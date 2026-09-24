/**
 * STEP 13-B —— INDUSTRIAL CLUSTERS IA/UI RESTRUCTURE 回归
 *
 * 运行：
 *   node scripts/run-regression.mjs cs13b-cluster-directory-regression CS13B_ROOT
 *
 * 覆盖：
 *   A 冻结层：9 语字典 clusters.allCountries 到位 + en 叶子数 3028 + 8 处门禁常量同源
 *   B 分组层：国家 → 地区 → 卡片（用**生产库导出的 8 条真实行**当夹具，不编造产业带）
 *   C 排序层：确定性排序 / sort_order 为主、name 为次 / 输入乱序不影响输出
 *   D 边界层：缺 region / 缺 industry / 缺 country_code / 空输入 都不臆造、不崩
 *   E 结构层：锚点唯一、slug 不重复、展平顺序与渲染顺序一致
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildClusterDirectory,
  flattenClusterDirectory,
  clusterLocation,
  type ClusterDirectoryRow,
} from "@/lib/clusterDirectory";

const ROOT = process.env.CS13B_ROOT || process.cwd();
let pass = 0;
let fail = 0;

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? "  [" + detail + "]" : ""}`);
  }
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function countLeaves(obj: unknown): number {
  if (obj === null || typeof obj !== "object") return 1;
  if (Array.isArray(obj)) return obj.reduce<number>((a, x) => a + countLeaves(x), 0);
  return Object.values(obj as Record<string, unknown>).reduce<number>((a, x) => a + countLeaves(x), 0);
}

const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];

// ============================================================================
// A 冻结层
// ============================================================================
console.log("--- A 冻结层 ---");
{
  const dicts = Object.fromEntries(
    LOCALES.map((l) => [l, JSON.parse(read(`i18n/dictionaries/${l}.json`))])
  );
  const enLeaves = countLeaves(dicts.en);
  ok("A1 en 字典叶子数 = 3028（新增 1 键）", enLeaves === 3028, `实际 ${enLeaves}`);

  const missingLocale = LOCALES.filter((l) => !dicts[l]?.clusters?.allCountries);
  ok(
    "A2 9 语都有 clusters.allCountries",
    missingLocale.length === 0,
    missingLocale.join(",")
  );

  const sameLeaf = LOCALES.every((l) => countLeaves(dicts[l]) === enLeaves);
  ok("A3 9 语叶子数一致", sameLeaf);

  const enKeys = Object.keys(dicts.en.clusters).sort().join("|");
  const drift = LOCALES.filter((l) => Object.keys(dicts[l].clusters).sort().join("|") !== enKeys);
  ok("A4 9 语 clusters 命名空间键集合一致", drift.length === 0, drift.join(","));

  const gates: Array<[string, string]> = [
    ["scripts/verify-opennext-bundle.mjs", "cnt !== 3028"],
    ["scripts/cs06a-directory-regression.ts", "baseKeys.length === 3028"],
    ["scripts/cs08-form-regression.ts", "leafCounts[0] === 3028"],
    ["scripts/cs12-profile-regression.ts", "enLeaf === 3028"],
    ["scripts/cs13-supplier-seo-regression.ts", "EN_LEAF_COUNT = 3028"],
    ["scripts/cs16-supplier-mgmt-regression.ts", "EN_LEAF = 3028"],
    ["scripts/cs17-commerce-regression.ts", "EN_LEAF = 3028"],
    ["scripts/cs20-supplier-report.ts", "EN_LEAF = 3028"],
    ["RELEASE-RULES.md", "**3028**"],
  ];
  for (const [f, pat] of gates) {
    const src = read(f);
    // 历史 changelog 行（含 "→"）里的旧数字不算残留
    const stale = src.split("\n").some((l) => !l.includes("→") && l.includes("2939"));
    ok(`A5 ${f} 常量 → 3028 且无残留 2939`, src.includes(pat) && !stale);
  }
}

// ============================================================================
// B/C/E 分组与排序（夹具 = 生产库 industrial_clusters 8 行真实快照）
// ============================================================================
// 来源：scripts/step13b-cluster-audit.mjs 对生产库的只读导出（已发布 8 条）。
// 这是**生产行的镜像**，不是编造的产业带；本脚本不写库、不新增任何产业带。
const REAL: ClusterDirectoryRow[] = [
  { name: "江门家居厨房用品产业带", slug: "jiangmen-home-kitchen", country: "China", country_code: "CN", region: "South China", province: "Guangdong", city: "Jiangmen", industry: "Home & Kitchen", sort_order: 10 },
  { name: "中山照明产业带", slug: "zhongshan-lighting", country: "China", country_code: "CN", region: "South China", province: "Guangdong", city: "Zhongshan", industry: "Lighting", sort_order: 20 },
  { name: "佛山家具产业带", slug: "foshan-furniture", country: "China", country_code: "CN", region: "South China", province: "Guangdong", city: "Foshan", industry: "Furniture", sort_order: 30 },
  { name: "东莞电子制造产业带", slug: "dongguan-electronics", country: "China", country_code: "CN", region: "South China", province: "Guangdong", city: "Dongguan", industry: "Electronics", sort_order: 40 },
  { name: "泰国罗勇汽车制造产业带", slug: "rayong-automotive", country: "Thailand", country_code: "TH", region: "Eastern Thailand", province: null, city: "Rayong", industry: "Automotive", sort_order: 50 },
  { name: "越南北宁电子制造产业带", slug: "bac-ninh-electronics", country: "Vietnam", country_code: "VN", region: "Northern Vietnam", province: null, city: "Bac Ninh", industry: "Electronics", sort_order: 60 },
  { name: "印尼巴淡电子制造产业带", slug: "batam-electronics", country: "Indonesia", country_code: "ID", region: "Riau Islands", province: null, city: "Batam", industry: "Electronics", sort_order: 70 },
  { name: "印尼茉莉芬家具产业带", slug: "jepara-furniture", country: "Indonesia", country_code: "ID", region: "Central Java", province: null, city: "Jepara", industry: "Furniture", sort_order: 80 },
];

console.log("--- B 分组层 ---");
const dir = buildClusterDirectory(REAL);
{
  ok("B1 国家数 = 4（China/Thailand/Vietnam/Indonesia）", dir.length === 4, dir.map((d) => d.name).join(","));
  ok(
    "B2 国家顺序 = 组内最小 sort_order（China→Thailand→Vietnam→Indonesia）",
    dir.map((d) => d.key).join(",") === "china,thailand,vietnam,indonesia",
    dir.map((d) => d.key).join(",")
  );
  ok(
    "B3 国家计数 = 4/1/1/2",
    dir.map((d) => d.count).join(",") === "4,1,1,2",
    dir.map((d) => d.count).join(",")
  );
  ok("B4 国家锚点 = slug 形式（可与 tab href 直接拼接）", dir.every((d) => /^[a-z0-9-]+$/.test(d.anchor)));

  const cn = dir[0];
  ok("B5 China 只有 1 个地区分组 = South China", cn.regions.length === 1 && cn.regions[0].name === "South China");
  ok(
    "B6 South China 下 4 条按 sort_order 升序",
    cn.regions[0].clusters.map((c) => c.slug).join(",") ===
      "jiangmen-home-kitchen,zhongshan-lighting,foshan-furniture,dongguan-electronics",
    cn.regions[0].clusters.map((c) => c.slug).join(",")
  );

  const id = dir[3];
  ok(
    "B7 Indonesia 有 2 个地区，按组内最小 sort_order（Riau Islands → Central Java）",
    id.regions.map((r) => r.name).join(",") === "Riau Islands,Central Java",
    id.regions.map((r) => r.name).join(",")
  );

  ok("B8 每个 cluster 只出现在一个分组里（slug 不重复）", (() => {
    const all = flattenClusterDirectory(dir).map((c) => c.slug);
    return new Set(all).size === all.length;
  })());

  ok("B9 8 条一条不少", flattenClusterDirectory(dir).length === 8);
}

console.log("--- C 排序确定性 ---");
{
  const reversed = buildClusterDirectory([...REAL].reverse());
  ok(
    "C1 输入倒序 → 输出顺序不变（排序不依赖输入序）",
    JSON.stringify(reversed) === JSON.stringify(dir)
  );

  const shuffled = buildClusterDirectory([...REAL].sort(() => 0.5 - Math.random()));
  ok("C2 输入随机洗牌 → 输出顺序不变", JSON.stringify(shuffled) === JSON.stringify(dir));

  // sort_order 相同 ⇒ 按 name 码点升序（不用 created_at）
  const tie: ClusterDirectoryRow[] = [
    { name: "B-cluster", slug: "b", country: "China", country_code: "CN", region: "R1", province: null, city: null, industry: null, sort_order: 5 },
    { name: "A-cluster", slug: "a", country: "China", country_code: "CN", region: "R1", province: null, city: null, industry: null, sort_order: 5 },
  ];
  const tieDir = buildClusterDirectory(tie);
  ok(
    "C3 sort_order 相同 ⇒ name 升序（created_at 不参与）",
    tieDir[0].regions[0].clusters.map((c) => c.slug).join(",") === "a,b",
    tieDir[0].regions[0].clusters.map((c) => c.slug).join(",")
  );

  const noOrder = buildClusterDirectory(tie.map((r) => ({ ...r, sort_order: null })));
  ok("C4 sort_order 缺值退化为 100（不崩、不排到最前）", noOrder[0].regions[0].clusters.length === 2);

  const mixed = buildClusterDirectory([
    { name: "Z-noorder", slug: "z", country: "China", country_code: "CN", region: "R1", province: null, city: null, industry: null, sort_order: null },
    { name: "A-order-30", slug: "ao", country: "China", country_code: "CN", region: "R1", province: null, city: null, industry: null, sort_order: 30 },
  ]);
  ok(
    "C5 显式 sort_order(30) 排在缺值(默认 100) 之前",
    mixed[0].regions[0].clusters.map((c) => c.slug).join(",") === "ao,z",
    mixed[0].regions[0].clusters.map((c) => c.slug).join(",")
  );
}

console.log("--- D 边界层（不臆造） ---");
{
  const empty = buildClusterDirectory([]);
  ok("D1 空输入 ⇒ 空数组（页面走空态）", Array.isArray(empty) && empty.length === 0);

  const noRegion = buildClusterDirectory([
    { name: "X", slug: "x", country: "China", country_code: "CN", region: null, province: "Guangdong", city: "Foshan", industry: "Furniture", sort_order: 1 },
  ]);
  ok("D2 缺 region ⇒ 地区名空串（页面不渲染 H3，不臆造「其他」）", noRegion[0].regions[0].name === "");
  ok("D3 缺 region 仍归到正确的国家组", noRegion[0].key === "china" && noRegion[0].count === 1);

  const noIndustry = buildClusterDirectory([
    { name: "X", slug: "x", country: "China", country_code: "CN", region: "R", province: null, city: null, industry: null, sort_order: 1 },
  ]);
  ok("D4 缺 industry ⇒ 保持 null（不猜行业）", noIndustry[0].regions[0].clusters[0].industry === null);

  const noCountryName = buildClusterDirectory([
    { name: "X", slug: "x", country: null, country_code: "CN", region: "R", province: null, city: null, industry: "Electronics", sort_order: 1 },
  ]);
  ok("D5 只给 country_code ⇒ 显示名退化为 code，不臆造国名", noCountryName[0].name === "CN");

  const caseVariant = buildClusterDirectory([
    { name: "A", slug: "a", country: "China", country_code: "CN", region: "R", province: null, city: null, industry: null, sort_order: 1 },
    { name: "B", slug: "b", country: "china", country_code: "CN", region: "R", province: null, city: null, industry: null, sort_order: 2 },
  ]);
  ok("D6 大小写变体合并到同一国家组", caseVariant.length === 1 && caseVariant[0].count === 2);

  ok(
    "D7 clusterLocation 只拼真实字段（Rayong 无 province ⇒ 不出现空占位）",
    clusterLocation({ name: "", slug: "", country: "Thailand", country_code: "TH", region: null, province: null, city: "Rayong", industry: null }) ===
      "Rayong · Thailand"
  );
  ok(
    "D8 clusterLocation 空字段不留 ' · ' 残渣",
    !clusterLocation({ name: "", slug: "", country: null, country_code: null, region: null, province: null, city: "Foshan", industry: null }).includes("·")
  );
}

console.log("--- E 结构层 ---");
{
  ok("E1 展平顺序 = 渲染顺序（国家→地区→卡片）", (() => {
    const flat = flattenClusterDirectory(dir).map((c) => c.slug);
    const manual = dir.flatMap((co) => co.regions.flatMap((r) => r.clusters.map((c) => c.slug)));
    return flat.join(",") === manual.join(",") && flat.length === 8;
  })());
  ok("E2 锚点唯一（tab href 不会互相覆盖）", new Set(dir.map((d) => d.anchor)).size === dir.length);
  ok(
    "E3 每张卡都带 location 字段（卡片第三行直接可渲染）",
    flattenClusterDirectory(dir).every((c) => typeof c.location === "string" && c.location.length > 0)
  );
}

console.log(`\nSTEP 13-B 回归：${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
