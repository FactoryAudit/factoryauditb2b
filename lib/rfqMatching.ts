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
      reasons.push(`industry exact match (${industryCode}) +50`);
    }

    if (rfqCountry && cNorm === rfqCountry) {
      score += 25;
      reasons.push(`country match (${countryCode}) +25`);
    }

    if (rfqTokens.size > 0) {
      const productText = products.join(" ").toLowerCase();
      const hits = [...rfqTokens].filter((t) => productText.includes(t));
      if (hits.length > 0) {
        const pts = Math.min(15, 5 * hits.length);
        score += pts;
        reasons.push(`product keyword: ${hits.slice(0, 3).join(", ")} +${pts}`);
      }
    }

    const vLevel = row.verification_level == null ? null : String(row.verification_level);
    if (vLevel === "on_site_audit" || vLevel === "third_party_audit") {
      score += 10;
      reasons.push(`verified (${vLevel}) +10`);
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

// ============================================================================
// STEP 13 CHANGE SET D —— 匹配跟进（suggested → contacted → won / lost）
// ============================================================================
//
// 状态常量与流转表住在 lib/matchStatus.ts（纯模块，零依赖）—— 因为 Admin 的
// 跟进面板是 client component，而本文件 import 了 service_role 客户端。
// 这里只做 re-export，保证前后端**同一份**流转规则。

export {
  MATCH_STATUSES,
  MATCH_TRANSITIONS,
  isMatchStatus,
  type MatchStatus,
  type RfqMatchRow,
} from "./matchStatus";

import {
  isMatchStatus,
  MATCH_STATUSES,
  MATCH_TRANSITIONS,
  type MatchStatus,
  type RfqMatchRow,
} from "./matchStatus";

/** 读取某 RFQ 已确认的匹配（含供应商信息；两次查询，不做 N+1） */
export async function listRfqMatches(rfqId: string): Promise<RfqMatchRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data: ms, error } = await db
      .from("rfq_matches")
      .select("id, supplier_id, status, note, created_at")
      .eq("rfq_id", rfqId)
      .order("created_at", { ascending: true });
    if (error || !ms || ms.length === 0) return [];

    const rows = ms as Array<Record<string, unknown>>;
    const ids = rows.map((r) => String(r.supplier_id));
    const { data: sup } = await db
      .from("suppliers")
      .select("id, slug, legal_name, city, province, country_code, industry_code, verification_level, main_products")
      .in("id", ids);
    const byId = new Map(
      ((sup ?? []) as Array<Record<string, unknown>>).map((s) => [String(s.id), s])
    );

    return rows.map((r) => {
      const s = byId.get(String(r.supplier_id)) ?? {};
      return {
        matchId: String(r.id ?? ""),
        supplierId: String(r.supplier_id ?? ""),
        slug: String(s.slug ?? ""),
        legalName: String(s.legal_name ?? "(supplier not found)"),
        city: s.city == null ? null : String(s.city),
        province: s.province == null ? null : String(s.province),
        countryCode: s.country_code == null ? null : String(s.country_code),
        industryCode: s.industry_code == null ? null : String(s.industry_code),
        verificationLevel: s.verification_level == null ? null : String(s.verification_level),
        mainProducts: Array.isArray(s.main_products) ? (s.main_products as unknown[]).map(String) : [],
        status: String(r.status ?? ""),
        note: r.note == null ? null : String(r.note),
        createdAt: String(r.created_at ?? ""),
      };
    });
  } catch (e) {
    console.error("[rfqMatching] listRfqMatches exception", e);
    return [];
  }
}

export type UpdateMatchResult =
  | { ok: true; status: MatchStatus; changed: boolean }
  | { ok: false; error: "match_not_found" | "invalid_status" | "invalid_transition"; allowed?: readonly MatchStatus[] };

/**
 * 推进一条匹配的业务状态（真实写库 + 写审计日志）。
 * 幂等：目标状态 == 当前状态视为成功但不重复写审计。
 */
export async function updateMatchStatus(
  rfqId: string,
  supplierId: string,
  next: unknown,
  actorEmail: string
): Promise<UpdateMatchResult> {
  if (!isMatchStatus(next)) return { ok: false, error: "invalid_status", allowed: MATCH_STATUSES };

  const db = createAdminClient();
  if (!db) return { ok: false, error: "match_not_found" };

  const { data: cur, error: readErr } = await db
    .from("rfq_matches")
    .select("id, status")
    .eq("rfq_id", rfqId)
    .eq("supplier_id", supplierId)
    .maybeSingle();
  if (readErr || !cur) return { ok: false, error: "match_not_found" };

  const from = String((cur as Record<string, unknown>).status ?? "");
  if (from === next) return { ok: true, status: next, changed: false };
  if (!isMatchStatus(from) || !MATCH_TRANSITIONS[from].includes(next)) {
    return {
      ok: false,
      error: "invalid_transition",
      allowed: isMatchStatus(from) ? MATCH_TRANSITIONS[from] : [],
    };
  }

  const { error: upErr } = await db
    .from("rfq_matches")
    .update({ status: next })
    .eq("rfq_id", rfqId)
    .eq("supplier_id", supplierId);
  if (upErr) {
    console.error("[rfqMatching] updateMatchStatus failed", upErr.message);
    return { ok: false, error: "match_not_found" };
  }

  // 审计留痕：状态跃迁是业务动作，必须可追溯（spec §11 audit-friendly）
  await db.from("admin_audit_log").insert({
    actor_id: null,
    actor_email: actorEmail,
    action: "rfq_match.status_changed",
    target_type: "rfq_match",
    target_id: String((cur as Record<string, unknown>).id ?? ""),
    diff: { from, to: next, rfq_id: rfqId, supplier_id: supplierId },
  });

  return { ok: true, status: next, changed: true };
}
