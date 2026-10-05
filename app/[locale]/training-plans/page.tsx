import type { Metadata } from "next";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import JsonLd from "@/components/JsonLd";
import WhatsAppLink from "@/components/WhatsAppLink";
import { COMMERCIAL } from "@/lib/commercialConfig";

const PATH = "/training-plans";

// 套餐高亮标记为 UI 状态，不随语言翻译；按索引与字典 plans 数组对应
const HL = [false, true, false];

// 培训套餐标准价（USD）。按索引与字典 plans 对齐；Enterprise 无标准价（字典为 "Custom"）。
// 字典 `price` 只保留 "{price}" 占位符与本地货币符号/位置，数字一律由 COMMERCIAL 注入
// —— 改价只改 lib/commercialConfig.ts 一处（spec §39/§70 单一真源）。
const PLAN_USD: readonly (number | null)[] = [
  COMMERCIAL.training.starterUsd,
  COMMERCIAL.training.proUsd,
  null,
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
  const PLANS = t.trainingPlans.plans;
  const FAQ = t.trainingPlans.faq;

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
              { "@type": "ListItem", position: 1, name: t.common.ui.home, item: "https://factoryauditb2b.com/" },
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
        <h1 className="text-3xl font-bold text-[#171717]">{t.trainingPlans.h1}</h1>
        <p className="text-[#6d6b66] mt-2 max-w-2xl mx-auto">{t.trainingPlans.lead}</p>
      </header>

      <h2 className="text-xl font-semibold text-center mt-10 mb-1">{t.trainingPlans.plansTitle}</h2>
      <p className="text-center text-sm text-[#6d6b66] mb-4">{t.trainingPlans.priceNote}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((p, i) => {
          // 数字来自 COMMERCIAL；无标准价的套餐（Enterprise）字典里不含占位符，原样输出。
          const usd = PLAN_USD[i];
          const priceText = usd == null ? p.price : p.price.replace("{price}", String(usd));
          return (
            <div key={p.name} className={`card p-6 ${HL[i] ? "border-[#171717] ring-2 ring-[#171717]" : ""}`}>
              <div className="font-bold text-lg">{p.name}</div>
              <div className="text-2xl font-extrabold text-[#171717] my-2">
                {priceText}
                {p.period && <span className="text-sm font-normal text-[#6d6b66]">{p.period}</span>}
              </div>
              <ul className="space-y-1 text-sm text-[#3f4650] mb-4">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <a href={lp("/custom-services")} className={`btn ${HL[i] ? "btn-primary" : "btn-outline"} w-full`}>
                {p.cta}
              </a>
            </div>
          );
        })}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-center">{t.trainingPlans.faqTitle}</h2>
        <div className="mt-4 max-w-3xl mx-auto divide-y rounded-lg border">
          {FAQ.map((f) => (
            <div key={f.q} className="p-4">
              <div className="font-medium text-[#171717]">{f.q}</div>
              <p className="text-sm text-[#3f4650] mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-lg bg-[#f5f3ee] p-6 text-center">
        <h2 className="font-semibold text-[#171717]">{t.trainingPlans.ctaTitle}</h2>
        <p className="mt-1 text-sm text-[#3f4650]">{t.trainingPlans.ctaDesc}</p>
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
