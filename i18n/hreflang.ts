import { LOCALES, LOCALE_META, localePath, type Locale } from "./config";

const BASE = "https://factoryauditb2b.com";

/**
 * 生成某条路径的 hreflang 映射。
 * 传入的 path 是「去掉语言前缀」的路径，例如 /tools/supplier-risk-calculator。
 * 英文落在无前缀 URL 上，其余语言带前缀，并把英文标为 x-default。
 *
 * CS-01：每个语种**只声明一个** hreflang 代码（取 LOCALE_META.htmlLang），
 * 再加一条 x-default。此前额外塞了 en-US / zh-Hans / zh-Hant / pt-BR / ja / ar，
 * 其中：
 *   - en-US、zh-Hans 指向的 URL 与 en、zh-CN **完全相同** ⇒ 同一 URL 被重复声明；
 *   - zh-Hant、pt-BR、ja、ar 与对应语种的 htmlLang **键名本身就一样** ⇒ 写了等于没写。
 * 结果是 12 条声明里只有 10 个去重后的值，纯粹是噪声。现在固定为 9 + 1 = 10 条。
 */
export function hreflangFor(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of LOCALES) {
    map[LOCALE_META[l].htmlLang] = `${BASE}${localePath(l, path)}`;
  }
  // x-default：无匹配语言时的兜底，指向英文（无前缀）地址
  map["x-default"] = `${BASE}${localePath("en", path)}`;
  return map;
}

/** canonical：英文用无前缀地址 */
export function canonicalFor(locale: Locale, path: string): string {
  return `${BASE}${localePath(locale, path)}`;
}
