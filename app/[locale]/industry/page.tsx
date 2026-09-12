import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { industryDisplayName, listIndustries } from "@/lib/taxonomy";
import { topicsForIndustry } from "@/lib/industryContent";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";

const PATH = "/industry";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.industryPage.breadcrumb,
    description: t.industryPage.hubMetaDesc,
  });
}

export default async function IndustryHubPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = t.industryPage;
  const lp = (href: string) => localePath(locale, href);

  const industries = await listIndustries();
  const cards = industries.map((i) => ({
    code: i.code,
    name: industryDisplayName(locale, i.name),
    topics: topicsForIndustry(i.code),
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: p.breadcrumb,
    url: `${BASE}${lp(PATH)}`,
    numberOfItems: cards.length,
    itemListElement: cards.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      url: `${BASE}${lp(`/industry/${x.code}`)}`,
    })),
  };

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={lp("/")} className="hover:underline">
          {t.common.ui.home}
        </Link>{" "}
        / {p.breadcrumb}
      </nav>

      <section className="max-w-3xl mb-10">
        <h1 className="text-4xl font-extrabold text-[#0f172a]">{p.breadcrumb}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{p.hubLead}</p>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {cards.map((x) => (
          <div key={x.code} className="card p-6 flex flex-col">
            <h2 className="text-xl font-bold text-[#0f172a]">
              <Link href={lp(`/industry/${x.code}`)} className="hover:underline">
                {x.name}
              </Link>
            </h2>
            {/* 子主题只在 lib/industryContent.ts 里配置了内容的行业才渲染。
                没有配置就只留行业名 —— 绝不用模板套话填充（§44 质量门）。 */}
            {x.topics.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm flex-1">
                {x.topics.map((tp) => (
                  <li key={tp.slug}>
                    <Link
                      href={lp(`/industry/${x.code}/${tp.slug}`)}
                      className="text-[#0f4c81] hover:underline"
                    >
                      {pickZhPair(locale, tp.title.en, tp.title.zh)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href={lp(`/industry/${x.code}`)} className="btn btn-outline mt-5 self-start">
              {x.name} →
            </Link>
          </div>
        ))}
      </section>
    </main>
  );
}
