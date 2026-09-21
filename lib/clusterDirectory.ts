// lib/clusterDirectory.ts —— /industrial-clusters 目录页的「分组 + 排序」纯逻辑（STEP 13-B）
//
// 为什么单独抽一个文件：
//   · **零 import、零数据库依赖**。只吃 `listPublishedClusters()` 的结果，吐出页面
//     可直接渲染的分组结构。回归脚本因此能把它当纯函数测（不起 DB、不碰 service_role）。
//   · 信息架构（用户拍板）：**Country → Region → Industry(标签) → Cluster → Suppliers**。
//     Industry 是卡片上的标签，**不是**分组层级 —— 所以这里只有两级分组。
//
// 排序规则（全部由数据决定，**不硬编码国家列表、不硬编码国家顺序**）：
//   Country 组顺序 = 组内最小 sort_order，再按国家名
//   Region  组顺序 = 组内最小 sort_order，再按地区名
//   Cluster 顺序  = sort_order，再按名称
//
//   `sort_order` 是后台 Admin 可编辑字段（DB column default 100）——它就是运营手里的
//   排序旋钮。缺值退化为 100（与 DB 默认值一致）。**绝不使用 created_at 当视觉顺序**，
//   因为 created_at 只是"录入先后"，不是"展示意图"。
//
//   实现取巧：先按 (sort_order, name) 全局排序一次，再按插入序分组 ——
//   每个分组的第一个成员天然就是该组最小 sort_order 的成员，于是"组顺序"自动正确，
//   不需要额外的 min() 计算，也不会出现两组排序依据不一致的口径分叉。

/** 消费方（IndustrialCluster）只需提供这些字段；其余字段原样透传。 */
export type ClusterDirectoryRow = {
  slug: string;
  name: string;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  province: string | null;
  industry: string | null;
  /** 卡片简介。为空 ⇒ 页面不渲染这一段（不编造产业带描述）。 */
  description?: string | null;
  sort_order?: number | null;
};

export type ClusterDirectoryCard = ClusterDirectoryRow & {
  /** 卡片定位行：City · Province · Country。
   *  只拼接**真实存在**的字段 —— 空值不占位，绝不写 "Unknown" / "N/A" / "—"。 */
  location: string;
};

export type ClusterDirectoryRegion = {
  key: string;
  /** 真实地区名。数据缺 region 时为空串 ⇒ 页面**不输出 H3**（不臆造"其他地区"）。 */
  name: string;
  clusters: ClusterDirectoryCard[];
};

export type ClusterDirectoryCountry = {
  key: string;
  name: string;
  /** 同页锚点：H2 的 id / 顶部国家 tab 的 href。 */
  anchor: string;
  count: number;
  regions: ClusterDirectoryRegion[];
};

/** 与 DB `industrial_clusters.sort_order` 的 column default 保持一致。 */
const DEFAULT_SORT = 100;
/** 数据缺 region 时的分组 key（页面据 `name === ""` 决定不渲染 H3）。 */
const NO_REGION_KEY = "__none__";

function slugSegment(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortOrderOf(row: ClusterDirectoryRow): number {
  const n = row.sort_order;
  return typeof n === "number" && Number.isFinite(n) ? n : DEFAULT_SORT;
}

/** 名称比较：用纯码点比较（不依赖 ICU / locale），保证任何环境下同一份数据同一顺序。 */
function byName(a: { name: string }, b: { name: string }): number {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

function text(v: string | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * 卡片定位行：`City · Province · Country`，只列真实存在的字段。
 * 例：Jiangmen · Guangdong · China ／ Rayong · Thailand（province 为 null 时自动跳过）。
 */
export function clusterLocation(row: ClusterDirectoryRow): string {
  return [row.city, row.province, row.country].map(text).filter((v) => v.length > 0).join(" · ");
}

/** 国家分组的 key / 锚点：优先用国家名（China → china），缺名时退化为国家码（CN → cn）。 */
function countryKeyOf(row: ClusterDirectoryRow): string {
  return slugSegment(text(row.country) || text(row.country_code));
}

/** 国家显示名：优先 country 字段，缺则退化为 country_code；两者皆缺则为空串。 */
function countryNameOf(row: ClusterDirectoryRow): string {
  return text(row.country) || text(row.country_code);
}

/**
 * 把已发布产业带切成「国家 → 地区 → 卡片」的三层结构。
 *
 * 输入顺序无关紧要（内部会重新排序）；输出顺序**完全确定**：
 * 同一份数据在任何环境、任何调用次数下都得到同一顺序。
 * 空数组 ⇒ 空数组（页面据长度走空态分支）。
 */
export function buildClusterDirectory(
  rows: ClusterDirectoryRow[]
): ClusterDirectoryCountry[] {
  // ① 全局稳定排序：sort_order asc, name asc
  const sorted = [...rows].sort((a, b) => sortOrderOf(a) - sortOrderOf(b) || byName(a, b));

  // ② 按插入序分组（Map 保序）—— 分组顺序自然等于"组内最小 sort_order"
  const countries = new Map<
    string,
    {
      name: string;
      regions: Map<string, { name: string; clusters: ClusterDirectoryCard[] }>;
    }
  >();

  for (const row of sorted) {
    const cKey = countryKeyOf(row) || "__unknown_country__";
    if (!countries.has(cKey)) {
      countries.set(cKey, { name: countryNameOf(row), regions: new Map() });
    }
    const country = countries.get(cKey)!;
    // 先出现的名字优先；若先出现的是空名（只有 country_code 而 name 缺失的反例），
    // 后出现的非空名可以升级显示名 —— 仍是确定性的，不猜任何东西。
    if (!country.name) country.name = countryNameOf(row);

    const regionName = text(row.region);
    const rKey = regionName ? slugSegment(regionName) : NO_REGION_KEY;
    if (!country.regions.has(rKey)) {
      country.regions.set(rKey, { name: regionName, clusters: [] });
    }
    country.regions.get(rKey)!.clusters.push({ ...row, location: clusterLocation(row) });
  }

  return Array.from(countries.entries()).map(([key, country]) => {
    const regions: ClusterDirectoryRegion[] = Array.from(country.regions.entries()).map(
      ([rKey, region]) => ({ key: rKey, name: region.name, clusters: region.clusters })
    );
    return {
      key,
      name: country.name,
      anchor: key,
      count: regions.reduce((n, r) => n + r.clusters.length, 0),
      regions,
    };
  });
}

/** 展平成一个列表（JSON-LD ItemList / 顶部 All 计数用），顺序与页面渲染顺序一致。 */
export function flattenClusterDirectory(
  directory: ClusterDirectoryCountry[]
): ClusterDirectoryCard[] {
  return directory.flatMap((co) => co.regions.flatMap((r) => r.clusters));
}
