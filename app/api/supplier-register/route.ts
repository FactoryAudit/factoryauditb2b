import { NextRequest, NextResponse } from "next/server";
import { notifyAdminSupplierRegistration, notifyAdminCertificationRequest, notifySupplierReceived } from "@/lib/notify";
import { insertLead } from "@/lib/leads";
import { leadScore } from "@/lib/leadScore";
import { CERTIFICATION_REQUEST_FIELDS, CERTIFICATION_REQUEST_KIND } from "@/lib/supplierNetwork";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { slugify } from "@/lib/supplierCreate";

// Supplier Network V1.0：供应商免费入驻表单统一入口。
//
// CS-02D：本路由**落库**（public.leads，kind=supplier_application）。
//   此前只发邮件、一行不落库 —— 供应商提交了申请，后台一条记录都查不到。
//   现在与 /api/lead 共用 lib/leads.ts 的唯一写入通道，短号 LEAD-XXXXXX 给供应商回执。
//
// 落库失败不阻断邮件、不阻断成功响应（理由同 /api/lead）。
//
// 人工审核流程不变：审核 → 定 Evidence Level / Status / Risk Score → 通过后录入发布。
// 与 /api/lead 的关系：独立路由（字段差异大），限流与邮件通道复用。
// CS-08：同一路由按 body.kind 分流 —— 入驻申请（默认）／认证辅导需求（certification_request）。

const REG_LIMIT = 5; // 同 IP 每小时最多 5 次（入驻申请与认证需求共用额度）
const REG_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 字段长度上限（防超长输入撑爆邮件正文）。
// ⚠️ `new Set<string>([...])` 必须显式标注泛型，否则推断成字面量联合类型导致 .has(string) 报 TS2345。
const LONG_TEXT_FIELDS = new Set<string>(["message", "certificates", "certificatesJson"]);
const MEDIUM_TEXT_FIELDS = new Set<string>(["certHelpWanted", "certHelpNote"]);

function maxFieldLength(key: string): number {
  if (LONG_TEXT_FIELDS.has(key)) return 5000;
  if (MEDIUM_TEXT_FIELDS.has(key)) return 500;
  if (key.includes("Address")) return 500;
  return 300;
}

// =============================================================================
// CS-16F：注册成功后落库供应商草稿 + 授权留痕
//   三个写入均走 service_role（BYPASSRLS），且不阻断成功响应（失败仅记录日志）。
//   IP/UA 服务端取，绝不信任客户端提交。
// =============================================================================
const SUPPLIER_CONSENT_VERSION = "1.0";

