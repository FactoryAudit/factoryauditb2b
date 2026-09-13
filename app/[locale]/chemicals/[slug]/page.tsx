import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CHEMICALS, findChemical } from "@/lib/chemicals";
import { industryDisplayName, listIndustries } from "@/lib/taxonomy";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair, twText } from "@/lib/tw";
import JsonLd from "@/components/JsonLd";
import RfqForm from "@/components/RfqForm";

const BASE = "https://factoryauditb2b.com";
// 🔴 化工行业的 RFQ 落在 industry_code = chemicals 下；
//    没有「化学品」这张表，也不为此改数据库 —— 具体品种靠 source_path + product 承载。
const INDUSTRY_CODE = "chemicals";

type Params = { locale: string; slug: string };

export const dynamicParams = false;

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) => CHEMICALS.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const chem = findChemical(slug);
  if (!chem) {
    return buildPageMetadata({
      locale,
      path: `/chemicals/${slug}`,
      title: "Chemical",
      description: "Chemical raw material.",
      robots: { index: false },
    });
  }
  const t = await getDictionary(locale);
  const name = pickZhPair(locale, chem.nameEn, chem.nameZh);
  return buildPageMetadata({
    locale,
    path: `/chemicals/${slug}`,
    title: `${name} (CAS ${chem.cas}) — ${t.chemicals.metaTitle}`,
    description: pickZhPair(locale, chem.application.en, chem.application.zh).slice(0, 200),
  });
}

export default async function ChemicalPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const lp = (href: string) => localePath(locale, href);
  const c = t.chemicals;

  const chem = findChemical(slug);
  if (!chem) notFound();

  const name = pickZhPair(locale, chem.nameEn, chem.nameZh);
  const industries = await listIndustries();
  const downstream = chem.downstream
    .map((code) => industries.find((i) => i.code === code))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map((i) => ({ code: i.code, name: industryDisplayName(locale, i.name) }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${name} (CAS ${chem.cas})`,
            description: pickZhPair(locale, chem.application.en, chem.application.zh),
            inLanguage: locale,
            url: `${BASE}${lp(`/chemicals/${slug}`)}`,
            publisher: { "@id": `${BASE}/#organization` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              { "@type": "ListItem", position: 2, name: c.metaTitle, item: `${BASE}/chemicals` },
              { "@type": "ListItem", position: 3, name, item: `${BASE}/chemicals/${slug}` },
            ],
          },
        ]}
      />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={lp("/")} className="hover:underline">{t.common.ui.home}</Link> /{" "}
        <Link href={lp("/chemicals")} className="hover:underline">{c.metaTitle}</Link> / {name}
      </nav>

      <h1 className="text-3xl font-bold">{name}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {c.casLabel}: <span className="font-mono">{chem.cas}</span>
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">{c.synonymsLabel}</h2>
        {/* 🔴 同义词是数组，不能像正文那样走 pickZhPair —— zh-TW 下必须逐条繁化。
            此前直接取 synonyms.zh 原样输出，导致繁体页里出现简体「柠檬酸」。 */}
        <p className="mt-2 text-gray-600">
          {(locale === "zh" || locale === "zh-TW" ? chem.synonyms.zh : chem.synonyms.en)
            .map((x) => (locale === "zh-TW" ? twText(x) : x))
            .join(" · ")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{c.applicationLabel}</h2>
        <p className="mt-2 text-gray-600">
          {pickZhPair(locale, chem.application.en, chem.application.zh)}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{c.complianceLabel}</h2>
        <p className="mt-2 text-gray-600">
          {pickZhPair(locale, chem.compliance.en, chem.compliance.zh)}
        </p>
      </section>

      {downstream.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{c.relatedIndustries}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {downstream.map((i) => (
              <Link
                key={i.code}
                href={lp(`/industry/${i.code}`)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
              >
                {i.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA：把「化学品」作为合法 context 带进 RFQ ——
          industry_code=chemicals（已有列）+ source_path（已有列）+ product 预填。
          不新增任何数据库列，也不注入 certifications_req（买家还没说要什么证书）。 */}
      <section className="mt-10 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">
          {t.industryPage.ctaTitle.replaceAll("{industry}", name)}
        </h2>
        <p className="mt-1 text-sm text-[#475569]">
          {t.industryPage.ctaDesc.replaceAll("{industry}", name)}
        </p>
        <div className="mt-4">
          <RfqForm
            t={t.rfq.form}
            context={{
              locale,
              industryCode: INDUSTRY_CODE,
              sourcePath: `/chemicals/${slug}`,
              defaultProduct: name,
            }}
          />
        </div>
      </section>
    </main>
  );
}
