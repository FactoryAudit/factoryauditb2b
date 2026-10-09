// lib/attribution-parse.ts —— 首次触达归因的**纯逻辑**（零依赖、零框架）
//
// 为什么单独一个文件：
//   1. 可离线测试。真正的读取（lib/attribution.ts）要 import "next/headers"，
//      在纯 Node 下无法解析；把纯逻辑分出来后，
//      `node --experimental-strip-types` 就能直接跑往返测试（见
//      scripts/_r74_check_attribution.cjs），无需真提交一条询盘去污染生产库。
//   2. 客户端与服务端共用同一个 cookie 名与同一套键名契约 ——
//      「客户端写 us、服务端读 utm_source」这类键名对不上的 bug
//      在类型系统里是看不见的，必须靠共享常量 + 往返测试兜住。

/** 首次触达 cookie 名。客户端写、服务端读，**唯一真源**。 */
export const ATTR_COOKIE = "fab_ft";

/** 首次触达 cookie 的存活期（秒）。归因属长期信息，给 90 天。 */
export const ATTR_MAX_AGE = 90 * 86400;

/** cookie 内使用的**短键名**（受 cookie 体积限制，刻意不复用长列名）。 */
export const ATTR_KEYS = {
  landingPage: "lp",
  referrer: "rf",
  utmSource: "us",
  utmMedium: "um",
  utmCampaign: "uc",
  firstTouchAt: "ts",
} as const;

export type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  landingPage: string | null;
  firstTouchAt: string | null;
};

export const EMPTY_ATTRIBUTION: Attribution = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  referrer: null,
  landingPage: null,
  firstTouchAt: null,
};

/** 清洗：去控制字符、裁长度。数据库列不需要超长值，也不该存注入性内容。 */
export function cleanAttributionValue(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, max) : null;
}

/** ISO 时间串校验：只接受能被 Date 解析的值，否则丢弃（不写脏数据） */
export function cleanAttributionIso(v: unknown): string | null {
  const s = cleanAttributionValue(v, 40);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * 把客户端写好的 cookie 值解析成 Attribution。
 *
 * 返回 null 表示不可用（解析失败、或字段全空）⇒ 调用方应继续走兜底，而不是写半条脏数据。
 * 单个字段不可用只影响该字段（写 NULL），不会让整条归因作废。
 */
export function parseAttributionCookie(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const K = ATTR_KEYS;
  const out: Attribution = {
    utmSource: cleanAttributionValue(j[K.utmSource], 120),
    utmMedium: cleanAttributionValue(j[K.utmMedium], 120),
    utmCampaign: cleanAttributionValue(j[K.utmCampaign], 120),
    referrer: cleanAttributionValue(j[K.referrer]),
    landingPage: cleanAttributionValue(j[K.landingPage]),
    firstTouchAt: cleanAttributionIso(j[K.firstTouchAt]),
  };
  return Object.values(out).some((x) => x !== null) ? out : null;
}

/**
 * 组装要写进 cookie 的值（客户端用）。
 * 与 parseAttributionCookie 严格互逆 —— 往返测试就是验这一点。
 */
export function buildAttributionCookie(input: {
  landingPage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  firstTouchAt: string;
}): string {
  const K = ATTR_KEYS;
  const ft: Record<string, string> = {
    [K.landingPage]: input.landingPage.slice(0, 500),
    [K.referrer]: input.referrer.slice(0, 500),
    [K.utmSource]: input.utmSource.slice(0, 120),
    [K.utmMedium]: input.utmMedium.slice(0, 120),
    [K.utmCampaign]: input.utmCampaign.slice(0, 120),
    [K.firstTouchAt]: input.firstTouchAt,
  };
  return encodeURIComponent(JSON.stringify(ft));
}
