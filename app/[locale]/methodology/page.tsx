import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { DIMENSION_STRUCTURE, TOTAL_WEIGHT, TOTAL_QUESTIONS } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/methodology";
const BASE = "https://factoryauditb2b.com";
/** 模型版本：DIMENSION_STRUCTURE 或评分逻辑发生实质变更时手动 +1，并在此记录 */
const MODEL_VERSION = "1.0";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.methodology.metaTitle,
    description: t.methodology.metaDesc,
  });
}

export default async function MethodologyPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const m = t.methodology;
  const p = (href: string) => localePath(locale, href);

  // 维度权重直接从评分模型读取，不手工抄一份，避免文档与代码脱节
  const dims = DIMENSION_STRUCTURE.map((d) => {
    const content = (t.risk.dimensions as Record<
      string,
      { label: string; short: string; description: string } | undefined
    >)[d.key];
    return {
      key: d.key,
      weight: d.weight,
      questions: d.questions.length,
      label: content?.label ?? d.key,
      description: content?.description ?? "",
    };
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: m.h1,
    description: m.metaDesc,
    url: `${BASE}${p(PATH)}`,
    inLanguage: locale,
    about: { "@type": "Thing", name: "Supplier risk assessment" },
    publisher: { "@id": `${BASE}/#organization` },
  };

  return (
    <main className="container py-12 max-w-3xl">
      <JsonLd data={jsonLd} />

      <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
        {m.badge}
      </span>
      <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{m.h1}</h1>
      <p className="text-[#64748b] mt-3 text-lg">{m.lead}</p>

      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-bold text-[#0f172a]">Quick answer</h2>
        <p className="text-[#475569] mt-2">{m.quickAnswer}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.frameworkTitle}</h2>
        <p className="text-[#475569] mt-2">{m.frameworkBody}</p>
        <p className="text-sm text-[#64748b] mt-2">
          {TOTAL_QUESTIONS} scored inputs · {DIMENSION_STRUCTURE.length} dimensions · total
          weight {TOTAL_WEIGHT}.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.weightsTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-4">{m.weightsLead}</p>
        <table className="w-full text-sm border border-[#e2e8f0] rounded-lg overflow-hidden">
          <thead className="bg-[#f1f5f9] text-left">
            <tr>
              <th className="px-4 py-2 font-semibold text-[#0f172a]">{m.dimensionTitle}</th>
              <th className="px-4 py-2 font-semibold text-[#0f172a]">{m.weightTitle}</th>
              <th className="px-4 py-2 font-semibold text-[#0f172a]">{t.methodology.scoredInputsLabel}</th>
            </tr>
          </thead>
          <tbody>
            {dims.map((d) => (
              <tr key={d.key} className="border-t border-[#e2e8f0] align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-[#0f172a]">{d.label}</div>
                  <div className="text-xs text-[#64748b] mt-1">{d.description}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-[#0f4c81]">{d.weight}</td>
                <td className="px-4 py-3 text-[#475569]">{d.questions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.evidenceTitle}</h2>
        <p className="text-[#475569] mt-2">{m.evidenceBody}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.aiTitle}</h2>
        <p className="text-[#475569] mt-2">{m.aiBody}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.limitationsTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-3">{m.limitationsLead}</p>
        <ul className="space-y-2 text-[#475569]">
          {m.limitations.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{m.updateTitle}</h2>
        <p className="text-[#475569] mt-2">{m.updateBody}</p>
        <h3 className="font-semibold text-[#0f172a] mt-4">{m.changelogTitle}</h3>
        <ul className="mt-2 text-sm text-[#475569] space-y-1">
          <li>
            {m.versionTitle} {MODEL_VERSION} {t.methodology.weightsSumLine.replace("{n}", String(TOTAL_QUESTIONS)).replace("{w}", String(TOTAL_WEIGHT))}
            summing to {TOTAL_WEIGHT}.
          </li>
        </ul>
      </section>

      <section className="mt-10 card p-8 bg-[#f7f9fc]">
        <h2 className="text-xl font-bold text-[#0f172a]">{m.ctaTitle}</h2>
        <p className="text-[#475569] mt-2">{m.ctaLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/services/supplier-verification")} className="btn btn-primary">
            {m.ctaPrimary}
          </Link>
          <Link href={p("/tools/supplier-risk-calculator")} className="btn btn-outline">
            {m.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
