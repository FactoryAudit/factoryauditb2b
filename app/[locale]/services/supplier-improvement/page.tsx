import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/services/supplier-improvement";
const BASE = "https://factoryauditb2b.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = t.trainingPage;
  return buildPageMetadata({
    locale,
    path: PATH,
    title: p.metaTitle,
    description: p.metaDesc,
  });
}

// 供应商培训降级为「验厂后续环节」（PRD §37）：
// 定位是 Audit findings → Corrective Action → Supplier Training → Re-audit，
// 不是一家独立的培训公司。原 /knowledge 已 重定向到本页。
export default async function SupplierImprovementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = t.trainingPage;
  const lp = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: p.h1,
    serviceType: "Supplier improvement and training",
    description: p.metaDesc,
    provider: { "@id": `${BASE}#organization` },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      url: `${BASE}/rfq`,
    },
    url: `${BASE}${lp(PATH)}`,
  };

  return (
    <div className="container py-12">
      <JsonLd data={jsonLd} />

      <section className="max-w-3xl mb-12">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {p.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{p.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{p.lead}</p>
        <p className="text-sm text-[#6d6b66] mt-2">
          {t.servicesIndex.items.improvement.desc}
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        <div className="card p-6 border-l-4 border-l-[#171717]">
          <div className="font-semibold text-[#171717] mb-2">{p.pillarAuditTitle}</div>
          <p className="text-sm text-[#3f4650]">{p.pillarAuditDesc}</p>
        </div>
        <div className="card p-6 border-l-4 border-l-[#d4232a]">
          <div className="font-semibold text-[#d4232a] mb-2">{p.pillarTrainTitle}</div>
          <p className="text-sm text-[#3f4650]">{p.pillarTrainDesc}</p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-1">{p.offeringsTitle}</h2>
        <p className="text-[#6d6b66] mb-5">{p.offeringsLead}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {p.offerings.map((o) => (
            <div key={o.title} className="card p-5">
              <div className="font-semibold text-[#171717]">{o.title}</div>
              <p className="text-sm text-[#3f4650] mt-2">{o.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-1">{t.claim.whyTitle}</h2>
        <p className="text-[#6d6b66] mb-5">{t.claim.whyLead}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {t.claim.benefits.map((b) => (
            <div key={b} className="card p-4">
              ✓ {b}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-8 bg-[#171717] text-white">
        <h2 className="text-2xl font-bold">{p.ctaTitle}</h2>
        <p className="mt-2 text-white/80">{p.ctaDesc}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={lp("/custom-services")} className="btn btn-accent">
            {p.ctaButton}
          </Link>
          <Link
            href={lp("/training-plans")}
            className="btn btn-outline-dark"
          >
            {t.footer.trainingPlans}
          </Link>
        </div>
      </section>
    </div>
  );
}
