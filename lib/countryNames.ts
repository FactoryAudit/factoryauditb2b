// lib/countryNames.ts —— 覆盖国家名称的 9 语本地化（CS-01）
//
// 为什么要这个模块：
//   audit-guide 页的标题模板形如 "{country}{type} 验厂"，此前 `{country}` 一律填
//   STATIC_COUNTRIES.name（英文）⇒ 中文页渲染成「ChinaBSCI 验厂」，日文页渲染成
//   「ChinaのBSCI監査」。国名不本地化，标题在 7 个非英语种里都是中英混排。
//
// 为什么不放进 lib/coverage.ts：
//   COVERAGE_COUNTRIES 里已有 name / nameZh，但缺其余 7 语。往那个 1000+ 行的大对象
//   里塞 45 个字段改动面过大；这里做成独立小表，单点可审。
//
// 数据性质：国名属于无争议的通用译名，不涉及技术参数或商业声称，可安全人工填写。
// 缺失时一律回退到英文名（fallback），绝不臆造。

import type { Locale } from "@/i18n/config";

const NAMES: Record<string, Record<Locale, string>> = {
  china: {
    en: "China",
    zh: "中国",
    "zh-TW": "中國",
    ja: "中国",
    es: "China",
    de: "China",
    fr: "Chine",
    pt: "China",
    ar: "الصين",
  },
  vietnam: {
    en: "Vietnam",
    zh: "越南",
    "zh-TW": "越南",
    ja: "ベトナム",
    es: "Vietnam",
    de: "Vietnam",
    fr: "Viêt Nam",
    pt: "Vietname",
    ar: "فيتنام",
  },
  thailand: {
    en: "Thailand",
    zh: "泰国",
    "zh-TW": "泰國",
    ja: "タイ",
    es: "Tailandia",
    de: "Thailand",
    fr: "Thaïlande",
    pt: "Tailândia",
    ar: "تايلاند",
  },
  malaysia: {
    en: "Malaysia",
    zh: "马来西亚",
    "zh-TW": "馬來西亞",
    ja: "マレーシア",
    es: "Malasia",
    de: "Malaysia",
    fr: "Malaisie",
    pt: "Malásia",
    ar: "ماليزيا",
  },
  philippines: {
    en: "Philippines",
    zh: "菲律宾",
    "zh-TW": "菲律賓",
    ja: "フィリピン",
    es: "Filipinas",
    de: "Philippinen",
    fr: "Philippines",
    pt: "Filipinas",
    ar: "الفلبين",
  },
};

/**
 * 取某国家在当前语种下的显示名。
 * 查不到（新增国家还没补译文）时回退到传入的英文名 —— 宁可显示英文，也不臆造译名。
 */
export function countryDisplayName(
  locale: Locale,
  code: string,
  fallbackEn: string
): string {
  return NAMES[code]?.[locale] ?? fallbackEn;
}
