// lib/geoLegacyLinks.ts —— GEO 批次页 → 既有关联静态指南的**单向**深读内链。
//
// 背景：GEO 批次 1 的 verify-chinese-supplier-factory-vs-trading-company（4 列验证矩阵）
// 与既有静态指南 china-factory-or-trading-company（叙述型长文，被 10+ 处内链引用）
// 主题高度重叠。删任一页都会破坏既有 URL 与内链网（项目铁律：现有 URL 全部保留）。
//
// 处理：两页都保留、差异化定位，并让**新页单向指向旧页**：
//   · 方向只能是 GEO → legacy，不能反向 —— legacy 页是权威页（内链多、内容深），
//     反向链接会把权重导流给新页，等于让补充页蚕食主页。
//   · 链接文字取 legacy 指南自己的 titleEn/titleZh（findGuide），不新造文案。
//   · 区块标题复用 t.common.ui.relatedGuides，**不新增字典键**（9 语字典已冻结）。
//
// 新增撞题页：往本表加一行即可，渲染壳无需改动。
export const GEO_LEGACY_LINK: Record<string, string> = {
  "verify-chinese-supplier-factory-vs-trading-company": "china-factory-or-trading-company",
};

/** 给定 GEO slug，返回要置顶的 legacy 指南 slug；无映射返回 null。 */
export function legacyLinkFor(geoSlug: string): string | null {
  return GEO_LEGACY_LINK[geoSlug] ?? null;
}
