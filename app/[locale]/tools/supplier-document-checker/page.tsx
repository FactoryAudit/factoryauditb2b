import type { Metadata } from "next";
import SupplierDocumentCheckerTool from "@/components/tools/SupplierDocumentCheckerTool";
import type { DocumentCheckerUi } from "@/lib/toolUiTypes";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/tools/supplier-document-checker";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.toolsUi.documentChecker.metaTitle,
    description: t.toolsUi.documentChecker.metaDesc,
  });
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const ui = t.toolsUi.documentChecker;

  return (
    <main className="container py-12" data-track-page="tool_document_checker">
      <span className="inline-block px-3 py-1 rounded-full bg-[#e6eef6] text-[#0f4c81] text-sm font-semibold mb-4">
        {t.common.freeTool}
      </span>
      <h1 className="text-3xl font-bold text-[#0f172a]">{ui.h1}</h1>
      <p className="text-[#64748b] mt-2 mb-6 max-w-3xl">{ui.lead}</p>
      <SupplierDocumentCheckerTool ui={ui as unknown as DocumentCheckerUi} />
      <p className="text-xs text-[#94a3b8] mt-10 max-w-3xl text-center">{t.common.disclaimer}</p>
    </main>
  );
}
