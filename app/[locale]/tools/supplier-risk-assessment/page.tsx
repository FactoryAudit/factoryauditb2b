import type { Metadata } from "next";
import SupplierRiskAssessmentTool from "@/components/tools/SupplierRiskAssessmentTool";
import type { RiskAssessmentUi } from "@/lib/toolUiTypes";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/tools/supplier-risk-assessment";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.toolsUi.riskAssessment.metaTitle,
    description: t.toolsUi.riskAssessment.metaDesc,
  });
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const ui = {
    ...t.toolsUi.riskAssessment,
    industryNames: t.toolsUi.industryNames,
  } as unknown as RiskAssessmentUi;

  return (
    <main className="container py-12" data-track-page="tool_risk_assessment">
      <span className="inline-block px-3 py-1 rounded-full bg-[#e6eef6] text-[#0f4c81] text-sm font-semibold mb-4">
        FactoryAuditB2B RiskScore™
      </span>
      <h1 className="text-3xl font-bold text-[#0f172a]">{ui.h1}</h1>
      <p className="text-[#64748b] mt-2 mb-6 max-w-3xl">{ui.lead}</p>
      <SupplierRiskAssessmentTool ui={ui as unknown as RiskAssessmentUi} />
      <p className="text-xs text-[#94a3b8] mt-10 max-w-3xl text-center">{t.common.disclaimer}</p>
    </main>
  );
}
