// lib/buyerIntake.ts —— 买家注册画像的单一真相源
//
// 为什么要有这个文件：
//   注册表单（客户端）与服务端校验各自抄一份白名单，迟早会漂。
//   服务的可选取值只在这里定义，表单渲染 checkbox、API 归一化都读同一份。
//
// 约束：本文件必须保持「无服务端依赖」，客户端组件可以直接 import。

/** 买家可勾选的服务（与 profiles.services_needed 的取值一一对应） */
export const BUYER_SERVICE_KEYS = [
  "audit",
  "inspection",
  "sourcing",
  "due_diligence",
] as const;

export type BuyerServiceKey = (typeof BUYER_SERVICE_KEYS)[number];

/** 字典键后缀映射：register.form.services<Xxx> */
export const BUYER_SERVICE_DICT_SUFFIX: Record<BuyerServiceKey, string> = {
  audit: "Audit",
  inspection: "Inspection",
  sourcing: "Sourcing",
  due_diligence: "DueDiligence",
};

export const BUYER_PRODUCTS_MAX = 500;
export const BUYER_PORT_MAX = 120;
export const BUYER_PHONE_MAX = 40;

/**
 * 服务多选归一：只认白名单，去重，最多 4 个。
 * 非法值/空数组一律 null（NULL 语义 = 未表态，不编造）。
 */
export function normalizeServicesNeeded(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter(
    (x): x is string =>
      typeof x === "string" &&
      (BUYER_SERVICE_KEYS as readonly string[]).includes(x)
  );
  return out.length > 0 ? Array.from(new Set(out)) : null;
}

/**
 * 联系方式宽松归一：保留 + 空格 连字符 括号，剔掉其它字符。
 * 不校验国家码格式 —— 中东/非洲号码写法差异大，过度校验只会拦掉真实买家。
 */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const cleaned = v.trim().replace(/[^\d+\-()\s.]/g, "").replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, BUYER_PHONE_MAX) : null;
}
