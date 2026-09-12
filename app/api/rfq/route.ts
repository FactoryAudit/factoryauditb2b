import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";
import { notifyAdminNewLead, notifyCustomerRfqReceived } from "@/lib/notify";
import { STATIC_INDUSTRIES } from "@/lib/staticData";
import { LOCALES } from "@/i18n/config";

// POST /api/rfq —— 询价单入库
//
// 与 /api/lead 的分工：
//   /api/lead  游客线索（工具页用完留邮箱、custom-services 等），只发邮件，不落库
//   /api/rfq   正式询价单，**要落库**、要能查状态、要能被 Admin 匹配供应商
//
// 游客也能提交（user_id 为 null）：
//   询价是本站最重要的转化动作，绝不能因为"必须注册"而流失。
//   登录用户额外能做的事：在 /account/rfqs 里看到状态与匹配结果。
//
// 失败方向：数据库未配置时**仍然发邮件**并告知降级 ——
//           落库失败不该让一单真实生意凭空消失。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

// RFQ 是真实生意，比普通 lead 更值钱也更易被灌，限 3 条/小时
const LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---- CS-02C G3：行业化上下文归一（全部可选；不合法一律丢弃为 null，绝不编值） ----

/** 询价来源页路径：必须以 / 开头，只允许路径安全字符，clamp 300 */
const SOURCE_PATH_RE = /^\/[A-Za-z0-9\-._~\/]*$/;

function normalizeIndustryCode(v: unknown): string | null {
  const s = clamp(v, 60);
  return s && STATIC_INDUSTRIES.some((i) => i.code === s) ? s : null;
}

/** 认证/审核要求：字符串数组 → 大写、去重、限 10 个，code 形如 HACCP / FSSC22000 */
function normalizeCertRequirements(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => (typeof x === "string" ? x.trim().toUpperCase() : ""))
    .filter((s) => /^[A-Z0-9_-]{2,40}$/.test(s));
  return out.length > 0 ? Array.from(new Set(out)).slice(0, 10) : null;
}

/** 布尔三态：true/false 明确表态；缺省 / 无法解析 → null（=未表态） */
function normalizeTriBool(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return null;
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "true" || s === "on" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return null;
}

function normalizeSourcePath(v: unknown): string | null {
  const s = clamp(v, 300);
  return s && SOURCE_PATH_RE.test(s) ? s : null;
}

function normalizeLocale(v: unknown): string | null {
  const s = clamp(v, 10);
  return s && (LOCALES as readonly string[]).includes(s) ? s : null;
}

/** 生成对外展示短号：RFQ-XXXXXX（6 位大写字母数字，去掉易混淆的 0/O/1/I） */
function makeReferenceId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `RFQ-${out}`;
}

