import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { listAdminMembers, requireAdmin, type AdminMemberRow } from "@/lib/adminData";
import MemberPlanSelect, { type MemberAction } from "@/components/admin/MemberPlanSelect";

// Admin · 会员列表
//
// 能力（2026-09-30 补全）：
//   1. 展示每个账号的身份（姓名 / 公司）与会员档位、状态、到期时间
//   2. **手动开通 / 撤销会员** —— 线下成交路径的唯一入口。
//      在此之前 memberships.plan 只有支付 webhook 一条写入路径，
//      等于"没有支付密钥 = 没有任何办法产生一个付费会员"。
//
// 安全：
//   · 整页 requireAdmin()，非 admin 直接 notFound()（不暴露后台存在）
//   · force-dynamic：绝不预渲染（后台数据不冻结、不进构建产物）
//   · 不展示任何支付凭据：stripe_customer_id 只作为"已绑定渠道"的标记，
//     页面不渲染它的值
//
// 关于硬编码的英文小标签（admin badge / manual badge / —）：
//   与 LeadStatusSelect 同一约定 —— 后台是单人内部工具，不补 9 语翻译。
//   新增字典键会触发 i18n 叶子数闸门（22 文件白名单），代价远大于收益。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

/**
 * 由 plan + status + 到期时间反推"当前档位"，用于给下拉选默认项。
 *
 * 规则必须与 lib/access.ts:resolveTier() 一致，否则会出现
 * "界面显示付费、实际拿不到权限"的错位：
 *   · plan !== founding_buyer                → free
 *   · plan === founding_buyer 且无到期时间    → 终身（resolveTier 跳过过期校验）
 *   · 其余                                    → 一年期
 */
function currentActionOf(r: AdminMemberRow): MemberAction {
  if (r.plan !== "founding_buyer") return "revoke";
  if (!r.current_period_end) return "grant_lifetime";
  return "grant_yearly";
}

export default async function AdminMembersPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);
  const rows = await listAdminMembers(200);

  // 数据库里是英文枚举，字典键是驼峰；显式映射，取不到就回落原始值
  const planLabel: Record<string, string> = {
    free: a.planFree,
    founding_buyer: a.planFounding,
  };
  const statusLabel: Record<string, string> = {
    active: a.statusActive,
    canceled: a.statusCanceled,
    past_due: a.statusPastDue,
    expired: a.statusExpired,
  };

  // 三个动作的展示标签：复用既有 admin 键 + 内部工具后缀（不新增字典键）
  const actionLabels: Record<MemberAction, string> = {
    revoke: a.planFree,
    grant_yearly: `${a.planFounding} · 1y`,
    grant_lifetime: `${a.planFounding} · lifetime`,
  };

  const paidCount = rows.filter((r) => r.plan === "founding_buyer").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171717]">{a.membersTitle}</h1>
      <p className="mt-1 text-sm text-[#6d6b66]">{a.membersLead}</p>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#3f4650]">{a.membersEmpty}</p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-[#3f4650]">
            {a.statPaid}: <span className="font-semibold text-[#171717]">{paidCount}</span>
            <span className="mx-2 text-[#ebe8e1]">|</span>
            {a.statUsers}: <span className="font-semibold text-[#171717]">{rows.length}</span>
          </p>

          <div className="mt-4 overflow-x-auto rounded-lg border border-[#ebe8e1] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#ebe8e1] bg-[#fbfaf7] text-xs uppercase text-[#6d6b66]">
                <tr>
                  <th className="px-4 py-3">{a.colName}</th>
                  <th className="px-4 py-3">{a.colEmail}</th>
                  <th className="px-4 py-3">{a.colPlan}</th>
                  <th className="px-4 py-3">{a.colStatus}</th>
                  <th className="px-4 py-3">{a.colPeriodEnd}</th>
                  <th className="px-4 py-3">{a.colCreatedAt}</th>
                  <th className="px-4 py-3">{a.edit}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe8e1]">
                {rows.map((r) => {
                  const paid = r.plan === "founding_buyer";
                  return (
                    <tr key={r.user_id} className="hover:bg-[#fbfaf7]">
                      <td className="px-4 py-3">
                        <div className="text-[#171717]">{r.full_name || "—"}</div>
                        {r.company && (
                          <div className="text-xs text-[#8c8982]">{r.company}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${r.email}`}
                          className="text-[#171717] hover:underline"
                        >
                          {r.email}
                        </a>
                        {r.role === "admin" && (
                          <span className="ml-2 rounded-full bg-[#fff4e0] px-2 py-0.5 text-xs text-[#8a5410]">
                            admin
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            paid
                              ? "rounded-full bg-[#f5f3ee] px-2 py-0.5 text-xs font-medium text-[#171717]"
                              : "text-xs text-[#6d6b66]"
                          }
                        >
                          {planLabel[r.plan] ?? r.plan}
                        </span>
                        {r.provider === "manual" && (
                          <span className="ml-2 text-xs text-[#8c8982]">manual</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#3f4650]">
                        {statusLabel[r.status] ?? r.status}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8c8982]">
                        {r.current_period_end
                          ? new Date(r.current_period_end).toISOString().slice(0, 10)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8c8982]">
                        {new Date(r.created_at).toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <MemberPlanSelect
                          userId={r.user_id}
                          action={currentActionOf(r)}
                          email={r.email}
                          dict={{
                            labels: actionLabels,
                            saving: a.saving,
                            error: a.error,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-[#6d6b66]">
        <a href={p("/admin")} className="text-[#171717] hover:underline">
          ← {a.navOverview}
        </a>
      </p>
    </div>
  );
}
