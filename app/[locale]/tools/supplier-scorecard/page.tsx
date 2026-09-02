import type { Metadata } from "next";
import SupplierScorecardTool from "@/components/tools/SupplierScorecardTool";
import type { ScorecardUi } from "@/lib/toolUiTypes";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/tools/supplier-scorecard";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.toolsUi.scorecard.metaTitle,
    description: t.toolsUi.scorecard.metaDesc,
  });
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const ui = t.toolsUi.scorecard;

  return (
    <main className="container py-12" data-track-page="tool_scorecard">
      <span className="inline-block px-3 py-1 rounded-full bg-[#e6eef6] text-[#0f4c81] text-sm font-semibold mb-4">
        FactoryAuditB2B RiskScore™
      </span>
      <h1 className="text-3xl font-bold text-[#0f172a]">{ui.h1}</h1>
      <p className="text-[#64748b] mt-2 mb-6 max-w-3xl">{ui.lead}</p>
      <SupplierScorecardTool ui={ui as unknown as ScorecardUi} />
      <p className="text-xs text-[#94a3b8] mt-10 max-w-3xl text-center">{t.common.disclaimer}</p>
    </main>
  );
}
