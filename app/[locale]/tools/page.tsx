import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { TOOL_ORDER } from "@/lib/nav";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";

const PATH = "/tools";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const title = `${t.toolsIndex.metaTitle} | FactoryAuditB2B`;
  return {
    title,
    description: t.toolsIndex.metaDesc,
    alternates: { canonical: canonicalFor(locale, PATH), languages: hreflangFor(PATH) },
    openGraph: { title, description: t.toolsIndex.metaDesc, type: "website", url: canonicalFor(locale, PATH) },
  };
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);

  // 工具排序来自 lib/nav.ts（PRD §10）：风险计算器为旗舰，装柜计算器不属于
  // 供应商评估工具，已从工具索引移除（页面保留，从页脚 Tools 入口进入）。
  const tools = TOOL_ORDER.map((x, i) => ({
    ...t.toolCards[x.cardKey],
    href: x.href,
    tag: i === 0 ? t.toolsIndex.flagship : undefined,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.toolsIndex.metaTitle,
    url: canonicalFor(locale, PATH),
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.title,
      url: canonicalFor(locale, tool.href),
    })),
  };

  return (
    <main className="container py-10">
      <JsonLd data={jsonLd} />

      <section className="max-w-3xl mx-auto text-center mb-12">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {t.common.freeTool}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{t.toolsIndex.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{t.toolsIndex.lead}</p>
      </section>

      <section className="grid md:grid-cols-2 gap-5 mb-14">
        {tools.map((tool) => (
          <Link key={tool.href} href={p(tool.href)} className="card p-6 hover:border-[#0f4c81] transition">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-[#0f4c81]">{tool.title}</span>
              {"tag" in tool && tool.tag && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#fff4e0] text-[#a86a13]">
                  {tool.tag}
                </span>
              )}
            </div>
            <p className="text-sm text-[#475569]">{tool.desc}</p>
          </Link>
        ))}
      </section>

      <section className="card p-8 text-center bg-[#f7f9fc]">
        <h2 className="text-2xl font-bold text-[#0f172a]">{t.toolsIndex.ctaTitle}</h2>
        <p className="text-[#64748b] mt-2 max-w-2xl mx-auto">{t.toolsIndex.ctaLead}</p>
        <div className="mt-6 flex gap-3 flex-wrap justify-center">
          <Link href={p("/services/supplier-verification")} className="btn btn-primary">
            {t.toolsIndex.ctaPrimary}
          </Link>
          <Link href={p("/factory-audit/request")} className="btn btn-outline">
            {t.toolsIndex.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
