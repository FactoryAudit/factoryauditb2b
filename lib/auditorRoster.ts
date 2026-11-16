// lib/auditorRoster.ts —— 审核员名录（只读聚合）
//
// 为什么需要：派单要填「姓名 + 邮箱」，但运营每次都得翻微信/邮件手抄一遍，
// 且系统里没有任何地方能回答「我们手上有哪几个审核员、谁接过几单」。
//
// 数据来源只有两处，**不新建表**：
//   1. audit_assignments —— 真正派过单的人（最可信：有过业务往来）
//   2. leads(kind=auditor_application) —— 通过 /careers 申请过的人（migration 039）
//
// 合并规则：按邮箱小写去重；同名不同邮箱视为两个人（邮箱才是业务主键，
// 姓名重名在跨国审核员里太常见）。姓名/国家等取「最近一次出现」的值，
// 不做人工覆盖 —— 没有真相源就不要假装有。
//
// 红线：收录 ≠ 审核通过 ≠ 可派单。名录只是「填过表 / 派过单的人」，
// 资质判断永远在运营脑子里，不由系统代为宣称。

import { createAdminClient } from "@/lib/supabaseAdmin";

export type AuditorRosterEntry = {
  name: string;
  email: string;
  country: string | null;
  /** 擅长领域 / 专业（来自申请表），可能为空 */
  specialization: string | null;
  /** 已派单次数（0 = 只申请过，没接过单） */
  assignments: number;
  /** 最近一次出现的时间（ISO 字符串），用于排序 */
  lastSeenAt: string;
  applied: boolean;
};

/** 明显的测试/探针邮箱：不进名录，避免下拉里出现 probe@example.com */
function looksLikeTest(email: string, name: string, extra?: string): boolean {
  const s = `${email} ${name} ${extra ?? ""}`.toLowerCase();
  if (/(^|@)(example\.(com|invalid)|invalid|test)$/.test(email.toLowerCase())) return true;
  return /probe|请忽略|测试|探针|smoke test|automated verify|live verification/.test(s);
}

