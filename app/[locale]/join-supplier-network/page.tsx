import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import SupplierRegistrationForm from "@/components/SupplierRegistrationForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { canonicalFor } from "@/i18n/hreflang";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/join-supplier-network";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.supplierNetwork.metaTitle,
    description: t.supplierNetwork.metaDesc,
  });
}

export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.supplierNetwork;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: s.h1,
      serviceType: "Supplier network registration and verification",
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
    <main className="container py-10" data-track-page="supplier_network">
      <JsonLd data={jsonLd} />

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center mb-12">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">{s.badge}</span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2">{s.h1}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{s.lead}</p>
      </section>

      {/* Benefits */}
      <section className="max-w-4xl mx-auto mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-5 text-center">{s.benefitsTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {s.benefits.map((b) => (
            <div key={b} className="card p-4 flex items-start gap-3">
              <span className="text-[#171717] font-bold mt-0.5">✓</span>
              <p className="text-sm text-[#2b2b2b]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* No guarantee（反伪造铁律：明确不承诺） */}
      <section className="max-w-3xl mx-auto mb-12">
        <div className="card p-6 border-l-4 border-l-[#d4232a] bg-[#fff7f7]">
          <h2 className="text-lg font-bold text-[#171717] mb-2">{s.noGuaranteeTitle}</h2>
          <p className="text-sm text-[#3f4650]">{s.noGuarantee}</p>
          <p className="text-sm text-[#d4232a] font-medium mt-3">{s.certStatement}</p>
        </div>
      </section>

      {/* How joining works */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-5 text-center">{s.howTitle}</h2>
        <ol className="space-y-3">
          {s.howSteps.map((step, i) => (
            <li key={step} className="card p-4 flex items-start gap-3">
              <span className="h-7 w-7 rounded-full bg-[#171717] text-white text-sm flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-[#2b2b2b]">{step}</p>
            </li>
          ))}
        </ol>

        {/* 🔴 2026-10-28：给「档案已存在」的供应商一条岔路。
            实测案例：厦门一家企业在 9-19 / 9-21 / 9-22 连续三次提交入驻申请，全部无人处理；
            它的档案其实早已在目录里且已发布 —— 它需要的是「认领」，而这四步流程从头到尾
            只讲「提交申请」，没有一个字说明这件事。它试了一个半月，最后因认领表单报错才改用邮件找来。
            这条岔路必须出现在流程说明里，否则每个已入库的供应商都会白走一次。 */}
        <p className="mt-4 text-sm text-[#8a5410] bg-[#fff4e0] rounded-md px-4 py-3">
          {locale === "zh" || locale === "zh-TW" ? (
            <>
              ⚠️ 您的公司可能已经在本目录中。如果能在{" "}
              <a href={p("/suppliers")} className="underline font-medium">
                供应商目录
              </a>{" "}
              里搜到自己的档案，请不要重复提交申请，直接认领现有档案即可 ——
              认领后可以自行维护证书、照片和自评信息。
            </>
          ) : (
            <>
              ⚠️ Your company may already be listed. If you can find your profile in the{" "}
              <a href={p("/suppliers")} className="underline font-medium">
                supplier directory
              </a>
              , do not submit a new application — claim the existing profile instead, then maintain
              its certificates, photos and self-assessment yourself.
            </>
          )}
        </p>
      </section>

      {/* Status + Evidence */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[#171717] mb-2">{s.statusTitle}</h2>
          <p className="text-sm text-[#6d6b66] mb-4">{s.statusLead}</p>
          <ul className="space-y-2">
            {s.statuses.map((st) => (
              <li key={st} className="flex items-center gap-2 text-sm text-[#2b2b2b]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#171717]" />
                {st}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[#171717] mb-2">{s.evidenceTitle}</h2>
          <p className="text-sm text-[#6d6b66] mb-4">{s.evidenceLead}</p>
          <ul className="space-y-2">
            {s.evidenceLevels.map((el) => (
              <li key={el} className="flex items-center gap-2 text-sm text-[#2b2b2b]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#171717]" />
                {el}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-2 text-center">{s.formTitle}</h2>
        <p className="text-[#6d6b66] text-sm mb-6 text-center">{s.formLead}</p>
        <SupplierRegistrationForm t={s.form} success={s.success} error={s.error} />
      </section>

      {/* Review process */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-5 text-center">{s.processTitle}</h2>
        <ol className="space-y-3">
          {s.processSteps.map((step, i) => (
            <li key={step} className="card p-4 flex items-start gap-3">
              <span className="h-7 w-7 rounded-full bg-[#d4232a] text-white text-sm flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-[#2b2b2b]">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Risk bands */}
      <section className="max-w-3xl mx-auto mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-2 text-center">{s.riskTitle}</h2>
        <p className="text-[#6d6b66] text-sm mb-5 text-center">{s.riskLead}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {s.riskBands.map((band) => (
            <div key={band} className="card p-4 text-sm text-[#2b2b2b]">
              {band}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#8c8982] mt-3 text-center">{s.riskDisclaimer}</p>
      </section>

      {/* Documents */}
      <section className="max-w-4xl mx-auto mb-12">
        <h2 className="text-2xl font-bold text-[#171717] mb-2 text-center">{s.docsTitle}</h2>
        <p className="text-[#6d6b66] text-sm mb-2 text-center">{s.docsLead}</p>
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {s.docs.map((doc) => (
            <span key={doc} className="rounded-full border border-[#ebe8e1] bg-white px-3 py-1.5 text-xs text-[#3f4650]">
              {doc}
            </span>
          ))}
        </div>
        <p className="text-xs text-[#8c8982] text-center">{s.docsNote}</p>
      </section>

      {/* Contact CTA */}
      <section className="card p-8 text-center bg-[#fbfaf7] max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-[#171717]">{s.contactTitle}</h2>
        <p className="text-[#6d6b66] mt-2 max-w-2xl mx-auto">{s.contactLead}</p>
        <a
          href={p("/custom-services")}
          className="btn btn-primary mt-5 inline-block"
        >
          {s.contactCta}
        </a>
      </section>
    </main>
  );
}
