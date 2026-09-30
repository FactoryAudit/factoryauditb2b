import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { listAdminMembers, requireAdmin } from "@/lib/adminData";

// Admin · 会员列表
//
// 展示每个账号的套餐与订阅状态。不展示任何支付凭据
// （stripe_customer_id 只在列表里作为"已绑定"标记，不渲染完整值）。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

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
                  <th className="px-4 py-3">{a.colEmail}</th>
                  <th className="px-4 py-3">{a.colPlan}</th>
                  <th className="px-4 py-3">{a.colStatus}</th>
                  <th className="px-4 py-3">{a.colPeriodEnd}</th>
                  <th className="px-4 py-3">{a.colCreated}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe8e1]">
                {rows.map((r) => {
                  const paid = r.plan === "founding_buyer";
                  return (
                    <tr key={r.email} className="hover:bg-[#fbfaf7]">
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
