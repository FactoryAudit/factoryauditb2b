import type { Metadata } from "next";
import SelfAssessmentForm from "@/components/supplier/SelfAssessmentForm";
import OnSiteAuditApply from "@/components/supplier/OnSiteAuditApply";
import {
  getChecklistTemplates,
  getSupplierSelfAssessment,
  getSupplierOnSiteAudit,
  type AssessmentTemplate,
} from "@/lib/supplierAssessments";
import { listEvidenceForSupplier } from "@/lib/supplierEvidence";
import { listFactoryPhotosForSupplier } from "@/lib/supplierImages";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";
import { getDictionary } from "@/i18n/getDictionary";

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
  const dict = await getDictionary(locale);
  const sa = (dict.selfAssessment ?? {}) as Record<string, string>;

  // 归属裁决（会话优先 / 邮箱兜底 / 歧义拒）。无会话且无邮箱 ⇒ 需登录（满足 CS-B Test13）。
  const access = await resolveSupplierAccess({
    claimedSupplierId: (sp.supplier || "").trim() || null,
    email: (sp.email || "").trim() || null,
  });

  if (!access.ok) {
    const reason = access.code;
    return (
      <main className="container py-10" data-track-page="supplier_self_assessment">
        <section className="max-w-3xl mx-auto text-center mb-8">
          <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">
            {sa["pageTitle"] ?? "工厂自评估 / Factory Self-Assessment"}
          </h1>
        </section>
        <div className="card p-6 max-w-xl mx-auto text-center">
          {reason === "not_owner" ? (
            <p className="text-[#b45309]">{sa["notOwner"] ?? "This account is not linked to a supplier."}</p>
          ) : (
            <p className="text-[#334155]">{sa["signInRequired"] ?? "Please sign in to your supplier account to continue."}</p>
          )}
          <a
            className="btn-primary inline-block mt-4 px-6 py-3"
            href={localePath(locale, "/account")}
          >
            {sa["signIn"] ?? "Sign in"}
          </a>
        </div>
      </main>
    );
  }

  const supplierId = access.identity.supplierId;
  const email = access.identity.email;

  const templates: AssessmentTemplate[] = await getChecklistTemplates();

  let initialResponses: Record<string, any> | null = null;
  let initialSummary: string | null = null;
  let initialStatus: any = null;
  let initialItemReview: Record<string, { status: string; note: string }> | null = null;
  if (templates.length > 0) {
    const draft = await getSupplierSelfAssessment(supplierId);
    if (draft) {
      initialResponses = draft.responses;
      initialSummary = draft.summary;
      initialStatus = draft.status;
      initialItemReview = draft.itemReview;
    }
  }

  const initialEvidence = templates.length > 0 ? await listEvidenceForSupplier(supplierId) : [];
  const initialPhotos = templates.length > 0 ? await listFactoryPhotosForSupplier(supplierId) : [];

  return (
    <main className="container py-10" data-track-page="supplier_self_assessment">
      <section className="max-w-3xl mx-auto text-center mb-8">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">Supplier Portal</span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">
          {sa["pageTitle"] ?? "工厂自评估 / Factory Self-Assessment"}
        </h1>
        <p className="text-[#64748b] mt-3 text-lg">
          {sa["pageDesc"] ??
            "填写社会责任与质量两份清单（共 72 项检查点），提交后由平台审核并发布「工厂自评估」标签。"}
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
            dict={sa}
            supplierId={supplierId}
            email={email}
            initialResponses={initialResponses}
            initialSummary={initialSummary}
            initialStatus={initialStatus}
            initialItemReview={initialItemReview}
            initialEvidence={initialEvidence}
            initialPhotos={initialPhotos}
          />
        </div>
      )}

      <p className="text-center text-xs text-[#94a3b8] mt-8">
        <a className="underline" href={localePath(locale, "/join-supplier-network")}>
          {sa["becomeSupplier"] ?? "Become a supplier"}
        </a>{" "}
        · FactoryAuditB2B
      </p>
    </main>
  );
}
