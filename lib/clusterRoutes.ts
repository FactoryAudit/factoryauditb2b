// lib/clusterRoutes.ts —— Industrial Clusters 层级 URL resolver（STEP 09 ROUTE-02）
//
// 设计原则（用户拍板「扩展式」方案）：
//   · DB 实体 slug 永远不变（如 dongguan-electronics）。
//   · 层级 URL 由路由层根据国家 / 省 / 市关系**生成**，路径层级 ≠ 实体 slug。
//   · 新层级 URL = canonical；旧扁平 URL 仅做 301 兼容。
//
// 该文件是纯函数 + 静态映射，**不依赖数据库**，供以下三方复用：
//   · 页面（catch-all [...segments]）渲染详情 / 聚合页
//   · sitemap.ts 生成正式层级 URL
//   · middleware.ts 旧扁平 URL → 新层级 URL 的 301 静态映射

/** resolver 所需的最小输入（与 IndustrialCluster 解耦，便于在 middleware 里静态使用）。 */
export type ClusterRouteInput = {
  slug: string;
  country_code: string | null;
  province: string | null;
  city: string | null;
};

/** country_code → URL 国家段（用户 §18：公开 URL 用全拼，不用 ISO 短码）。 */
export const COUNTRY_URL_SEGMENT: Record<string, string> = {
  CN: "china",
  TH: "thailand",
  VN: "vietnam",
  ID: "indonesia",
};

/** 已知的国家段反向查表（middleware 解析路径前缀用）。 */
export const COUNTRY_SEGMENT_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_URL_SEGMENT).map(([code, seg]) => [seg, code])
);

/** 把任意文本转成 URL 段（与 lib/industrialClusters.ts 的 slugifyCluster 同规则）。 */
export function slugifySegment(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * 由集群的行政维度生成**正式层级 URL**（canonical）。
 *
 * 规则（数据驱动，非硬编码）：
 *   1. 国家段来自 COUNTRY_URL_SEGMENT。
 *   2. 中间段（parent）：
 *      · CN 集群 → province（如 Guangdong）
 *      · 其余（TH/VN/ID）→ city（如 Rayong / Bac Ninh / Batam）
 *   3. 冗余消除：若 slug 已以 `parent-` 开头，则省略中间段，
 *      避免 /thailand/rayong/rayong-automotive 这类重复。
 *   4. 国家码缺失（数据不全）→ 退化到扁平 URL 并交由 REVIEW，不臆造。
 */
export function buildClusterCanonicalPath(c: ClusterRouteInput): string {
  const countrySeg = COUNTRY_URL_SEGMENT[c.country_code ?? ""];
  if (!countrySeg) return `/industrial-clusters/${c.slug}`; // 退化（REVIEW）

  // 中间段（parent）按「国家策略」选择，而非机械地「slug 已含父段就省略」：
  //  · CN    → province（如 Guangdong）              —— 省是中国产业带的标准中间层
  //  · VN/ID → city（如 Bac Ninh / Batam / Jepara）  —— 用户 §5/§9/§26 明确要求保留城市层：
  //                                                      /vietnam/bac-ninh/bac-ninh-electronics
  //  · TH    → 无中间段（用户 §5 明确：泰国不需要独立城市页，URL 直接 country/slug）
  //  其余未来国家 → 默认无中间段，退化到 /country/slug，不臆造层级。
  //  ⚠️ 不启用「slug 以 parent- 开头则省略」逻辑：那是上一版的 bug，
  //     会把 /vietnam/bac-ninh/bac-ninh-electronics 错误压成 /vietnam/bac-ninh-electronics。
  let parentSeg: string | null = null;
  if (c.country_code === "CN") {
    parentSeg = c.province ? slugifySegment(c.province) : null;
  } else if (c.country_code === "VN" || c.country_code === "ID") {
    parentSeg = c.city ? slugifySegment(c.city) : null;
  } else if (c.country_code === "TH") {
    parentSeg = null;
  }

  return `/industrial-clusters/${countrySeg}` + (parentSeg ? `/${parentSeg}` : "") + `/${c.slug}`;
}

// ── ROUTE-04 静态 legacy 映射（由 resolver 生成，非手写 if/switch）─────────────
// 仅覆盖 P0（8 条）。未来集群上线时，本映射应由 Admin 写入或改为 DB 驱动；
// 页面侧另有通用兜底（catch-all 对「slug 命中但路径≠canonical」自动 301）。
const P0_CLUSTER_FACTS: ClusterRouteInput[] = [
  { slug: "jiangmen-home-kitchen", country_code: "CN", province: "Guangdong", city: "Jiangmen" },
  { slug: "zhongshan-lighting", country_code: "CN", province: "Guangdong", city: "Zhongshan" },
  { slug: "foshan-furniture", country_code: "CN", province: "Guangdong", city: "Foshan" },
  { slug: "dongguan-electronics", country_code: "CN", province: "Guangdong", city: "Dongguan" },
  { slug: "rayong-automotive", country_code: "TH", province: null, city: "Rayong" },
  { slug: "bac-ninh-electronics", country_code: "VN", province: null, city: "Bac Ninh" },
  { slug: "batam-electronics", country_code: "ID", province: null, city: "Batam" },
  { slug: "jepara-furniture", country_code: "ID", province: null, city: "Jepara" },
];

/** legacy 扁平 slug → 正式层级 canonical path（不含 locale 前缀）。 */
export const LEGACY_CLUSTER_REDIRECTS: Record<string, string> = Object.fromEntries(
  P0_CLUSTER_FACTS.map((f) => [f.slug, buildClusterCanonicalPath(f)])
);
