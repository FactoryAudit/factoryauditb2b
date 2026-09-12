import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getSeoMatrix, industryDisplayName, listIndustries } from "@/lib/taxonomy";
import { listSuppliersByIndustry } from "@/lib/queries";
import { findIndustryTopic, topicsForIndustry } from "@/lib/industryContent";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";
import JsonLd from "@/components/JsonLd";
import RfqForm from "@/components/RfqForm";

const BASE = "https://factoryauditb2b.com";

type Params = { locale: string; slug: string; topic: string };

// 只预渲染 lib/industryContent.ts 里真正配置了内容的行业 × 子主题组合。
// 未列出的组合直接静态 404 —— 不允许爬虫按需生成空壳页（§44 质量门）。
export const dynamicParams = false;

export async function generateStaticParams() {
  const industries = await listIndustries();
  return LOCALES.flatMap((locale) =>
    industries.flatMap((i) =>
      topicsForIndustry(i.code).map((tp) => ({ locale, slug: i.code, topic: tp.slug }))
    )
  );
}

async function resolveIndustry(slug: string, locale: string) {
  const industries = await listIndustries();
  const industry = industries.find((i) => i.code === slug);
  if (!industry) notFound();
  return { code: industry.code, name: industryDisplayName(locale, industry.name) };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug, topic: topicSlug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const industry = await resolveIndustry(slug, locale);
  const topic = findIndustryTopic(slug, topicSlug);
  if (!topic) {
    return buildPageMetadata({
      locale,
      path: `/industry/${slug}/${topicSlug}`,
      title: industry.name,
      description: industry.name,
      robots: { index: false },
    });
  }
  return buildPageMetadata({
    locale,
    path: `/industry/${slug}/${topicSlug}`,
    title: pickZhPair(locale, topic.title.en, topic.title.zh),
    description: pickZhPair(locale, topic.metaDesc.en, topic.metaDesc.zh),
  });
}

export default async function IndustryTopicPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug, topic: topicSlug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const lp = (href: string) => localePath(locale, href);
  const p = t.industryPage;

  const industry = await resolveIndustry(slug, locale);
  const topic = findIndustryTopic(slug, topicSlug);
  if (!topic) notFound();

  const title = pickZhPair(locale, topic.title.en, topic.title.zh);
  const description = pickZhPair(locale, topic.metaDesc.en, topic.metaDesc.zh);

  // 相关审核项目：只取已在 getSeoMatrix().auditTypes（isAudit=true）里的 code，
  // 否则会渲染出 404 的 audit-guide 死链。
  const { auditTypes } = await getSeoMatrix();
  const valid = new Set(auditTypes.map((a) => a.code));
  const wanted = topic.programCodes ?? (topic.programCode ? [topic.programCode] : []);
  const programs = wanted
    .filter((c) => valid.has(c))
    .map((c) => auditTypes.find((a) => a.code === c))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  // 审核指南链接的国家维度：取该行业供应商最集中的国家，没有则回退 china。
  // 只有带 programCode 的子主题（P2/P3）才需要查，其余不产生这次查询。
  let primaryCountry = "china";
  if (programs.length > 0) {
    const suppliers = await listSuppliersByIndustry(slug);
    const countryCount = suppliers.reduce<Record<string, number>>((acc, s) => {
      acc[s.countryCode] = (acc[s.countryCode] ?? 0) + 1;
      return acc;
    }, {});
    primaryCountry = Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "china";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: title,
            description,
            inLanguage: locale,
            url: `${BASE}${lp(`/industry/${slug}/${topicSlug}`)}`,
            publisher: { "@id": `${BASE}/#organization` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              { "@type": "ListItem", position: 2, name: p.breadcrumb, item: `${BASE}/industry` },
              { "@type": "ListItem", position: 3, name: industry.name, item: `${BASE}/industry/${slug}` },
              { "@type": "ListItem", position: 4, name: title, item: `${BASE}/industry/${slug}/${topicSlug}` },
            ],
          },
        ]}
      />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={lp("/")} className="hover:underline">{t.common.ui.home}</Link> /{" "}
        <Link href={lp("/industry")} className="hover:underline">{p.breadcrumb}</Link> /{" "}
        <Link href={lp(`/industry/${slug}`)} className="hover:underline">{industry.name}</Link> / {title}
      </nav>

      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-gray-600">{pickZhPair(locale, topic.intro.en, topic.intro.zh)}</p>

      {topic.sections.map((sec) => (
        <section key={sec.h2.en} className="mt-8">
          <h2 className="text-xl font-semibold">{pickZhPair(locale, sec.h2.en, sec.h2.zh)}</h2>
          <div className="mt-2 space-y-3 text-gray-600">
            {sec.body.map((b, i) => (
              <p key={i}>{pickZhPair(locale, b.en, b.zh)}</p>
            ))}
          </div>
        </section>
      ))}

      {topic.checklist && topic.checklist.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{t.common.ui.checklist}</h2>
          <ul className="mt-3 space-y-2 text-gray-600">
            {topic.checklist.map((x, i) => (
              <li key={i}>☐ {pickZhPair(locale, x.en, x.zh)}</li>
            ))}
          </ul>
        </section>
      )}

      {programs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{p.relatedAudit}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {programs.map((a) => (
              <Link
                key={a.code}
                href={lp(`/audit-guide/${primaryCountry}/${a.code}`)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
              >
                {pickZhPair(locale, a.nameEn, a.nameZh)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{p.topicsTitle.replaceAll("{industry}", industry.name)}</h2>
        <ul className="mt-3 space-y-2">
          {topicsForIndustry(slug).map((tp) => (
            <li key={tp.slug}>
              {tp.slug === topicSlug ? (
                <span className="text-gray-500">{pickZhPair(locale, tp.title.en, tp.title.zh)}</span>
              ) : (
                <Link href={lp(`/industry/${slug}/${tp.slug}`)} className="text-[#0f4c81] hover:underline">
                  {pickZhPair(locale, tp.title.en, tp.title.zh)}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA：与 Master 页一致，注入行业上下文 + 具体来源路径（子主题级别）。 */}
      <section className="mt-10 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">{p.ctaTitle.replaceAll("{industry}", industry.name)}</h2>
        <p className="mt-1 text-sm text-[#475569]">{p.ctaDesc.replaceAll("{industry}", industry.name)}</p>
        <div className="mt-4">
          <RfqForm
            t={t.rfq.form}
            context={{ locale, industryCode: slug, sourcePath: `/industry/${slug}/${topicSlug}` }}
          />
        </div>
      </section>
    </main>
  );
}
