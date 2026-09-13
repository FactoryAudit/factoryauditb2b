// lib/leads.ts —— public.leads 的**唯一写入层**
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么必须有这个文件（CS-02D · P0 Fake Function 收口）
// ─────────────────────────────────────────────────────────────────────────────
//   migration 008（= supabase/cs07/02_migration.sql）把 public.leads 建得很完整：
//   22 列 + 4 索引 + RLS(2 policies) + updated_at 触发器，
//   而且 DDL 注释里两次点名了本文件：
//     · "撞号由 lib/leads.ts 自动重试解决"
//     · "超 16KB 时由应用层写入 {_truncated:true,_keys:[…]}"
//
//   但建完表之后**没有任何代码写它**。7 个前端表单仍 POST 到 /api/lead，
//   而 /api/lead 只发两封邮件、一行不落库 —— 后台永远查不到任何线索。
//   这是典型的一等「假功能」：页面上到处是转化入口，系统里一条记录都没有。
//
//   本文件补上缺失的应用层，兑现 migration 的承诺。
//
// 铁律：
//   1. 只走 service_role（createAdminClient）；leads 对 anon/authenticated 已 REVOKE 写权限。
//   2. 落库失败**绝不阻断主流程**：调用方仍要发邮件、仍要给用户返回成功。
//      一封邮件的价值远高于一次 INSERT；但反过来，一单生意不能因为数据库抖动而丢。
//   3. 绝不静默截断：payload 超限时显式写 {_truncated:true,_keys:[…]}。
//   4. 绝不放宽 UNIQUE：撞号靠重试，不靠取消约束。
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from "@/lib/supabaseAdmin";

/** 三类来源，严格区分、不混用（与 leads_kind_check 一致） */
export type LeadKind = "buyer_lead" | "supplier_application" | "supplier_claim";

export const LEAD_KINDS: readonly LeadKind[] = [
  "buyer_lead",
  "supplier_application",
  "supplier_claim",
];

// 短号字符集：去掉易混淆的 0/O/1/I（与 /api/rfq 的 RFQ-XXXXXX 完全一致）
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REF_LEN = 6;

/** 撞号重试上限。6 位 × 32 字符集 ≈ 10 亿组合，撞 6 次的概率可忽略；真撞满就报错，不静默降级。 */
const MAX_REF_ATTEMPTS = 6;

/** payload 上限（字节）。与 migration 注释一致：16KB。 */
export const LEAD_PAYLOAD_MAX_BYTES = 16 * 1024;

/**
 * 生成对外短号：LEAD-XXXXXX
 *
 * 为什么不用 UUID 对外：UUID 没法在邮件、微信、工单里口述引用。
 * 短号是「运营能直接念出来的主键」。
 */
export function makeLeadReferenceId(): string {
  let out = "";
  for (let i = 0; i < REF_LEN; i++) {
    out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `LEAD-${out}`;
}

/**
 * payload 兜底：超 16KB 时**显式标记**截断，绝不静默丢字段。
 *
 * 返回 null（无 payload）或普通对象。截断时返回
 *   { _truncated: true, _keys: [...] }
 * —— 运维至少能知道"这一条还有字段没存进来"，而不是以为拿到了全量。
 */
export function fitPayload(payload: unknown): Record<string, unknown> | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== "object" || Array.isArray(payload)) return null;

  const obj = payload as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;

  let serialized = "";
  try {
    serialized = JSON.stringify(obj) ?? "";
  } catch {
    // 循环引用 / BigInt 等不可序列化输入：只留键名，不让它把整条 INSERT 带崩
    return { _truncated: true, _keys: keys };
  }

  if (new TextEncoder().encode(serialized).length <= LEAD_PAYLOAD_MAX_BYTES) {
    return obj;
  }
  return { _truncated: true, _keys: keys };
}

export type LeadInsertInput = {
  kind: LeadKind;
  /** 具体来源标识（表单/路由）。NOT NULL —— 由服务端决定，不依赖 NULL。 */
  tool: string;
  email: string;
  firstName?: string | null;
  company?: string | null;
  country?: string | null;
  phone?: string | null;
  /** 要采购什么 / 所属行业 */
  sourcing?: string | null;
  /** 要核验 / 认领的供应商名 */
  supplierName?: string | null;
  supplierWebsite?: string | null;
  message?: string | null;
  /** leadScore 0–100；越界会被夹到 0–100，NaN/null → null */
  score?: number | null;
  /** 原始业务字段全量兜底（会被 fitPayload 处理） */
  payload?: unknown;
  userId?: string | null;
};

export type LeadInsertResult =
  | { stored: true; referenceId: string; attempts: number }
  | { stored: false; reason: "not_configured" | "insert_failed"; message?: string };

/** Postgres 唯一约束冲突（23505）——只有这一种错误值得换号重试 */
function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const code = (e as { code?: unknown }).code;
  if (code === "23505" || code === "23505 ") return true;
  const msg = String((e as { message?: unknown }).message ?? "");
  return /duplicate key value violates unique constraint/i.test(msg);
}

/** 分数夹取：leads_score_check 要求 0–100 或 NULL */
function clampScore(v: number | null | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * 写入一条 lead。
 *
 * 返回值里 stored=false 时，调用方**仍应继续发邮件并给用户返回成功** ——
 * 数据库不可用不是用户的错，也不该让一单真实意向凭空消失。
 */
export async function insertLead(input: LeadInsertInput): Promise<LeadInsertResult> {
  const db = createAdminClient();
  if (!db) return { stored: false, reason: "not_configured" };

  const base = {
    kind: input.kind,
    tool: String(input.tool || "").slice(0, 64) || "unknown",
    status: "new",
    email: String(input.email || "").slice(0, 254),
    first_name: input.firstName ?? null,
    company: input.company ?? null,
    country: input.country ?? null,
    phone: input.phone ?? null,
    sourcing: input.sourcing ?? null,
    supplier_name: input.supplierName ?? null,
    supplier_website: input.supplierWebsite ?? null,
    message: input.message ?? null,
    score: clampScore(input.score),
    payload: fitPayload(input.payload),
    user_id: input.userId ?? null,
  };

  let lastCollision = "";
  for (let attempt = 1; attempt <= MAX_REF_ATTEMPTS; attempt++) {
    const referenceId = makeLeadReferenceId();
    try {
      const { error } = await db.from("leads").insert({ ...base, reference_id: referenceId });
      if (!error) return { stored: true, referenceId, attempts: attempt };
      if (isUniqueViolation(error)) {
        lastCollision = error.message;
        continue; // 换号重试；**绝不**通过取消 UNIQUE 约束来"解决"
      }
      console.error("[leads] insert failed", error.message);
      return { stored: false, reason: "insert_failed", message: error.message };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isUniqueViolation(e)) {
        lastCollision = msg;
        continue;
      }
      console.error("[leads] insert exception", msg);
      return { stored: false, reason: "insert_failed", message: msg };
    }
  }

  console.error("[leads] reference_id collision retry exhausted");
  return {
    stored: false,
    reason: "insert_failed",
    message: lastCollision || "reference_id collision retry exhausted",
  };
}
