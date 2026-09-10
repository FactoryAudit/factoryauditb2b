import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import {
  listPendingReview,
  listExpiringCertifications,
  requireAdmin,
  type PendingReviewItem,
} from "@/lib/adminData";
import { Badge } from "@/components/Badge";
import { EXPIRING_SOON_DAYS } from "@/lib/verification";

// 后台「待审核」页 —— Verification & Evidence Center（spec §6/§11）。
//
// 两段聚合：
//   1. 待审核队列：documents / certifications / audits 三表中 PENDING 的记录。
//   2. 即将到期：60 天内到期或已过期的证书。
// 只读列表 + 跳转到对应供应商的子页面处理。不在本页做写操作。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

/** 记录类型 → 对应子页面路径段 */
const KIND_PATH: Record<PendingReviewItem["kind"], string> = {
  document: "documents",
  certification: "certifications",
  audit: "audits",
};

function fmtDays(tpl: string, n: number): string {
  return tpl.replace("{n}", String(n));
}

export default async function AdminPendingReviewPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const d = t.evidenceCenter;
  const p = (href: string) => localePath(locale, href);

  const [pending, expiring] = await Promise.all([
    listPendingReview(200),
    listExpiringCertifications(EXPIRING_SOON_DAYS),
  ]);

  return (
    <div>
      <Link
        href={p("/admin/suppliers")}
        className="text-sm text-[#0f4c81] hover:underline"
      >
        ← {a.backToList}
      </Link>

      <h1 className="mt-2 text-2xl font-bold text-[#0f172a]">{d.adminPendingTitle}</h1>
      <p className="mt-1 text-sm text-[#475569]">{d.adminPendingLead}</p>

      {/* ---- 待审核 ---- */}
      <section className="mt-6">
        {pending.length === 0 ? (
          <p className="text-sm text-[#475569]">{d.adminPendingEmpty}</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f9fc] text-left text-xs text-[#475569]">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">{d.sectionEvidence}</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((it) => (
                  <tr key={`${it.kind}-${it.id}`} className="border-t border-[#e2e8f0]">
                    <td className="px-3 py-2 text-xs text-[#475569]">{it.kind}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={p(`/admin/suppliers/${it.supplierSlug}/${KIND_PATH[it.kind]}`)}
                        className="font-medium text-[#0f4c81] hover:underline"
                      >
                        {it.label}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#475569]">
                      {it.supplierName || it.supplierSlug}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="pending">{d.statusPending}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- 即将到期 ---- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-[#0f172a]">{d.adminExpiringTitle}</h2>
        {expiring.length === 0 ? (
          <p className="mt-2 text-sm text-[#475569]">{d.adminExpiringEmpty}</p>
        ) : (
          <div className="card mt-3 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f9fc] text-left text-xs text-[#475569]">
                <tr>
                  <th className="px-3 py-2">Program</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">{d.validUntil}</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((c) => (
                  <tr key={c.id} className="border-t border-[#e2e8f0]">
                    <td className="px-3 py-2 font-medium text-[#0f172a]">{c.programCode}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={p(`/admin/suppliers/${c.supplierSlug}/certifications`)}
                        className="text-[#0f4c81] hover:underline"
                      >
                        {c.supplierName || c.supplierSlug}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#475569]">
                      {c.expiryDate ?? "—"}
                      {c.daysLeft !== null ? (
                        <div>
                          {c.daysLeft < 0
                            ? fmtDays(d.expiredAgo, -c.daysLeft)
                            : fmtDays(d.daysRemaining, c.daysLeft)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {c.daysLeft !== null && c.daysLeft < 0 ? (
                        <Badge variant="expired">{d.statusExpired}</Badge>
                      ) : (
                        <Badge variant="expiring">{d.statusExpiringSoon}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
