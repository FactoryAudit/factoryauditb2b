import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getAdminSupplier, listAdminAudits, requireAdmin, getLatestSupplierConsent } from "@/lib/adminData";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import SupplierEditor, {
  type SupplierFormValues,
  type SupplierAuthInfo,
} from "@/components/admin/SupplierEditor";
import SupplierReportDownloadButton from "@/components/admin/SupplierReportDownloadButton";
import type { SupplierReportInput, ReportLang } from "@/lib/supplierReportHtml";

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

  const audits = await listAdminAudits(slug);
  const consent = await getLatestSupplierConsent(slug);

  // 组装「核验报告」输入：只取 DB 中的真实记录，绝不编造。
  const reportData: SupplierReportInput = {
    legalName: row.legal_name,
    slug: row.slug,
    countryCode: row.country_code,
    city: row.city ?? null,
    industryCode: row.industry_code ?? null,
    businessType: row.business_type ?? null,
    established: row.established,
    employees: row.employees ?? null,
    mainProducts: row.main_products ?? [],
    exportMarkets: row.export_markets ?? [],
    certifications: row.certifications ?? [],
    auditStatus: row.audit_status ?? null,
    inspectionHistory: row.inspection_history ?? 0,
    riskScore: row.risk_score,
    verificationLevel: row.verification_level,
    audits: audits.map((a) => ({
      auditType: a.audit_type,
      auditDate: a.audit_date,
      auditorName: a.auditor_name ?? null,
      auditorOrg: a.auditor_org ?? null,
      result: a.result ?? null,
      verificationStatus: a.verification_status,
      findingsCritical: a.findings_critical,
      findingsMajor: a.findings_major,
      findingsMinor: a.findings_minor,
      notes: a.notes ?? null,
    })),
    generatedAt: new Date().toISOString(),
  };

  const defaultLang: ReportLang = locale === "zh" || locale === "zh-TW" ? "zh" : "en";

  const initial: SupplierFormValues = {
    slug: row.slug,
    legal_name: row.legal_name,
    english_name: row.english_name ?? "",
    company_type: row.company_type ?? "",
    registration_number: row.registration_number ?? "",
    website: row.website ?? "",
    country_code: row.country_code ?? "",
    province: row.province ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
    industry_code: row.industry_code ?? "",
    business_type: row.business_type ?? "",
    established: row.established === null ? "" : String(row.established),
    employees: row.employees ?? "",
    main_products: (row.main_products ?? []).join(", "),
    export_markets: (row.export_markets ?? []).join(", "),
    contact_person: row.contact_person ?? "",
    contact_email: row.contact_email ?? "",
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    company_description: row.company_description ?? "",
    verification_status: row.verification_status ?? "",
    audit_status: row.audit_status ?? "",
    risk_score: row.risk_score === null ? "" : String(row.risk_score),
    inspection_history: String(row.inspection_history ?? 0),
    access_tier: (row.access_tier as "public" | "free" | "paid") ?? "public",
    is_published: row.is_published,
  };

  const auth: SupplierAuthInfo = {
    profileAuthorized: row.profile_authorized,
    authorizedBy: row.authorized_by ?? null,
    authorizedAt: row.authorized_at ?? null,
    consentVersion: row.consent_version ?? null,
    consentAt: consent?.consent_timestamp ?? null,
    consentIp: (consent?.ip_address ?? row.consent_ip) ?? null,
    consentUserAgent: (consent?.user_agent ?? row.consent_user_agent) ?? null,
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

      <div className="mt-4">
        <SupplierReportDownloadButton reportData={reportData} defaultLang={defaultLang} />
      </div>

      <div className="mt-6">
        <SupplierEditor
          slug={row.slug}
          initial={initial}
          auth={auth}
          countryOptions={COVERAGE_COUNTRIES.map((c) => ({ code: c.code, name: c.name }))}
          dict={{
            save: a.save,
            saving: a.saving,
            saved: a.saved,
            error: a.error,
            publish: a.publishButton,
            unpublish: a.unpublishButton,
            publishBlocked: a.publishBlocked,
            consentHistoryNote: a.consentHistoryNote,
            authorizedTitle: a.authorizedTitle,
            tierPublic: a.tier?.public ?? "Public",
            tierFree: a.tier?.free ?? "Free",
            tierPaid: a.tier?.paid ?? "Paid",
            riskHint: a.riskHint,
            tierHint: a.tierHint,
            labels: {
              legalName: a.fieldLegalName,
              englishName: a.fieldEnglishName,
              companyType: a.fieldCompanyType,
              registrationNumber: a.fieldRegistrationNumber,
              website: a.fieldWebsite,
              country: a.fieldCountry,
              province: a.fieldProvince,
              city: a.fieldCity,
              address: a.fieldAddress,
              industry: a.fieldIndustry,
              businessType: a.fieldBusinessType,
              established: a.fieldEstablished,
              employees: a.fieldEmployees,
              products: a.fieldProducts,
              exportMarkets: a.fieldExportMarkets,
              contactPerson: a.fieldContactPerson,
              contactEmail: a.fieldContactEmail,
              phone: a.fieldPhone,
              whatsapp: a.fieldWhatsapp,
              companyDescription: a.fieldCompanyDescription,
              verification: a.fieldVerification,
              auditStatus: a.fieldAuditStatus,
              riskScore: a.fieldRiskScore,
              inspectionHistory: a.fieldInspectionHistory,
              accessTier: a.fieldAccessTier,
              published: a.fieldPublished,
              authorized: a.colAuthorized,
              authorizedBy: a.authorizedBy,
              authorizedAt: a.authorizedAt,
              consentVersion: a.consentVersion,
              consentAt: a.consentAt,
              consentIp: a.consentIp,
              consentUserAgent: a.consentUserAgent,
            },
          }}
        />
      </div>

      <p className="mt-4 text-xs text-[#64748b]">{a.editorNote}</p>
    </div>
  );
}
