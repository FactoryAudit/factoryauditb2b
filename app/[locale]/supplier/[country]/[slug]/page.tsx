import { permanentRedirect } from "next/navigation";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { listSupplierSlugs } from "@/lib/queries";

// Supplier Directory V2：独立 SEO Profile URL 收敛为 /suppliers/{slug}。
// 旧路径 /supplier/{country}/{slug} 保留路由文件，统一 308 永久重定向到新地址，
// 保住历史外链权重；新站点地图只提交 /suppliers/{slug}。

export async function generateStaticParams() {
  // 旧路径继续生成静态参数，确保重定向在 SSG 下也能工作
  return await listSupplierSlugs();
}

export default async function LegacySupplierProfile({
  params,
}: {
  params: Promise<{ locale: string; country: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  permanentRedirect(localePath(locale, `/suppliers/${slug}`));
}
