import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/adminData";
import { listLeadActivation } from "@/lib/adminBusiness";
import LeadStatusSelect from "@/components/admin/LeadStatusSelect";

// Admin · 线索列表（CS-02D 建立 → STEP 13 CHANGE SET B 升级为「Lead 运营台」）
//
// public.leads 收三类：买家留资 / 供应商入驻申请 / 供应商认领申请。
//
// STEP 13 CS-B 补上的三件事：
//   1. **Lead → 草稿 Supplier 关联**：两表之间**没有外键**，只能按公司名匹配
//      （lib/adminBusiness.ts 的 listLeadActivation）。匹配不上就显示"未关联"，
//      绝不猜、绝不自动建关联。
//   2. **完整度 + 能否发布**：直接复用 supplierCompleteness（与供应商详情页同一口径），
//      让 Admin 在这一页就能判断"这家能不能发"，不用点进去再点出来。
//   3. **Reject 不删除**：status='rejected'（migration 027），保留审计轨迹。
//
// 🔴 测试探针隔离：历史验收脚本写进生产的探针行会被打上 TEST 标记，
//    不计入任何漏斗统计（统计口径见 lib/adminBusiness.ts 的 isTest*）。
//
// 数据库未配置时返回空数组，页面不会崩 —— 与既有 fail-open 哲学一致。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function AdminLeadsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);
  const rows = await listLeadActivation(200);
  const zh = locale === "zh" || locale === "zh-TW";

  // kind 与 status 都是内部运营口径：单人后台，不补 9 语翻译，直接显示库值
  const KIND_LABEL: Record<string, string> = {
    buyer_lead: "buyer",
    supplier_application: "supplier",
    supplier_claim: "claim",
  };

  const L = zh
    ? {
        colCompany: "公司",
        colCountry: "国家",
        colSupplier: "关联供应商",
        colCompleteness: "完整度",
        colAction: "操作",
        noSupplier: "未关联草稿",
        open: "打开",
        test: "测试探针",
        publishable: "可发布",
        blocked: "不可发布",
        published: "已发布",
      }
    : {
        colCompany: "Company",
        colCountry: "Country",
        colSupplier: "Draft supplier",
        colCompleteness: "Completeness",
        colAction: "Action",
        noSupplier: "no draft linked",
        open: "Open",
        test: "TEST",
        publishable: "publishable",
        blocked: "not publishable",
        published: "published",
      };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">{a.leadsTitle}</h1>
      <p className="mt-1 text-sm text-[#64748b]">{a.leadsLead}</p>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#475569]">{a.leadsEmpty}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f7f9fc] text-xs uppercase text-[#64748b]">
              <tr>
                <th className="px-4 py-3">{a.colReference}</th>
                <th className="px-4 py-3">{a.colKind}</th>
                <th className="px-4 py-3">{L.colCompany}</th>
                <th className="px-4 py-3">{L.colCountry}</th>
                <th className="px-4 py-3">{L.colSupplier}</th>
                <th className="px-4 py-3">{L.colCompleteness}</th>
                <th className="px-4 py-3">{a.colCreated}</th>
                <th className="px-4 py-3">{a.colStatus}</th>
                <th className="px-4 py-3">{L.colAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => {
                const c = r.supplier?.completeness ?? null;
                return (
                  <tr key={r.id} className="align-top hover:bg-[#f7f9fc]">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[#64748b]">{r.referenceId}</span>
                      {r.isTest && (
                        <span className="ml-2 rounded bg-[#fdf3d8] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a5a00]">
                          {L.test}
                        </span>
                      )}
                      <div className="mt-0.5 text-xs text-[#94a3b8]">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#e6eef6] px-2 py-0.5 text-xs text-[#0f4c81]">
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#0f172a]">{r.company || r.supplierName || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#475569]">{r.country || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.supplier ? (
                        <>
                          <span className="font-mono text-[#0f4c81]">{r.supplier.slug}</span>
                          <div className="mt-0.5 text-[#94a3b8]">
                            {[r.supplier.city, r.supplier.industryCode].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </>
                      ) : (
                        <span className="text-[#94a3b8]">{L.noSupplier}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-[#0f172a]">
                            {c.score}/{c.total}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              r.supplier?.isPublished
                                ? "bg-[#e7f6ec] text-[#1f7a36]"
                                : c.publishable
                                  ? "bg-[#e6eef6] text-[#0f4c81]"
                                  : c.rejected
                                    ? "bg-[#fdeaea] text-[#d4232a]"
                                    : "bg-[#fdf3d8] text-[#8a5a00]"
                            }`}
                          >
                            {r.supplier?.isPublished
                              ? L.published
                              : c.rejected
                                ? "REJECTED"
                                : c.publishable
                                  ? L.publishable
                                  : L.blocked}
                          </span>
                          {!c.publishable && !r.supplier?.isPublished && (
                            <div className="w-full text-[10px] text-[#8a5a00]">{c.blockers.join(" / ")}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94a3b8]">
                      {r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusSelect
                        referenceId={r.referenceId}
                        status={r.status}
                        dict={{ saving: a.saving, error: a.error }}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.supplier ? (
                        <Link
                          href={p(`/admin/suppliers/${r.supplier.slug}`)}
                          className="text-[#0f4c81] hover:underline"
                        >
                          {L.open} →
                        </Link>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-[#64748b]">
        <Link href={p("/admin")} className="text-[#0f4c81] hover:underline">
          ← {a.navOverview}
        </Link>
      </p>
    </div>
  );
}
