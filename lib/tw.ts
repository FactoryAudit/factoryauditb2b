// lib/tw.ts — zh-TW 正文繁化运行时工具
//
// 内容正文数据源（lib/coverage.ts、lib/guides.ts、lib/fieldReports.ts、lib/caseStudies.ts）
// 只维护 en/zh 双版。zh-TW 页面复用 zh（简体）文案并在此繁化为台湾正体（s2twp 风格）。
//
// 词表来自 scripts/gen-tw-mapping.py 生成的 lib/twData.generated.ts：
//   - str    完整字符串映射（正文源串 → s2twp 结果），命中即整串替换，保留台湾用词差异
//   - phrase 词组级差异（长度降序）。s2twp 里 窗口→視窗、集群→叢集、信息→資訊
//           都是整词替换，绝不能拆成单字——2026-09-02 线上「進出口」被转成「進出窗」
//           就是因为旧表把词组逐字 zip 成了 口→窗。
//   - char   单字兜底（每条都用 opencc 单字转换校验过，不含词组级误拆）
// 正文中文变更后需重跑生成脚本。

import { TW_MAP } from "./twData.generated";

const CHAR = TW_MAP.char;
const STR = TW_MAP.str;
// 生成脚本已按长度降序输出，长词先替换，避免短词抢先命中把词拆开
const PHRASE_KEYS = Object.keys(TW_MAP.phrase);
const PHRASE = TW_MAP.phrase;
const HAS_HAN = /[\u4e00-\u9fff]/;

/** 单段文本繁化：整串 → 词组（最长匹配）→ 单字兜底。 */
export function twText(input: string): string {
  if (!input || !HAS_HAN.test(input)) return input;
  const hit = STR[input];
  if (hit !== undefined) return hit;
  let out = input;
  for (const key of PHRASE_KEYS) {
    if (out.indexOf(key) !== -1) out = out.split(key).join(PHRASE[key]);
  }
  let res = "";
  for (const ch of out) {
    res += CHAR[ch] ?? ch;
  }
  return res;
}

/** 深度繁化任意结构（对象/数组/字符串），保留非字符串原样。 */
export function twDeep<T>(value: T): T {
  if (typeof value === "string") return twText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => twDeep(v)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      out[k] = twDeep((value as Record<string, unknown>)[k]);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * 内容对象取数（内容源对象形如 { en: X, zh: X }）：
 * zh → zh 原样；zh-TW → zh 繁化；其余语言 → en。
 * en/zh 允许不同类型（如纯字面量对象），返回 E | Z。
 */
export function pickZhCopy<E, Z>(
  locale: string,
  content: { en: E; zh: Z }
): E | Z {
  if (locale === "zh-TW") return twDeep(content.zh) as unknown as E | Z;
  return locale === "zh" ? (content.zh as unknown as E | Z) : content.en;
}

/** 成对文案取数（titleEn/titleZh、metaDescEn/metaDescZh 之类）：zh 原样、zh-TW 繁化、其余 en。 */
export function pickZhPair(locale: string, en: string, zh: string): string {
  if (locale === "zh") return zh;
  if (locale === "zh-TW") return twText(zh);
  return en;
}

