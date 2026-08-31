// 统一页面 metadata 工具：保证每个页面都有正确的 canonical / hreflang / OG / robots。
// 修复 SEO-AUDIT P0-1：此前 16 个页面继承根 layout 的 canonicalFor(locale, "/")，全部指向首页。
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

// 全局品牌分享图（1200x630，供 Open Graph / Twitter Card 使用）。
// 此前 openGraph 没有 images，社交分享与富媒体展示缺失。
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "FactoryAuditB2B — Supplier verification and factory audit for China, Vietnam and Thailand",
};

type MetaInput = {
  locale: Locale;
  path: string; // 去掉语言前缀的路径，如 /pricing
  title: string; // 最终 title（可含品牌，也可不含）
  description: string;
  robots?: Partial<Metadata["robots"]>; // 例如 { index: false }
  withBrand?: boolean; // 是否自动追加 "| FactoryAuditB2B"
};

export function buildPageMetadata({ locale, path, title, description, robots, withBrand = true }: MetaInput): Metadata {
  const finalTitle = withBrand ? `${title} | FactoryAuditB2B` : title;
  return {
    title: finalTitle,
    description,
    alternates: { canonical: canonicalFor(locale, path), languages: hreflangFor(path) },
    openGraph: {
      title: finalTitle,
      description,
      type: "website",
      url: canonicalFor(locale, path),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description,
      images: [OG_IMAGE],
    },
    robots: robots ?? { index: true, follow: true },
  };
}
