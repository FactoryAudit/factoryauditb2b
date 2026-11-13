import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import RfqForm from "@/components/RfqForm";
import RfqRespondForm from "@/components/RfqRespondForm";
import RfqEnterTracker from "@/components/RfqEnterTracker";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { canonicalFor } from "@/i18n/hreflang";
import { buildPageMetadata } from "@/lib/pageMeta";
import { getPublicRfqForResponse } from "@/lib/queries";

const PATH = "/rfq";
type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.rfq.metaTitle,
    description: t.rfq.metaDesc,
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.rfq;
  const p = (href: string) => localePath(locale, href);

  // ---- 供应商报价模式：/rfq?request=RFQ-XXXX ----
  //
  // 2026-11-13 前这是死链：/suppliers 的需求卡链过来，`request` 参数只有埋点在读，
  // 供应商看到的是一张空白采购单。现在按编号取**买家已授权公开**的那一条，
  // 渲染报价表单；取不到（不存在 / 未公开 / 已关闭）就退回普通买家表单。
  const sp = await searchParams;
  const rawRequest = Array.isArray(sp?.request) ? sp.request[0] : sp?.request;
  const respondTarget = rawRequest
    ? await getPublicRfqForResponse(String(rawRequest))
    : null;

  if (respondTarget) {
    return (
      <main className="container py-10" data-track-page="rfq-respond">
        <section className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold text-[#171717] mb-6">
            {s.form.respond.to.replace("{ref}", respondTarget.referenceId)}
          </h1>
          <RfqRespondForm
            t={{
              labels: s.form.labels,
              offer: s.form.offer,
              respond: s.form.respond,
              error: s.form.error,
              errorRequired: s.form.errorRequired,
            }}
            target={respondTarget}
          />
        </section>
      </main>
    );
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.h1,
      serviceType: "Request for quotation and supplier matching",
      provider: { "@type": "Organization", name: "FactoryAuditB2B", url: "https://factoryauditb2b.com" },
      areaServed: "Worldwide",
      description: s.metaDesc,
      url: canonicalFor(locale, PATH),
      inLanguage: locale,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.common.ui.home, item: `https://factoryauditb2b.com${p("/")}` },
        { "@type": "ListItem", position: 2, name: s.h1, item: canonicalFor(locale, PATH) },
      ],
    },
  ];

  return (
    <main className="container py-10" data-track-page="rfq">
      {/* P2（STEP 08）：进入 /rfq 时发一次独立业务事件 rfq_enter */}
      <RfqEnterTracker locale={locale} />
      <JsonLd data={jsonLd} />
      <section className="max-w-3xl mx-auto text-center mb-10">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">{s.badge}</span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{s.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{s.lead}</p>
      </section>
      <section className="max-w-3xl mx-auto">
        {/* CS-02C G3：带上提交语言落 rfqs.locale；行业上下文由 CS-02A 的
            /industry/* CTA 通过 ?src= 与页面注入补齐 */}
        <RfqForm t={s.form} context={{ locale }} />
      </section>
    </main>
  );
}
