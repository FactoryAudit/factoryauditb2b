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

  // ── 2026-11-14：平台不再限于中国供应商，补齐实际已有数据与非中国供应国的国名 ──
  // 起因：suppliers.country_code 里有 'CN'(8330 行 ISO 码) 与 'china'(248 行小写全名)
  // 两套写法并存；而本表此前只覆盖 COVERAGE_COUNTRIES 的 5 国，查不到就原样输出，
  // 线上因此出现 "Suqian, CN"、"Country CN"、"Surakarta, indonesia" 这类渲染。
  // 这里把所有实际出现过的形态一次性收口（见下方 CODE_ALIASES）。
  india: {
    en: "India",
    zh: "印度",
    "zh-TW": "印度",
    ja: "インド",
    es: "India",
    de: "Indien",
    fr: "Inde",
    pt: "Índia",
    ar: "الهند",
  },
  indonesia: {
    en: "Indonesia",
    zh: "印度尼西亚",
    "zh-TW": "印尼",
    ja: "インドネシア",
    es: "Indonesia",
    de: "Indonesien",
    fr: "Indonésie",
    pt: "Indonésia",
    ar: "إندونيسيا",
  },
  pakistan: {
    en: "Pakistan",
    zh: "巴基斯坦",
    "zh-TW": "巴基斯坦",
    ja: "パキスタン",
    es: "Pakistán",
    de: "Pakistan",
    fr: "Pakistan",
    pt: "Paquistão",
    ar: "باكستان",
  },
  bangladesh: {
    en: "Bangladesh",
    zh: "孟加拉国",
    "zh-TW": "孟加拉",
    ja: "バングラデシュ",
    es: "Bangladés",
    de: "Bangladesch",
    fr: "Bangladesh",
    pt: "Bangladesh",
    ar: "بنغلاديش",
  },
  russia: {
    en: "Russia",
    zh: "俄罗斯",
    "zh-TW": "俄羅斯",
    ja: "ロシア",
    es: "Rusia",
    de: "Russland",
    fr: "Russie",
    pt: "Rússia",
    ar: "روسيا",
  },
  "united-states": {
    en: "United States",
    zh: "美国",
    "zh-TW": "美國",
    ja: "アメリカ合衆国",
    es: "Estados Unidos",
    de: "Vereinigte Staaten",
    fr: "États-Unis",
    pt: "Estados Unidos",
    ar: "الولايات المتحدة",
  },
  turkey: {
    en: "Türkiye",
    zh: "土耳其",
    "zh-TW": "土耳其",
    ja: "トルコ",
    es: "Turquía",
    de: "Türkei",
    fr: "Turquie",
    pt: "Turquia",
    ar: "تركيا",
  },
  japan: {
    en: "Japan",
    zh: "日本",
    "zh-TW": "日本",
    ja: "日本",
    es: "Japón",
    de: "Japan",
    fr: "Japon",
    pt: "Japão",
    ar: "اليابان",
  },
  "south-korea": {
    en: "South Korea",
    zh: "韩国",
    "zh-TW": "韓國",
    ja: "韓国",
    es: "Corea del Sur",
    de: "Südkorea",
    fr: "Corée du Sud",
    pt: "Coreia do Sul",
    ar: "كوريا الجنوبية",
  },
  mexico: {
    en: "Mexico",
    zh: "墨西哥",
    "zh-TW": "墨西哥",
    ja: "メキシコ",
    es: "México",
    de: "Mexiko",
    fr: "Mexique",
    pt: "México",
    ar: "المكسيك",
  },
  brazil: {
    en: "Brazil",
    zh: "巴西",
    "zh-TW": "巴西",
    ja: "ブラジル",
    es: "Brasil",
    de: "Brasilien",
    fr: "Brésil",
    pt: "Brasil",
    ar: "البرازيل",
  },
};

/**
 * ISO 3166-1 alpha-2 / 常见变体 → 本表 key。
 *
 * 为什么必须有这层：suppliers.country_code 存在两套写法 ——
 * 抓取入库的是 'CN'（8330 行），注册接口写的 'china'（248 行）。
 * 不去重这两套，同一国家的档案会显示成 "CN" 与 "China" 两种样子。
 */
const CODE_ALIASES: Record<string, string> = {
  cn: "china",
  chn: "china",
  in: "india",
  ind: "india",
  id: "indonesia",
  idn: "indonesia",
  pk: "pakistan",
  pak: "pakistan",
  bd: "bangladesh",
  bgd: "bangladesh",
  ru: "russia",
  rus: "russia",
  us: "united-states",
  usa: "united-states",
  "us-america": "united-states",
  tr: "turkey",
  tur: "turkey",
  jp: "japan",
  jpn: "japan",
  kr: "south-korea",
  "kr-south": "south-korea",
  "korea-south": "south-korea",
  mx: "mexico",
  mex: "mexico",
  br: "brazil",
  bra: "brazil",
  vn: "vietnam",
  vnm: "vietnam",
  th: "thailand",
  tha: "thailand",
  my: "malaysia",
  mys: "malaysia",
  ph: "philippines",
  phl: "philippines",
};

/** 归一化国家标识：去空白、转小写、别名映射。查不到就原样返回小写。 */
export function normalizeCountryKey(code: string | null | undefined): string {
  const raw = String(code ?? "").trim().toLowerCase();
  if (!raw) return "";
  return CODE_ALIASES[raw] ?? raw;
}

/** "united-states" / "south korea" → "United States" / "South Korea" */
function titleCaseCountry(raw: string): string {
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

/** 该标识是否是本表已收录的国家（含 ISO 别名）。注册接口用它决定「直接采用」还是「降级」。 */
export function isKnownCountry(code: string | null | undefined): boolean {
  const key = normalizeCountryKey(code);
  return Boolean(key) && Object.prototype.hasOwnProperty.call(NAMES, key);
}

/**
 * 取某国家在当前语种下的显示名。
 *
 * 查找顺序：别名归一 → 本表当前语种 → 本表英文 → 调用方给的英文名 → 兜底 title-case。
 * 最后那层兜底是必需的：此前查不到就原样输出，于是 'indonesia' 与 'CN' 直接进了 HTML。
 * 宁可显示一个首字母大写的代码，也不能把数据库里的原始码原样丢给买家。
 */
export function countryDisplayName(
  locale: Locale,
  code: string,
  fallbackEn: string
): string {
  const key = normalizeCountryKey(code);
  if (!key) return fallbackEn?.trim() || "";
  return NAMES[key]?.[locale] ?? NAMES[key]?.en ?? (fallbackEn?.trim() || titleCaseCountry(key));
}
