/**
 * 多语言字典急救修复（P0）。
 *
 * 背景：此前用免费 MyMemory 接口批量翻译，出现了三类必须立刻修掉的事故：
 *  1) 链接字段被当普通文本翻译 —— pricing.plans.0.href 变成 "Herramientas"，
 *     7 个语言的首个定价卡点了就是 404
 *  2) 商业事实被改写 —— pricing.currencyNote 从「全部以美元计价」被改成
 *     「早期试行价格，可能调整」；inspection.faq.2.a 的 USD 200–350 被写成 100–350
 *  3) 译错语言 —— ja/zh-TW/de/fr/ar 里混进西班牙语（"Herramientas gratuitas"），
 *     对日本买家等于乱码
 *
 * 本脚本只做「撤回」：坏链改回 en 值、被改写的商业事实改回 en 值、
 * 西语污染改回 en 值。宁可先显示英文（用户至少能读），也不显示错语言或错价格。
 *
 * 用法：
 *   node scripts/fix-i18n-critical.cjs --dry   # 只看会改什么
 *   node scripts/fix-i18n-critical.cjs         # 写入
 */
const fs = require("fs");
const path = require("path");

const D = path.join(__dirname, "..", "i18n", "dictionaries");
const DRY = process.argv.includes("--dry");
const LANGS = ["zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];

/** 展平：数组按下标展开，才能定位到 pricing.plans.0.href */
function flat(obj, prefix = "", out = {}) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === "object") flat(item, `${p}.${i}`, out);
        else out[`${p}.${i}`] = item;
      });
    } else if (v && typeof v === "object") {
      flat(v, p, out);
    } else {
      out[p] = v;
    }
  }
  return out;
}
function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const LINK_KEY = /(^|\.)(href|url|link|path|src|to)$/i;
const isLinkLike = (s) => typeof s === "string" && /^(\/|https?:|#|mailto:)/.test(s);

/**
 * 西班牙语强特征（刻意排除与葡萄牙语/法语共通的词形，避免误伤 pt）：
 *  - ción / ciones：西语独有（葡语是 ção）
 *  - herramientas / necesita / Evaluación / Verificación：西语拼写
 *  - ¿ 反问号、Tengo、bancaria、desglose
 */
const ES_STRONG =
  /(ción|ciones|herramientas|necesita|evaluación|verificación|¿|tengo|bancaria|desglose|proveedores?|auditoría|fábrica|cotizad|envío|gratuitas|puntuación|página|herramienta\b)/i;

/** 这些拉丁语言本身就可能命中上面的词（es 不用说），跳过语言判定 */
const SKIP_ES_CHECK = new Set(["es", "pt"]);

/** 商业事实类键：翻译一旦偏离就属于编造，直接撤回 en 原文 */
const FACT_KEYS = [
  "pricing.currencyNote",
  "inspection.faq.2.a",
  "aiChat.fallbackAnswers.pricing",
  "risk.options.quality_qms.yes",
  "risk.options.comp_env.comprehensive",
  "sampleReport.recommendBody",
  "auditGuide.metaDesc",
];

const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
const enFlat = flat(en);

let total = 0;

for (const lang of LANGS) {
  const file = path.join(D, `${lang}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const flatDict = flat(dict);
  const fixes = [];

  for (const k of Object.keys(flatDict)) {
    const v = flatDict[k];
    const e = enFlat[k];
    if (typeof v !== "string" || typeof e !== "string") continue;
    if (v === e) continue;

    // ① 坏链：en 是路径/URL，目标语言却不是
    if (LINK_KEY.test(k) && isLinkLike(e) && !isLinkLike(v)) {
      fixes.push({ k, from: v, to: e, why: "坏链" });
      continue;
    }

    // ② 商业事实被改写
    if (FACT_KEYS.includes(k)) {
      fixes.push({ k, from: v, to: e, why: "商业事实被改写" });
      continue;
    }

    // ③ 西语污染（es/pt 跳过）
    if (!SKIP_ES_CHECK.has(lang) && ES_STRONG.test(v)) {
      fixes.push({ k, from: v, to: e, why: "西语污染" });
    }
  }

  if (!fixes.length) {
    console.log(`[${lang}] 无需修复`);
    continue;
  }

  console.log(`\n[${lang}] ${fixes.length} 处待修复`);
  const byWhy = {};
  for (const f of fixes) {
    byWhy[f.why] = (byWhy[f.why] || 0) + 1;
    if (f.why !== "西语污染" || DRY) {
      console.log(
        `  [${f.why}] ${f.k}\n      ${JSON.stringify(f.from)}\n   -> ${JSON.stringify(f.to)}`,
      );
    }
  }
  console.log(`  分类：${Object.entries(byWhy).map(([w, n]) => `${w} ${n}`).join(" / ")}`);

  if (!DRY) {
    for (const f of fixes) setPath(dict, f.k, f.to);
    fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
    console.log(`  已写入 ${file}`);
  }
  total += fixes.length;
}

console.log(`\n${DRY ? "DRY RUN" : "完成"}：共 ${total} 处`);