function parseList(s: string | undefined, max = 100): string[] {
  if (!s) return [];
  return s
    .split(/[,\n，、;；]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

function toIntInRange(s: string | undefined, lo: number, hi: number): number | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const t = Math.trunc(n);
  if (t < lo || t > hi) return null;
  return t;
}

// factoryCountry 是自由文本，归一化为 coverage country code；无法识别降级 "unknown"（草稿未发布，admin 发布前会修正）。
async function resolveCountryCode(raw: string | undefined): Promise<string> {
  const v = (raw || "").trim();
  if (!v) return "unknown";
  const lower = v.toLowerCase();
  const hit = COVERAGE_COUNTRIES.find(
    (c) => c.code === lower || c.name.toLowerCase() === lower
  );
  if (hit) return hit.code;
  return slugify(v) || "unknown";
}

// 生成不重复的 slug（slug 唯一约束兜底）：base → base-2 → ... → base-<time36>
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "supplier";
  const db = createAdminClient();
  if (!db) return root;
  for (let i = 0; i < 5; i++) {
    const cand = i === 0 ? root : `${root}-${i}`;
    const { data } = await db.from("suppliers").select("slug").eq("slug", cand).maybeSingle();
    if (!data) return cand;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function parseCertsJson(s: string | undefined): unknown[] | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

type DraftInput = {
  companyName: string;
  englishName?: string;
  companyType?: string;
  registrationNumber?: string;
  website?: string;
  factoryCountry?: string;
  factoryCity?: string;
  factoryAddress?: string;
  employees?: string;
  factorySize?: string;
  establishedYear?: string;
  mainProducts?: string;
  productionCapacity?: string;
  monthlyOutput?: string;
  exportMarkets?: string;
  exportSince?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactVisibility?: string;
  certificatesJson?: string;
  consentGiven: boolean;
  ip: string;
  ua: string | null;
};

/**
 * 创建 suppliers 草稿行 + 写 supplier_consents + 写 admin_audit_log(consent_submitted)。
 * 任一写入失败仅记录日志，不抛出（不阻断注册成功响应）。
 * 返回 { id, slug } 或 null。
 */
async function createSupplierDraft(input: DraftInput): Promise<{ id: string; slug: string } | null> {
  const db = createAdminClient();
  if (!db) return null;

  const slug = await uniqueSlug(input.companyName);
  const legalName = clamp(input.companyName, 200) ?? "";
  const city = clamp(input.factoryCity, 120) || "unknown";
  if (!legalName) return null;

  const websiteRaw = clamp(input.website, 400);
  const website = websiteRaw && /^https?:\/\/.+/i.test(websiteRaw) ? websiteRaw : null;
  const emailRaw = (input.contactEmail || "").toLowerCase();
  const contactEmail = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
  const consentGiven = input.consentGiven;
  const visibility = ["public", "platform", "private"].includes(input.contactVisibility || "")
    ? input.contactVisibility
    : null;
  const certs = parseCertsJson(input.certificatesJson);

  const row = {
    slug,
    legal_name: legalName,
    country_code: await resolveCountryCode(input.factoryCountry),
    city,
    english_name: clamp(input.englishName, 200),
    company_type: clamp(input.companyType, 120),
    registration_number: clamp(input.registrationNumber, 120),
    website,
    address: clamp(input.factoryAddress, 400),
    employees: clamp(input.employees, 64),
    factory_size: clamp(input.factorySize, 64),
    production_capacity: clamp(input.productionCapacity, 200),
    monthly_output: clamp(input.monthlyOutput, 200),
    established: toIntInRange(input.establishedYear, 1800, 2100),
    export_since: toIntInRange(input.exportSince, 1800, 2100),
    main_products: parseList(input.mainProducts),
    export_markets: parseList(input.exportMarkets),
    contact_person: clamp(input.contactName, 120),
    contact_email: contactEmail,
    phone: clamp(input.contactPhone, 64),
    whatsapp: clamp(input.contactWhatsapp, 64),
    contact_visibility: visibility,
    self_reported_certificates: certs,
    is_published: false,
    profile_authorized: consentGiven,
    consent_version: SUPPLIER_CONSENT_VERSION,
    consent_ip: input.ip,
    consent_user_agent: input.ua,
    verification_level: "unverified",
    access_tier: "public",
    inspection_history: 0,
  };

  const { data, error } = await db.from("suppliers").insert(row).select("id").maybeSingle();
  if (error || !data) {
    console.error("[api/supplier-register] draft insert failed", error?.message ?? "no data");
    return null;
  }
  const supplierId = (data as { id: string }).id;

  const { error: cErr } = await db.from("supplier_consents").insert({
    supplier_id: supplierId,
    consent_type: "supplier_profile",
    consent_version: SUPPLIER_CONSENT_VERSION,
    consent_given: consentGiven,
    consent_timestamp: new Date().toISOString(),
    ip_address: input.ip,
    user_agent: input.ua,
  });
  if (cErr) console.error("[api/supplier-register] consent insert failed", cErr.message);

  const { error: aErr } = await db.from("admin_audit_log").insert({
    actor_id: null,
    actor_email: contactEmail,
    action: "consent_submitted",
    target_type: "supplier",
    target_id: supplierId,
    diff: { consent_version: SUPPLIER_CONSENT_VERSION, consent_given: consentGiven },
    ip_address: input.ip,
    notes: "supplier registration consent",
  });
  if (aErr) console.error("[api/supplier-register] audit insert failed", aErr.message);

  return { id: supplierId, slug };
}

// 白名单校验：只保留已声明字段，防止任意键注入邮件正文
const KNOWN_FIELDS = [
  "companyName",
  "englishName",
  "companyType",
  "registrationNumber",
  "establishedYear",
  "website",
  "factoryCountry",
  "factoryCity",
  "factoryAddress",
  "employees",
  "factorySize",
  "mainProducts",
  "productionCapacity",
  "monthlyOutput",
  "exportMarkets",
  "exportSince",
  "certificates",
  "certificatesJson",
  "contactName",
  "contactEmail",
  "contactPhone",
  "contactWhatsapp",
  "auditAvailability",
  "inspectionAvailability",
  "authorizeCompanyProfile",
  "contactVisibility",
  "message",
] as const;

export async function POST(req: NextRequest) {
  try {
    // 限流放最前（不解析 body、不发信）
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-register:${ip}`, REG_LIMIT, REG_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message:
            "You have submitted several applications recently. Please wait a while, or email us directly.",
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const kind = String(body?.kind || "");
    const raw = body?.fields ?? {};

    // —— 分支 A：认证辅导需求（入驻表「我要获得证书」）——
    // 只发管理员邮件，不落库、不给供应商回执、不产生任何信任状态副作用。
    if (kind === CERTIFICATION_REQUEST_KIND) {
      const cr: Record<string, string> = {};
      for (const key of CERTIFICATION_REQUEST_FIELDS) {
        const rawVal = raw[key];
        if (rawVal === undefined || rawVal === null) continue;
        const v = String(rawVal).trim().slice(0, maxFieldLength(key));
        if (v) cr[key] = v;
      }

      const wanted = String(cr.certHelpWanted || "");
      if (!wanted) {
        return NextResponse.json({ ok: false, error: "certification required" }, { status: 400 });
      }
      const helpEmail = String(cr.certHelpContactEmail || "").toLowerCase();
      if (!helpEmail) {
        return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
      }
      if (helpEmail.length > 254 || !EMAIL_RE.test(helpEmail)) {
        return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
      }

      const requestId = crypto.randomUUID();

      // 落库（kind=supplier_application：供应商主动提出的认证辅导需求）
      const saved = await insertLead({
        kind: "supplier_application",
        tool: "certification-request",
        email: helpEmail,
        firstName: cr.certHelpContactName || null,
        company: cr.certHelpCompany || null,
        sourcing: cr.certHelpWanted || null,
        message: cr.certHelpNote || null,
        score: leadScore({ email: helpEmail, company: cr.certHelpCompany, sourcing: cr.certHelpWanted, message: cr.certHelpNote }),
        payload: { kind: CERTIFICATION_REQUEST_KIND, fields: cr },
      });
      if (!saved.stored) console.error("[api/supplier-register] cert request not stored", saved.reason, saved.message ?? "");

      await Promise.allSettled([
        notifyAdminCertificationRequest({ id: saved.stored ? saved.referenceId : requestId, fields: cr }),
      ]);
      return NextResponse.json({
        ok: true,
        requestId,
        referenceId: saved.stored ? saved.referenceId : null,
        stored: saved.stored,
      });
    }

    // —— 分支 B：供应商入驻申请（默认）——
    const f: Record<string, string> = {};
    for (const key of KNOWN_FIELDS) {
      const rawVal = raw[key];
      if (rawVal === undefined || rawVal === null) continue;
      const v = String(rawVal).trim().slice(0, maxFieldLength(key));
      if (v) f[key] = v;
    }

    // 必填校验
    const email = String(f.contactEmail || "").toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    if (!f.companyName) {
      return NextResponse.json({ ok: false, error: "company name required" }, { status: 400 });
    }
    if (f.authorizeCompanyProfile !== "yes" && f.authorizeCompanyProfile !== "no") {
      return NextResponse.json({ ok: false, error: "authorization required" }, { status: 400 });
    }

    // CS-16F：服务端取 UA（IP 已在限流处取过）。落库草稿 + 授权留痕（best-effort，不阻断成功响应）。
    const ua = req.headers.get("user-agent") || null;
    const draft = await createSupplierDraft({
      companyName: f.companyName,
      englishName: f.englishName,
      companyType: f.companyType,
      registrationNumber: f.registrationNumber,
      website: f.website,
      factoryCountry: f.factoryCountry,
      factoryCity: f.factoryCity,
      factoryAddress: f.factoryAddress,
      employees: f.employees,
      factorySize: f.factorySize,
      establishedYear: f.establishedYear,
      mainProducts: f.mainProducts,
      productionCapacity: f.productionCapacity,
      monthlyOutput: f.monthlyOutput,
      exportMarkets: f.exportMarkets,
      exportSince: f.exportSince,
      contactName: f.contactName,
      contactEmail: f.contactEmail,
      contactPhone: f.contactPhone,
      contactWhatsapp: f.contactWhatsapp,
      contactVisibility: f.contactVisibility,
      certificatesJson: f.certificatesJson,
      consentGiven: f.authorizeCompanyProfile === "yes",
      ip,
      ua,
    });
    if (draft) {
      console.log(`[api/supplier-register] draft created slug=${draft.slug} id=${draft.id}`);
    }

    const id = crypto.randomUUID();

    // 落库（kind=supplier_application）。payload 存白名单后的全量字段，
    // 以后表单加字段即使列没跟上，原始值也一定在 payload 里。
    const saved = await insertLead({
      kind: "supplier_application",
      tool: "supplier-register",
      email,
      firstName: f.contactName || null,
      company: f.companyName || null,
      country: f.factoryCountry || null,
      phone: f.contactPhone || f.contactWhatsapp || null,
      sourcing: f.mainProducts || null,
      supplierName: f.companyName || null,
      supplierWebsite: f.website || null,
      message: f.message || null,
      score: leadScore({
        email,
        company: f.companyName,
        supplierWebsite: f.website,
        sourcing: f.mainProducts,
        message: f.message,
        tool: "supplier-register",
      }),
      payload: f,
    });
    if (!saved.stored) console.error("[api/supplier-register] not stored", saved.reason, saved.message ?? "");
    const referenceId = saved.stored ? saved.referenceId : null;

    // 双邮件（通道未配置时降级为日志，不阻塞）
    // 供应商回执里显示短号而不是 UUID —— 他可以直接拿这个号来问进度。
    await Promise.allSettled([
      notifyAdminSupplierRegistration({ id: referenceId ?? id, fields: f }),
      notifySupplierReceived({ email, companyName: f.companyName, id: referenceId ?? id }),
    ]);

    return NextResponse.json({
      ok: true,
      supplierId: id,
      referenceId,
      stored: saved.stored,
      draftSlug: draft?.slug ?? null,
      draftId: draft?.id ?? null,
    });
  } catch (e) {
    console.error("supplier register failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
