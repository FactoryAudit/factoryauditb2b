import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import FaqAccordion from "@/components/FaqAccordion";
import { getAssessmentFaq } from "@/lib/assessmentFaq";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/assessment-faq/buyer";
const BASE = "https://factoryauditb2b.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const faq = getAssessmentFaq("buyer", locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: faq.title,
    description: faq.lead,
  });
}

export default async function BuyerAssessmentFaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const faq = getAssessmentFaq("buyer", locale);
  const p = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.groups.flatMap((g) =>
      g.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }))
    ),
  };

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd data={jsonLd} />

      <header>
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {locale === "zh" || locale === "zh-TW" ? "买家指南" : "Buyer Guide"}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2 leading-tight">
          {faq.title}
        </h1>
      </header>

      <div className="mt-8">
        <FaqAccordion faq={faq} />
      </div>

      {/* 供应商视角入口 */}
      <div className="mt-12 rounded-xl border border-[#ebe8e1] bg-[#fbfaf7] p-6">
        <p className="text-sm text-[#3f4650]">
          {locale === "zh" || locale === "zh-TW"
            ? "你是供应商，想了解怎么填写自评？"
            : "Are you a supplier and want help completing the self-assessment?"}
        </p>
        <Link
          href={p("/assessment-faq")}
          className="muted-link mt-2 inline-block text-sm font-semibold"
        >
          {locale === "zh" || locale === "zh-TW"
            ? "查看供应商 FAQ →"
            : "View the supplier FAQ →"}
        </Link>
      </div>

      {/* 返回供应商目录，买家可直接去筛选供应商 */}
      <p className="mt-10 text-sm text-[#6d6b66]">
        <Link
          href={p("/suppliers")}
          className="text-[#171717] underline decoration-[#e07a49] hover:decoration-2"
        >
          {locale === "zh" || locale === "zh-TW"
            ? "浏览已验证供应商"
            : "Browse verified suppliers"}
        </Link>
      </p>
    </main>
  );
}
