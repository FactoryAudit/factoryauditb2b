import { permanentRedirect } from "next/navigation";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";

// 原 /inspectors 是「资源中心」，但路径名与内容不符。
// 新资源中心为 /resources（Supplier Intelligence Resources），此处保留 308。
export default async function InspectorsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  permanentRedirect(localePath(locale, "/resources"));
}
