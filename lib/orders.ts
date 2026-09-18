// lib/orders.ts —— public.orders 的**唯一读写层**（CS-17 Commerce V1）
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么单独一个文件（与 lib/leads.ts 同一纪律）
// ─────────────────────────────────────────────────────────────────────────────
//   orders 是本站第一条**交易记录**，不是线索。它必须只有一个写入实现：
//     · 订单号撞号重试策略只写一遍
//     · 状态流转校验只写一遍（pending_payment → paid，绝不允许反向退回）
//     · service_role 是唯一通道，避免在页面/组件里散落特权客户端
//
// 铁律：
//   1. 只走 service_role。public.orders 对 anon/authenticated 是**零权限**（连 SELECT 都没有）。
//   2. **金额由 lib/commerce.ts 的价目表算**，本文件只负责落库，不接受外部传入的金额。
//   3. 缺失 = 缺失：amount_minor 为 NULL 表示待报价，绝不当 0。
//   4. 落库失败绝不吞异常，返回可识别的原因，由调用方决定降级（订单页面仍要能出订单号）。
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "./supabaseAdmin";
import {
  canTransition,
  isOrderStatus,
  makeOrderReferenceId,
  type OrderStatus,
} from "./commerce";

/** 与 public.orders 完全对齐的行结构 */
export type OrderRow = {
  id: number;
  reference_id: string;
  service_code: string;
  service_name: string;
  quantity: number;
  currency: string;
  amount_minor: number | null;
  status: OrderStatus;
  email: string;
  company: string | null;
  country: string | null;
  supplier_slug: string | null;
  locale: string;
  source_path: string | null;
  notes: string | null;
  provider: string | null;
  provider_ref: string | null;
  /** 收款渠道托管收银台地址（PayPal approve 链接）。人工收款为 null。 */
  pay_url: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export type CreateOrderInput = {
  serviceCode: string;
  serviceName: string;
  quantity: number;
  /** 由 lib/commerce.ts priceOrder() 算出。null = 待报价 */
  amountMinor: number | null;
  email: string;
  company?: string | null;
  country?: string | null;
  supplierSlug?: string | null;
  locale: string;
  sourcePath?: string | null;
  notes?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  payload?: unknown;
};

export type CreateOrderResult =
  | { stored: true; referenceId: string; attempts: number }
  | { stored: false; reason: "not_configured" | "insert_failed"; message?: string };

/** 撞号重试上限（与 lib/leads.ts 一致） */
const MAX_REF_ATTEMPTS = 6;

/** payload 上限（字节）。超过就显式标记截断，绝不静默丢字段。 */
export const ORDER_PAYLOAD_MAX_BYTES = 16 * 1024;

function fitPayload(payload: unknown): Record<string, unknown> | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== "object" || Array.isArray(payload)) return null;
  const obj = payload as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;
  let serialized = "";
  try {
    serialized = JSON.stringify(obj) ?? "";
  } catch {
    return { _truncated: true, _keys: keys };
  }
  if (new TextEncoder().encode(serialized).length <= ORDER_PAYLOAD_MAX_BYTES) return obj;
  return { _truncated: true, _keys: keys };
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { code?: unknown }).code;
  if (code === "23505") return true;
  return /duplicate key value violates unique constraint/i.test(
    String((e as { message?: unknown }).message ?? "")
  );
}

/** 邮箱最简校验（DB 层还有 orders_email_check 兜底） */
export function looksLikeEmail(v: string): boolean {
  return v.length >= 3 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * 创建一条订单。
 *
 * 返回 stored=false 时调用方**仍应**给客户返回订单号 —— 数据库抖动不该让一单生意消失，
 * 但此时订单号是"未落库"的，页面必须如实标注（不能假装已创建）。
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const db = createAdminClient();
  if (!db) return { stored: false, reason: "not_configured" };

  const base = {
    service_code: input.serviceCode,
    service_name: input.serviceName,
    quantity: input.quantity,
    currency: "USD",
    amount_minor: input.amountMinor,
    status: "pending_payment" satisfies OrderStatus,
    email: input.email.slice(0, 254),
    company: input.company ?? null,
    country: input.country ?? null,
    supplier_slug: input.supplierSlug ?? null,
    locale: input.locale || "en",
    source_path: input.sourcePath ?? null,
    notes: input.notes ?? null,
    provider: input.provider ?? null,
    provider_ref: input.providerRef ?? null,
    payload: fitPayload(input.payload),
  };

  for (let attempt = 1; attempt <= MAX_REF_ATTEMPTS; attempt++) {
    const referenceId = makeOrderReferenceId();
    try {
      const { error } = await db.from("orders").insert({ ...base, reference_id: referenceId });
      if (!error) return { stored: true, referenceId, attempts: attempt };
      if (isUniqueViolation(error)) continue; // 换号重试，绝不取消 UNIQUE
      console.error("[orders] insert failed", error.message);
      return { stored: false, reason: "insert_failed", message: error.message };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isUniqueViolation(e)) continue;
      console.error("[orders] insert exception", msg);
      return { stored: false, reason: "insert_failed", message: msg };
    }
  }
  return {
    stored: false,
    reason: "insert_failed",
    message: "reference_id collision retry exhausted",
  };
}

