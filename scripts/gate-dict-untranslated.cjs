#!/usr/bin/env node
/**
 * scripts/gate-dict-untranslated.cjs —— 门禁③：未翻译门（只读）
 *
 * 判据（对 es/de/fr/pt/ja/ar 六个语种，逐键对比 en）：
 *   1) 取值与 en 在同一键路径上**逐字符相同** ⇒ 违规（语言中立项除外）。
 *   2) 🔴 判据盲区补丁：取值为 ≥60 字符、纯 ASCII 可打印（含 – —）、
 *      且含 ≥8 个英语功能词 ⇒ 判为「疑似未译」。
 *      —— 堵住"整段英文但结尾措辞与 en 略不同 ⇒ 逃过等值判据"的盲区
 *         （真实案例：es.about.storyBody 曾是一整段英文，措辞与 en 不同）。
 *
 * 排除：品牌名 / 公司名 / URL / 邮箱 / 标准代号 / 供应商原文（供应商原文走白名单）。
 *
 * ⚠️ 已知盲区（如实记录，勿误以为覆盖）：`isCognateSingle` 对 es/de/fr/pt **豁免单 token**
 *    （因这些语言与英语同形词太多），代价是**会漏报 `Free` / `No` 这类单 token 真漏译**。
 *    本轮已由 team-lead 人工补 6 语 `planFree`（es/de/fr/pt/ja/ar）与 ar 的 `risk.options.*.no`，
 *    门禁不会自动报出它们 —— 下一个读代码的人请勿认为门禁覆盖了该场景。
 *
 * 用法：
 *   node scripts/gate-dict-untranslated.cjs
 *   node scripts/gate-dict-untranslated.cjs --selftest
 *   node scripts/gate-dict-untranslated.cjs --verbose
 *
 * 退出码：0 全通过 / 1 发现违规 / 2 数据缺失。
 */

const fs = require("fs");
const path = require("path");
const L = require("./gate-i18n-lib.cjs");

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");

/** 供应商原文 / 专名白名单（供应商自己提供的中文/英文原文，任何语种都可原样保留） */
const SUPPLIER_ALLOW = [
  /^[\u4E00-\u9FFF]{2,12}$/, // 纯中文短名（供应商/人名）
  /(Co\.,?\s*Ltd\.?|Limited|GmbH|LLC|Inc\.?|S\.A\.|B\.V\.|Pte\.?\s*Ltd)/i, // 公司后缀
];

/** 结构性标识符：枚举值 / slug / 模板占位 —— 不是面向用户的文案，任何语种都可原样 */
function isStructuralIdentifier(v, key) {
  const s = String(v).trim();
  if (/^\$\{[^}]*\}$/.test(s)) return true; // ${price}
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(s)) return true; // id_legal / fa_address / qm_system
  if (/\.(key|id|ids|code|codes|slug|enum|value)$/i.test(key)) return true;
  return false;
}

/** 支付/社交/物流品牌名 —— 专名，任何语种都可原样 */
const BRAND_TOKENS_EXTRA = new Set([
  "paypal", "alipay", "stripe", "visa", "mastercard", "wechat", "whatsapp",
  "amazon", "alibaba", "google", "linkedin", "youtube", "dhl", "fedex", "ups",
]);

/**
 * 同形合法（类 B）：拉丁语系（es/de/fr/pt）与英语共享大量同形词
 * （Audit / Type / Status / Name / Region / Plan / Service / China / Vietnam …），
 * 单 token 命中无法与"真·未译"区分 ⇒ 对这四个语种豁免单 token。
 * ⚠️ ja/ar 不豁免：其文字系统与拉丁字母不同，任何与 en 逐字符相同的拉丁 token
 *    按定义就是未译（如 Free / English / medium）。
 */
const LATIN_COGNATE_LOCALES = new Set(["es", "de", "fr", "pt"]);
function isCognateSingle(v, loc) {
  return LATIN_COGNATE_LOCALES.has(loc) && !/\s/.test(String(v).trim());
}

/**
 * 逐条显式白名单（同形合法）—— team-lead 决策 2 要求：每条注明原因，不放宽通用判据。
 * 仅当 locale + key + value 三者完全一致时豁免。
 */
