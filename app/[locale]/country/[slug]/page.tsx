import { permanentRedirect } from "next/navigation";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { findCoverageCountry } from "@/lib/coverage";

// 旧的 /country/[slug] 已被 /countries/[slug] 取代（PRD §7）。
// Phase 1 三个国家保留 308 到新页面；其余国家尚无差异化内容，统一落到 /countries。
// 顺带修掉旧页面里硬编码的中文「风险」（P0 语言一致性）。
export default async function CountryRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const target = findCoverageCountry(slug)
    ? `/countries/${slug}`
    : "/countries";
  permanentRedirect(localePath(locale, target));
}
