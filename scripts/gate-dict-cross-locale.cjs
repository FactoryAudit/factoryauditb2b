#!/usr/bin/env node
/**
 * scripts/gate-dict-cross-locale.cjs —— 门禁②：跨语种污染门（只读）
 *
 * 判据：对 9 语字典做**递归展平**后逐键比较：
 *   非 es 语种的取值，不得与 es 语种在**同一键路径**上的取值逐字符相同。
 *   （典型事故：把西语译文误粘进 de/fr/pt/ja/ar 文件。）
 *
 * 白名单（三类，均在 --selftest 里各放正/负对照）：
 *   A. 语言中立项 —— URL / 邮箱 / 电话 / 纯数字符号 / 品牌词 / 标准代号（ISO 9001 …）
 *   B. 同形合法 —— 单 token（无空白）且 ≤16 字符的取值（外来词 / 专名，跨语种天然同形，如 Menu / for）
 *   C. 专名（**键级**）—— 只对下列键豁免，防"别处同值真漏译"被顺带放过：
 *        `sampleReport.companyName`（样例报告里的**虚构公司名**，用户原始任务白名单含"供应商公司名"）；
 *        `home.sample.valLocation`（地名，`China` 在 es/de/pt 就是正确写法，与门禁③ 同源）。
 *      ⚠️ 刻意用**键级**而非值级：值级会掩盖"未来某语种把样例公司名当真实公司名误译"的回归。
 *
 * 历史：曾有「值级品牌计划名 Founding Buyer」白名单 —— 因用户拍板把该品牌名**译成各语种**而删除；
 *        自证已反转（`Founding Buyer` 同值**必须仍命中**），防止白名单残留掩盖未来回退。
 *
 * 用法：
 *   node scripts/gate-dict-cross-locale.cjs
 *   node scripts/gate-dict-cross-locale.cjs --selftest
 *   node scripts/gate-dict-cross-locale.cjs --verbose
 *
 * 退出码：0 全通过 / 1 发现违规 / 2 数据缺失。
 */

const fs = require("fs");
const path = require("path");
const L = require("./gate-i18n-lib.cjs");

const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");
const REF = "es";

/**
 * 参与比较的目标语种（team-lead 决策 1）：
 *   - 排除 REF(es) 本身；
 *   - 排除 en —— en 是源语言，取值与 es 相同本来就正常，不属于"污染"。
 */
const CHECK_LOCALES = ["zh", "zh-TW", "de", "fr", "pt", "ja", "ar"];

/**
 * pt 专用判据（team-lead 决策 1）：西/葡同形词太多，「== es」不构成污染证据，
 * 改为「出现西语专有标记才算违规」。
 *
 * ⚠️ 关键修正（照 team-lead 自己"排除葡语也有的词"的原则执行）：
 *   初版词表里的 `está / país / sobre / entre / desde / porque` **本身就是葡语词**
 *   （实测：`home.howSteps[0].body` = "…do que está faltando."、`nav.about` = "Sobre nós"、
 *   `home.evaLead` = "…entre um fornecedor…" 全被误判），单靠它们造成 162 条假阳。
 *   故移出词表，只保留"葡语不用/拼写不同"的强标记词。
 * ⚠️ 刻意排除：para（葡语也有）、documentos / fábrica / verificação（同形合法）。
 */
const ES_MARK_CHARS = /[ñÑ¿¡]/;
const ES_MARK_WORDS = [
  "los", "las", "del", "con", "más", "también", "están", "sólo", "además",
  "cómo", "qué", "según", "través", "años", "días", "electrónico",
  "usted", "nuestro", "nuestra", "nosotros", "hay", "muy", "pero",
  "cuando", "donde", "hasta", "sin",
];
/**
 * 左边界只允许「串首 / 空白 / 开引号括号」—— 刻意排除连字符，
 * 否则葡语后附代词 `Listamo-los` / `compará-los` / `vê-los` 会被 `los` 误判（实测 3 条假阳）。
 */
const ES_MARK_WORD_RE = new RegExp(
  `(?:^|[\\s(\\["'«¿¡{])(?:${ES_MARK_WORDS.join("|")})(?![\\p{L}])`,
  "iu"
);

/** 取值里是否出现"西语专有标记"（pt 的污染判据） */
function hasSpanishMarker(v) {
  const s = String(v == null ? "" : v);
  if (ES_MARK_CHARS.test(s)) return true;
  return ES_MARK_WORD_RE.test(s);
}

/** 同形合法：单 token（无空白）且 ≤16 字符 */
function isHomographToken(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s || /\s/.test(s)) return false;
  return s.length <= 16;
}

/**
 * 类 C：专名键级白名单 —— 只豁免这些**键**（与取值无关的键语义：这些键承载的
 * 就是"语言中立的专名"）。刻意不做值级，避免掩盖别处同值的真漏译。
 * 对照证据见文件头 C 段。
 */