/**
 * 按订单号读取（后台/订单页共用）。
 *
 * 注意：订单号是**唯一**的对外凭据，等同于"知道订单号即可查看"——
 * 这是刻意设计：客户不注册也能查自己的订单（B2B 买家不愿先开户）。
 * 因此订单页**只展示订单自身字段**，绝不含其他客户的数据。
 */
export async function getOrderByRef(referenceId: string): Promise<OrderRow | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("reference_id", referenceId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as OrderRow;
}

export type ListOrdersFilter = {
  status?: string;
  search?: string;
  limit?: number;
};

/** 后台订单列表。失败返回空数组（后台崩了不影响前台做生意）。 */
export async function listOrders(filter: ListOrdersFilter = {}): Promise<OrderRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  let q = db.from("orders").select("*").order("created_at", { ascending: false }).limit(
    Math.max(1, Math.min(200, filter.limit ?? 100))
  );
  if (filter.status && isOrderStatus(filter.status)) q = q.eq("status", filter.status);
  const s = (filter.search ?? "").trim();
  if (s) {
    // 订单号 / 邮箱 / 公司 三字段模糊匹配
    q = q.or(`reference_id.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return data as OrderRow[];
}

/**
 * 把收款渠道回填到已存在的订单上。
 *
 * 为什么不在建单时就带上：PayPal 的 custom_id / invoice_id 必须等于订单号，
 * 而订单号是落库时才生成的 ⇒ 只能"先建单、再补链"。
 * 这也是为什么 createOrder 里 provider 允许为 null。
 */
export async function attachProvider(
  referenceId: string,
  provider: string,
  providerRef: string | null,
  payUrl: string | null = null
): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { error } = await db
    .from("orders")
    .update({ provider, provider_ref: providerRef, pay_url: payUrl })
    .eq("reference_id", referenceId);
  if (error) {
    console.error("[orders] attachProvider failed", error.message);
    return false;
  }
  return true;
}

export type SetStatusResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; reason: "not_found" | "invalid_status" | "invalid_transition" | "db_error"; message?: string };

/**
 * 状态流转。唯一写入口，带状态机校验。
 *
 * paid 时自动写 paid_at；refunded / cancelled 只改状态，不清空 paid_at
 * （已收款的事实是历史，不能因为退款就把"曾经付过"抹掉）。
 */
export async function setOrderStatus(
  referenceId: string,
  next: string,
  extra: { provider?: string | null; providerRef?: string | null } = {}
): Promise<SetStatusResult> {
  if (!isOrderStatus(next)) return { ok: false, reason: "invalid_status" };

  const db = createAdminClient();
  if (!db) return { ok: false, reason: "db_error" };

  const current = await getOrderByRef(referenceId);
  if (!current) return { ok: false, reason: "not_found" };
  if (current.status === next) return { ok: true, status: next };
  if (!canTransition(current.status, next)) {
    return {
      ok: false,
      reason: "invalid_transition",
      message: `${current.status} -> ${next} is not allowed`,
    };
  }

  const patch: Record<string, unknown> = { status: next };
  if (next === "paid") patch.paid_at = new Date().toISOString();
  if (extra.provider) patch.provider = extra.provider;
  if (extra.providerRef) patch.provider_ref = extra.providerRef;

  const { error } = await db.from("orders").update(patch).eq("reference_id", referenceId);
  if (error) {
    console.error("[orders] update status failed", error.message);
    return { ok: false, reason: "db_error", message: error.message };
  }
  return { ok: true, status: next };
}

/**
 * PayPal webhook 核销入口。
 *
 * 只认"已捕获付款"这一类事件，且**必须**能匹配到订单号才会置 paid；
 * 匹配不到就返回 false，宁可让运营人工核销，也绝不放过一个伪造请求。
 */
export async function markOrderPaidByProvider(
  referenceId: string,
  provider: string,
  providerRef: string | null
): Promise<boolean> {
  if (!referenceId.startsWith("ORD-")) return false;
  const r = await setOrderStatus(referenceId, "paid", { provider, providerRef });
  return r.ok;
}
