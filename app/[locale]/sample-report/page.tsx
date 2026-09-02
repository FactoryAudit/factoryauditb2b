import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import SocialLinks from "@/components/SocialLinks";
import SampleReportForm from "@/components/SampleReportForm";
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

// 样例报告的结构化内容（虚构演示数据）。公司名/法人/编号/金额/日期等
// 为数据而非营销文案，跨语言通用，故放在代码常量；行标签全部走字典。
const SAMPLE = {
  uscc: "91440300MA5EXXX7XX",
  legalRep: "Chen X. 陈某",
  capital: "CNY 8,000,000",
  address: "Building 4, XX Industrial Park, Bao'an District, Shenzhen",
  scope: "生产 · 制造 · 进出口",
  ownership: [
    { name: "Chen X. 陈某", type: "Individual", contribution: "CNY 5,200,000", stake: "65%", since: "2014" },
    { name: "Liu X. 刘某", type: "Individual", contribution: "CNY 2,000,000", stake: "25%", since: "2016" },
    { name: "Apex HK Trading Ltd.", type: "Corporate (HK)", contribution: "CNY 800,000", stake: "10%", since: "2019" },
  ],
  taxRows: [
    { key: "rating", value: "B — 2025 / B — 2024 / B — 2023" },
    { key: "vat", value: "General taxpayer" },
    { key: "customs", value: "4403960XXX" },
    { key: "export", value: "USD 3.1M" },
    { key: "markets", value: "United States · Germany · Australia" },
  ],
  siteChecks: [
    { key: "address", value: "6,200 m² industrial building" },
    { key: "signage", value: "Chinese & English" },
    { key: "video", value: "22 min, unscripted" },
    { key: "machinery", value: "14 injection lines" },
    { key: "workers", value: "~80 on floor" },
  ],
  certs: [
    { name: "ISO 9001:2015 (Quality)", number: "CN-XXXX-Q", issued: "2023-09", status: "valid" },
    { name: "ISO 14001 (Environment)", number: "CN-XXXX-E", issued: "2024-02", status: "valid" },
    { name: "BSCI social audit", number: "—", issued: "2025-04", status: "valid" },
    { name: "CE (product-specific)", number: "—", issued: "2024-11", status: "onfile" },
  ],
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

  const SectionTitle = ({ num, title }: { num: string; title: string }) => (
    <h2 className="mt-8 mb-2 flex items-center gap-2 text-lg font-bold text-[#0f172a]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-xs font-bold text-white">
        {num}
      </span>
      {title}
    </h2>
  );

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 border-b border-[#e2e8f0] py-2 last:border-0">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="text-right font-medium text-[#0f172a]">{value}</dd>
    </div>
  );

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd data={jsonLd} />

      <span className="text-sm font-semibold uppercase tracking-wide text-[#0f4c81]">
        {s.badge}
      </span>
      <h1 className="mt-2 text-4xl font-extrabold text-[#0f172a]">{s.h1}</h1>
      <p className="mt-3 text-lg text-[#64748b]">{s.lead}</p>

      {/* 演示声明：反伪造铁律，样例必须显著标注 */}
      <div className="mt-6 rounded-md border border-[#d4232a] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#991b1b]">
        {s.sampleBanner}
      </div>

      {/* ===== 报告正文 ===== */}
      <div className="mt-8 rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm md:p-8">
        {/* 报告头部 */}
        <div className="border-b border-[#e2e8f0] pb-4">
          <div className="text-xl font-bold text-[#0f172a]">{s.reportTitle}</div>
          <div className="mt-2 space-y-0.5 text-xs text-[#64748b]">
            <div>{s.reportRef}</div>
            <div>{s.reportDate}</div>
            <div>{s.preparedFor}</div>
          </div>
        </div>

        {/* 评分概览 */}
        <div className="mt-6 flex items-center gap-5 rounded-lg bg-[#f1f5f9] p-5">
          <div className="text-5xl font-extrabold text-[#0f4c81]">{s.scoreValue}</div>
          <div>
            <div className="font-semibold text-[#0f172a]">
              {s.scoreLevel} · {s.scoreLabel}
            </div>
            <p className="mt-1 text-sm text-[#64748b]">{s.scoreNote}</p>
          </div>
        </div>

        {/* 01 · 执行摘要 */}
        <SectionTitle num="01" title={s.execSection} />
        <p className="text-sm text-[#475569]">{s.execLead}</p>
        <div className="mt-4 space-y-2">
          {dims.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-[#475569]">{d.label}</span>
                <span className="font-semibold text-[#0f172a]">{d.score}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full bg-[#0f4c81]"
                  style={{ width: `${d.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <h3 className="mt-5 font-semibold text-[#1f7a36]">{s.strengthsTitle}</h3>
        <ul className="mt-2 space-y-2 text-sm text-[#475569]">
          {s.strengths.map((f: string) => (
            <li key={f} className="flex gap-2">
              <span className="text-[#2f9e44]">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 font-semibold text-[#b45309]">{s.concernsTitle}</h3>
        <ul className="mt-2 space-y-2 text-sm text-[#475569]">
          {s.concerns.map((f: string) => (
            <li key={f} className="flex gap-2">
              <span className="text-[#d4232a]">!</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {/* 02 · 公司档案 */}
        <SectionTitle num="02" title={s.companySection} />
        <p className="text-xs text-[#64748b]">{s.profileNote}</p>
        <dl className="mt-3">
          <Field label={s.companyNameLabel} value={s.companyName} />
          <Field label={s.countryLabel} value={s.companyCountry} />
          <Field label={s.usccLabel} value={SAMPLE.uscc} />
          <Field label={s.legalRepLabel} value={SAMPLE.legalRep} />
          <Field label={s.registeredLabel} value={s.companyRegistered} />
          <Field label={s.capitalLabel} value={SAMPLE.capital} />
          <Field label={s.companyTypeLabel} value={s.companyTypeValue} />
          <Field label={s.yearLabel} value={s.companyYear} />
          <Field label={s.employeeLabel} value={s.companyEmployees} />
          <Field label={s.productsLabel} value={s.companyProducts} />
          <Field label={s.addressLabel} value={SAMPLE.address} />
          <Field label={s.scopeLabel} value={SAMPLE.scope} />
        </dl>

        {/* 03 · 股权结构 */}
        <SectionTitle num="03" title={s.ownershipSection} />
        <p className="text-xs text-[#64748b]">{s.ownershipNote}</p>
        <div className="mt-3 overflow-x-auto rounded-md border border-[#e2e8f0]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-3 py-2 font-semibold">{s.shareholderLabel}</th>
                <th className="px-3 py-2 font-semibold">{s.shareholderLabel} (EN)</th>
                <th className="px-3 py-2 font-semibold">{s.capitalLabel}</th>
                <th className="px-3 py-2 font-semibold">{s.stakeLabel}</th>
                <th className="px-3 py-2 font-semibold">{s.sinceLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f7] text-[#475569]">
              {SAMPLE.ownership.map((o) => (
                <tr key={o.name}>
                  <td className="px-3 py-2">{o.name}</td>
                  <td className="px-3 py-2">{o.type}</td>
                  <td className="px-3 py-2">{o.contribution}</td>
                  <td className="px-3 py-2 font-medium text-[#0f172a]">{o.stake}</td>
                  <td className="px-3 py-2">{o.since}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 rounded-md bg-[#f7f9fc] px-3 py-2 text-sm text-[#475569]">
          {s.ownershipAnalyst}
        </p>

        {/* 04 · 涉诉与执行 */}
        <SectionTitle num="04" title={s.courtSection} />
        <p className="text-xs text-[#64748b]">{s.courtNote}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-md bg-[#f8fafc] p-3 text-center">
            <div className="text-2xl font-bold text-[#0f172a]">4</div>
            <div className="mt-1 text-xs text-[#64748b]">{s.caseTotalLabel}</div>
          </div>
          <div className="rounded-md bg-[#f8fafc] p-3 text-center">
            <div className="text-2xl font-bold text-[#b45309]">1</div>
            <div className="mt-1 text-xs text-[#64748b]">{s.caseOpenLabel}</div>
          </div>
          <div className="rounded-md bg-[#f8fafc] p-3 text-center">
            <div className="text-2xl font-bold text-[#0f172a]">3</div>
            <div className="mt-1 text-xs text-[#64748b]">{s.caseDefendantLabel}</div>
          </div>
          <div className="rounded-md bg-[#f8fafc] p-3 text-center">
            <div className="text-2xl font-bold text-[#1f7a36]">0</div>
            <div className="mt-1 text-xs text-[#64748b]">{s.enforcementLabel}</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#475569]">{s.courtSummary}</p>

        {/* 05 · 工商变更 */}
        <SectionTitle num="05" title={s.changesSection} />
        <p className="text-xs text-[#64748b]">{s.changesNote}</p>
        <ol className="mt-4 space-y-4 border-l-2 border-[#e2e8f0] pl-4">
          {s.changes.map((c: { date: string; impact: string; title: string; desc: string }) => (
            <li key={c.title}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[#0f4c81]">{c.date}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.impact === "low"
                      ? "bg-[#e8f5ea] text-[#1f7a36]"
                      : "bg-[#fff4e0] text-[#a86a13]"
                  }`}
                >
                  {c.impact === "low" ? s.impactLow : s.impactMedium}
                </span>
              </div>
              <div className="mt-1 text-sm font-medium text-[#0f172a]">{c.title}</div>
              <div className="text-sm text-[#64748b]">{c.desc}</div>
            </li>
          ))}
        </ol>

        {/* 06 · 税务与进出口 */}
        <SectionTitle num="06" title={s.taxSection} />
        <p className="text-xs text-[#64748b]">{s.taxNote}</p>
        <dl className="mt-3">
          {SAMPLE.taxRows.map((r) => (
            <Field
              key={r.key}
              label={(s.taxLabels as Record<string, string>)[r.key] ?? r.key}
              value={r.value}
            />
          ))}
        </dl>

        {/* 07 · 工厂实地核验 */}
        <SectionTitle num="07" title={s.siteSection} />
        <p className="text-xs text-[#64748b]">{s.siteNote}</p>
        <ul className="mt-3 space-y-2 text-sm text-[#475569]">
          {SAMPLE.siteChecks.map((r) => (
            <li key={r.key} className="flex justify-between gap-4 border-b border-[#eef2f7] py-1.5 last:border-0">
              <span className="text-[#475569]">
                {(s.siteCheckLabels as Record<string, string>)[r.key] ?? r.key}
              </span>
              <span className="text-right font-medium text-[#0f172a]">{r.value}</span>
            </li>
          ))}
        </ul>

        {/* 08 · 认证与知识产权 */}
        <SectionTitle num="08" title={s.certSection} />
        <p className="text-xs text-[#64748b]">{s.certNote}</p>
        <div className="mt-3 overflow-x-auto rounded-md border border-[#e2e8f0]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-3 py-2 font-semibold">
                  {(s.certLabels as Record<string, string>).certification}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {(s.certLabels as Record<string, string>).number}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {(s.certLabels as Record<string, string>).issued}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {(s.certLabels as Record<string, string>).status}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef2f7] text-[#475569]">
              {SAMPLE.certs.map((c) => (
                <tr key={c.name}>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.number}</td>
                  <td className="px-3 py-2">{c.issued}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.status === "valid"
                          ? "bg-[#e8f5ea] text-[#1f7a36]"
                          : "bg-[#eef2f7] text-[#5b6b7e]"
                      }`}
                    >
                      {c.status === "valid" ? s.certStatusValid : s.certStatusOnfile}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-[#475569]">{s.ipNote}</p>

        {/* 09 · 分析师建议 */}
        <SectionTitle num="09" title={s.recommendSection} />
        <blockquote className="mt-2 rounded-md border-l-4 border-[#0f4c81] bg-[#f7f9fc] px-4 py-3 text-[#0f172a]">
          {s.analystQuote}
        </blockquote>
        <h3 className="mt-4 font-semibold text-[#0f172a]">{s.actionsTitle}</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[#475569]">
          {s.recommendActions.map((a: string) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
        <p className="mt-4 text-right text-xs text-[#64748b]">
          CX · {s.analystRole}
        </p>
      </div>

      {/* ===== 表单（获取完整样例报告）===== */}
      <section id="sample-form" className="mt-10 card bg-[#f7f9fc] p-6 md:p-8">
        <h2 className="text-xl font-bold text-[#0f172a]">{s.formTitle}</h2>
        <p className="mt-1 text-sm text-[#475569]">{s.formLead}</p>
        <div className="mt-4">
          <SampleReportForm
            emailPlaceholder={s.formEmailPlaceholder}
            cta={s.formCta}
            privacyNote={s.formPrivacyNote}
            success={s.formSuccess}
            error={s.formError}
          />
        </div>
      </section>

      {/* ===== 社媒入口（表单下方；未配置真实链接的平台不渲染）===== */}
      <section className="mt-8 flex flex-col items-center text-center md:flex-row md:justify-between md:text-left">
        <div>
          <h2 className="font-semibold text-[#0f172a]">{s.socialTitle}</h2>
          <p className="mt-1 text-sm text-[#64748b]">{s.socialNote}</p>
        </div>
        <SocialLinks className="mt-4 md:mt-0" />
      </section>

      {/* CTA */}
      <section className="mt-10 card p-8">
        <h2 className="text-xl font-bold text-[#0f172a]">{s.ctaTitle}</h2>
        <p className="mt-2 text-[#475569]">{s.ctaLead}</p>
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
