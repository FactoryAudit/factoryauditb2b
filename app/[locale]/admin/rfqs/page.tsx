import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { listAdminRfqs, requireAdmin } from "@/lib/adminData";
import RfqStatusSelect from "@/components/admin/RfqStatusSelect";
import RfqPublicToggle, {
  type RfqPublicToggleDict,
} from "@/components/admin/RfqPublicToggle";

// Admin · 询价单列表
//
// 数据库未配置时 listAdminRfqs() 返回空数组，页面不会崩，
// 会显示空态 —— 与 V2.0 的 fail-open 哲学一致。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function AdminRfqsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);
  const rows = await listAdminRfqs(200);

  const statusDict = {
    statusNew: a.statusNew,
    statusReviewing: a.statusReviewing,
    statusMatched: a.statusMatched,
    statusClosed: a.statusClosed,
    saving: a.saving,
    error: a.error,
  };

  // STEP-02B：对外公开闸门文案。后台为单人 noindex 工具，
  // 按 admin/layout.tsx 既有约定用双语常量，不为内部标签补 9 语字典键。
  const isZh = locale === "zh" || locale === "zh-TW";
  const publicDict: RfqPublicToggleDict = isZh
    ? {
        publicOn: "公开",
        publicOff: "下架",
        shown: "前台可见",
        hidden: "未公开",
        saving: "保存中…",
        error: "失败",
      }
    : {
        publicOn: "Show",
        publicOff: "Hide",
        shown: "Live",
        hidden: "Hidden",
        saving: "Saving…",
        error: "Failed",
      };
  const colPublic = isZh ? "前台公开" : "Public";

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">{a.rfqsTitle}</h1>
      <p className="mt-1 text-sm text-[#64748b]">{a.rfqsLead}</p>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#475569]">{a.rfqsEmpty}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f7f9fc] text-xs uppercase text-[#64748b]">
              <tr>
                <th className="px-4 py-3">{a.colReference}</th>
                <th className="px-4 py-3">{a.colProduct}</th>
                <th className="px-4 py-3">{a.colEmail}</th>
                <th className="px-4 py-3">{a.colCountry}</th>
                <th className="px-4 py-3">{a.colCreated}</th>
                <th className="px-4 py-3">{colPublic}</th>
                <th className="px-4 py-3">{a.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-[#f7f9fc]">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-[#64748b]">{r.reference_id}</span>
                    {r.company && (
                      <div className="mt-0.5 text-xs text-[#94a3b8]">{r.company}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0f172a]">{r.product}</div>
                    {r.quantity && (
                      <div className="mt-0.5 text-xs text-[#94a3b8]">{r.quantity}</div>
                    )}
                    {r.message && (
                      <p className="mt-1 max-w-md whitespace-pre-wrap text-xs text-[#64748b]">
                        {r.message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`mailto:${r.email}`}
                      className="text-[#0f4c81] hover:underline"
                    >
                      {r.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">{r.country ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8]">
                    {new Date(r.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <RfqPublicToggle
                      referenceId={r.reference_id}
                      isPublic={Boolean(r.is_public)}
                      dict={publicDict}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <RfqStatusSelect
                      referenceId={r.reference_id}
                      status={r.status}
                      dict={statusDict}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-[#64748b]">
        <a href={p("/admin")} className="text-[#0f4c81] hover:underline">
          ← {a.navOverview}
        </a>
      </p>
    </div>
  );
}
