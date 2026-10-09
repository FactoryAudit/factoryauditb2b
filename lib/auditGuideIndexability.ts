// lib/auditGuideIndexability.ts —— audit-guide 组合的可索引判定（单一真源）
//
// 背景（2026-10-09 全站 SEO 诊断）：
//   /audit-guide/<国家>/<标准> 共 5 国 × 7 标准 × 9 语言 = 315 条 URL。
//   实测：仅 3 个组合挂有供应商档案；其余 32 个组合页面只剩模板骨架
//   （约 1,900 字符 ≈ 250 英文词，组合间正文相似度 96.2%，仅国名/标准名不同）
//   却全部 index, follow —— 属程序化薄内容，会拉低整站质量评分。
//
// 判据：**该组合是否挂有 ≥1 家供应商档案**。
//   · 有 ⇒ 页面含真实、唯一的数据（供应商清单 + 档案内链）⇒ index, follow + 进 sitemap
//   · 无 ⇒ noindex, follow + 不进 sitemap（follow 保留：面包屑/CTA 仍传递权重）
//   供应商数量增长后，对应组合会自动恢复可索引 —— 无需人工维护清单。
//
// 🔴 返回 null = **数据源不可达**。调用方必须 fail-open（一律按可索引处理）。
//    否则一次构建期静默回落就会把 315 条 URL 全部踢出索引。
//
// 🔴 页面侧（generateMetadata）与 sitemap 侧共用本函数 ——
//    任何一侧单独判定都会产生「sitemap 收录但页面 noindex」的错配，
//    Search Console 会直接报 "Submitted URL marked noindex"，浪费抓取预算。

import { getSeoMatrix } from "@/lib/taxonomy";
import { countSuppliersByAuditType } from "@/lib/queries";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";

const COVERAGE_CODES = new Set(COVERAGE_COUNTRIES.map((c) => c.code));

// 模块级 memo：一次构建进程内只算一次（页面生成 + sitemap 共享同一结果）。
let _cache: Promise<Set<string> | null> | null = null;

/**
 * 返回「可索引的 audit-guide 组合」集合，元素形如 `china/SMETA`。
 * 返回 `null` 表示数据源不可达，调用方须 fail-open。
 */
export function listIndexableAuditGuideCombos(): Promise<Set<string> | null> {
  if (!_cache) _cache = compute();
  return _cache;
}

async function compute(): Promise<Set<string> | null> {
  const counts = await countSuppliersByAuditType();
  if (counts === null) return null;
  const { countries, auditTypes } = await getSeoMatrix();
  const out = new Set<string>();
  for (const c of countries) {
    if (!COVERAGE_CODES.has(c.code)) continue;
    for (const a of auditTypes) {
      if ((counts.get(`${c.code}/${a.code}`) ?? 0) > 0) out.add(`${c.code}/${a.code}`);
    }
  }
  return out;
}