const KEY_LEVEL_ALLOW = new Set([
  "sampleReport.companyName", // 样例报告里的虚构公司名（供应商公司名类，语言中立）
  "home.sample.valLocation", // 地名；China 在 es/de/pt 就是正确写法
]);

/**
 * 纯函数核心：给定 {loc: 展平字典}，返回违规列表。
 *   - pt  → 用「西语专有标记」判据；
 *   - 其余目标语种 → 用「与 es 逐字符相同」判据（语言中立项 / 同形合法除外）。
 */
function collectViolations(flatByLoc, ref = REF, locales = CHECK_LOCALES) {
  const out = [];
  const refMap = flatByLoc[ref] || {};
  for (const loc of locales) {
    const flat = flatByLoc[loc] || {};
    for (const key of Object.keys(flat)) {
      if (!(key in refMap)) continue;
      const a = flat[key];
      if (typeof a !== "string" || !a.trim()) continue;
      if (L.isNeutralValue(a)) continue;
      if (KEY_LEVEL_ALLOW.has(key)) continue; // 类 C（键级）：专名键
      if (loc === "pt") {
        if (hasSpanishMarker(a))
          out.push({ locale: loc, key, reason: "含西语专有标记", value: a.slice(0, 120) });
        continue;
      }
      const b = refMap[key];
      if (typeof b !== "string") continue;
      if (a !== b) continue;
      if (isHomographToken(a)) continue; // 类 B
      out.push({ locale: loc, key, reason: "与 es 逐字符相同", value: a.slice(0, 120) });
    }
  }
  return out;
}

function loadFlattened(locales) {
  const flat = {};
  for (const loc of locales) {
    const f = path.join(L.DICT_DIR, `${loc}.json`);
    if (!fs.existsSync(f)) {
      console.error(`[gate-dict-cross-locale] 数据缺失：找不到 ${f}`);
      process.exit(2);
    }
    flat[loc] = L.flatten(JSON.parse(fs.readFileSync(f, "utf8")));
  }
  return flat;
}

function main() {
  const flat = loadFlattened([REF, ...CHECK_LOCALES]);
  console.log(`\n${"=".repeat(74)}`);
  console.log(`门禁② 跨语种污染（基线 = ${REF}，比较集 = ${CHECK_LOCALES.join("/")}）`);
  console.log(`${"=".repeat(74)}`);

  const violations = collectViolations(flat, REF, CHECK_LOCALES);
  const byLoc = {};
  for (const v of violations) byLoc[v.locale] = (byLoc[v.locale] || 0) + 1;
  console.log("\n各语种违规数：");
  for (const l of CHECK_LOCALES) console.log(`  ${l.padEnd(6)} ${byLoc[l] || 0}`);
  console.log(`\n合计违规：${violations.length} 条`);
  const show = VERBOSE ? violations : violations.slice(0, 30);
  for (const v of show) console.log(`  ✗ [${v.locale}] ${v.key}  ${v.reason}：${v.value}`);
  if (!VERBOSE && violations.length > show.length)
    console.log(`  …（共 ${violations.length} 条，--verbose 看全部）`);

  if (violations.length > 0) {
    console.log("\n❌ 门禁② 未通过");
    process.exit(1);
  }
  console.log("\n✅ 门禁② 通过");
  process.exit(0);
}

