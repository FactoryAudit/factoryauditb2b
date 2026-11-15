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
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/supplier-assessment";
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ supplier?: string; email?: string; module?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  // 该页依赖登录态 + ?supplier= / ?email= 参数，且为动态渲染（private, no-cache）。
  // 会话/归属相关的个体化视图不应进入索引 ⇒ noindex, nofollow。
  return buildPageMetadata({
    locale,
    path: PATH,
    title: "Factory Self-Assessment",
    description:
      "Complete the social compliance and quality self-assessment checklists to earn the Factory Self-Assessment tag.",
    robots: { index: false, follow: false },
  });
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
      <div data-track-page="supplier_self_assessment">
        <header className="mb-6">
          <h1 className="text-[22px] font-extrabold text-[#171717]">
            {sa["pageTitle"] ?? "工厂自评估 / Factory Self-Assessment"}
          </h1>
        </header>
        <div className="rounded-xl border border-[#ecebe7] bg-white p-8 text-center">
          {reason === "not_owner" ? (
            <p className="text-[#b45309]">{sa["notOwner"] ?? "This account is not linked to a supplier."}</p>
          ) : (
            <p className="text-[#3f4650]">{sa["signInRequired"] ?? "Please sign in to your supplier account to continue."}</p>
          )}
          <a
            className="btn btn-primary mt-4 inline-block text-sm"
            href={localePath(locale, "/login")}
          >
            {sa["signIn"] ?? "Sign in"}
          </a>
        </div>
      </div>
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

  // 🔴 本页嵌在 (portal)/layout.tsx 的 PortalShell 里（外壳已提供 max-w-820px + padding
  //    + 左侧导航）。因此这里**不能再套 container / max-w / 第二个 <main>**，
  //    否则就是双重留白 + 双重限宽，内容被压得又窄又空（2026-11-16 用户反馈"很难看"的根因）。
  //    标题也从 text-4xl 降到 22px，与 /portal/company 等新页面保持同一层级。
  //    顶部的「返回看板」按钮已移除 —— 左侧侧边栏就是导航，重复只会增加噪音。
  return (
    <div data-track-page="supplier_self_assessment">
      <header className="mb-6">
        <h1 className="text-[22px] font-extrabold text-[#171717]">
          {sa["pageTitle"] ?? "工厂自评估 / Factory Self-Assessment"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#6d6b66]">
          {sa["pageDesc"] ??
            "填写 14 项基础档案（约 5 分钟）即可提交审核并发布企业档案；质量、社会责任、环保三个专项模块可按买家要求后续补充。"}
        </p>
        {/* 商业逻辑硬约束（2026-11-16）：自评=免费；只有线下审核收费。
            必须写在页面上，否则供应商不确定要不要付费，直接放弃填写。 */}
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-[#f1f7f3] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#2e7d4f]">
          <span aria-hidden="true" className="mt-0.5">
            ✓
          </span>
          <span>
            {locale === "zh" || locale === "zh-TW"
              ? "自评完全免费：填写档案、上传工厂照片、提交审核都不收费。只有申请线下实地审核时才收费 —— 399 美元/次（或等值人民币）。"
              : "Self-assessment is free: filling in your profile, uploading factory photos and submitting for review cost nothing. A fee applies only to an on-site audit — USD 399 per audit (or the equivalent in CNY)."}
          </span>
        </p>
      </header>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-[#ecebe7] bg-white p-6 text-center text-[#6d6b66]">
          The self-assessment service is not configured yet. Please check back shortly.
        </div>
      ) : (
        <SelfAssessmentForm
          templates={templates}
          locale={locale}
          dict={sa}
          supplierId={supplierId}
          email={email}
          initialResponses={initialResponses}
          initialSummary={initialSummary}
          initialStatus={initialStatus}
          initialItemReview={initialItemReview}
          initialEvidence={initialEvidence}
          initialPhotos={initialPhotos}
          initialOpenModule={(sp.module || "").trim() || null}
        />
      )}

      <p className="mt-8 text-xs text-[#8c8982]">
        <a className="underline" href={localePath(locale, "/assessment-faq")}>
          {locale === "zh" || locale === "zh-TW" ? "自评 FAQ" : "Self-assessment FAQ"}
        </a>{" "}
        · FactoryAuditB2B
      </p>
    </div>
  );
}
