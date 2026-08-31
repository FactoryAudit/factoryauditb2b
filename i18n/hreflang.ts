import { LOCALES, LOCALE_META, localePath, type Locale } from "./config";

const BASE = "https://factoryauditb2b.com";

/**
 * 生成某条路径的 hreflang 映射。
 * 传入的 path 是「去掉语言前缀」的路径，例如 /tools/supplier-risk-calculator。
 * 英文落在无前缀 URL 上，其余语言带前缀，并把英文标为 x-default。
 */
export function hreflangFor(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of LOCALES) {
    const url = `${BASE}${localePath(l, path)}`;
    map[LOCALE_META[l].htmlLang] = url;
    if (l === "en") map["en-US"] = url;
    if (l === "zh") map["zh-Hans"] = url;
    if (l === "zh-TW") map["zh-Hant"] = url;
    if (l === "pt") map["pt-BR"] = url;
    if (l === "ja") map["ja"] = url;
    if (l === "ar") map["ar"] = url;
  }
  map["x-default"] = `${BASE}${localePath("en", path)}`;
  return map;
}

/** canonical：英文用无前缀地址 */
export function canonicalFor(locale: Locale, path: string): string {
  return `${BASE}${localePath(locale, path)}`;
}