// ─────────────────────────────────────────────
// 自证
// ─────────────────────────────────────────────
function selftest() {
  const { check, done } = L.makeCheck();
  console.log("\n门禁② gate-dict-cross-locale --selftest");

  console.log("\n── 阳性对照：西语多词译文被误粘进其它语种 ⇒ 必须判违规 ──");
  const bad = {
    es: { "about.title": "Verificamos fábricas en toda Asia antes de que pague" },
    de: { "about.title": "Verificamos fábricas en toda Asia antes de que pague" },
    fr: { "about.title": "Verificamos fábricas en toda Asia antes de que pague" },
  };
  const badV = collectViolations(bad);
  check("西语整句粘进 de/fr ⇒ 命中 2 条", badV.length === 2);

  console.log("\n── 阴性对照（类 A）：语言中立项同值 ⇒ 必须通过 ──");
  const neutral = {
    es: { "doc.iso": "ISO 9001:2015", "doc.url": "https://factoryauditb2b.com", "doc.mail": "info@factoryauditb2b.com", "doc.num": "12,500+" },
    de: { "doc.iso": "ISO 9001:2015", "doc.url": "https://factoryauditb2b.com", "doc.mail": "info@factoryauditb2b.com", "doc.num": "12,500+" },
  };
  check("ISO/URL/邮箱/纯数字 同值 ⇒ 不命中", collectViolations(neutral).length === 0);

  console.log("\n── 阴性对照（类 B）：单 token 同形合法 ⇒ 必须通过 ──");
  const homo = {
    es: { "nav.menu": "Menu", "label.for": "for", "brand.name": "FactoryAuditB2B" },
    fr: { "nav.menu": "Menu", "label.for": "for", "brand.name": "FactoryAuditB2B" },
  };
  check("Menu / for / 品牌 同形 ⇒ 不命中", collectViolations(homo).length === 0);

  console.log("\n── 阳性对照：多词同值 ⇒ 命中 ──");
  const multi = {
    es: { "cta.join": "Solicitar una cotización ahora" },
    de: { "cta.join": "Solicitar una cotización ahora" },
  };
  check("多词西语同值 ⇒ 命中", collectViolations(multi).length === 1);

  console.log("\n── 阴性对照：en 不参与比较（源语言与 es 同值不算污染）──");
  const enCase = {
    es: { "x.y": "Dongguan, China" },
    en: { "x.y": "Dongguan, China" },
  };
  check("en 同值 ⇒ 不命中", collectViolations(enCase).length === 0);

  console.log("\n── pt 专用判据（含西语专有标记才算污染）──");
  const ptNeg = {
    es: { "a.b": "Documentos da empresa" },
    pt: { "a.b": "Documents que utilizamos para a fábrica" },
  };
  check("pt 含 documentos/fábrica ⇒ 不命中（同形合法）", collectViolations(ptNeg).length === 0);
  const ptNeg2 = {
    es: { "a.b": "Fase 1" },
    pt: { "a.b": "Documentos e fábrica verificados" },
  };
  check("pt 含 documentos 与 fábrica ⇒ 不命中", collectViolations(ptNeg2).length === 0);
  const ptPos = {
    es: { "a.b": "Verificación del proveedor" },
    pt: { "a.b": "la verificación del proveedor" },
  };
  const ptPosV = collectViolations(ptPos);
  check("pt 含 la verificación del proveedor ⇒ 命中（del 是西语标记）", ptPosV.length === 1);
  check("pt 命中理由为『含西语专有标记』", ptPosV[0] && ptPosV[0].reason === "含西语专有标记");
  const ptPos2 = {
    es: { "a.b": "Puntuación" },
    pt: { "a.b": "Puntuación de riesgo con desglose" },
  };
  check("pt 含『con』⇒ 命中（葡语应为 com）", collectViolations(ptPos2).length === 1);
  const ptNeg3 = {
    es: { "a.b": "x" },
    pt: { "a.b": "Execute a lista do que está faltando. Sobre nós. Entre fornecedores. Desde 2018." },
  };
  check(
    "pt 含 está/sobre/entre/desde（葡语本就有的词）⇒ 不命中",
    collectViolations(ptNeg3).length === 0
  );
  check(
    "普通葡语（sem 标记、非 == es）⇒ 不命中",
    collectViolations({ es: { "a.b": "Fase 1: qualificação" }, pt: { "a.b": "Verificamos fornecedores na Asia" } }).length === 0
  );

  console.log("\n── 值级品牌名白名单已删：Founding Buyer 同值 ⇒ 必须仍命中（防回归）──");
  // 反转自证：白名单存在时此处会得到 0、断言必然 FAIL；删净后应为 2
  //（es 是基线不参与比较，只数 de 的 2 个键）。
  const brandNow = {
    es: { "auth.accountMenu.planFounding": "Founding Buyer", "admin.planFounding": "Founding Buyer" },
    de: { "auth.accountMenu.planFounding": "Founding Buyer", "admin.planFounding": "Founding Buyer" },
  };
  check(
    "Founding Buyer（跨键同值）⇒ 全部命中（证明值级白名单已删净）",
    collectViolations(brandNow).length === 2
  );

  console.log("\n── 类 C（键级）：专名键同值 ⇒ 豁免；别键同值 ⇒ 仍命中 ──");
  const keyAllowPos = {
    es: {
      "sampleReport.companyName": "Shenzhen XX Electronics Co., Ltd.",
      "home.sample.valLocation": "Dongguan, China",
    },
    de: {
      "sampleReport.companyName": "Shenzhen XX Electronics Co., Ltd.",
      "home.sample.valLocation": "Dongguan, China",
    },
  };
  check("sampleReport.companyName / home.sample.valLocation（该键同值）⇒ 不命中", collectViolations(keyAllowPos).length === 0);
  const keyAllowNeg = {
    es: { "other.companyName": "Shenzhen XX Electronics Co., Ltd." },
    de: { "other.companyName": "Shenzhen XX Electronics Co., Ltd." },
  };
  check("同一专名值出现在**别键** ⇒ 仍命中（证明是键级而非值级）", collectViolations(keyAllowNeg).length === 1);

  console.log("\n── 阴性对照：真正不同的译文 ⇒ 不命中 ──");
  const diff = {
    es: { "cta.join": "Solicitar una cotización ahora" },
    fr: { "cta.join": "Demander un devis maintenant" },
  };
  check("不同译文 ⇒ 不命中", collectViolations(diff).length === 0);

  return done("门禁② 自检结果");
}

if (argv.includes("--selftest")) process.exit(selftest());
else main();
