// lib/matchStatus.ts —— rfq_matches 的状态与流转（**纯模块，零依赖**）
//
// 为什么要单独一个文件：
//   Admin 的匹配跟进面板是 client component，它需要知道「当前状态允许哪些下一步」。
//   如果把这份表放在 lib/rfqMatching.ts 里，客户端 import 会连带把 supabaseAdmin
//   （service_role 密钥）打进浏览器 bundle —— 既泄露密钥也可能直接构建失败。
//   所以状态机必须待在**不 import 任何服务端东西**的文件里，前后端同源引用。
//
// 🔴 状态取值受库内 CHECK 约束（rfq_matches_status_check），有且只有这四个：
//      suggested | contacted | won | lost
//    严禁 'matched' / 'completed' / 'success' / 'failed' / 'closed'
//    （'matched' 曾直接违反 CHECK 被库拒绝 —— 以库内约束为准，不靠记忆写值。）
//
// 🔴 流转表（服务端强校验，前端隐藏按钮不算拦住写入）：
//      suggested → contacted | lost
//      contacted → won | lost
//      won / lost → （终态，不可再改）
//
//    为什么允许 suggested → lost：spec C5 要求「取消推荐不得 DELETE、用 status 表达生命周期」。
//    在只有四个合法值的前提下，唯一能表达「这个推荐不跟进」的就是 lost。
//    （不新增 'dismissed' —— spec D 明确禁止随意加状态值。）

export const MATCH_STATUSES = ["suggested", "contacted", "won", "lost"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  suggested: ["contacted", "lost"],
  contacted: ["won", "lost"],
  won: [],
  lost: [],
};

export function isMatchStatus(v: unknown): v is MatchStatus {
  return (MATCH_STATUSES as readonly string[]).includes(String(v));
}

/** 已确认的匹配行（含供应商展示字段） */
export type RfqMatchRow = {
  matchId: string;
  supplierId: string;
  slug: string;
  legalName: string;
  city: string | null;
  province: string | null;
  countryCode: string | null;
  industryCode: string | null;
  verificationLevel: string | null;
  mainProducts: string[];
  status: string;
  note: string | null;
  createdAt: string;
};