const HOMOGRAPH_ALLOW = [
  // de：「Phase」在德语里就是 Phase（与英语同形）。对照证据：es=Fase 1 / fr=Première phase / ja=フェーズ1 / ar=المرحلة الأولى 均已本地化。
  { locale: "de", key: "coverage.phase1", value: "Phase 1" },
  // es/de/pt：「China」在这三种语言里就是正确写法（西语/德语/葡语均作 China）。
  // 对照证据：fr=Dongguan, Chine、ja=中国・東莞、ar=دونغقوان، الصين 均已本地化 ⇒ 只有 es/de/pt 是合法同形。
  { locale: "es", key: "home.sample.valLocation", value: "Dongguan, China" },
  { locale: "de", key: "home.sample.valLocation", value: "Dongguan, China" },
  { locale: "pt", key: "home.sample.valLocation", value: "Dongguan, China" },
];
function isHomographAllowed(loc, key, v) {
  return HOMOGRAPH_ALLOW.some((e) => e.locale === loc && e.key === key && e.value === v);
}

/**
 * ⚠️ 已删除「品牌计划名」值级白名单（`BRAND_PLAN_NAMES = {"Founding Buyer"}`）。
 * 原因：用户拍板把 `Founding Buyer` **译成各语种**（zh 创始买家 / de Gründungskäufer / ja 創業バイエー …，
 *   直接复用各语已存在的 `membership.planName`），en 保持源串。此时该常量已无任何值匹配 ⇒ 死条目，
 *   且保留会掩盖"某语种又把该键回退成英文"的回归。
 * 反向证据（自证固化）：删白名单后 `Founding Buyer` 同值**必须仍命中**（见 --selftest）。
 * 注意：站点为「品牌名保留英文 + 本地化短标签」双轨，正文另有 11~21 处英文品牌名**本轮有意不动**，
 *   故本门不会因正文残留而误报（那是范围边界，非缺陷）。
 */

/**
 * 键级白名单：语言名按其母语写法显示（设计如此，非漏译）。
 * 证据（实测）：`standardReport.langZh` 在**全部 9 语**都是 `中文`；`langEn` 在 zh/zh-TW 是 `英文`，
 *   其余 7 语是 `English` ⇒ 本键语义 =「语言名的母语写法」，en 显示 English 是设计。
 * 只用**键级**：值级会把别处真漏译的 `English` 一并放过。
 */
const KEY_VALUE_ALLOW = [{ key: "standardReport.langEn", value: "English" }];

/**
 * 键模式白名单：`sampleReport.changes[*].impact`（`low`/`medium`）。
 * 证据：9 语（en/zh/zh-TW/es/de/fr/pt/ja/ar）恒为 low/medium/medium（连中文站也是 low），
 *   且全仓 grep `.impact` **零命中**（无代码消费者）⇒ 疑为样例/死键，另案确认。
 * 只用**键模式**：值级会把别处真漏译的 low/medium 一并放过。
 */
const KEY_PATTERN_ALLOW = [/^sampleReport\.changes\[\d+\]\.impact$/];

function isKeyAllowlisted(key, v) {
  if (KEY_VALUE_ALLOW.some((e) => e.key === key && e.value === v)) return true;
  if (KEY_PATTERN_ALLOW.some((re) => re.test(key))) return true;
  return false;
}

/** 纯函数核心：给定 {en:展平, loc:展平}，返回违规 */
function collectViolations(enFlat, flatByLoc, locales) {
  const out = [];
  for (const loc of locales) {
    const flat = flatByLoc[loc] || {};
    for (const key of Object.keys(flat)) {
      if (!(key in enFlat)) continue;
      const v = flat[key];
      const e = enFlat[key];
      if (typeof v !== "string") continue;
      if (!v.trim()) continue;
      if (L.isNeutralValue(v)) continue;
      if (SUPPLIER_ALLOW.some((re) => re.test(v))) continue;
      const eStr = typeof e === "string" ? e : "";
      if (v === eStr) {
        if (isKeyAllowlisted(key, v)) continue; // 键级 / 键模式白名单
        if (isHomographAllowed(loc, key, v)) continue;
        if (isStructuralIdentifier(v, key)) continue;
        if (BRAND_TOKENS_EXTRA.has(v.trim().toLowerCase())) continue;
        if (isCognateSingle(v, loc)) continue;
        out.push({ locale: loc, key, reason: "与 en 完全相同", value: v.slice(0, 120) });
        continue;
      }
      if (L.looksLikeUntranslatedEnglish(v) && !L.looksLikeUntranslatedEnglish(eStr)) {
        out.push({
          locale: loc,
          key,
          reason: `疑似未译（整段英文，${L.countEnFunctionWords(v)} 个功能词）`,
          value: v.slice(0, 120),
        });
      }
    }
  }
  return out;
}