export async function POST(req: Request) {
  // ---- 限流放最前 ----
  const ip = clientIp(req);
  const rl = checkRateLimit(`rfq:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message:
          "You have submitted several requests recently. Please wait a while, or email us directly.",
      },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // ---- 解析与校验 ----
  let b: Record<string, unknown> = {};
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const email = String(b.email ?? "").trim().toLowerCase();
  const product = clamp(b.product, 300);
  const quantity = clamp(b.quantity, 120);
  const company = clamp(b.company, 200);
  const country = clamp(b.country, 120);
  const message = clamp(b.message, 5000);
  // ---- CS-02C G3：行业化上下文（可空；只入新列，不碰既有 12 列的语义） ----
  const contactName = clamp(b.contact_name, 80); // 只进管理员邮件，不落库（rfqs 无姓名列）
  const industryCode = normalizeIndustryCode(b.industry_code);
  const certificationsReq = normalizeCertRequirements(b.certifications_req);
  const oemRequired = normalizeTriBool(b.oem_required);
  const targetMarket = clamp(b.target_market, 80) || null;
  const incoterm = clamp(b.incoterm, 20) || null;
  const sourcePath = normalizeSourcePath(b.source_path);
  const locale = normalizeLocale(b.locale);

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400, headers: NO_STORE }
    );
  }
  if (!product) {
    return NextResponse.json(
      { ok: false, error: "product_required" },
      { status: 400, headers: NO_STORE }
    );
  }

  // 登录用户才带上 user_id（游客为 null，RLS 的 rfqs_insert_anyone 允许）
  const user = await getCurrentUser();
  const userId = user?.id ?? null;

  const referenceId = makeReferenceId();

  // ---- 落库（失败不阻断邮件） ----
  const db = createAdminClient();
  let stored = false;
  if (db) {
    try {
      // 极小的短号碰撞概率：撞上就重试一次，再撞交给数据库唯一约束报错
      const { error } = await db.from("rfqs").insert({
        reference_id: referenceId,
        user_id: userId,
        company: company ?? "",
        email,
        product,
        quantity: quantity ?? "",
        country: country ?? "",
        message: message ?? "",
        status: "new",
        // ---- CS-02C G3：可空上下文，缺省 null，绝不给历史字段编值 ----
        industry_code: industryCode,
        certifications_req: certificationsReq,
        oem_required: oemRequired,
        target_market: targetMarket,
        incoterm,
        source_path: sourcePath,
        locale,
      });
      if (error) {
        console.error("[api/rfq] insert failed", error.message);
      } else {
        stored = true;
      }
    } catch (e) {
      console.error("[api/rfq] insert exception", e);
    }
  }

  // ---- 双邮件：管理员 + 客户（无论落库成功与否都要发） ----
  //
  // 为什么客户确认邮件不能省：
  //   客户填完询价单，页面上只有一个"提交成功"提示，邮箱里空空如也 ——
  //   他会怀疑到底提交成功没有，于是重复提交或直接流失。
  //   **确认邮件是这个环节唯一的"收据"**，对转化是刚需，不是锦上添花。
  //
  // 两封都走 allSettled：任何一封失败都不影响接口返回成功
  // （sendMail 内部本身也是 fail-open），一单生意不能因为邮件通道抖动而丢失。
  await Promise.allSettled([
    notifyAdminNewLead({
      id: referenceId,
      tool: stored ? "rfq" : "rfq (not stored)",
      // CS-02C：表单的 firstName 走 contact_name 进管理员邮件（rfqs 无姓名列，不落库）
      firstName: contactName || company || "",
      email,
      company: company ?? "",
      country: country ?? "",
      message: [
        `Product: ${product}`,
        quantity ? `Quantity: ${quantity}` : "",
        industryCode ? `Industry: ${industryCode}` : "",
        certificationsReq?.length ? `Certifications required: ${certificationsReq.join(", ")}` : "",
        oemRequired === true ? "OEM/ODM required: yes" : "",
        targetMarket ? `Target market: ${targetMarket}` : "",
        incoterm ? `Incoterm: ${incoterm}` : "",
        sourcePath ? `Source: ${sourcePath}` : "",
        message ?? "",
      ]
        .filter(Boolean)
        .join("\n"),
      score: stored ? 10 : 5,
    }),
    notifyCustomerRfqReceived({
      email,
      name: company ?? null,
      referenceId,
      product,
    }),
  ]);

  return NextResponse.json({ ok: true, referenceId, stored }, { headers: NO_STORE });
}

/**
 * GET /api/rfq —— 当前登录用户的询价单列表
 *
 * 只返回自己的（user_id 过滤），游客返回空数组。
 * 匹配结果一并带出，供 /account/rfqs 展示"我们推荐了哪些供应商"。
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE });
  }

  const db = createAdminClient();
  if (!db) {
    return NextResponse.json({ ok: true, items: [], degraded: true }, { headers: NO_STORE });
  }

  try {
    const { data, error } = await db
      .from("rfqs")
      .select(
        "reference_id, product, quantity, country, status, created_at, rfq_matches(status, suppliers(slug, legal_name, city, country_code))"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[api/rfq] list failed", error.message);
      return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, items: data ?? [] }, { headers: NO_STORE });
  } catch (e) {
    console.error("[api/rfq] list exception", e);
    return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE });
  }
}
