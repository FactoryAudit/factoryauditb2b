// lib/categoryDirectory.ts —— 行业品类目录（对标 aguato 品类页）的**唯一数据源**。
//
// 设计背景（2026-11-25）：
//   用户要把 /suppliers 升级成 aguato 形态（每品类一页、卡片带国家/规模/标签/Claimed）。
//   勘察发现 main_products 有 308 个标签，其中 290 个只命中 1 家 ⇒ 按细分标签铺页
//   会造出 290 个 thin-content 空页（Google 不收录，还拖累站点质量）。
//   故改为**行业级品类**：只收录已发布供应商密度达标的行业。
//
// 🔴 三条铁律：
//   1. 本表是唯一开页清单。新增行业前必须实测已发布供应商数 >= MIN_SUPPLIERS，
//      否则等于开空页 —— build 期有断言拦截（见 assertCategoryDensity）。
//   2. 卡片数据全部来自公开层字段，禁读 PII（contact_email 等）；深度证据仍走登录墙。
//   3. slug 用行业 code（machinery 等），与 /industry/[slug] 同源，不另造 taxonomy。

export const MIN_SUPPLIERS_PER_CATEGORY = 5;

/**
 * 已确认密度的品类清单。数字为勘察当日（2026-11-25）已发布供应商数，
 * 仅作文档留痕；真实密度在 build 期由 assertCategoryDensity 用库内数据复核。
 */
export const CATEGORY_DIRECTORY: readonly {
  slug: string;
  label: string;
  observedCount: number;
}[] = [
  { slug: "machinery", label: "Industrial machinery", observedCount: 25 },
  { slug: "home-appliances", label: "Home appliances", observedCount: 10 },
  { slug: "textiles", label: "Textiles", observedCount: 9 },
  { slug: "electronics", label: "Electronics", observedCount: 6 },
  { slug: "furniture", label: "Furniture", observedCount: 5 },
] as const;

export type CategoryDirectoryEntry = (typeof CATEGORY_DIRECTORY)[number];

export function isCategoryDirectorySlug(slug: string): boolean {
  return CATEGORY_DIRECTORY.some((c) => c.slug === slug);
}

export function getCategoryDirectoryEntry(slug: string): CategoryDirectoryEntry | undefined {
  return CATEGORY_DIRECTORY.find((c) => c.slug === slug);
}

/**
 * build 期密度闸门：每个品类必须真的有 >= MIN_SUPPLIERS_PER_CATEGORY 家已发布供应商。
 * 传入 listSuppliersByIndustry 的结果长度，由调用页/脚本断言。
 * 🔴 只做断言、不改数据；密度掉了就 fail build，不允许静默开空页。
 */
export function assertCategoryDensity(
  slug: string,
  count: number
): { ok: true } | { ok: false; slug: string; count: number; min: number } {
  return count >= MIN_SUPPLIERS_PER_CATEGORY
    ? { ok: true }
    : {
        ok: false,
        slug,
        count,
        min: MIN_SUPPLIERS_PER_CATEGORY,
      };
}
