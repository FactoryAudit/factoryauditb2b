import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import {
  getAdminSupplier,
  listAdminAudits,
  requireAdmin,
  getLatestSupplierConsent,
  getAdminSupplierReport,
} from "@/lib/adminData";
import { listPublishedClusters } from "@/lib/industrialClusters";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import SupplierEditor, {
  type SupplierFormValues,
  type SupplierAuthInfo,
} from "@/components/admin/SupplierEditor";
import SupplierReportDownloadButton from "@/components/admin/SupplierReportDownloadButton";
import AssessmentAdminPanel from "@/components/admin/AssessmentAdminPanel";
import SupplierReportEditor from "@/components/admin/SupplierReportEditor";
import { ASSESSMENT_TYPE_LABELS } from "@/lib/supplierAssessments";
import {
  supplierCompleteness,
  completenessStateClass,
  completenessStateLabel,
} from "@/lib/supplierCompleteness";
import { emptyReportTemplate } from "@/lib/supplierReportTemplate";
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

  // STEP 10-B：已发布产业带（仅这些可作为供应商关联下拉项；value=slug）。
  const publishedClusters = await listPublishedClusters();
  const clusterOptions = publishedClusters.map((c) => ({
    slug: c.slug,
    label: `${c.name} · ${[c.country, c.province, c.city].filter(Boolean).join(" · ")}`,
  }));

  // CS-20：报告正文（每工厂一份）。库里无记录 ⇒ 下发空模板（13 章骨架，内容全空）。
  // 🔴 绝不用样张的虚构数据当默认值（emptyReportTemplate 只带章节标题与来源说明）。
  const reportRow = await getAdminSupplierReport(slug);

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
    cluster_slug: row.cluster_slug ?? "",
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

  // STEP 13 CS-A：完整度**只算一次**，同时供页面徽章与 SupplierEditor 的发布闸门使用。
  // 与 POST/PATCH /api/admin/suppliers 的服务端校验同源（同一个 lib/supplierCompleteness），
  // 所以"按钮禁用"与"服务端拒绝"永远是同一套理由。
  const completeness = supplierCompleteness({
    slug: row.slug,
    countryCode: row.country_code,
    province: row.province,
    city: row.city,
    industryCode: row.industry_code,
    mainProducts: row.main_products ?? [],
    verificationLevel: row.verification_level,
    verificationStatus: row.verification_status,
    consentVersion: row.consent_version,
    hasConsentRecord: Boolean(consent),
    profileAuthorized: row.profile_authorized,
    isPublished: row.is_published,
  });

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

      {/* STEP 12 Change Set B → STEP 13 A2：审核入口要能一眼看到「数据完整度 / 授权 / 核验」。
          完整度判定统一走 lib/supplierCompleteness.ts（与 Lead 列表、发布闸门同一份口径），
          不再在本页内联一份 —— 否则后台会出现两套"能不能发布"的标准。
          后台是内部 noindex 工具，按 admin 既有约定用双语常量，**不补 9 语字典键**
          （避免再动 en 叶子数冻结常量 2940）。 */}
      {(() => {
        const zh = locale === "zh" || locale === "zh-TW";
        const c = completeness;
        return (
          <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-white p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase text-[#64748b]">
                {zh ? `数据完整度 ${c.score}/${c.total}` : `Data completeness ${c.score}/${c.total}`}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  c.rejected
                    ? "bg-[#fdeaea] text-[#d4232a]"
                    : c.publishable
                      ? "bg-[#e6eef6] text-[#0f4c81]"
                      : "bg-[#fdf3d8] text-[#8a5a00]"
                }`}
              >
                {c.rejected
                  ? zh
                    ? "不合格记录"
                    : "REJECTED"
                  : c.publishable
                    ? zh
                      ? "可发布"
                      : "Publishable"
                    : zh
                      ? "暂不可发布"
                      : "Not publishable"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.items.map((it) => (
                <span
                  key={it.key}
                  className={`rounded px-2 py-1 text-xs ${completenessStateClass(it.state)}`}
                  title={it.value || undefined}
                >
                  {it.state === "PASS" ? "✓ " : it.state === "UNKNOWN" ? "? " : "✗ "}
                  {zh ? it.labelZh : it.labelEn}
                  {it.state !== "PASS" && ` · ${completenessStateLabel(it.state, zh)}`}
                </span>
              ))}
            </div>
            {c.blockers.length > 0 && (
              <p className="mt-2 text-xs text-[#8a5a00]">
                {zh ? "不能发布：" : "Cannot publish: "}
                {c.blockers.join(" / ")}
              </p>
            )}
          </div>
        );
      })()}

      <div className="mt-4">
        <SupplierReportDownloadButton reportData={reportData} defaultLang={defaultLang} />
      </div>

      {/* CS-21：三标签审核管理块（标签①②③审核/发布） */}
      <div className="mt-6">
        <AssessmentAdminPanel supplierId={row.id} labels={ASSESSMENT_TYPE_LABELS} />
      </div>

      <div className="mt-6">
        <SupplierEditor
          slug={row.slug}
          initial={initial}
          auth={auth}
          countryOptions={COVERAGE_COUNTRIES.map((c) => ({ code: c.code, name: c.name }))}
          clusterOptions={clusterOptions}
          publishGate={{
            publishable: completeness.publishable,
            blockers: completeness.blockers,
            isPublished: row.is_published,
          }}
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

      {/* CS-20：报告正文编辑器（人工录入；导出为自包含 HTML） */}
      <div className="mt-10">
        <SupplierReportEditor
          slug={row.slug}
          supplierName={row.legal_name}
          initial={reportRow?.doc ?? emptyReportTemplate()}
          isNew={!reportRow}
          updatedBy={reportRow?.updatedBy ?? null}
          updatedAt={reportRow?.updatedAt ?? null}
        />
      </div>
    </div>
  );
}
