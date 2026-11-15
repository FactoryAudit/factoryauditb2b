import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import FaqAccordion from "@/components/FaqAccordion";
import { getAssessmentFaq } from "@/lib/assessmentFaq";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/assessment-faq";
const BASE = "https://factoryauditb2b.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const faq = getAssessmentFaq("supplier", locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: faq.title,
    description: faq.lead,
  });
}

export default async function AssessmentFaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const faq = getAssessmentFaq("supplier", locale);
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
          {locale === "zh" || locale === "zh-TW" ? "供应商门户" : "Supplier Portal"}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2 leading-tight">
          {faq.title}
        </h1>
      </header>

      <div className="mt-8">
        <FaqAccordion faq={faq} />
      </div>

      {/* 买家视角入口：同一份自评，买家关心的是一套不同的问题 */}
      <div className="mt-12 rounded-xl border border-[#ebe8e1] bg-[#fbfaf7] p-6">
        <p className="text-sm text-[#3f4650]">
          {locale === "zh" || locale === "zh-TW"
            ? "你是采购商，想了解怎么读懂供应商自评？"
            : "Buying from a supplier and want to understand how to read their self-assessment?"}
        </p>
        <Link
          href={p("/assessment-faq/buyer")}
          className="muted-link mt-2 inline-block text-sm font-semibold"
        >
          {locale === "zh" || locale === "zh-TW"
            ? "查看买家视角 FAQ →"
            : "View the buyer FAQ →"}
        </Link>
      </div>

      {/* 返回自评入口 */}
      <p className="mt-10 text-sm text-[#6d6b66]">
        <Link
          href={p("/supplier-assessment")}
          className="text-[#171717] underline decoration-[#e07a49] hover:decoration-2"
        >
          {locale === "zh" || locale === "zh-TW"
            ? "返回自评问卷"
            : "Back to self-assessment"}
        </Link>
      </p>
    </main>
  );
}
