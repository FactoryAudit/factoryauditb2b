// lib/rfqMatching.ts —— STEP 12 CHANGE SET D：RFQ → 推荐供应商（第一版**确定性**匹配）
//
// 设计原则（spec §D）：
//   1. 不做 AI 匹配 —— 只做确定性的规则打分，结果可解释、可复现。
//   2. 只推荐**已发布**供应商（is_published=true）。
//   3. 不推荐 incomplete 供应商（既无 industry 又无产品 ⇒ 没有任何匹配依据）。
//   4. 不推荐 country=unknown / 空的供应商。
//   5. 不推荐测试/占位记录（脏 slug 黑名单）。
//   6. **绝不**自动改 suppliers.cluster_slug。
//   7. 第一版只做「Admin 可查看推荐 + 手动确认匹配」，不自动发给供应商。

import { createAdminClient } from "./supabaseAdmin";

/** 脏数据 / 占位 slug 黑名单：永不参与推荐（且不允许删除，只隔离） */
const DIRTY_SLUGS = new Set(["supplier"]);

/** 国家别名归一：RFQ 的 country 是自由文本，供应商是 country_code */
const COUNTRY_ALIAS: Record<string, string> = {
  cn: "china",
  china: "china",
  prc: "china",
  vn: "vietnam",
  vietnam: "vietnam",
  th: "thailand",
  thailand: "thailand",
  id: "indonesia",
  indonesia: "indonesia",
  in: "india",
  india: "india",
  bd: "bangladesh",
  bangladesh: "bangladesh",
  pk: "pakistan",
  pakistan: "pakistan",
};

function normCountry(v: unknown): string {
  const s = String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return "";
  return COUNTRY_ALIAS[s] ?? s;
}

/** 只保留有信息量的词（≥3 字符，去掉纯数字） */
function tokens(v: unknown): string[] {
  return String(v ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

export type RfqLike = {
  id: string;
  referenceId?: string;
  industryCode?: string | null;
  country?: string | null;
  product?: string | null;
  clusterSlug?: string | null;
};

export type RfqRecommendation = {
  supplierId: string;
  slug: string;
  legalName: string;
  city: string | null;
  province: string | null;
  countryCode: string | null;
  industryCode: string | null;
  verificationLevel: string | null;
  mainProducts: string[];
  score: number;
  reasons: string[];
};

/**
 * 为一个 RFQ 计算推荐供应商。
 * 返回按分数降序的列表；**没有任何命中依据的供应商不会被推荐**。
 */
export async function recommendSuppliersForRfq(
  rfq: RfqLike,
  limit = 10
): Promise<RfqRecommendation[]> {
  const db = createAdminClient();
  if (!db) return [];

  const { data, error } = await db
    .from("suppliers")
    .select(
      "id, slug, legal_name, city, province, country_code, industry_code, verification_level, main_products, is_published"
    )
    .eq("is_published", true);

  if (error || !data) {
    console.error("[rfqMatching] load suppliers failed", error?.message);
    return [];
  }

  const rfqIndustry = String(rfq.industryCode ?? "").trim().toLowerCase();
  const rfqCountry = normCountry(rfq.country);
  const rfqTokens = new Set(tokens(rfq.product));

  const out: RfqRecommendation[] = [];

  for (const row of data as Array<Record<string, unknown>>) {
    const slug = String(row.slug ?? "");
    // ---- 硬过滤 ----
    if (DIRTY_SLUGS.has(slug)) continue; // 脏数据/占位
    const countryCode = row.country_code == null ? null : String(row.country_code);
    const cNorm = normCountry(countryCode);
    if (!cNorm || cNorm === "unknown") continue; // 国家未知 ⇒ 不推荐
    const products = Array.isArray(row.main_products)
      ? (row.main_products as unknown[]).map(String)
      : [];
    const industryCode = row.industry_code == null ? null : String(row.industry_code);
    if (!industryCode && products.length === 0) continue; // incomplete：无任何匹配依据

    // ---- 打分 ----
    let score = 0;
    const reasons: string[] = [];

    if (rfqIndustry && industryCode && industryCode.toLowerCase() === rfqIndustry) {
      score += 50;
      reasons.push(`industry exact match (${industryCode})`);
    }

    if (rfqCountry && cNorm === rfqCountry) {
      score += 25;
      reasons.push(`country match (${countryCode})`);
    }

    if (rfqTokens.size > 0) {
      const productText = products.join(" ").toLowerCase();
      const hits = [...rfqTokens].filter((t) => productText.includes(t));
      if (hits.length > 0) {
        score += Math.min(15, 5 * hits.length);
        reasons.push(`product keyword: ${hits.slice(0, 3).join(", ")}`);
      }
    }

    const vLevel = row.verification_level == null ? null : String(row.verification_level);
    if (vLevel === "on_site_audit" || vLevel === "third_party_audit") {
      score += 10;
      reasons.push(`verified (${vLevel})`);
    }

    if (score <= 0) continue; // 没有任何命中依据 ⇒ 不推荐

    out.push({
      supplierId: String(row.id ?? ""),
      slug,
      legalName: String(row.legal_name ?? slug),
      city: row.city == null ? null : String(row.city),
      province: row.province == null ? null : String(row.province),
      countryCode,
      industryCode,
      verificationLevel: vLevel,
      mainProducts: products,
      score,
      reasons,
    });
  }

  out.sort((a, b) => b.score - a.score || a.legalName.localeCompare(b.legalName));
  return out.slice(0, Math.max(1, Math.min(limit, 20)));
}

/** Admin 手动确认匹配：写入 rfq_matches（幂等：同 rfq+supplier 已存在则跳过） */
export async function confirmRfqMatches(
  rfqId: string,
  supplierIds: string[],
  actorEmail: string
): Promise<{ inserted: number; skipped: number }> {
  const db = createAdminClient();
  if (!db) return { inserted: 0, skipped: 0 };

  const { data: existing } = await db
    .from("rfq_matches")
    .select("supplier_id")
    .eq("rfq_id", rfqId);
  const have = new Set((existing ?? []).map((r) => String(r.supplier_id)));

  let inserted = 0;
  let skipped = 0;
  for (const sid of supplierIds) {
    if (have.has(sid)) {
      skipped++;
      continue;
    }
    // ⚠️ status 受 rfq_matches_status_check 约束，只允许：
    //    suggested（Admin 已确认推荐，尚未联系）→ contacted → won / lost
    //    （曾用 'matched' 会直接违反 CHECK 被拒 —— 以库内约束为准，不靠记忆写值）
    const { error } = await db.from("rfq_matches").insert({
      rfq_id: rfqId,
      supplier_id: sid,
      status: "suggested",
      note: `STEP12 admin-confirmed match by ${actorEmail}`,
    });
    if (error) {
      console.error("[rfqMatching] confirm failed", error.message);
      skipped++;
    } else {
      inserted++;
    }
  }
  return { inserted, skipped };
}
