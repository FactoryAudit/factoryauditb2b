// 多语言配置（自研轻量 i18n，零新增依赖）
// 规则：英文为默认语言且 URL 不带前缀（/tools），其余语言带前缀（/zh/tools、/es/tools）。
// 这样现有英文 URL 完全不变，SEO 不受损；新增语言只需在 LOCALES 与字典目录里加一项。

export const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// 非默认语言（URL 需要带前缀的那些）
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE) as Exclude<
  Locale,
  "en"
>[];

export const LOCALE_META: Record<
  Locale,
  { name: string; english: string; htmlLang: string; ogLocale: string }
> = {
  en: { name: "English", english: "English", htmlLang: "en", ogLocale: "en_US" },
  zh: { name: "简体中文", english: "Chinese (Simplified)", htmlLang: "zh-CN", ogLocale: "zh_CN" },
  es: { name: "Español", english: "Spanish", htmlLang: "es", ogLocale: "es_ES" },
  de: { name: "Deutsch", english: "German", htmlLang: "de", ogLocale: "de_DE" },
  fr: { name: "Français", english: "French", htmlLang: "fr", ogLocale: "fr_FR" },
  pt: { name: "Português", english: "Portuguese", htmlLang: "pt-BR", ogLocale: "pt_BR" },
  ja: { name: "日本語", english: "Japanese", htmlLang: "ja", ogLocale: "ja_JP" },
  "zh-TW": { name: "繁體中文", english: "Chinese (Traditional)", htmlLang: "zh-Hant", ogLocale: "zh_TW" },
  ar: { name: "العربية", english: "Arabic", htmlLang: "ar", ogLocale: "ar_AR" },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** 从路径首段解析语言；没有前缀则视为默认语言 en */
export function localeFromPath(pathname: string): Locale {
  const first = pathname.split("/")[1] ?? "";
  return isLocale(first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
}

/** 给路径加上语言前缀（英文不加） */
export function localePath(locale: Locale, path: string): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? clean || "/" : `/${locale}${clean}`;
}

/** 把已带语言前缀的路径切换到另一种语言，便于语言切换器 */
export function switchLocalePath(currentPath: string, target: Locale): string {
  const segments = currentPath.split("/").filter(Boolean);
  if (segments.length && isLocale(segments[0]) && segments[0] !== DEFAULT_LOCALE) {
    segments.shift();
  }
  const rest = segments.length ? `/${segments.join("/")}` : "/";
  return localePath(target, rest);
}
