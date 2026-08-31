import type { Locale } from "./config";
import { DEFAULT_LOCALE } from "./config";

// 字典类型以英文为准：其他语言缺 key 会在类型检查时暴露。
// 实际返回用 unknown 断言，因为不同 locale 的 JSON 字面量结构可能略有差异（已在
// sync-dict 和 lock-brand-terms 保证关键字段齐全，TS 类型层不再做严格字面量比较）。
export type Dictionary = typeof import("./dictionaries/en.json");

const loaders: Record<Locale, () => Promise<unknown>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  zh: () => import("./dictionaries/zh.json").then((m) => m.default),
  es: () => import("./dictionaries/es.json").then((m) => m.default),
  de: () => import("./dictionaries/de.json").then((m) => m.default),
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
  pt: () => import("./dictionaries/pt.json").then((m) => m.default),
  ja: () => import("./dictionaries/ja.json").then((m) => m.default),
  "zh-TW": () => import("./dictionaries/zh-TW.json").then((m) => m.default),
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return (await (loaders[locale] ?? loaders[DEFAULT_LOCALE])()) as Dictionary;
}