function main() {
  const enPath = path.join(L.DICT_DIR, "en.json");
  if (!fs.existsSync(enPath)) {
    console.error(`[gate-dict-untranslated] 数据缺失：找不到 ${enPath}`);
    process.exit(2);
  }
  const enFlat = L.flatten(JSON.parse(fs.readFileSync(enPath, "utf8")));
  const flatByLoc = {};
  for (const loc of L.CONTENT_LOCALES) {
    const f = path.join(L.DICT_DIR, `${loc}.json`);
    if (!fs.existsSync(f)) {
      console.error(`[gate-dict-untranslated] 数据缺失：找不到 ${f}`);
      process.exit(2);
    }
    flatByLoc[loc] = L.flatten(JSON.parse(fs.readFileSync(f, "utf8")));
  }

  console.log(`\n${"=".repeat(74)}`);
  console.log("门禁③ 未翻译（基线 = en）");
  console.log(`${"=".repeat(74)}`);

  const violations = collectViolations(enFlat, flatByLoc, L.CONTENT_LOCALES);
  const byLoc = {};
  const byReason = {};
  for (const v of violations) {
    byLoc[v.locale] = (byLoc[v.locale] || 0) + 1;
    const r = v.reason.startsWith("与 en") ? "与 en 完全相同" : "疑似未译（整段英文）";
    byReason[r] = (byReason[r] || 0) + 1;
  }
  console.log("\n各语种违规数：");
  for (const l of L.CONTENT_LOCALES) console.log(`  ${l.padEnd(6)} ${byLoc[l] || 0}`);
  console.log("\n分类：");
  for (const r of Object.keys(byReason)) console.log(`  ${r.padEnd(22)} ${byReason[r]}`);
  console.log(`\n合计违规：${violations.length} 条`);
  const show = VERBOSE ? violations : violations.slice(0, 30);
  for (const v of show) console.log(`  ✗ [${v.locale}] ${v.key}  ${v.reason}：${v.value}`);
  if (!VERBOSE && violations.length > show.length)
    console.log(`  …（共 ${violations.length} 条，--verbose 看全部）`);

  if (violations.length > 0) {
    console.log("\n❌ 门禁③ 未通过");
    process.exit(1);
  }
  console.log("\n✅ 门禁③ 通过");
  process.exit(0);
}

