// lib/adminBusiness.ts —— STEP 13：Admin 业务激活层（完整度视图 + 漏斗统计）
//
// 归属边界：
//   - 只做**后台运营视图**需要的读取与聚合，**不碰**前台查询（lib/queries.ts）。
//   - 完整度判定一律复用 lib/supplierCompleteness.ts，不在这里另立口径。
//   - 测试数据识别集中在这里（isTest*），漏斗统计才能把探针剔干净。
//
// 所有函数都是 fail-open：库不可用返回空数组 / 零值，后台不崩（既有哲学）。

import { createAdminClient } from "./supabaseAdmin";
import { supplierCompleteness, type SupplierCompleteness } from "./supplierCompleteness";

export type SupplierActivationRow = {
  id: string;
  slug: string;
  legalName: string;
  displayName: string | null;
  englishName: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  industryCode: string | null;
  mainProducts: string[];
  verificationLevel: string | null;
  verificationStatus: string | null;
  consentVersion: string | null;
  hasConsentRecord: boolean;
  profileAuthorized: boolean | null;
  isPublished: boolean;
  completeness: SupplierCompleteness;
};

export type LeadActivationRow = {
  id: string;
  referenceId: string;
  kind: string;
  status: string;
  company: string | null;
  supplierName: string | null;
  country: string | null;
  email: string;
  createdAt: string;
  /** 按公司名匹配到的草稿供应商（无外键，只能名称匹配） */
  supplier: SupplierActivationRow | null;
  isTest: boolean;
};

// ---------- 测试数据识别 ----------
//
// 🔴 这些行是历史验收脚本自己写进生产的（STEP 05/07/08/12 的探针），
//    不是真实买家 / 供应商。漏斗一旦把它们算进去，"真实 RFQ 数"就是假的。
//    识别规则集中在此，任何统计都必须先过一遍。

const TEST_EMAIL_HOSTS = new Set(["example.com", "example.invalid", "invalid", "test"]);
const TEST_TEXT_PATTERNS = [
  /probe/i,
  /^cs-?\d{2}[a-z]?\b/i, // CS-02A / CS02D …
  /step\d{2}\b/i, // STEP12 …
  /请忽略/,
  /测试/,
  /smoke test/i,
  /live verification/i,
  /automated verify/i,
];

/** 邮箱域名或本地部分带明显测试标记 */
function isTestEmail(v: unknown): boolean {
  const s = String(v ?? "").toLowerCase();
  if (!s) return false;
  const host = s.split("@")[1] ?? "";
  if (TEST_EMAIL_HOSTS.has(host)) return true;
  return TEST_TEXT_PATTERNS.some((re) => re.test(s));
}

function isTestText(...vals: unknown[]): boolean {
  return vals.some((v) => {
    const s = String(v ?? "");
    return s.length > 0 && TEST_TEXT_PATTERNS.some((re) => re.test(s));
  });
}

export function isTestSupplier(row: Record<string, unknown>): boolean {
  return isTestText(row.slug, row.legalName) || isTestEmail(row.contactEmail);
}

/**
 * RFQ 是否为测试探针。
 *
 * 🔴 2026-09-21 实测纠正：RFQ-CXJCRL（Titanium dioxide / chemicals / 20MT）
 *    content 看起来完全像真实采购需求，STEP 11/12 因此判定它是"唯一真实 RFQ"，
 *    STEP 07B 还把它置为 is_public=true 放上了首页 Live Buyer Requests。
 *    但它的 email=cs02b.smoke@example.com、company="CS-02B Test Co"
 *    ⇒ **它是 CS-02B 冒烟测试探针**。判据必须看 email/company，不能只看 product 文案。
 */
export function isTestRfq(row: Record<string, unknown>): boolean {
  return isTestText(row.product, row.referenceId, row.company) || isTestEmail(row.email);
}

export function isTestLead(row: Record<string, unknown>): boolean {
  return isTestText(row.company, row.supplierName) || isTestEmail(row.email);
}

// ---------- 读取 ----------

/**
 * 供应商激活视图：一次查询取回完整度所需的全部字段（**不 N+1**）。
 * consent 用 supplier_consents 是否存在判断（service_role 可读全表）。
 */
