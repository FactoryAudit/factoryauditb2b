import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { requireAdmin } from "@/lib/adminData";
import { listAuditorManagement, type AuditorState } from "@/lib/auditorRoster";

// Admin · 审核员管理（2026-11-16 新建）
//
// 为什么要有这一页：审核员此前**没有管理入口** —— 申请落在 /admin/leads，
// 派单在 /admin/audits，名册只在派单下拉里出现。运营无法回答
// 「上个月申请的那个人哪去了」「谁接过几单」「谁被拒了」。
//
// 🔴 本页只读：状态全部由既有数据派生，**不新增字段、不写库**。
//    要改状态（拒绝/恢复）仍走 /admin/leads 的 LeadStatusSelect —— 那里有审计轨迹。
//    名录用于派单下拉，本页用于管理视角，两者口径不同（见 lib/auditorRoster.ts 注释）。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

const STATE_META: Record<AuditorState, { zh: string; en: string; cls: string }> = {
  active: { zh: "可用", en: "Active", cls: "bg-[#e8f3ec] text-[#2e7d4f]" },
  pending: { zh: "待评估", en: "Pending", cls: "bg-[#fdf3e7] text-[#b45309]" },
  rejected: { zh: "已拒绝", en: "Rejected", cls: "bg-[#fdecec] text-[#b42318]" },
  test: { zh: "测试数据", en: "Test", cls: "bg-[#f2efe9] text-[#8c8982]" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export default async function AdminAuditorsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh" || locale === "zh-TW";
  const rows = await listAuditorManagement(200);

  const counts = {
    active: rows.filter((r) => r.state === "active").length,
    pending: rows.filter((r) => r.state === "pending").length,
    rejected: rows.filter((r) => r.state === "rejected").length,
    test: rows.filter((r) => r.state === "test").length,
  };
  const totalAssignments = rows.reduce((s, r) => s + r.assignments, 0);

  const stats = [
    { label: zh ? "可用审核员" : "Active", value: counts.active, tone: "text-[#2e7d4f]" },
    { label: zh ? "待评估" : "Pending", value: counts.pending, tone: "text-[#b45309]" },
    { label: zh ? "已拒绝" : "Rejected", value: counts.rejected, tone: "text-[#b42318]" },
    { label: zh ? "累计派单" : "Assignments", value: totalAssignments, tone: "text-[#171717]" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-[#171717]">
          {zh ? "审核员管理" : "Auditors"}
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#6d6b66]">
          {zh
            ? "审核员申请来自 /careers，派单记录来自验厂工单。本页把两处合起来看：谁可用、谁还没评估、谁被拒了。状态由数据派生，改状态请到线索管理。"
            : "Applications come from /careers, assignments from audit jobs. This page merges both: who is active, who is still pending, who was rejected. State is derived — change it in Leads."}
        </p>
      </header>

      {/* 统计 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[#ecebe7] bg-white p-4">
            <div className={`text-2xl font-extrabold ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-xs text-[#8c8982]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 名单 */}
      <section className="overflow-hidden rounded-xl border border-[#ecebe7] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#ecebe7] px-5 py-4">
          <h2 className="text-[15px] font-bold text-[#171717]">
            {zh ? "全部审核员" : "All auditors"}
            <span className="ml-2 text-xs font-normal text-[#8c8982]">({rows.length})</span>
          </h2>
          <Link href={p("/admin/leads")} className="text-xs text-[#171717] underline">
            {zh ? "去线索管理改状态 →" : "Change status in Leads →"}
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#8c8982]">
            {zh ? "还没有任何审核员申请或派单记录。" : "No auditor applications or assignments yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#ecebe7] text-left text-xs text-[#8c8982]">
                  <th className="px-5 py-3 font-medium">{zh ? "姓名 / 邮箱" : "Name / Email"}</th>
                  <th className="px-4 py-3 font-medium">{zh ? "国家" : "Country"}</th>
                  <th className="px-4 py-3 font-medium">{zh ? "专长" : "Specialisation"}</th>
                  <th className="px-4 py-3 text-center font-medium">{zh ? "接单数" : "Jobs"}</th>
                  <th className="px-4 py-3 font-medium">{zh ? "状态" : "State"}</th>
                  <th className="px-4 py-3 font-medium">{zh ? "申请时间" : "Applied"}</th>
                  <th className="px-4 py-3 font-medium">{zh ? "最近活动" : "Last seen"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = STATE_META[r.state];
                  return (
                    <tr key={r.email} className="border-b border-[#f2efe9] last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-medium text-[#171717]">{r.name}</div>
                        <div className="mt-0.5 text-xs text-[#8c8982]">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[#3f4650]">{r.country || "—"}</td>
                      <td className="px-4 py-3 text-[#3f4650]">{r.specialization || "—"}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-[#171717]">
                        {r.assignments || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                          {zh ? meta.zh : meta.en}
                        </span>
                        {r.cvPath ? (
                          <span className="ml-1.5 text-xs text-[#8c8982]" title={zh ? "有简历附件" : "CV attached"}>
                            📎
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6d6b66]">{fmtDate(r.appliedAt)}</td>
                      <td className="px-4 py-3 text-xs text-[#6d6b66]">{fmtDate(r.lastSeenAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs leading-relaxed text-[#8c8982]">
        {zh
          ? "收录 ≠ 审核通过 ≠ 可派单。「可用」只代表派过单；资质判断仍在运营侧，系统不代为宣称。测试/探针邮箱已单列，不计入任何统计。"
          : "Being listed ≠ approved ≠ assignable. “Active” only means a job was assigned; qualification is an operator judgement. Test/probe emails are isolated and excluded from stats."}
      </p>
    </div>
  );
}
