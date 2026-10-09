import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICES, findCoverageCountry } from "@/lib/coverage";
import { getSeoMatrix } from "@/lib/taxonomy";
import { SERVICE_MENU } from "@/lib/nav";
import { countryDisplayName } from "@/lib/countryNames";
import { listSuppliersByCountry } from "@/lib/queries";
import { overallLevel } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy, pickZhPair } from "@/lib/tw";
import { trLookup } from "@/lib/contentI18n";
import { supplierDisplayName } from "@/lib/supplierDisplayName";
import RelatedGuides from "@/components/RelatedGuides";

const BASE = "https://factoryauditb2b.com";
type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    COVERAGE_COUNTRIES.map((c) => ({ locale, slug: c.slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const country = findCoverageCountry(slug);
  if (!country) {
    return buildPageMetadata({
      locale,
      path: `/countries/${slug}`,
      title: "Coverage",
      description: "Supplier verification coverage.",
      robots: { index: false },
    });
  }
  const t = await getDictionary(locale);
  const name = pickZhPair(locale, country.name, country.nameZh);
  return buildPageMetadata({
    locale,
    path: `/countries/${slug}`,
    title: t.countryHub.h1Template.replaceAll("{country}", name),
    description: t.countryHub.metaDesc.replaceAll("{country}", name),
  });
}

export default async function CountryPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const country = findCoverageCountry(slug);
  if (!country) notFound();

  const t = await getDictionary(locale);
  const h = t.countryHub;
  const p = (href: string) => localePath(locale, href);
  const name = pickZhPair(locale, country.name, country.nameZh);
  const copy = pickZhCopy(locale, country);

  // 与 /audit-guide/[country]/[auditType] 的 generateStaticParams 同源，
  // 保证下方 chip 链接指向真实存在的页面，绝不产生死链。
  const { auditTypes } = await getSeoMatrix();
  const suppliers = (await listSuppliersByCountry(country.code)).slice(0, 12);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${name} Supplier Verification`,
      serviceType: trLookup(locale, "Supplier verification") ?? "Supplier verification",
      areaServed: name,
      description: trLookup(locale, country.metaDesc) ?? country.metaDesc,
      provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
      url: `${BASE}${p(`/countries/${slug}`)}`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: h.breadcrumbHome, item: `${BASE}${p("/")}` },
        {
          "@type": "ListItem",
          position: 2,
          name: t.coverage.h1,
          item: `${BASE}${p("/countries")}`,
        },
        { "@type": "ListItem", position: 3, name, item: `${BASE}${p(`/countries/${slug}`)}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  // 国家级服务页（verification / audit）——复用 COVERAGE_SERVICES 引擎，
  // slug 形如 /services/thailand-factory-audit。
  const services: { title: string; href: string; note?: string }[] = COVERAGE_SERVICES.map((svc) => ({
    title: pickZhPair(locale, svc.nameEn, svc.nameZh),
    href: `/services/${country.slug}-${svc.slugSuffix}`,
  }));

  // 非国家级服务（inspection / sourcing / monitoring / improvement）——
  // href 直接复用主导航的单一事实来源 SERVICE_MENU，不在此第二次硬编码路径，
  // 标签取字典 servicesIndex.items[key].title。国家页与主导航因此永远同源，不会各自漂移。
  // inspection 额外挂上字典里既有的诚实口径（inspection.honestNote）：
  // 排期取决于品类、地点与审核员档期，绝不包装成「已全面覆盖」。
  const GLOBAL_SERVICE_KEYS = ["inspection", "sourcing", "monitoring", "improvement"] as const;
  const globalServices: { title: string; href: string; note?: string }[] = SERVICE_MENU.filter((m) =>
    (GLOBAL_SERVICE_KEYS as readonly string[]).includes(m.key)
  ).map((m) => ({
    title: t.servicesIndex.items[m.key].title,
    href: m.href,
    note: m.key === "inspection" ? t.inspection.honestNote : undefined,
  }));

  // 国家间交叉链接：China ↔ Vietnam ↔ Thailand ↔ Malaysia ↔ Philippines。
  // 名称走 lib/countryNames.ts 的 9 语表（缺译文时回退英文，不臆造）；
  // 锚文本 =「国家名 + Supplier Verification」，与该国页的 H1 意图一致。
  const relatedCountries = COVERAGE_COUNTRIES.filter((c) => c.slug !== country.slug).map((c) => ({
    href: `/countries/${c.slug}`,
    label: `${countryDisplayName(locale, c.code, c.name)} ${t.servicesIndex.items.verification.title}`,
  }));

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#6d6b66]">
        <Link href={p("/")} className="hover:underline">{h.breadcrumbHome}</Link>
        {" / "}
        <Link href={p("/countries")} className="hover:underline">{h.breadcrumb}</Link>
        {" / "}{name}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#171717]">
        {h.h1Template.replaceAll("{country}", name)}
      </h1>
      <p className="mt-3 text-lg text-[#3f4650]">{copy.hook}</p>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.profileTitle}</h2>
        <p className="text-[#3f4650] mt-2">{copy.profile}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.risksTitle}</h2>
        <ul className="mt-3 space-y-2 text-[#3f4650]">
          {copy.risks.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-[#171717]">{h.verificationTitle}</h2>
          <ul className="mt-3 space-y-2 text-[#3f4650]">
            {copy.verificationNotes.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#171717]">{h.auditTitle}</h2>
          <ul className="mt-3 space-y-2 text-[#3f4650]">
            {copy.auditNotes.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.hubsTitle}</h2>
        <ul className="mt-3 space-y-1 text-[#3f4650]">
          {copy.hubs.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-2xl font-bold text-[#171717]">{h.industriesTitle}</h2>
          <ul className="mt-3 space-y-1 text-[#3f4650]">
            {copy.industries.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#171717]">{h.standardsTitle}</h2>
          <ul className="mt-3 space-y-1 text-[#3f4650]">
            {copy.standards.map((x) => (
              <li key={x}>· {x}</li>
            ))}
          </ul>

          {/* 该国审核指南入口。
              此前 /audit-guide/{country}/{code} 只有 china 全量 + vietnam/SMETA 被 /industry 页链到，
              马来西亚 / 菲律宾 / 泰国 / 越南 共 27 个页面零入链（孤岛），Google 只能靠 sitemap 发现，
              抓取优先级垫底 —— 直接对应 Search Console「已发现 - 尚未编入索引」。
              这里复用 getSeoMatrix().auditTypes，与页面 generateStaticParams 及 sitemap 同源，
              保证每个链接都指向真实存在的页面，不产生死链。 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {auditTypes.map((a) => (
              <Link
                key={a.code}
                href={p(`/audit-guide/${country.code}/${a.code}`)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-[#171717] hover:bg-gray-200"
              >
                {a.nameEn}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.logisticsTitle}</h2>
        <p className="text-[#3f4650] mt-2">{copy.logistics}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.registryTitle}</h2>
        <p className="text-[#3f4650] mt-2">{copy.registry}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.servicesTitle}</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...services, ...globalServices].map((s) => (
            <Link key={s.href} href={p(s.href)} className="card p-4 hover:border-[#171717]">
              <span className="font-medium text-[#171717]">{s.title}</span>
              {s.note ? (
                <span className="mt-1 block text-sm text-[#6d6b66]">{s.note}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.toolsTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline">
            {t.toolCards.riskCalculator.title}
          </Link>
          <Link href={p("/tools/supplier-verification-checklist")} className="btn btn-outline">
            {t.toolCards.verificationChecklist.title}
          </Link>
          <Link href={p("/tools/audit-checklist")} className="btn btn-outline">
            {t.toolCards.auditChecklist.title}
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">
          {h.suppliersTitle.replace("{country}", name)}
        </h2>
        {suppliers.length === 0 ? (
          <p className="mt-2 text-[#3f4650]">
            {h.suppliersEmpty.replace("{country}", name)}
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border border-[#ebe8e1]">
            {suppliers.map((s) => (
              <li key={s.slug} className="flex items-center justify-between p-3">
                <Link
                  href={p(`/suppliers/${s.slug}`)}
                  className="font-medium text-[#171717] hover:underline"
                >
                  {supplierDisplayName(locale, s)}
                </Link>
                <span className="text-sm text-[#6d6b66]">
                  {s.city} · {t.supplierProfile.riskScore}{" "}
                  {typeof s.riskScore === "number"
                    ? `${s.riskScore} / 100 · ${t.risk.ui.level[overallLevel(s.riskScore)]}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* 注意：此处不再出现中文「风险」硬编码，口径统一走字典（P0 语言一致性） */}

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{h.faqTitle}</h2>
        <div className="mt-3 space-y-4">
          {copy.faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-[#171717]">{f.q}</h3>
              <p className="text-[#3f4650] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 国家间交叉链接：形成 China ↔ Vietnam ↔ Thailand ↔ Malaysia ↔ Philippines 的完整内链网。
          标题与导语复用字典既有键 servicesIndex.coverageTitle / coverageLead（"Coverage by country"），
          ⚠️ 不新增字典键 —— en 字典叶子数 3192 是 20 个回归脚本共同断言的闸门，复用即可保持 3192。 */}
      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#171717]">{t.servicesIndex.coverageTitle}</h2>
        <p className="text-[#3f4650] mt-1">{t.servicesIndex.coverageLead}</p>
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {relatedCountries.map((r) => (
            <li key={r.href}>
              <Link href={p(r.href)} className="block card p-4 hover:border-[#171717]">
                <span className="font-medium text-[#171717]">{r.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 card p-8 bg-[#fbfaf7]">
        <h2 className="text-xl font-bold text-[#171717]">
          {h.ctaTitle.replace("{country}", name)}
        </h2>
        <p className="text-[#3f4650] mt-2">{h.ctaLead.replace("{country}", name)}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p(`/services/${country.slug}-supplier-verification`)} className="btn btn-primary">
            {h.ctaPrimary.replace("{country}", name)}
          </Link>
          <Link href={p(`/services/${country.slug}-factory-audit`)} className="btn btn-outline">
            {h.ctaSecondary.replace("{country}", name)}
          </Link>
        </div>
      </section>
      <RelatedGuides locale={locale} hub={`country:${slug}`} />
    </main>
  );
}