export async function listAuditorRoster(limit = 60): Promise<AuditorRosterEntry[]> {
  const db = createAdminClient();
  if (!db) return [];

  try {
    const [asnRes, appRes] = await Promise.all([
      db
        .from("audit_assignments")
        .select("auditor_name, auditor_email, created_at")
        .not("auditor_email", "is", null)
        .order("created_at", { ascending: false })
        .limit(500),
      db
        .from("leads")
        .select("first_name, email, country, sourcing, status, created_at")
        .eq("kind", "auditor_application")
        // 已拒绝的申请不进名录（含验收探针）。保留在库里可查，但不该出现在派单下拉里。
        .neq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const map = new Map<string, AuditorRosterEntry>();
    const touch = (
      emailRaw: unknown,
      nameRaw: unknown,
      at: unknown,
      init: Partial<AuditorRosterEntry>,
      isAssignment: boolean
    ) => {
      const email = String(emailRaw ?? "").trim().toLowerCase();
      const name = String(nameRaw ?? "").trim();
      if (!email) return;
      if (looksLikeTest(email, name, init.specialization ?? undefined)) return;
      const at2 = String(at ?? "");
      const cur = map.get(email);
      if (cur) {
        // 计数与最近时间始终更新；姓名等描述性字段只在新记录更晚时才覆盖
        cur.assignments += isAssignment ? 1 : 0;
        cur.applied = cur.applied || !isAssignment;
        if (at2 > cur.lastSeenAt) {
          cur.lastSeenAt = at2;
          if (name) cur.name = name;
          if (init.country) cur.country = init.country;
          if (init.specialization) cur.specialization = init.specialization;
        }
        return;
      }
      map.set(email, {
        name: name || email.split("@")[0],
        email,
        country: init.country ?? null,
        specialization: init.specialization ?? null,
        assignments: isAssignment ? 1 : 0,
        lastSeenAt: at2,
        applied: !isAssignment,
      });
    };

    for (const r of (asnRes.data ?? []) as Array<Record<string, unknown>>) {
      touch(r.auditor_email, r.auditor_name, r.created_at, {}, true);
    }
    for (const r of (appRes.data ?? []) as Array<Record<string, unknown>>) {
      touch(r.email, r.first_name, r.created_at, {
        country: r.country == null ? null : String(r.country),
        specialization: r.sourcing == null ? null : String(r.sourcing),
      }, false);
    }

    return Array.from(map.values())
      .sort((a, b) => b.assignments - a.assignments || b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, limit);
  } catch (e) {
    console.error("[auditorRoster] list failed", e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// 管理视角（/admin/auditors）
//
// 与 listAuditorRoster 的区别：名录是「派单下拉用」，必须干净（过滤探针/已拒绝）；
// 管理页恰恰要**看到全部** —— 包括被拒的人、测试数据、从没接过单的申请者，
// 否则运营无法回答「上个月申请的那个人哪去了」。
//
// 状态口径（派生，不新增字段）：
//   test      明显是测试/探针邮箱（不进任何统计）
//   rejected  leads.status = 'rejected'（保留可查，但不派单）
//   active    真派过单（audit_assignments 有记录）
//   pending   只提交过申请、还没派过单
// ─────────────────────────────────────────────────────────────

export type AuditorState = "active" | "pending" | "rejected" | "test";

export type AuditorAdminEntry = AuditorRosterEntry & {
  state: AuditorState;
  /** leads.status 原值（pending / contacted / approved / rejected…），派单来源可能为 null */
  leadStatus: string | null;
  /** 首次申请时间（只有 leads 来源有） */
  appliedAt: string | null;
  /** 简历附件路径（私有 bucket，需签名后才能看） */
  cvPath: string | null;
};

export async function listAuditorManagement(limit = 200): Promise<AuditorAdminEntry[]> {
  const db = createAdminClient();
  if (!db) return [];

  try {
    const [asnRes, appRes] = await Promise.all([
      db
        .from("audit_assignments")
        .select("auditor_name, auditor_email, created_at")
        .not("auditor_email", "is", null)
        .order("created_at", { ascending: false })
        .limit(500),
      // ⚠️ 这里**不过滤** status=rejected —— 管理页要看得见被拒的人
      db
        .from("leads")
        .select("first_name, email, country, sourcing, status, created_at, attachment_path")
        .eq("kind", "auditor_application")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const map = new Map<string, AuditorAdminEntry>();

    const upsert = (
      emailRaw: unknown,
      nameRaw: unknown,
      at: unknown,
      init: Partial<AuditorAdminEntry>,
      isAssignment: boolean
    ) => {
      const email = String(emailRaw ?? "").trim().toLowerCase();
      const name = String(nameRaw ?? "").trim();
      if (!email) return;
      const at2 = String(at ?? "");
      const isTest = looksLikeTest(email, name, init.specialization ?? undefined);

      const cur = map.get(email);
      if (cur) {
        cur.assignments += isAssignment ? 1 : 0;
        cur.applied = cur.applied || !isAssignment;
        if (isAssignment) cur.state = "active";
        if (!isTest && cur.state === "test") cur.state = isAssignment ? "active" : "pending";
        if (at2 > cur.lastSeenAt) {
          cur.lastSeenAt = at2;
          if (name) cur.name = name;
          if (init.country) cur.country = init.country;
          if (init.specialization) cur.specialization = init.specialization;
        }
        if (init.leadStatus) cur.leadStatus = init.leadStatus;
        if (init.appliedAt) cur.appliedAt = init.appliedAt;
        if (init.cvPath) cur.cvPath = init.cvPath;
        return;
      }

      map.set(email, {
        name: name || email.split("@")[0],
        email,
        country: init.country ?? null,
        specialization: init.specialization ?? null,
        assignments: isAssignment ? 1 : 0,
        lastSeenAt: at2,
        applied: !isAssignment,
        state: isTest
          ? "test"
          : init.leadStatus === "rejected"
          ? "rejected"
          : isAssignment
          ? "active"
          : "pending",
        leadStatus: init.leadStatus ?? null,
        appliedAt: init.appliedAt ?? null,
        cvPath: init.cvPath ?? null,
      });
    };

    for (const r of (asnRes.data ?? []) as Array<Record<string, unknown>>) {
      upsert(r.auditor_email, r.auditor_name, r.created_at, {}, true);
    }
    for (const r of (appRes.data ?? []) as Array<Record<string, unknown>>) {
      upsert(
        r.email,
        r.first_name,
        r.created_at,
        {
          country: r.country == null ? null : String(r.country),
          specialization: r.sourcing == null ? null : String(r.sourcing),
          leadStatus: r.status == null ? null : String(r.status),
          appliedAt: r.created_at == null ? null : String(r.created_at),
          cvPath: r.attachment_path == null ? null : String(r.attachment_path),
        },
        false
      );
    }

    // 排序：可用的排前面（按接单数），然后待评估、已拒绝、测试
    const rank: Record<AuditorState, number> = { active: 0, pending: 1, rejected: 2, test: 3 };
    return Array.from(map.values())
      .sort(
        (a, b) =>
          rank[a.state] - rank[b.state] ||
          b.assignments - a.assignments ||
          b.lastSeenAt.localeCompare(a.lastSeenAt)
      )
      .slice(0, limit);
  } catch (e) {
    console.error("[auditorRoster] management list failed", e);
    return [];
  }
}
