// lib/buyerRequest.ts —— 买家需求类型的**唯一真相源**
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要这个文件（2026-11-13）
// ─────────────────────────────────────────────────────────────────────────────
//   /rfq 原本只表达「买货」：Product / Quantity / Target country 三个字段。
//   科威特 RFQ-2MSL3N 要的是 HVAC 风水平衡与系统验证**服务**，表单问不出这层，
//   他只能把服务说明塞进 Product、把「一个项目」塞进 Quantity。
//
//   本文件提供三件事，供 API 层与后台共用（客户端只拿常量与类型）：
//     1. request_type 白名单与归一（非法值一律回落 product，绝不编值）
//     2. service_detail 的字段清洗（工厂名 / 所在地 / 审核类型 / 期望日期 /
//        目的港 / 验货标准；空串归 null，日期只认 YYYY-MM-DD）
//     3. rfqs.product（NOT NULL）的可读标题推导 —— 服务类需求没有「产品」，
//        但列不能空，也不该塞一句假产品名
//
// 铁律：
//   · 只做「买家填了什么」的归一，**绝不推断补值**。
//   · request_type 只描述诉求，不代表已受理 / 已报价 / 已成交。
// ─────────────────────────────────────────────────────────────────────────────

// 刻意不 import lib/rateLimit：本文件会被客户端表单直接引用（类型单选渲染），
// 而 rateLimit 是服务端模块。这里用等价实现，保持本文件零服务端依赖。
function clamp(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export const RFQ_REQUEST_TYPES = [
  "product",
  "sourcing",
  "audit",
  "inspection",
  "other",
] as const;

export type RfqRequestType = (typeof RFQ_REQUEST_TYPES)[number];

export const DEFAULT_REQUEST_TYPE: RfqRequestType = "product";

/** 需要买家明确填写「产品」的类型（产品本身 / 产品品类 / 待验货的产品） */
export const TYPES_REQUIRING_PRODUCT: readonly RfqRequestType[] = [
  "product",
  "sourcing",
  "inspection",
];

export function isRfqRequestType(v: unknown): v is RfqRequestType {
  return typeof v === "string" && (RFQ_REQUEST_TYPES as readonly string[]).includes(v);
}

/** 非法 / 缺省 → 回落 product（与 migration 042 的列默认值一致），绝不编造。 */
export function normalizeRequestType(v: unknown): RfqRequestType {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return isRfqRequestType(s) ? s : DEFAULT_REQUEST_TYPE;
}

/** 后台 / 管理员邮件用的中文标签。只面向内部运营，不进对外页面，故不占字典键。 */
export const REQUEST_TYPE_LABELS: Record<RfqRequestType, string> = {
  product: "采购产品",
  sourcing: "寻找供应商",
  audit: "验厂 / 工厂核实",
  inspection: "验货 / 质检",
  other: "其他需求",
};

export function requestTypeLabel(v: unknown): string {
  return REQUEST_TYPE_LABELS[normalizeRequestType(v)];
}

// ---- service_detail ----

export type RfqServiceDetail = {
  factoryName?: string;
  factoryLocation?: string;
  auditType?: string;
  /** 只认 YYYY-MM-DD；其它格式一律丢弃，不猜日期 */
  preferredDate?: string;
  destinationPort?: string;
  inspectionStandard?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(v: unknown, max: number): string | null {
  const s = clamp(v, max);
  return s ? s : null;
}

/** 只收日期形态的字符串。`2026-13-45` 这类形状对但语义错的，交给前端 date input 拦住；
 *  服务端不做日历校验，但绝不把非日期文本塞进这一格。 */
function cleanDate(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return DATE_RE.test(s) ? s : null;
}

/**
 * 把表单散字段收成一个 jsonb 对象。
 * 所有字段都空 → 返回 null（不写 `{}`，让「没有明细」在库里也是明确的 NULL）。
 */
export function buildServiceDetail(input: Record<string, unknown>): RfqServiceDetail | null {
  const out: RfqServiceDetail = {};
  const factoryName = cleanText(input.factory_name, 200);
  const factoryLocation = cleanText(input.factory_location, 200);
  const auditType = cleanText(input.audit_type, 200);
  const preferredDate = cleanDate(input.preferred_date);
  const destinationPort = cleanText(input.destination_port, 120);
  const inspectionStandard = cleanText(input.inspection_standard, 120);

  if (factoryName) out.factoryName = factoryName;
  if (factoryLocation) out.factoryLocation = factoryLocation;
  if (auditType) out.auditType = auditType;
  if (preferredDate) out.preferredDate = preferredDate;
  if (destinationPort) out.destinationPort = destinationPort;
  if (inspectionStandard) out.inspectionStandard = inspectionStandard;

  return Object.keys(out).length > 0 ? out : null;
}

// ---- rfqs.product 标题推导 ----

const FALLBACK_TITLE: Record<RfqRequestType, string> = {
  product: "Product sourcing request",
  sourcing: "Supplier sourcing request",
  audit: "Factory audit request",
  inspection: "Inspection request",
  other: "General request",
};

/**
 * rfqs.product 是 NOT NULL（migration 001），且前台卡片、后台列表、撮合逻辑
 * 都读它。服务类需求没有产品名，必须给一个**真实可读**的标题，而不是空串或假货名。
 *
 * 优先级：买家填的产品 → 类型专属线索（工厂名 / 需求首句）→ 类型兜底标题。
 */
export function deriveRfqProduct(
  type: RfqRequestType,
  product: string | null | undefined,
  detail: RfqServiceDetail | null,
  message?: string | null
): string {
  const explicit = (product || "").trim();
  if (explicit) return explicit.slice(0, 300);

  if (type === "audit") {
    const target = detail?.factoryName || detail?.factoryLocation;
    return (target ? `Factory audit — ${target}` : FALLBACK_TITLE.audit).slice(0, 300);
  }

  if (type === "other") {
    const firstLine = (message || "").trim().replace(/\s+/g, " ");
    return (firstLine ? firstLine.slice(0, 120) : FALLBACK_TITLE.other).slice(0, 300);
  }

  return FALLBACK_TITLE[type];
}
