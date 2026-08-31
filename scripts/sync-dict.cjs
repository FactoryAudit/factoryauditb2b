#!/usr/bin/env node
/**
 * 字典键同步（多语言）。
 *
 * 背景：字典类型以 en.json 为准（Dictionary = typeof en.json），其他语言缺 key
 * 会在类型检查时报错，所以新增文案必须同步到全部 9 份字典。
 *
 * 用法：
 *   node scripts/sync-dict.cjs              # 补齐所有语言缺失的 key
 *   node scripts/sync-dict.cjs --lang=es    # 只补指定语言（逗号分隔）
 *   node scripts/sync-dict.cjs --dry        # 只看缺什么，不写入
 *   node scripts/sync-dict.cjs --no-translate  # 直接用英文填充，不调用翻译接口
 *
 * 策略：
 * 1. 保留目标语言已有翻译，绝不覆盖。
 * 2. 缺失的 key 优先走 MyMemory 免费翻译（带品牌名与占位符掩码）。
 * 3. 翻译失败或配额耗尽时回退英文 —— 宁可显示英文，也不显示空字符串。
 * 4. 缓存写入 .workbuddy/dict-cache.json，中断后重跑自动续传。
 *
 * 手动翻译优先级最高：先手写 zh.json，再跑本脚本补齐其余语言。
 *
 * 保护：以下「品牌词 / 档位词」永远用英文，不调用翻译接口。
 * 由 scripts/lock-brand-terms.cjs 把所有 locale 的这些 key 强制对齐到 en。
 */
const fs = require("fs");
const path = require("path");

const D = path.join(process.cwd(), "i18n", "dictionaries");
const CACHE = path.join(process.cwd(), ".workbuddy", "dict-cache.json");

/** 品牌词 / 档位词：永远用 en，不翻译。
 * 与 scripts/lock-brand-terms.cjs 同步。
 * 任何不翻译的字段，必须同时加进两个文件。 */
const KEEP_EN_PREFIXES = [
  // 行业缩写：翻译了反而没人认得
  "nav.rfq",
  // 注意：nav 其余项**不锁**，它们是 UI 导航词不是品牌名，必须跟随语言。
  // 上一版全锁成英文属过度修正，已改为手写翻译（见各字典 nav 段）。
  "brand.name","brand.eva","brand.tagline",
  "footer.allTools","footer.riskCalculator","footer.verificationChecklist",
  "footer.supplierVerification","footer.factoryAudit","footer.sourcingService",
  "footer.improvementService","footer.allServices","footer.containerCalculator",
  "footer.trustCenter",
  "home.coverageTitle","home.coveragePhase",
  "home.coverageService1","home.coverageService2","home.coverageService3",
  "home.coverageCta","home.otherRegionTitle","home.otherRegionCta",
  "home.toolsTitle",
  "toolsIndex.badge","toolsIndex.h1",
  "toolCards.riskCalculator.title","toolCards.verificationChecklist.title",
  "toolCards.riskAssessment.title","toolCards.auditChecklist.title",
  "toolCards.supplierScorecard.title","toolCards.auditReportAnalyzer.title",
  "toolCards.documentChecker.title",
  "servicesIndex.badge","servicesIndex.servicesTitle",
  "servicesIndex.items.verification.title","servicesIndex.items.factoryAudit.title",
  "servicesIndex.items.inspection.title","servicesIndex.items.sourcing.title",
  "servicesIndex.items.improvement.title","servicesIndex.coverageTitle",
  "servicesIndex.notSureCta","servicesIndex.breadcrumb",
  "pricing.h1","pricing.plansTitle",
  "risk.dimensions.company.label","risk.dimensions.quality.label",
  "risk.dimensions.compliance.label","risk.dimensions.production.label",
  "risk.dimensions.supplychain.label","risk.dimensions.documentation.label",
  "risk.levels.LOW","risk.levels.MODERATE","risk.levels.ELEVATED","risk.levels.HIGH","risk.levels.CRITICAL",
  "verification.levelLabel",
  "inspection.badge","inspection.h1",
  "trust.badge","trust.h1",
];
function isBrandKey(dotted) {
  return KEEP_EN_PREFIXES.includes(dotted);
}

// MyMemory 语言映射（站点 locale -> MyMemory langpair 目标）
const MM_TARGET = {
  es: "es",
  de: "de",
  fr: "fr",
  pt: "pt-BR",
  ja: "ja",
  "zh-TW": "zh-TW",
  ar: "ar",
  zh: "zh-CN",
};

const BRAND = [
  ["privacy@factoryauditb2b.com", "ZMAIL1"],
  ["legal@factoryauditb2b.com", "ZMAIL2"],
  ["FactoryAuditB2B.com", "ZBRDZ"],
  ["FactoryAuditB2B", "ZBRND"],
  ["factoryauditb2b.com", "ZDOMZ"],
  ["Incoterms", "ZINCTZ"],
  ["BSCI", "ZSTD1"],
  ["SMETA", "ZSTD2"],
  ["SA8000", "ZSTD3"],
  ["WRAP", "ZSTD4"],
  ["ISO 9001", "ZSTD5"],
  ["ISO 14001", "ZSTD6"],
  ["IATF 16949", "ZSTD7"],
  ["HACCP", "ZSTD8"],
  ["FSSC 22000", "ZSTD9"],
  ["USD", "ZCURZ"],
];

