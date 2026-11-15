import type { Metadata } from "next";
import Link from "next/link";
import CompanyProfileWizard from "@/components/portal/CompanyProfileWizard";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import {
  getChecklistTemplates,
  getSupplierSelfAssessment,
} from "@/lib/supplierAssessments";
import { isBasicTemplate, type AssessmentQuestion, type AssessmentResponses } from "@/lib/assessmentShared";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

// /portal/company —— 公司信息分步向导（照 Sedex /supplier/company/site）
//
// 读写与 /supplier-assessment 同一份 responses（SP01–SP14），只是 UI 换成
// Sedex 式分步表单。这样供应商可以用「向导」快速填完基础档案，再去做专项模块。

const PATH = "/portal/company";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.account.h1,
    description: t.account.lead,
    robots: { index: false, follow: false },
  });
}

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh" || locale === "zh-TW";

  const access = await resolveSupplierAccess({ claimedSupplierId: null, email: null });
  if (!access.ok) {
    return (
      <div className="rounded-xl border border-[#ecebe7] bg-white p-8 text-center">
        <p className="text-[#3f4650]">
          {access.code === "not_owner"
            ? zh
              ? "此账号未关联任何供应商。"
              : "This account is not linked to a supplier."
            : zh
            ? "请先登录供应商账号。"
            : "Please sign in to your supplier account."}
        </p>
        <Link href={p("/portal")} className="btn btn-primary mt-4 inline-block text-sm">
          {zh ? "返回工作台" : "Back to workspace"}
        </Link>
      </div>
    );
  }

  const { supplierId, email } = access.identity;
  const templates = await getChecklistTemplates();
  const basic = templates.find(isBasicTemplate);
  const questions: AssessmentQuestion[] = basic
    ? basic.sections
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .flatMap((s) => s.questions.slice().sort((a, b) => a.sortOrder - b.sortOrder))
    : [];

  const draft = await getSupplierSelfAssessment(supplierId);
  const initialResponses: AssessmentResponses = (draft?.responses as AssessmentResponses) ?? {};

  return (
    <div>
      {/* 面包屑（对齐 Sedex 的「返回工作场所仪表板」） */}
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <Link
          href={p("/portal")}
          className="inline-flex items-center gap-1 text-[#6d6b66] hover:text-[#171717]"
        >
          <span aria-hidden="true">←</span>
          {zh ? "返回工作台" : "Back to workspace"}
        </Link>
      </nav>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-[#ecebe7] bg-white p-6 text-center text-[#6d6b66]">
          {zh ? "题库尚未配置，请稍后再试。" : "Questionnaire is not configured yet."}
        </div>
      ) : (
        <CompanyProfileWizard
          questions={questions}
          initialResponses={initialResponses}
          supplierId={supplierId}
          email={email}
          locale={locale}
        />
      )}
    </div>
  );
}
