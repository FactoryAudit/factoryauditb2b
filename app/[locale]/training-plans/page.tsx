import type { Metadata } from "next";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import JsonLd from "@/components/JsonLd";
import WhatsAppLink from "@/components/WhatsAppLink";

const PATH = "/training-plans";

// 付费培训方案（落地页 CTA 的统一目标）
// 套餐明细为产品文案，暂以英文呈现（v1），后续可按语言本地化。
const PLANS = [
  {
    name: "Starter Training",
    price: "$280",
    period: "/ factory",
    features: [
      "1-day on-site quality basics",
      "QC checklist & SOP template",
      "Pre-training gap audit",
      "Certificate of completion",
    ],
    cta: "Start",
    hl: false,
  },
  {
    name: "Pro Training",
    price: "$950",
    period: "/ factory",
    features: [
      "3-day quality system + QC",
      "Production process training",
      "Management review workshop",
      "Post-training audit & report",
      "Quarterly refresher",
    ],
    cta: "Choose Pro",
    hl: true,
  },
  {
    name: "Enterprise Training",
    price: "Custom",
    period: "",
    features: [
      "Multi-site rollout",
      "Compliance & safety modules",
      "Train-the-trainer program",
      "Dedicated account manager",
      "API & reporting",
    ],
    cta: "Contact us",
    hl: false,
  },
];

const FAQ = [
  {
    q: "Who delivers the training?",
    a: "Our auditors and QC engineers deliver training on-site or online, in the factory's working language where possible.",
  },
  {
    q: "Does training include an audit?",
    a: "Every plan starts with a gap audit so the training targets the factory's real weaknesses, not generic slides.",
  },
  {
    q: "Can training be tailored to my industry?",
    a: "Yes. We scope the modules (quality, QC, production process, compliance) to your product and target market.",
  },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.trainingPlans.pageTitle,
    description: t.trainingPlans.metaDesc,
  });
}

export default async function TrainingPlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const lp = (href: string) => localePath(locale, href);

  return (
    <div className="container py-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: t.trainingPlans.h1,
            description: t.trainingPlans.lead,
            serviceType: "Supplier Training",
            provider: { "@type": "Organization", name: "FactoryAuditB2B", url: "https://factoryauditb2b.com" },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://factoryauditb2b.com/" },
              { "@type": "ListItem", position: 2, name: t.trainingPlans.h1, item: "https://factoryauditb2b.com/training-plans" },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]}
      />

      <header className="text-center">
        <h1 className="text-3xl font-bold text-[#0f172a]">{t.trainingPlans.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-2xl mx-auto">{t.trainingPlans.lead}</p>
      </header>

      <h2 className="text-xl font-semibold text-center mt-10 mb-1">{t.trainingPlans.plansTitle}</h2>
      <p className="text-center text-sm text-[#64748b] mb-4">All prices in USD, per factory.</p>
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((p) => (
          <div key={p.name} className={`card p-6 ${p.hl ? "border-[#0f4c81] ring-2 ring-[#0f4c81]" : ""}`}>
            <div className="font-bold text-lg">{p.name}</div>
            <div className="text-2xl font-extrabold text-[#0f4c81] my-2">
              {p.price}
              {p.period && <span className="text-sm font-normal text-[#64748b]">{p.period}</span>}
            </div>
            <ul className="space-y-1 text-sm text-[#475569] mb-4">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <a href={lp("/custom-services")} className={`btn ${p.hl ? "btn-primary" : "btn-outline"} w-full`}>
              {p.cta}
            </a>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-center">{t.trainingPlans.faqTitle}</h2>
        <div className="mt-4 max-w-3xl mx-auto divide-y rounded-lg border">
          {FAQ.map((f) => (
            <div key={f.q} className="p-4">
              <div className="font-medium text-[#0f172a]">{f.q}</div>
              <p className="text-sm text-[#475569] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-lg bg-[#f1f5f9] p-6 text-center">
        <h2 className="font-semibold text-[#0f172a]">{t.trainingPlans.ctaTitle}</h2>
        <p className="mt-1 text-sm text-[#475569]">{t.trainingPlans.ctaDesc}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <a href={lp("/custom-services")} className="btn btn-primary inline-block">
            {t.trainingPlans.ctaButton}
          </a>
          <WhatsAppLink
            label={t.common.whatsappChat}
            message="Hi FactoryAuditB2B, I would like to ask about supplier training plans."
            className="btn btn-outline inline-block"
          />
        </div>
      </section>
    </div>
  );
}
