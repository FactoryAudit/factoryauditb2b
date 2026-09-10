import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getAdminSupplier, requireAdmin } from "@/lib/adminData";
import { STATIC_PROGRAMS } from "@/lib/staticData";
import SupplierEvidencePanel from "@/components/admin/SupplierEvidencePanel";

// 供应商「认证」页 —— Verification & Evidence Center（spec §5/§6）。
// 与 documents 页共用 SupplierEvidencePanel，仅初始页签不同。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function AdminSupplierCertificationsPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);

  const row = await getAdminSupplier(slug);
  if (!row) notFound();

  const programs = STATIC_PROGRAMS.filter((x) => x.isCertification || x.isAudit).map(
    (x) => ({
      code: x.code,
      label: locale === "zh" || locale === "zh-TW" ? x.nameZh : x.nameEn,
    })
  );

  return (
    <div>
      <Link
        href={p("/admin/suppliers")}
        className="text-sm text-[#0f4c81] hover:underline"
      >
        ← {a.backToList}
      </Link>

      <h1 className="mt-2 text-2xl font-bold text-[#0f172a]">{row.legal_name}</h1>
      <p className="mt-1 font-mono text-xs text-[#94a3b8]">{row.slug}</p>

      <div className="mt-6">
        <SupplierEvidencePanel
          slug={row.slug}
          locale={locale}
          dict={t.evidenceCenter}
          verificationLevel={row.verification_level}
          programs={programs}
          initialTab="certs"
        />
      </div>
    </div>
  );
}