export async function listSupplierActivation(): Promise<SupplierActivationRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const [{ data, error }, consents] = await Promise.all([
      db
        .from("suppliers")
        .select(
          "id, slug, legal_name, display_name, english_name, country_code, province, city, industry_code, main_products, verification_level, verification_status, consent_version, profile_authorized, is_published, contact_email"
        )
        .order("created_at", { ascending: true })
        .limit(500),
      db.from("supplier_consents").select("supplier_id").limit(2000),
    ]);
    if (error) {
      console.error("[adminBusiness] list suppliers failed", error?.message);
      return [];
    }
    const withConsent = new Set(
      ((consents.data ?? []) as Array<{ supplier_id: string }>).map((r) => String(r.supplier_id))
    );
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const id = String(r.id ?? "");
      const base = {
        id,
        slug: String(r.slug ?? ""),
        legalName: String(r.legal_name ?? ""),
        displayName: r.display_name == null ? null : String(r.display_name),
        englishName: r.english_name == null ? null : String(r.english_name),
        countryCode: r.country_code == null ? null : String(r.country_code),
        province: r.province == null ? null : String(r.province),
        city: r.city == null ? null : String(r.city),
        industryCode: r.industry_code == null ? null : String(r.industry_code),
        mainProducts: Array.isArray(r.main_products) ? (r.main_products as unknown[]).map(String) : [],
        verificationLevel: r.verification_level == null ? null : String(r.verification_level),
        verificationStatus: r.verification_status == null ? null : String(r.verification_status),
        consentVersion: r.consent_version == null ? null : String(r.consent_version),
        hasConsentRecord: withConsent.has(id),
        profileAuthorized: r.profile_authorized == null ? null : Boolean(r.profile_authorized),
        isPublished: Boolean(r.is_published),
      };
      return { ...base, completeness: supplierCompleteness({ ...base, isPublished: base.isPublished }) };
    });
  } catch (e) {
    console.error("[adminBusiness] list suppliers exception", e);
    return [];
  }
}

/** 名称归一：用于 lead ↔ supplier 的弱关联（两表之间**没有外键**，只能按名称匹配） */
function normName(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[.,，。、（）()\-_/&'"”"「」【】]/g, "");
}

/**
 * Lead 激活视图：把 supplier_application 与它的草稿供应商关联起来，
 * 让 Admin 在一页内看到「公司 → 草稿 → 完整度 → 能不能发布」。
 *
 * 关联方式：**仅名称匹配**，命中不了就 supplier=null（诚实显示"未关联"），
 * 绝不猜、绝不自动创建关联。
 */
export async function listLeadActivation(limit = 200): Promise<LeadActivationRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const [{ data, error }, suppliers] = await Promise.all([
      db
        .from("leads")
        .select("id, reference_id, kind, status, company, supplier_name, country, email, created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
      listSupplierActivation(),
    ]);
    if (error) {
      console.error("[adminBusiness] list leads failed", error?.message);
      return [];
    }
    const byName = new Map<string, SupplierActivationRow>();
    for (const s of suppliers) {
      for (const n of [s.legalName, s.displayName, s.englishName]) {
        const k = normName(n);
        if (k) byName.set(k, s);
      }
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const company = r.company == null ? null : String(r.company);
      const supplierName = r.supplier_name == null ? null : String(r.supplier_name);
      const supplier = byName.get(normName(supplierName)) ?? byName.get(normName(company)) ?? null;
      return {
        id: String(r.id ?? ""),
        referenceId: String(r.reference_id ?? ""),
        kind: String(r.kind ?? ""),
        status: String(r.status ?? ""),
        company,
        supplierName,
        country: r.country == null ? null : String(r.country),
        email: String(r.email ?? ""),
        createdAt: String(r.created_at ?? ""),
        supplier,
        isTest: isTestLead({ company, supplierName, email: r.email }),
      };
    });
  } catch (e) {
    console.error("[adminBusiness] list leads exception", e);
    return [];
  }
}

// ---------- 业务漏斗（CHANGE SET E） ----------

export type BusinessFunnel = {
  rfq: { total: number; real: number; test: number; publicCount: number };
  matching: {
    rfqsMatched: number;
    matches: number;
    suggested: number;
    contacted: number;
    won: number;
    lost: number;
    /** 只统计**真实 RFQ** 产生的匹配 —— 测试 RFQ 上的机制验证不计入业务漏斗 */
    realRfqsMatched: number;
    realMatches: number;
    realSuggested: number;
    realContacted: number;
    realWon: number;
    realLost: number;
    /** 曾离开 suggested 的匹配数（contacted + won + lost）—— 漏斗里"已推进"的真实口径 */
    realAdvanced: number;
  };
  supplier: {
    total: number;
    published: number;
    draft: number;
    needsReview: number;
    rejected: number;
    publishable: number;
  };
  leads: { real: number; reviewed: number; rejected: number; newCount: number };
};

