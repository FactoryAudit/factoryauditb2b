// lib/contentI18n/index.ts — 内容层多语言映射表（构建期静态数据）
//
// 为什么需要它：
//   内容数据源（lib/coverage.ts、lib/guides.ts、lib/industryContent.ts、lib/chemicals.ts、
//   lib/fieldReports.ts、lib/caseStudies.ts、lib/aboutContent.ts、lib/standardReport.ts）
//   只维护 en/zh 双版；ja/es/de/fr/pt/ar 六个语种原先一律回退英文。
//
//   本模块提供「英文原文 → 译文」的映射（键 = 英文源串本身），在三个收口点生效：
//     · lib/tw.ts  pickZhPair()    —— 成对文案（titleEn/titleZh 之类）
//     · lib/tw.ts  pickZhCopy()    —— 内容对象（{ en, zh }）
//     · lib/pickGuideDesc.ts       —— 指南 meta description（独立通道）
//
//   未命中的条目一律回退英文原文 ⇒ 补数据是**纯增量**，不会改变已有行为。
//
// 数据来源：outputs/i18n-tr/<locale>/ 由 scripts/_i18n_slice.cjs merge 汇总而来。
// 重新生成：node scripts/_i18n_slice.cjs merge

import es from "./es.json";
import de from "./de.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ja from "./ja.json";
import ar from "./ar.json";

type Dict = Record<string, string>;

const DICTS: Record<string, Dict> = { es, de, fr, pt, ja, ar };

/** 该 locale 是否有内容映射表（en/zh/zh-TW 不需要） */
export function hasContentDict(locale: string): boolean {
  return Object.prototype.hasOwnProperty.call(DICTS, locale);
}

/** 单串翻译：未命中返回 undefined，由调用方决定回退 */
export function trLookup(locale: string, text: string): string | undefined {
  const d = DICTS[locale];
  if (!d || typeof text !== "string") return undefined;
  const hit = d[text];
  return hit === undefined ? undefined : hit;
}

/** 深度翻译：字符串查表，对象/数组递归，其他类型原样 */
export function trDeep<T>(locale: string, value: T): T {
  const d = DICTS[locale];
  if (!d) return value;
  if (typeof value === "string") {
    const hit = d[value];
    return (hit !== undefined ? hit : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => trDeep(locale, v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const src = value as Record<string, unknown>;
    for (const k of Object.keys(src)) out[k] = trDeep(locale, src[k]);
    return out as unknown as T;
  }
  return value;
}