// ─────────────────────────────────────────────
// 自证
// ─────────────────────────────────────────────
function selftest() {
  const { check, done } = L.makeCheck();
  console.log("\n门禁③ gate-dict-untranslated --selftest");

  const EN_LONG =
    "FactoryAuditB2B was built by auditors and QC engineers who spent years inside factories in China and across Asia, and who kept seeing the same gap from both sides.";
  // 与 en 不同、但仍是整段英文（模拟 es.about.storyBody 那次真实事故）
  const ES_ENGLISH =
    "We built this platform after years inside factories in China and across Asia, and we kept seeing the same gap between buyers and good manufacturers.";

  console.log("\n── 阳性对照 A：取值 == en ⇒ 必须判违规 ──");
  const enA = { "panel.title": "Supplier Dashboard Overview" };
  const locA = { es: { "panel.title": "Supplier Dashboard Overview" } };
  const vA = collectViolations(enA, locA, ["es"]);
  check("es 与 en 完全相同 ⇒ 命中", vA.length === 1 && vA[0].reason.includes("完全相同"));

  console.log("\n── 阳性对照 B：整段英文但措辞与 en 略不同（判据盲区）⇒ 必须判违规 ──");
  const enB = { "about.storyBody": EN_LONG };
  const locB = { es: { "about.storyBody": ES_ENGLISH } };
  const vB = collectViolations(enB, locB, ["es"]);
  check(`es 整段英文(≠en) ⇒ 命中 (${L.countEnFunctionWords(ES_ENGLISH)} 个功能词)`, vB.length === 1);
  check("命中理由为『疑似未译』", vB.some((v) => v.reason.includes("疑似未译")));

  console.log("\n── 阴性对照：真西语长句（≥60 字符、纯 ASCII）⇒ 必须通过 ──");
  const esReal =
    "Verificamos fabricas en Asia y formamos a sus equipos, para que los problemas que encontramos no vuelvan a aparecer antes de pagar.";
  const locC = { es: { "about.storyBody": esReal } };
  check(
    `西语长句(${esReal.length} 字符, ${L.countEnFunctionWords(esReal)} 个英文功能词)不命中`,
    collectViolations(enB, locC, ["es"]).length === 0
  );

  console.log("\n── 阴性对照：语言中立 / 品牌 / URL / 标准代号 ⇒ 必须通过 ──");
  const enD = { "doc.iso": "ISO 9001:2015", "doc.url": "https://factoryauditb2b.com", "brand.name": "FactoryAuditB2B", "c.name": "Shenzhen XX Electronics Co., Ltd." };
  const locD = { de: { ...enD } };
  check("中立项同值不命中", collectViolations(enD, locD, ["de"]).length === 0);

  console.log("\n── 阴性对照：供应商中文原文 ⇒ 必须通过 ──");
  const enE = { "supplier.name": "Supplier Name" };
  const locE = { ja: { "supplier.name": "江门志宇科技" } };
  check("供应商中文原文不命中", collectViolations(enE, locE, ["ja"]).length === 0);

  console.log("\n── 显式白名单（同形合法）必须精确生效 ──");
  const enH = { "coverage.phase1": "Phase 1", "home.sample.valLocation": "Dongguan, China" };
  check(
    "de Phase 1 / Dongguan, China ⇒ 白名单豁免",
    collectViolations(enH, { de: { ...enH } }, ["de"]).length === 0
  );
  check(
    "白名单按 locale 精确匹配：fr 同值仍命中",
    collectViolations(enH, { fr: { "coverage.phase1": "Phase 1" } }, ["fr"]).length === 1
  );
  check(
    "白名单按 key 精确匹配：de 另一键同值 ⇒ 仍命中",
    collectViolations({ "coverage.phase2": "Phase 1" }, { de: { "coverage.phase2": "Phase 1" } }, ["de"])
      .length === 1
  );

  console.log("\n── 品牌计划名白名单已删：Founding Buyer 同值 ⇒ 必须仍命中（防回归）──");
  // 反转自证：白名单存在时此断言会得到 0、必然 FAIL；删净后应为 3。故它自证"白名单确实删净、
  // 未来任何语种把 planFounding 回退成英文都会被本门抓到"。
  const enBP = { "auth.accountMenu.planFounding": "Founding Buyer" };
  check(
    "es/ja/ar 同值 Founding Buyer ⇒ 全部命中（证明值级白名单已删净）",
    collectViolations(
      enBP,
      {
        es: { "auth.accountMenu.planFounding": "Founding Buyer" },
        ja: { "auth.accountMenu.planFounding": "Founding Buyer" },
        ar: { "auth.accountMenu.planFounding": "Founding Buyer" },
      },
      ["es", "ja", "ar"]
    ).length === 3
  );

  console.log("\n── 键级 / 键模式白名单（决策 A）──");
  check(
    "standardReport.langEn = English ⇒ 豁免",
    collectViolations(
      { "standardReport.langEn": "English" },
      { ja: { "standardReport.langEn": "English" }, ar: { "standardReport.langEn": "English" } },
      ["ja", "ar"]
    ).length === 0
  );
  check(
    "其它键 = English ⇒ 仍命中（键级不放宽值级）",
    collectViolations({ "x.langEn": "English" }, { ja: { "x.langEn": "English" } }, ["ja"]).length === 1
  );
  check(
    "sampleReport.changes[N].impact 键模式豁免",
    collectViolations(
      { "sampleReport.changes[1].impact": "medium" },
      { ja: { "sampleReport.changes[1].impact": "medium" } },
      ["ja"]
    ).length === 0
  );
  check(
    "其它键 = medium ⇒ 仍命中（键模式不放宽值级）",
    collectViolations({ "x.impact": "medium" }, { ja: { "x.impact": "medium" } }, ["ja"]).length === 1
  );

  return done("门禁③ 自检结果");
}

if (argv.includes("--selftest")) process.exit(selftest());
else main();