// 占位符：{country} {n} {year} {service} 等，翻译会破坏它们
const PLACE_RE = /\{[a-zA-Z]+\}/g;

function mask(s) {
  for (const [k, v] of BRAND) s = s.split(k).join(v);
  const slots = [];
  s = s.replace(PLACE_RE, (m) => {
    slots.push(m);
    return `ZPL${slots.length}Z`;
  });
  return { text: s, slots };
}
function unmask(s, slots) {
  slots.forEach((p, i) => {
    s = s.split(new RegExp(`ZPL${i + 1}Z`, "g")).join(p);
  });
  for (const [k, v] of BRAND) s = s.split(v).join(k);
  return s;
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
}
function saveCache(c) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(c, null, 0), "utf8");
}

async function translate(text, target, cache) {
  const key = target + "|" + text;
  if (cache[key]) return cache[key];
  if (text.length > 480) {
    // MyMemory 单次上限，超长直接回退英文避免半截翻译
    cache[key] = text;
    return text;
  }
  const { text: masked, slots } = mask(text);
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(masked) +
    "&langpair=en|" +
    target;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const d = await res.json();
    if (String(d.responseStatus) === "200" && d.responseData?.translatedText) {
      const out = unmask(String(d.responseData.translatedText), slots);
      // MyMemory 配额耗尽会返回固定提示串，识别为失败
      if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|USAGE LIMIT/i.test(out)) {
        cache[key] = text;
        return text;
      }
      cache[key] = out;
      return out;
    }
  } catch {
    /* 网络异常：回退英文 */
  }
  cache[key] = text;
  return text;
}

/** 按 en 的形状补齐 target 缺失的 key，返回 [缺失路径列表, 新对象] */
function fillShape(en, target, out, missing, noTranslate) {
  for (const k of Object.keys(en)) {
    const v = en[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) ? out[k] : {};
      fillShape(v, target[k] ?? {}, out[k], missing, noTranslate);
    } else if (typeof v === "string" && out[k] === v && !noTranslate) {
      // 现有值与 en 完全相同 → 视为需要重新翻译（用于"上次 sync 没翻译 / 缓存串味"
      // 后的回填场景）。noTranslate 时跳过。
      missing.push(k);
    } else if (!(k in out) || out[k] === undefined) {
      missing.push(k);
      out[k] = v; // 先放英文占位，翻译阶段再覆盖
    }
  }
  return out;
}

/** 翻译阶段：只对「与英文完全相同」的字符串做翻译 */
async function translateMissing(en, target, out, lang, prefix, cache, noTranslate, stats) {
  const dotted = prefix ? `${prefix}.${en === target ? "" : ""}` : "";
  for (const k of Object.keys(en)) {
    const v = en[k];
    const child = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!out[k]) out[k] = {};
      await translateMissing(v, target?.[k] ?? {}, out[k], lang, child, cache, noTranslate, stats);
    } else if (typeof v === "string" && out[k] === v) {
      if (noTranslate || isBrandKey(child)) {
        // 品牌词 / 档位词：直接用 en（且 stats 计 fallback）
        out[k] = v;
        stats.fallback++;
        continue;
      }
      out[k] = await translate(v, MM_TARGET[lang], cache);
      if (out[k] === v) stats.fallback++;
      else stats.translated++;
    } else if (Array.isArray(v) && Array.isArray(out[k])) {
      for (let i = 0; i < out[k].length && i < v.length; i++) {
        if (typeof out[k][i] === "string" && out[k][i] === v[i]) {
          if (noTranslate || isBrandKey(`${child}[${i}]`)) {
            stats.fallback++;
            continue;
          }
          out[k][i] = await translate(v[i], MM_TARGET[lang], cache);
          if (out[k][i] === v[i]) stats.fallback++;
          else stats.translated++;
        } else if (out[k][i] && typeof out[k][i] === "object") {
          await translateMissing(v[i], target?.[k]?.[i] ?? {}, out[k][i], lang, `${child}[${i}]`, cache, noTranslate, stats);
        }
      }
    }
  }
}

(async () => {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const noTranslate = args.includes("--no-translate");
  const langArg = args.find((a) => a.startsWith("--lang="));
  const langs = langArg
    ? langArg.slice(7).split(",")
    : ["zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

  const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
  const cache = loadCache();

  for (const lang of langs) {
    const file = path.join(D, lang + ".json");
    if (!fs.existsSync(file)) {
      console.log(`[skip] ${lang}.json not found`);
      continue;
    }
    const target = JSON.parse(fs.readFileSync(file, "utf8"));
    const out = JSON.parse(JSON.stringify(target));
    const missing = [];
    fillShape(en, target, out, missing, noTranslate);

    if (!missing.length) {
      console.log(`[ok] ${lang}: no missing keys`);
      continue;
    }
    console.log(`[fill] ${lang}: ${missing.length} missing keys${dry ? " (dry run)" : ""}`);

    if (!dry) {
      const stats = { translated: 0, fallback: 0 };
      await translateMissing(en, target, out, lang, "", cache, noTranslate, stats);
      // 键顺序跟随 en，便于人工 diff
      const ordered = JSON.parse(JSON.stringify(out));
      fs.writeFileSync(file, JSON.stringify(ordered, null, 2) + "\n", "utf8");
      console.log(
        `       translated ${stats.translated}, english fallback ${stats.fallback}`
      );
    }
  }
  saveCache(cache);
})();
