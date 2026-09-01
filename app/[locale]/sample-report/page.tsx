import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { DIMENSION_STRUCTURE } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/sample-report";
const BASE = "https://factoryauditb2b.com";

// 样例报告 8 维得分（虚构演示数据，与页面正文一致，加权后 76/100）。
// 分数是样例数据而非文案，故放在代码常量而非字典。
const SAMPLE_DIM_SCORES: Record<string, number> = {
  company: 82,
  quality: 80,
  compliance: 74,
  production: 70,
  supplychain: 72,
  documentation: 78,
  certification: 84,
  digitalFootprint: 75,
};

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.sampleReport.metaTitle,
    description: t.sampleReport.metaDesc,
  });
}

export default async function SampleReportPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.sampleReport;
  const p = (href: string) => localePath(locale, href);

  const dims = DIMENSION_STRUCTURE.map((d) => {
    const content = (t.risk.dimensions as Record<
      string,
      { label: string; short: string; description: string } | undefined
    >)[d.key];
    return {
      key: d.key,
      label: content?.label ?? d.key,
      score: SAMPLE_DIM_SCORES[d.key] ?? 0,
    };
  });

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: s.h1,
      description: s.metaDesc,
      url: `${BASE}${p(PATH)}`,
      inLanguage: locale,
      about: { "@type": "Thing", name: "Supplier due diligence report" },
      publisher: { "@id": `${BASE}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
        { "@type": "ListItem", position: 2, name: s.h1, item: `${BASE}${p(PATH)}` },
      ],
    },
  ];

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-[#e2e8f0] last:border-0">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="text-right font-medium text-[#0f172a]">{value}</dd>
    </div>
  );

  return (
    <main className="container py-12 max-w-3xl">
      <JsonLd data={jsonLd} />

      <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
        {s.badge}
      </span>
      <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{s.h1}</h1>
      <p className="text-[#64748b] mt-3 text-lg">{s.lead}</p>

      {/* 演示声明：反伪造铁律，样例必须显著标注 */}
      <div className="mt-6 rounded-md border border-[#d4232a] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#991b1b]">
        {s.sampleBanner}
      </div>

      {/* 报告正文 */}
      <div className="mt-8 rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <div className="border-b border-[#e2e8f0] pb-4">
          <div className="text-xl font-bold text-[#0f172a]">{s.reportTitle}</div>
          <div className="text-xs text-[#64748b] mt-2 space-y-0.5">
            <div>{s.reportRef}</div>
            <div>{s.reportDate}</div>
            <div>{s.preparedFor}</div>
          </div>
        </div>

        {/* 1. Company snapshot */}
        <h2 className="text-lg font-bold text-[#0f172a] mt-6 mb-2">{s.companySection}</h2>
        <dl>
          <Field label={s.companyNameLabel} value={s.companyName} />
          <Field label={s.countryLabel} value={s.companyCountry} />
          <Field label={s.registeredLabel} value={s.companyRegistered} />
          <Field label={s.yearLabel} value={s.companyYear} />
          <Field label={s.employeeLabel} value={s.companyEmployees} />
          <Field label={s.productsLabel} value={s.companyProducts} />
        </dl>

        {/* 2. Risk score */}
        <h2 className="text-lg font-bold text-[#0f172a] mt-6 mb-2">{s.scoreSection}</h2>
        <div className="rounded-lg bg-[#f1f5f9] p-4 flex items-center gap-4">
          <div className="text-4xl font-extrabold text-[#0f4c81]">{s.scoreValue}</div>
          <div>
            <div className="font-semibold text-[#0f172a]">
              {s.scoreLevel} · {s.scoreLabel}
            </div>
            <p className="text-sm text-[#64748b] mt-1">{s.scoreNote}</p>
          </div>
        </div>

        {/* 3. Dimension breakdown */}
        <h2 className="text-lg font-bold text-[#0f172a] mt-6 mb-1">{s.dimensionSection}</h2>
        <p className="text-sm text-[#64748b] mb-3">{s.dimensionNote}</p>
        <div className="space-y-2">
          {dims.map((d) => (
            <div key={d.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#475569]">{d.label}</span>
                <span className="font-semibold text-[#0f172a]">{d.score}</span>
              </div>
              <div className="h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0f4c81]"
                  style={{ width: `${d.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 4. Key findings */}
        <h2 className="text-lg font-bold text-[#0f172a] mt-6 mb-2">{s.findingsSection}</h2>
        <ul className="space-y-2 text-[#475569]">
          {s.findings.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-[#0f4c81]">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* 5. Evidence status */}
        <h2 className="text-lg font-bold text-[#0f172a] mt-6 mb-1">{s.evidenceSection}</h2>
        <p className="text-sm text-[#64748b] mb-3">{s.evidenceIntro}</p>
        <ul className="space-y-1.5 text-sm text-[#475569]">
          {s.evidenceItems.map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>

        {/* 6. Recommendation */}
        <h2 className="text-lg font-bold text-[#0f172a] mt-6 mb-2">{s.recommendSection}</h2>
        <p className="text-[#475569]">{s.recommendBody}</p>
      </div>

      {/* CTA */}
      <section className="mt-10 card p-8 bg-[#f7f9fc]">
        <h2 className="text-xl font-bold text-[#0f172a]">{s.ctaTitle}</h2>
        <p className="text-[#475569] mt-2">{s.ctaLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/services/supplier-verification")} className="btn btn-primary">
            {s.ctaPrimary}
          </Link>
          <Link href={p("/pricing")} className="btn btn-outline">
            {s.ctaSecondary}
          </Link>
        </div>
      </section>

      <p className="mt-6 text-xs text-[#64748b]">{s.disclaimer}</p>
    </main>
  );
}