/** 后台漏斗：只统计**真实**业务数据，测试探针一律剔除。 */
export async function getBusinessFunnel(): Promise<BusinessFunnel> {
  const db = createAdminClient();
  const empty: BusinessFunnel = {
    rfq: { total: 0, real: 0, test: 0, publicCount: 0 },
    matching: {
      rfqsMatched: 0,
      matches: 0,
      suggested: 0,
      contacted: 0,
      won: 0,
      lost: 0,
      realRfqsMatched: 0,
      realMatches: 0,
      realSuggested: 0,
      realContacted: 0,
      realWon: 0,
      realLost: 0,
      realAdvanced: 0,
    },
    supplier: { total: 0, published: 0, draft: 0, needsReview: 0, rejected: 0, publishable: 0 },
    leads: { real: 0, reviewed: 0, rejected: 0, newCount: 0 },
  };
  if (!db) return empty;

  try {
    const [rfqs, matches, suppliers, leads] = await Promise.all([
      db.from("rfqs").select("id, reference_id, product, email, company, is_public").limit(1000),
      db.from("rfq_matches").select("rfq_id, status").limit(5000),
      listSupplierActivation(),
      db.from("leads").select("kind, status, company, supplier_name, email").limit(1000),
    ]);

    const rfqRows = (rfqs.data ?? []) as Array<Record<string, unknown>>;
    const realRfqs = rfqRows.filter(
      (r) =>
        !isTestRfq({
          referenceId: r.reference_id,
          product: r.product,
          company: r.company,
          email: r.email,
        })
    );
    const realRfqIds = new Set(realRfqs.map((r) => String(r.id ?? "")));

    const matchRows = (matches.data ?? []) as Array<{ rfq_id: string; status: string }>;
    const count = (s: string) => matchRows.filter((m) => m.status === s).length;

    // 真实业务口径：只算挂在**真实 RFQ** 上的匹配行。
    // 机制验证（在测试 RFQ 上跑通 suggested→contacted）不计入业务漏斗，
    // 否则后台会虚报"已联系供应商"。
    const realMatchRows = matchRows.filter((m) => realRfqIds.has(String(m.rfq_id)));
    const realCount = (s: string) => realMatchRows.filter((m) => m.status === s).length;

    const realSuppliers = suppliers.filter((s) => !isTestSupplier({ slug: s.slug, legalName: s.legalName }));

    const leadRows = (leads.data ?? []) as Array<Record<string, unknown>>;
    const appLeads = leadRows.filter((l) => String(l.kind) === "supplier_application");
    const realAppLeads = appLeads.filter(
      (l) => !isTestLead({ company: l.company, supplierName: l.supplier_name, email: l.email })
    );

    return {
      rfq: {
        total: rfqRows.length,
        real: realRfqs.length,
        test: rfqRows.length - realRfqs.length,
        publicCount: rfqRows.filter((r) => Boolean(r.is_public)).length,
      },
      matching: {
        rfqsMatched: new Set(matchRows.map((m) => m.rfq_id)).size,
        matches: matchRows.length,
        suggested: count("suggested"),
        contacted: count("contacted"),
        won: count("won"),
        lost: count("lost"),
        realRfqsMatched: new Set(realMatchRows.map((m) => m.rfq_id)).size,
        realMatches: realMatchRows.length,
        realSuggested: realCount("suggested"),
        realContacted: realCount("contacted"),
        realWon: realCount("won"),
        realLost: realCount("lost"),
        realAdvanced: realMatchRows.filter((m) => m.status !== "suggested").length,
      },
      supplier: {
        total: realSuppliers.length,
        published: realSuppliers.filter((s) => s.isPublished).length,
        draft: realSuppliers.filter((s) => !s.isPublished && !s.completeness.rejected).length,
        // 需要人工复核：资料已齐、可发布但仍躺在草稿状态
        needsReview: realSuppliers.filter((s) => !s.isPublished && s.completeness.publishable).length,
        rejected: realSuppliers.filter((s) => s.completeness.rejected).length,
        publishable: realSuppliers.filter((s) => s.completeness.publishable).length,
      },
      leads: {
        real: realAppLeads.length,
        reviewed: realAppLeads.filter((l) => String(l.status) !== "new").length,
        rejected: realAppLeads.filter((l) => String(l.status) === "rejected").length,
        newCount: realAppLeads.filter((l) => String(l.status) === "new").length,
      },
    };
  } catch (e) {
    console.error("[adminBusiness] funnel exception", e);
    return empty;
  }
}
