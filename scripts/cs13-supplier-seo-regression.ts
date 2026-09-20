// scripts/cs13-supplier-seo-regression.ts
//
// CS-13（PHASE 03）供应商 SEO / GEO / AI-search 引擎回归。
//
// 跑法（建议带 .env；不带则 DB 段自动 SKIP，其余全部照跑）：
//   node --env-file=.env scripts/run-regression.mjs cs13-supplier-seo-regression CS13_ROOT
//
// 分层：
//   A 源码层：P0 修复（目录卡片核验态不再硬编码）
//   B 数据层：lib/queries.ts 新字段 / 新函数，且不越界（不加行政区划列、不外泄 paid 层）
//   C 引擎层：lib/seo/supplierSeo.ts 导出面 + 收口纪律
//   D 行为层：闸门 / Title / Description / Snapshot / FAQ / Schema（表驱动，纯函数）
//   E 适配层：supplierSeoDataFromView（页面与测试跑的是同一段映射）
//   F 冻结层：字典叶子数、字段分层、迁移文件数、历史归档不可改写
//   G 数据层（可选）：真实 DB 行为
//
// ⚠️ 不得使用 top-level await：通用运行器打成 cjs。

import fs from "node:fs";
import path from "node:path";

const ROOT = (process.env.CS13_ROOT ?? process.cwd()).replace(/\\/g, "/");

let pass = 0;
let fail = 0;
let skip = 0;

