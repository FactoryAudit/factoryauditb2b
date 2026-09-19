import type { Metadata } from "next";
import SelfAssessmentForm from "@/components/supplier/SelfAssessmentForm";
import OnSiteAuditApply from "@/components/supplier/OnSiteAuditApply";
import {
  getChecklistTemplates,
  getSupplierSelfAssessment,
  getSupplierOnSiteAudit,
  type AssessmentTemplate,
} from "@/lib/supplierAssessments";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

const PATH = "/supplier-assessment";
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ supplier?: string; email?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const title = "Factory Self-Assessment | FactoryAuditB2B";
  const desc = "Complete the social compliance and quality self-assessment checklists to earn the Factory Self-Assessment tag.";
  return {
    title,
    description: desc,
    alternates: { canonical: canonicalFor(locale, PATH), languages: hreflangFor(PATH) },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const sp = await searchParams;
  const supplierId = (sp.supplier || "").trim();
  const email = (sp.email || "").trim();

  const templates: AssessmentTemplate[] = await getChecklistTemplates();

  let initialResponses: Record<string, string> | null = null;
  let initialSummary: string | null = null;
  let initialOnSite: { status: string; slaDueAt: string | null; submittedAt: string | null } | null = null;
  if (supplierId) {
    const draft = await getSupplierSelfAssessment(supplierId);
    if (draft) {
      initialResponses = draft.responses;
      initialSummary = draft.summary;
    }
    const onSite = await getSupplierOnSiteAudit(supplierId);
    if (onSite) initialOnSite = onSite;
  }

  return (
    <main className="container py-10" data-track-page="supplier_self_assessment">
      <section className="max-w-3xl mx-auto text-center mb-8">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">Supplier Portal</span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">工厂自评估 / Factory Self-Assessment</h1>
        <p className="text-[#64748b] mt-3 text-lg">
          填写社会责任与质量两份清单（共 72 项检查点），提交后由平台审核并发布「工厂自评估」标签。
        </p>
      </section>

      {templates.length === 0 ? (
        <div className="card p-6 text-center text-[#64748b]">
          The self-assessment service is not configured yet. Please check back shortly.
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <SelfAssessmentForm
            templates={templates}
            locale={locale}
            supplierId={supplierId}
            email={email}
            initialResponses={initialResponses}
            initialSummary={initialSummary}
          />
        </div>
      )}

      {supplierId ? (
        <OnSiteAuditApply supplierId={supplierId} email={email} initial={initialOnSite} />
      ) : null}

      <p className="text-center text-xs text-[#94a3b8] mt-8">
        <a className="underline" href={localePath(locale, "/join-supplier-network")}>
          Become a supplier
        </a>{" "}
        · FactoryAuditB2B
      </p>
    </main>
  );
}
