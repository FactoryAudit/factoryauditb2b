import { permanentRedirect } from "next/navigation";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";

// 原 /knowledge 是供应商培训页，已按 PRD §37 降级并迁到
// /services/supplier-improvement。保留 308 以守住已有外链与收录。
export default async function KnowledgeRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  permanentRedirect(localePath(locale, "/services/supplier-improvement"));
}