function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? "  :: " + extra : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? "  :: " + extra : ""}`);
  }
}
function skipped(name: string, why: string) {
  skip++;
  console.log(`  SKIP  ${name}  :: ${why}`);
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

type Leaf = { key: string; value: unknown };
function leaves(obj: unknown, prefix = "", out: Leaf[] = []): Leaf[] {
  if (obj === null || typeof obj !== "object") {
    out.push({ key: prefix, value: obj });
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    leaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
/** 单一事实源：与 cs06a C8 / cs08 G4,G5 / cs12 E4,E5 / verify-opennext-bundle 同源 */
const EN_LEAF_COUNT = 2938;

async function main() {
  console.log("=".repeat(60));
  console.log("CS-13 供应商 SEO 引擎回归");
  console.log("=".repeat(60));

  // ===========================================================================
  // A. 源码层：P0 修复（§三）
  // ===========================================================================
  console.log("\n=== A. P0 —— 目录卡片核验态必须按真实等级（§三） ===");
  const dirPage = read("app/[locale]/suppliers/page.tsx");
  check("A1 目录页源码可读且非空", dirPage.length > 1000);
  check(
    "A2 卡片用 `x.publicVerificationLevel ?? 0`（消费方必须兜底 0）",
    /publicVerificationLevel\s*\?\?\s*0/.test(dirPage)
  );
  check(
    "A3 卡片按 level 分支渲染核验态文案",
    /level\s*===\s*0\s*\?\s*s\.verificationNotYet\s*:\s*v\.levelsShort\[level\]/.test(dirPage)
  );
  check("A4 旧的「无条件 verificationNotYet」形态已根除", !/>\s*\{\s*s\.verificationNotYet\s*\}\s*</.test(dirPage));
  check("A5 已取出 `const v = t.verification`", /const\s+v\s*=\s*t\.verification/.test(dirPage));
  // ⚠️ 不能用 `publicVerificationLevel\(` 判代码：目录页注释里就写着这个函数名（曾造成假 FAIL）。
  //    改为断言「目录页没有 import / 调用它」。
  check(
    "A6 目录页不自行推导核验等级（必须来自 listSupplierDirectory 的 CS-02 结果）",
    !/from\s+"@\/lib\/verification"/.test(dirPage) && !/import[^;\n]*\bpublicVerificationLevel\b/.test(dirPage)
  );

  // ===========================================================================
  // B. 数据层：lib/queries.ts
  // ===========================================================================
  console.log("\n=== B. 数据层 —— 新字段 / 新函数，且不越界 ===");
  const queries = read("lib/queries.ts");
  check("B1 SupplierView 增加 updatedAt", /updatedAt\?:\s*string\s*\|\s*null/.test(queries));
  check("B2 SupplierView 增加 publicVerificationLevel", /publicVerificationLevel\?:\s*number/.test(queries));
  check("B3 SupplierView 增加 hasScoreBreakdown（布尔）", /hasScoreBreakdown:\s*boolean/.test(queries));
  check("B4 ROW_SELECT 已含 updated_at", /ROW_SELECT[\s\S]{0,2500}\bupdated_at\b/.test(queries));
  check(
    "B5 ROW_SELECT 不得出现 province / state_code（§二 本轮不加行政区划列）",
    !/ROW_SELECT[\s\S]{0,2500}\b(province|state_code|province_code)\b/i.test(queries)
  );
  check("B6 新增 verifiedAuditSupplierIds()", /(export\s+)?function\s+verifiedAuditSupplierIds/.test(queries));
  const vfn = queries.slice(
    Math.max(0, queries.indexOf("function verifiedAuditSupplierIds")),
    queries.indexOf("function verifiedAuditSupplierIds") + 2500
  );
  check(
    "B7 verifiedAuditSupplierIds 失败方向保守（先建空集，出错就返回它）",
    /const out = new Set<string>\(\)/.test(vfn) && /catch[\s\S]{0,600}return out;/.test(vfn)
  );
  // 判 N+1 要看「发起了几次查询」，不是「有没有 for」—— 集合是从**已取回**的数组里遍历出来的。
  check(
    "B8 verifiedAuditSupplierIds 只发一次查询（无逐行 N+1）",
    (vfn.match(/\.from\(/g) || []).length === 1,
    `${(vfn.match(/\.from\(/g) || []).length} 次 .from()`
  );
  check("B9 新增 listSupplierSitemapRows()", /(export\s+)?function\s+listSupplierSitemapRows/.test(queries));
  check(
    "B10 listSupplierDirectory 用 publicVerificationLevel() 计算（不自己重写推导）",
    /function\s+listSupplierDirectory[\s\S]{0,2500}publicVerificationLevel\s*\(/.test(queries)
  );
  // 🔴 不变量是「布尔可公开、内容只能进 paid」——不是「这个字段名只许出现 N 次」（注释里也会出现）。
  check(
    "B11 hasScoreBreakdown 由非空判断派生（布尔，不是内容）",
    /hasScoreBreakdown:\s*row\.risk_breakdown\s*!=\s*null/.test(queries)
  );
  check(
    "B11b risk_breakdown 的**内容**只赋给 paid 层的 riskBreakdown，且仅一处",
    (queries.match(/riskBreakdown:\s*row\.risk_breakdown/g) || []).length === 1,
    `${(queries.match(/riskBreakdown:\s*row\.risk_breakdown/g) || []).length} 处`
  );
  check(
    "B11c SupplierView 没有把明细内容放在公开字段上（riskBreakdown 属 PAID_FIELDS）",
    read("lib/suppliers.ts").includes('"riskBreakdown"') && !/PUBLIC_FIELDS\s*=\s*\[[\s\S]{0,1200}"riskBreakdown"/.test(read("lib/suppliers.ts"))
  );
  check(
    "B12 updatedAt 未塞进 PUBLIC_FIELDS（保住 21 项）",
    !/PUBLIC_FIELDS\s*=\s*\[[\s\S]{0,1200}"updatedAt"/.test(read("lib/suppliers.ts"))
  );

  // ===========================================================================
  // C. 引擎层：lib/seo/supplierSeo.ts
  // ===========================================================================
  console.log("\n=== C. 引擎 —— 导出面与收口 ===");
  const seoText = read("lib/seo/supplierSeo.ts");
  check("C1 lib/seo/supplierSeo.ts 存在且非空", seoText.length > 5000, `${seoText.length} bytes`);
  for (const fn of [
    "generateSupplierTitle",
    "generateSupplierDescription",
    "generateSupplierSnapshot",
    "generateSupplierFaq",
    "generateSupplierSchema",
    "generateSupplierCanonical",
    "generateSupplierKeywordTargets",
    "determineSupplierIndexability",
    "supplierSeoDataFromView",
  ]) {
    check(`C2 导出 ${fn}()`, new RegExp(`export\\s+function\\s+${fn}\\b`).test(seoText));
  }
  check("C3 引擎层不依赖 server-only / next headers（保持纯函数）", !/server-only|next\/headers/.test(seoText));
  check(
    "C4 SupplierSeoData 不接收 free/paid 层字段（类型层防泄漏）",
    !/employees\s*[:?]/.test(seoText) && !/exportMarkets\s*[:?]/.test(seoText) && !/\bcertifications\s*[:?]/.test(seoText)
  );
  const profilePage = read("app/[locale]/suppliers/[slug]/page.tsx");
  check(
    "C5 页面把 SEO 逻辑收口到引擎（页面内不得残留自拼 JSON-LD）",
    /from\s+"@\/lib\/seo\/supplierSeo"/.test(profilePage) && !/"@context"/.test(profilePage)
  );
  check("C6 文案策略已写明其余语言回退英文（不外发机器翻译的免责声明）", /回退\s*EN|其余语言\s*→\s*EN|fallback/i.test(seoText));
  const sitemap = read("app/sitemap.ts");
  check(
    "C7 三处同源：引擎 / 档案页 / sitemap 都出现 determineSupplierIndexability",
    /determineSupplierIndexability/.test(seoText) &&
      /determineSupplierIndexability/.test(profilePage) &&
      /determineSupplierIndexability/.test(sitemap)
  );

  // ===========================================================================
  // D/E. 行为层（纯函数）
  // ===========================================================================
  const M = await import("../lib/seo/supplierSeo");
  const {
    generateSupplierTitle,
    generateSupplierDescription,
    generateSupplierSnapshot,
    generateSupplierFaq,
    generateSupplierSchema,
    determineSupplierIndexability,
    resolveSupplierSeoCopy,
    supplierSeoDataFromView,
  } = M;
  type Seo = import("../lib/seo/supplierSeo").SupplierSeoData;

  const base = (over: Partial<Seo> = {}): Seo => ({
    slug: "acme-tools",
    legalName: "Acme Tools Co., Ltd.",
    countryCode: "CN",
    countryName: "China",
    city: "Foshan",
    businessType: "Manufacturer",
    mainProducts: ["Hand Tools", "Garden Tools"],
    verificationLevel: 0,
    verificationScope: [],
    hasRealVerificationEvent: false,
    verifiedCertifications: [],
    profileScore: 72,
    profileScoreBand: "MODERATE",
    hasScoreBreakdown: false,
    evidenceOnFile: 0,
    ...over,
  });
  const verified = (over: Partial<Seo> = {}): Seo =>
    base({
      verificationLevel: 3,
      verificationScope: ["Company registration", "Production site"],
      hasRealVerificationEvent: true,
      ...over,
    });

  console.log("\n=== D1. 可索引性闸门（§八） ===");
  let v = determineSupplierIndexability(base());
  check("D1 公司名 + 地点 + 产品 ⇒ 可索引", v.indexable === true, `${v.reason} [${v.attributes.join(",")}]`);
  check("D2 attributes 无重复", new Set(v.attributes).size === v.attributes.length);
  v = determineSupplierIndexability(base({ mainProducts: [], profileScore: null }));
  check("D3 只有名字+地点 ⇒ noindex", v.indexable === false, v.reason);
  check("D4 原因码 = no-valuable-attribute", v.reason === "no-valuable-attribute", v.reason);
  v = determineSupplierIndexability(base({ city: "" }));
  check("D5 缺 city ⇒ noindex", v.indexable === false && v.reason === "missing-location", v.reason);
  v = determineSupplierIndexability(base({ countryName: "" }));
  check("D6 缺 country ⇒ noindex", v.indexable === false && v.reason === "missing-location", v.reason);
  v = determineSupplierIndexability(base({ legalName: "" }));
  check("D7 缺公司名 ⇒ noindex", v.indexable === false && v.reason === "missing-company-name", v.reason);
  check(
    "D8 仅官网也算有价值属性",
    determineSupplierIndexability(base({ mainProducts: [], profileScore: null, website: "https://x.example.com" })).indexable === true
  );
  check(
    "D9 仅证据条数 > 0 也算有价值属性",
    determineSupplierIndexability(base({ mainProducts: [], profileScore: null, evidenceOnFile: 2 })).indexable === true
  );
  check("D10 未核验但有实质属性 ⇒ 仍 index（不因未核验就 noindex）", determineSupplierIndexability(base()).indexable === true);

  console.log("\n=== D2. Title / Description ===");
  const enOpts = { copy: resolveSupplierSeoCopy("en"), levelLabel: "Factory verified" };
  const zhOpts = { copy: resolveSupplierSeoCopy("zh"), levelLabel: "工厂已核验" };

  const t1 = generateSupplierTitle(verified(), "en", enOpts);
  check("D11 title 含公司名", t1.includes("Acme Tools Co., Ltd."), t1);
  check("D12 title 含核验等级短语", /Factory verified/.test(t1), t1);
  check("D13 title 不含品牌（品牌由 buildPageMetadata 追加，避免重复）", !/FactoryAuditB2B/.test(t1), t1);
  check("D14 title 长度 <= 85", t1.length <= 85, `len=${t1.length}`);
  const longName =
    "Zhejiang Ningbo Yinzhou District Extremely Long Precision Hardware Manufacturing Co., Ltd.";
  const t2 = generateSupplierTitle(verified({ legalName: longName }), "en", enOpts);
  check("D15 超长公司名不得被截断（title 里不许出现不存在的公司名片段）", t2.includes(longName), `len=${t2.length}`);
  check("D16 超长公司名时宁可超长也不加省略号（TITLE_MAX 是偏好上限）", !t2.includes("…"), `len=${t2.length}`);
  check("D17 未核验 title 不得出现 Factory verified", !/Factory verified/.test(generateSupplierTitle(base(), "en", enOpts)));
  check("D18 zh title 用本地化等级短语", /工厂已核验/.test(generateSupplierTitle(verified(), "zh", zhOpts)));

  const d1 = generateSupplierDescription(base(), "en", enOpts);
  check("D19 未核验 desc 写「is a supplier-declared profile.」", /is a supplier-declared profile\./.test(d1), d1);
  check("D20 未核验 desc 合规句完整（截断不得吃掉）", /Not independently verified by FactoryAuditB2B\./.test(d1), d1);
  const dLong = generateSupplierDescription(
    base({
      mainProducts: [
        "Stainless Steel Kitchenware",
        "Aluminium Cookware",
        "Bamboo Cutting Boards",
        "Silicone Bakeware",
        "Cast Iron Pans",
        "Enamel Pots",
      ],
      address: "No. 88 Industrial Road, Shunde District",
      registrationNumber: "91440606MA4WXXXXXX",
    }),
    "en",
    enOpts
  );
  check("D21 超长 desc 长度 <= 200", dLong.length <= 200, `len=${dLong.length}`);
  check("D22 截断后合规句仍在（顺序即优先级）", /Not independently verified by FactoryAuditB2B\./.test(dLong), dLong.slice(-72));
  const d2 = generateSupplierDescription(verified(), "en", enOpts);
  check("D23 已核验 desc 写「recorded verification event」", /recorded verification event/.test(d2), d2);
  check("D24 已核验 desc 不得说「未独立核验」", !/not independently verified/i.test(d2));
  check("D25 desc 不出现 `Ltd..` 双句点", !/Ltd\.\./.test(d1 + d2 + dLong));
  const dzh = generateSupplierDescription(base(), "zh", zhOpts);
  check("D26 zh desc 合规句完整", /未经 FactoryAuditB2B 独立核验。/.test(dzh), dzh);
  check("D27 zh desc 中文句读后不留半角空格", !/[。，、；：]\s/.test(dzh), JSON.stringify(dzh.slice(0, 60)));
  const dNoProd = generateSupplierDescription(base({ mainProducts: [] }), "en", enOpts);
  check("D28 无产品时 desc 不出现「Listed products:」残句", !/Listed products:/.test(dNoProd), dNoProd);
  check("D29 无分数时 desc 不出现「score out of」残句", !/score\s+out of/.test(dNoProd), dNoProd);
  const dzhNo = generateSupplierDescription(base({ mainProducts: [] }), "zh", zhOpts);
  check("D30 zh 无产品时不出现「登记产品：」残句", !/登记产品：/.test(dzhNo), dzhNo);

  console.log("\n=== D3. Snapshot / FAQ / Schema ===");
  const labels: Record<string, string> = {
    englishName: "English name",
    city: "City",
    country: "Country",
    businessType: "Business type",
    industry: "Industry",
    products: "Main products",
    address: "Registered address",
    website: "Website",
    registrationNumber: "Registration no.",
    verificationLevel: "Verification level",
    lastUpdated: "Last updated",
    lastChecked: "Last checked",
    evidenceOnFile: "Evidence on file",
    scoreBand: "Moderate risk",
  };
  const snapV = generateSupplierSnapshot(verified(), "en", labels, enOpts);
  const snapU = generateSupplierSnapshot(base(), "en", labels, enOpts);
  check("D31 snapshot 行数 >= 8", snapV.length >= 8, `${snapV.length} rows`);
  check(
    "D32 snapshot 含核验等级行且写明 (3 / 4)",
    snapV.some((r) => /Verification level/i.test(r.label) && /3 \/ 4/.test(r.value))
  );
  // 注意：等级行走未核验**口径**，但 unknown 是 false —— 等级 0 是「已知的事实」，
  // 不是「没有数据」。unknown 只留给真正缺数据的行（地址/官网/时间戳那些）。
  check(
    "D33 未核验 snapshot 的等级行走未核验口径（且仍是有值行，不是 unknown）",
    snapU.some((r) => /Verification level/i.test(r.label) && /not independently verified/i.test(r.value) && r.unknown === false)
  );
  check(
    "D33b 真正缺数据的行才标 unknown",
    snapU.some((r) => r.unknown === true && /Not available in the current supplier profile\./.test(r.value))
  );
  check(
    "D34 snapshot 含评分免责声明行（note）",
    snapV.some((r) => r.note === true && /not constitute an independent assessment/.test(r.value))
  );
  check("D35 snapshot 含数据覆盖度行", snapV.some((r) => /Data coverage/i.test(r.label)));
  check("D36 city / country 是两行（便于复用字典键）", snapV.some((r) => r.id === "city") && snapV.some((r) => r.id === "country"));

  const faqV = generateSupplierFaq(verified(), "en", enOpts);
  const faqU = generateSupplierFaq(base(), "en", enOpts);
  check("D37 FAQ 条数 3–8（已核验）", faqV.length >= 3 && faqV.length <= 8, `${faqV.length}`);
  check("D38 FAQ 条数 3–8（未核验）", faqU.length >= 3 && faqU.length <= 8, `${faqU.length}`);
  check("D39 FAQ id 唯一", new Set(faqV.map((f) => f.id)).size === faqV.length);
  check("D40 FAQ 恒含 how-to-check", faqV.some((f) => f.id === "how-to-check") && faqU.some((f) => f.id === "how-to-check"));
  check("D41 已核验首条 = verified", faqV[0].id === "verified", faqV[0].id);
  check("D42 未核验首条 = unverified", faqU[0].id === "unverified", faqU[0].id);
  const faqSelf = generateSupplierFaq(base({ selfReportedCertificates: [{ name: "ISO 9001" }] }), "en", enOpts);
  check(
    "D43 自述证书走 certs-reported 且带「未审阅核验」口径",
    faqSelf.some((f) => f.id === "certs-reported" && /not been reviewed or verified/.test(f.a))
  );
  check("D44 自述证书不得走 certs-verified（两轴不得混淆）", !faqSelf.some((f) => f.id === "certs-verified"));
  check("D45 无认证走 certs-none", faqU.some((f) => f.id === "certs-none"));

  const ctx = {
    locale: "en",
    profileUrl: "https://factoryauditb2b.com/suppliers/acme-tools",
    homeUrl: "https://factoryauditb2b.com/",
    directoryUrl: "https://factoryauditb2b.com/suppliers",
    breadcrumbHome: "Home",
    breadcrumbDirectory: "Suppliers",
    htmlLang: "en",
    publisherId: "https://factoryauditb2b.com#organization",
  };
  const types = (generateSupplierSchema(verified(), ctx, faqV) as { "@graph": { "@type": string }[] })["@graph"].map(
    (n) => n["@type"]
  );
  check("D46 schema @graph 含 Organization", types.includes("Organization"), types.join("+"));
  check("D47 schema @graph 含 WebPage", types.includes("WebPage"));
  check("D48 schema @graph 含 BreadcrumbList", types.includes("BreadcrumbList"));
  check("D49 有 FAQ 时含 FAQPage", types.includes("FAQPage"));
  check("D50 schema 不含 LocalBusiness（§九：不硬凑）", !types.includes("LocalBusiness"));
  check("D51 schema 不含 Product / AggregateRating（无真实产品数据）", !types.includes("Product") && !types.includes("AggregateRating"));
  check(
    "D52 未核验档案的 schema 全文不得出现核验断言",
    !/Factory verified/.test(JSON.stringify(generateSupplierSchema(base(), ctx, faqU)))
  );

  // ===========================================================================
  // E. 适配层
  // ===========================================================================
  console.log("\n=== E. 适配器 supplierSeoDataFromView（页面与测试同一段映射） ===");
  type SrcView = Parameters<typeof supplierSeoDataFromView>[0];
  const src = (over: Partial<SrcView> = {}): SrcView =>
    ({
      slug: "sunny",
      legalName: "Sunny Co., Ltd.",
      country: "CN",
      countryName: "China",
      city: "Guangzhou",
      businessType: "Manufacturer",
      mainProducts: ["Sauce"],
      verificationLevel: "on_site_audit",
      evidenceCount: 1,
      riskScore: 96,
      ...over,
    }) as SrcView;
  const a = supplierSeoDataFromView(src(), { verifiedAudits: [{} as never], verifiedCertifications: [] });
  check("E1 有真实核验事件 ⇒ level = 3", a.level === 3, `level=${a.level}`);
  const b = supplierSeoDataFromView(src(), { verifiedAudits: [], verifiedCertifications: [] });
  check("E2 无真实核验事件 ⇒ 等级强制归 0（仅有等级声明无效）", b.level === 0, `level=${b.level}`);
  check("E3 适配器把分数带进 SEO 数据", a.seo.profileScore === 96, String(a.seo.profileScore));
  check("E4 适配器不带 employees / exportMarkets 类字段", !("employees" in a.seo) && !("exportMarkets" in a.seo));

  // ===========================================================================
  // F. 冻结层
  // ===========================================================================
  console.log("\n=== F1. 字典（en 叶子数是单一事实源） ===");
  const dictLeaves: Record<string, Leaf[]> = {};
  for (const loc of LOCALES) {
    const p = `i18n/dictionaries/${loc}.json`;
    check(`F1a 字典存在：${loc}.json`, exists(p));
    dictLeaves[loc] = leaves(JSON.parse(read(p)));
  }
  const enKeys = dictLeaves.en.map((l) => l.key).sort();
  check(`F1b en 叶子数 = ${EN_LEAF_COUNT}（未被截断/新增）`, enKeys.length === EN_LEAF_COUNT, `实际 ${enKeys.length}`);
  for (const loc of LOCALES) {
    if (loc === "en") continue;
    const keys = dictLeaves[loc].map((l) => l.key).sort();
    const missing = enKeys.filter((k) => !keys.includes(k)).length;
    const extra = keys.filter((k) => !enKeys.includes(k)).length;
    check(`F1c ${loc} 与 en 键集合一致（getDictionary 无深 fallback）`, missing === 0 && extra === 0, `missing=${missing} extra=${extra}`);
  }
  for (const loc of LOCALES) {
    const raw = fs.readFileSync(path.join(ROOT, "i18n/dictionaries", `${loc}.json`));
    const s = raw.toString("utf8");
    const crlf = (s.match(/\r\n/g) || []).length;
    const lf = (s.match(/\n/g) || []).length;
    check(`F1d ${loc}.json 仍是 CRLF + 末尾换行`, lf - crlf === 0 && s.endsWith("\r\n"), `bareLF=${lf - crlf} crlf=${crlf}`);
  }
  const en = JSON.parse(read("i18n/dictionaries/en.json"));
  const zh = JSON.parse(read("i18n/dictionaries/zh.json"));
  check("F1e en suppliers.riskLabel = 'Supplier profile score'（§一 改名）", en.suppliers.riskLabel === "Supplier profile score", en.suppliers.riskLabel);
  check("F1f zh suppliers.riskLabel = '供应商档案评分'", zh.suppliers.riskLabel === "供应商档案评分", zh.suppliers.riskLabel);
  check("F1g en supplierProfile.riskScore = 'Supplier profile score'", en.supplierProfile.riskScore === "Supplier profile score", en.supplierProfile.riskScore);
  const badScoreLabel = LOCALES.filter((l) => /risk[\s-]?score/i.test(JSON.parse(read(`i18n/dictionaries/${l}.json`)).suppliers.riskLabel));
  check("F1h 九语 riskLabel 均不再表述为「risk score」", badScoreLabel.length === 0, badScoreLabel.join(","));
  for (const [f, pat] of [
    ["scripts/cs06a-directory-regression.ts", "baseKeys.length === 2938"],
    ["scripts/cs08-form-regression.ts", "leafCounts[0] === 2938"],
    ["scripts/cs12-profile-regression.ts", "enLeaf === 2938"],
    ["scripts/verify-opennext-bundle.mjs", "cnt !== 2938"],
  ] as const) {
    check(`F1i ${f} 的叶子数常量仍为 2938（五处同源）`, read(f).includes(pat));
  }
  check(
    "F1j verify-opennext-bundle 的期望值文本未被弱化",
    read("scripts/verify-opennext-bundle.mjs").includes("(期望 2938)")
  );

  console.log("\n=== F2. 字段分层 / 迁移 / 历史（本轮零越界） ===");
  const supLib = read("lib/suppliers.ts");
  // ⚠️ 终止符必须是 `] as const`，写 `];` 会滑到下一个数组去（本项目三个字段表全是 `] as const;`），
  //    那样数出来的引号数会把后面的代码也算进来 —— 曾因此报出 40/19/10 的假 FAIL。
  const countOf = (arr: string, key: string) => {
    const start = arr.indexOf(key);
    const end = arr.indexOf("] as const", start);
    return ((arr.slice(start, end).match(/"/g) || []).length / 2);
  };
  check("F2a PUBLIC_FIELDS 仍 21 项", countOf(supLib, "export const PUBLIC_FIELDS") === 21, String(countOf(supLib, "export const PUBLIC_FIELDS")));
  check("F2b FREE_FIELDS 仍 13 项（4 basic + 4 产能 + 5 CS-16 联系/属地）", countOf(supLib, "export const FREE_FIELDS") === 13, String(countOf(supLib, "export const FREE_FIELDS")));
  check("F2c PAID_FIELDS 仍 4 项", countOf(supLib, "export const PAID_FIELDS") === 4, String(countOf(supLib, "export const PAID_FIELDS")));
  const migDir = path.join(ROOT, "supabase/migrations");
  const migs = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql"));
  // 8 → 10：STEP-02 加 023_supplier_geo_cluster_source.sql、
  //          STEP-02B 加 024_industrial_clusters_and_public_rfq.sql（均为用户指令内的增量变更）。
  //          CS-13 本轮零 DDL —— 这里只是把"历史上限"与真实文件数对齐。
  const MIGRATION_COUNT = 10;
  check(
    `F2d supabase/migrations 仍 ${MIGRATION_COUNT} 个 .sql（CS-13 本轮零 DDL）`,
    migs.length === MIGRATION_COUNT,
    migs.join(",")
  );
  for (const m of ["001_init.sql", "004_documents.sql", "006_compliance_fields.sql", "008_leads.sql", "009_supplier_profile_extras.sql"]) {
    check(`F2e 迁移仍在：${m}`, exists(`supabase/migrations/${m}`));
  }
  check("F2f CS-03 迁移仍在（007 序号）", exists("supabase/cs03/02_migration.sql"));
  check("F2g CS-07 迁移仍在（008 序号）", exists("supabase/cs07/02_migration.sql"));
  check("F2h 审计报告仍在（PHASE 01 交付物）", exists("docs/SUPPLIER-SEO-V1.0-AUDIT.md"));
  check(
    "F2i 档案页仍导出 generateStaticParams / generateMetadata（SSG 未退化）",
    /export\s+async\s+function\s+generateMetadata/.test(profilePage) &&
      /export\s+(async\s+)?function\s+generateStaticParams/.test(profilePage)
  );
  check("F2j 档案页不读 cookies / headers（否则退化成 Dynamic）", !/next\/headers/.test(profilePage));
  // ⚠️ 不能用「下一个 `});`」当块尾：那个落点是 determineSupplierIndexability({...}); 的收尾，
  //    会把这之后真正的 lastModified 逻辑切掉（曾造成 F2k 假 PASS + F2l/m/n 假 FAIL）。
  //    固定取 1600 字符窗口，足够覆盖整个 forEach 回调。
  const supStart = sitemap.indexOf("supplierRows.forEach");
  const supBlock = sitemap.slice(supStart, supStart + 1600);
  check("F2k sitemap 供应商块不再用 new Date() 顶替 lastModified", !/new Date\s*\(\s*\)/.test(supBlock));
  check("F2l sitemap 供应商块用真实 row.updatedAt", /row\.updatedAt/.test(supBlock));
  check("F2m sitemap 供应商块有 NaN 守卫", /Number\.isNaN/.test(supBlock));
  check("F2n sitemap 供应商块带 !verdict.indexable ⇒ return（闸门即提交集）", /!\s*verdict\.indexable\s*\)\s*return/.test(supBlock));

  // ===========================================================================
  // G. 真实 DB（可选）
  // ===========================================================================
  console.log("\n=== G. 数据层（真实 DB；无 .env 时 SKIP） ===");
  if ((process.env.SUPPLIER_DATA_SOURCE ?? "") !== "supabase") {
    skipped("G1–G5 真实 DB 行为", "SUPPLIER_DATA_SOURCE 非 supabase（静态兜底模式）");
  } else {
    const q = await import("../lib/queries");
    const rows = await q.listSupplierSitemapRows();
    check("G1 listSupplierSitemapRows 返回数组且有数据", Array.isArray(rows) && rows.length > 0, `${rows.length} rows`);
    const badUpdated = rows.filter((r) => r.updatedAt != null && Number.isNaN(new Date(r.updatedAt).getTime()));
    check("G2 每行 updatedAt 为 null 或可解析时间", badUpdated.length === 0, badUpdated.map((r) => r.slug).join(","));
    const gated = rows.map((r) =>
      determineSupplierIndexability({
        legalName: r.legalName,
        city: r.city,
        countryName: r.countryName,
        mainProducts: r.mainProducts,
        verificationLevel: r.verificationLevel,
        hasRealVerificationEvent: r.hasRealVerificationEvent,
        website: r.website,
        registrationNumber: r.registrationNumber,
        address: r.address,
        profileScore: r.profileScore,
        evidenceOnFile: r.evidenceOnFile,
      })
    );
    check("G3 闸门对真实行全部返回结构化判定", gated.every((g) => typeof g.indexable === "boolean"));
    console.log(
      "        闸门结果：" +
        rows.map((r, i) => `${gated[i].indexable ? "IN" : "OUT"}:${r.slug}(L${r.verificationLevel})`).join("  ")
    );
    const sunny = await q.getSupplierDetail("guangzhou-sunny-food", "en");
    if (!sunny) {
      skipped("G4 Sunny Food 真实核验态", "库中未找到 guangzhou-sunny-food");
    } else {
      check("G4 Sunny Food 有真实核验事件", sunny.verificationLevel === "on_site_audit", String(sunny.verificationLevel));
      const audits = await q.getSupplierPublicAudits("guangzhou-sunny-food");
      check("G5 Sunny Food 公开审核记录 > 0", audits.length > 0, `${audits.length} audits`);
      const dv = supplierSeoDataFromView(sunny as Parameters<typeof supplierSeoDataFromView>[0], {
        verifiedAudits: audits as never,
        verifiedCertifications: [],
      });
      check("G6 Sunny Food 推导等级 = 3", dv.level === 3, `level=${dv.level}`);
      check("G7 Sunny Food 闸门 = 可索引", determineSupplierIndexability(dv.seo).indexable === true);
      check("G8 Sunny Food title 含 Factory verified", /Factory verified/.test(generateSupplierTitle(dv.seo, "en", { ...enOpts, levelLabel: "Factory verified" })));
    }
    const prec = await q.getSupplierDetail("shenzhen-precision-electronics", "en");
    if (!prec) {
      skipped("G9 未核验对照家", "库中未找到 shenzhen-precision-electronics");
    } else {
      const audits = await q.getSupplierPublicAudits("shenzhen-precision-electronics");
      const dv = supplierSeoDataFromView(prec as Parameters<typeof supplierSeoDataFromView>[0], {
        verifiedAudits: audits as never,
        verifiedCertifications: [],
      });
      check("G9 未核验对照家推导等级 = 0", dv.level === 0, `level=${dv.level}`);
      check(
        "G10 未核验对照家的 desc 保留合规句",
        /Not independently verified by FactoryAuditB2B\./.test(generateSupplierDescription(dv.seo, "en", enOpts))
      );
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`CS-13 供应商 SEO 回归：${pass} PASS / ${fail} FAIL${skip ? ` / ${skip} SKIP` : ""}`);
  console.log("=".repeat(60));
  process.exit(fail === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error("\n[异常] " + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
