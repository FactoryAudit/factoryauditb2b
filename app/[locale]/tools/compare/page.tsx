import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import SupplierComparison from "@/components/tools/SupplierComparison";
import { DIMENSION_STRUCTURE } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/tools/compare";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.compare.metaTitle,
    description: t.compare.metaDesc,
  });
}

export default async function ComparePage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.compare;
  const p = (href: string) => localePath(locale, href);

  // 维度标签与权重直接取自评分模型，不手工抄一份，避免文档与代码脱节
  const dimensions = DIMENSION_STRUCTURE.map((d) => {
    const content = (t.risk.dimensions as Record<
      string,
      { label: string; short: string; description: string } | undefined
    >)[d.key];
    return {
      key: d.key,
      label: content?.label ?? d.key,
      weight: d.weight,
      description: content?.description ?? "",
    };
  });

  const defaultNames = [`${c.supplierLabel} A`, `${c.supplierLabel} B`];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: c.h1,
      description: c.metaDesc,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      url: `${BASE}${p(PATH)}`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${BASE}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        { "@type": "ListItem", position: 2, name: "Tools", item: `${BASE}${p("/tools")}` },
        { "@type": "ListItem", position: 3, name: c.h1, item: `${BASE}${p(PATH)}` },
      ],
    },
  ];

  return (
    <main className="container py-12" data-track-page="tool_compare">
      <JsonLd data={jsonLd} />

      <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
        {c.badge}
      </span>
      <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{c.h1}</h1>
      <p className="text-[#64748b] mt-3 text-lg max-w-3xl">{c.lead}</p>

      <div className="mt-8">
        <SupplierComparison
          dict={c}
          dimensions={dimensions}
          defaultNames={defaultNames}
          verificationHref={p("/services/supplier-verification")}
        />
      </div>
    </main>
  );
}
