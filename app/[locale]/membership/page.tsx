import { redirect } from "next/navigation";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";

// V2.2 §13/§41：/membership 合并进 /pricing（Founding Buyer 选项）。
// 本文件为页面级兜底重定向；next.config.mjs 另配 permanent 重定向供爬虫/外部链接使用。
// 两者都指向 /pricing#founding-buyer，保证锚点到 Founding Buyer 区块。
export const dynamic = "force-dynamic";

export default async function MembershipRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  redirect(localePath(locale, "/pricing") + "#founding-buyer");
}
