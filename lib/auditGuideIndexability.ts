// lib/auditGuideIndexability.ts —— audit-guide 组合的可索引判定（单一真源）
//
// 背景（2026-10-09 全站 SEO 诊断）：
//   /audit-guide/<国家>/<标准> 共 5 国 × 7 标准 × 9 语言 = 315 条 URL。
//   实测：多数组合页面只剩模板骨架（约 1,900 字符 ≈ 250 英文词，
//   组合间正文相似度 96.2%，仅国名/标准名不同）却全部 index, follow
//   ⇒ 属程序化薄内容，会拉低整站质量评分。
//
// 判定为「该组合是否具备独立价值」，满足**任一**条件即可索引：
//   ① 挂有 ≥1 家供应商档案（真实、唯一的数据 + 指向档案的内链）
//   ② 有已核证的编辑内容（lib/auditGuideContent.ts 的白名单组合）
// 两者都不满足 ⇒ noindex, follow + 不进 sitemap
// （保留 follow：面包屑/CTA 仍把权重传给 /countries/<slug>、/rfq、/services）。
//
// 供应商数量增长、或往白名单加组合后，对应页面会自动恢复可索引 —— 无需人工维护清单。
//
// 🔴 fail-open：若数据源不可达，**不得**把「问不到」当成「零供应商」。
//    否则一次构建期静默回落就会把大批 URL 误判为薄页并踢出索引（一次静默 SEO 事故）。
//    此时返回「全部覆盖组合」，即保持原状、不做任何删除。
//
// 🔴 页面侧（generateMetadata）与 sitemap 侧共用本函数 ——
//    任何一侧单独判定都会产生「sitemap 收录但页面 noindex」的错配，
//    Search Console 会直接报 "Submitted URL marked noindex"，浪费抓取预算。

import { getSeoMatrix } from "@/lib/taxonomy";
import { countSuppliersByAuditType } from "@/lib/queries";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { hasAuditGuideContent } from "@/lib/auditGuideContent";

const COVERAGE_CODES = new Set(COVERAGE_COUNTRIES.map((c) => c.code));

// 模块级 memo：一次构建进程内只算一次（页面生成 + sitemap 共享同一结果）。
let _cache: Promise<Set<string>> | null = null;

/**
 * 返回「应当可索引的 audit-guide 组合」集合，元素形如 `china/SMETA`。
 *
 * 数据源不可达时返回**全部**覆盖组合（fail-open，绝不误删索引）。
 */
export function listIndexableAuditGuideCombos(): Promise<Set<string>> {
  if (!_cache) _cache = compute();
  return _cache;
}

async function compute(): Promise<Set<string>> {
  const { countries, auditTypes } = await getSeoMatrix();
  const covered = countries.filter((c) => COVERAGE_CODES.has(c.code));

  const combos: string[] = [];
  for (const c of covered) for (const a of auditTypes) combos.push(`${c.code}/${a.code}`);

  // ① 编辑内容支撑：不依赖数据源，任何时候都算得出来。
  const out = new Set<string>(
    combos.filter((k) => {
      const parts = k.split("/");
      return hasAuditGuideContent(parts[0], parts[1]);
    })
  );

  // ② 供应商支撑：依赖数据源。
  const counts = await countSuppliersByAuditType();
  if (counts === null) {
    // 🔴 数据源不可达 ⇒ fail-open：全部视为可索引（保持原状，绝不误删）。
    return new Set(combos);
  }
  for (const k of combos) {
    if ((counts.get(k) ?? 0) > 0) out.add(k);
  }
  return out;
}
