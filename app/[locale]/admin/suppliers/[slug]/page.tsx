import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getAdminSupplier, requireAdmin } from "@/lib/adminData";
import SupplierEditor, {
  type SupplierFormValues,
} from "@/components/admin/SupplierEditor";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function AdminSupplierEditPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);

  const row = await getAdminSupplier(slug);
  if (!row) notFound();

  const initial: SupplierFormValues = {
    slug: row.slug,
    legal_name: row.legal_name,
    city: row.city,
    industry_code: row.industry_code ?? "",
    business_type: row.business_type ?? "",
    established: row.established === null ? "" : String(row.established),
    employees: row.employees ?? "",
    verification_status: row.verification_status ?? "",
    risk_score: row.risk_score === null ? "" : String(row.risk_score),
    audit_status: row.audit_status ?? "",
    inspection_history: String(row.inspection_history ?? 0),
    access_tier: (row.access_tier as "public" | "free" | "paid") ?? "public",
    is_published: row.is_published,
  };

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
        <SupplierEditor
          slug={row.slug}
          initial={initial}
          dict={{
            save: a.save,
            saving: a.saving,
            saved: a.saved,
            error: a.error,
            tierPublic: a.tier?.public ?? "Public",
            tierFree: a.tier?.free ?? "Free",
            tierPaid: a.tier?.paid ?? "Paid",
            riskHint: a.riskHint,
            tierHint: a.tierHint,
            labels: {
              legalName: a.fieldLegalName,
              city: a.fieldCity,
              industry: a.fieldIndustry,
              businessType: a.fieldBusinessType,
              established: a.fieldEstablished,
              employees: a.fieldEmployees,
              verification: a.fieldVerification,
              riskScore: a.fieldRiskScore,
              auditStatus: a.fieldAuditStatus,
              inspectionHistory: a.fieldInspectionHistory,
              accessTier: a.fieldAccessTier,
              published: a.fieldPublished,
            },
          }}
        />
      </div>

      <p className="mt-4 text-xs text-[#64748b]">{a.editorNote}</p>
    </div>
  );
}
