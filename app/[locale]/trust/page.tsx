import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import WhatsAppLink, { whatsappConfigured } from "@/components/WhatsAppLink";
import WatermarkedDocument from "@/components/WatermarkedDocument";
import { getTrustConfig, watermarkInfo } from "@/lib/trust";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/trust";
const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.trust.metaTitle,
    description: t.trust.metaDesc,
  });
}

export default async function TrustPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const tr = t.trust;
  const v = t.verification;
  const p = (href: string) => localePath(locale, href);

  const cfg = getTrustConfig();
  // 水印日期用「Verified:」而不是「Last verified:」，与水印用途（验证凭证）一致
  const wm = watermarkInfo(cfg, t.evidence.verified);

  const Section = ({
    num,
    title,
    lead,
    children,
  }: {
    num: string;
    title: string;
    lead?: string;
    children: React.ReactNode;
  }) => (
    <section className="mt-12">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-extrabold text-[#0f4c81]">{num}</span>
        <h2 className="text-2xl font-bold text-[#0f172a]">{title}</h2>
      </div>
      {lead && <p className="text-[#64748b] mt-2 max-w-3xl">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );

  const Field = ({
    label,
    value,
    masked,
  }: {
    label: string;
    value: string;
    masked?: boolean;
  }) =>
    value ? (
      <div className="flex justify-between gap-4 py-2 border-b border-[#e2e8f0] last:border-0">
        <dt className="text-[#64748b]">{label}</dt>
        <dd className="text-right font-medium text-[#0f172a]">
          {value}
          {masked && (
            <span className="block text-xs font-normal text-[#64748b]">
              {tr.maskedNote}
            </span>
          )}
        </dd>
      </div>
    ) : null;

  // AI Search 最需要的一段：明确「品牌 / 法律主体 / 做什么 / 服务哪些国家」
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: "FactoryAuditB2B",
    alternateName: cfg.configured ? cfg.legalEntity : undefined,
    legalName: cfg.configured ? cfg.legalEntity : undefined,
    url: BASE,
    description: tr.scopeBody,
    email: cfg.contactEmail || undefined,
    address: cfg.configured
      ? {
          "@type": "PostalAddress",
          addressLocality: cfg.city || undefined,
          addressCountry: cfg.country,
        }
      : undefined,
    areaServed: ["China", "Vietnam", "Thailand"],
    knowsAbout: tr.verify,
  };

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd
        data={[
          organizationJsonLd,
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
              { "@type": "ListItem", position: 2, name: tr.h1, item: `${BASE}${p(PATH)}` },
            ],
          },
        ]}
      />

      <header>
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {tr.badge}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2">{tr.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{tr.lead}</p>
      </header>

      {/* 01 — Business Registration */}
      <Section num="01" title={tr.regTitle} lead={tr.regLead}>
        {cfg.configured ? (
          <div className="card p-6">
            <dl>
              <Field label={tr.brandLabel} value={tr.brandValue} />
              <Field label={tr.legalEntityLabel} value={cfg.legalEntity} />
              <Field label={tr.countryLabel} value={cfg.country} />
              <Field label={tr.cityLabel} value={cfg.city} />
              <Field label={tr.registrationYearLabel} value={cfg.registrationYear} />
              <Field label={tr.statusLabel} value={cfg.registrationStatus} />
              <Field label={tr.authorityLabel} value={cfg.registrationAuthority} />
              <Field label={tr.verificationDateLabel} value={cfg.verificationDate} />
              <Field label={tr.legalRepLabel} value={cfg.legalRepresentative} masked />
              <Field label={tr.registrationNumberLabel} value={cfg.registrationNumber} masked />
              <Field label={tr.addressLabel} value={cfg.registeredAddress} masked />
            </dl>

            {cfg.licenseImage && (
              <details className="mt-5">
                <summary className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-[#0f4c81] px-4 py-2 text-sm font-medium text-[#0f4c81] hover:bg-[#e6eef6]">
                  {tr.viewDocument}
                </summary>
                <div className="mt-4">
                  <WatermarkedDocument
                    src={cfg.licenseImage}
                    alt={`${cfg.legalEntity} business registration`}
                    watermark={wm}
                  />
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#cbd5e1] p-6">
            <div className="font-semibold text-[#0f172a]">{tr.notConfigured}</div>
            <p className="text-sm text-[#475569] mt-1">{tr.notConfiguredLead}</p>
            <Link href={p("/custom-services")} className="btn btn-outline mt-4 inline-block">
              {t.home.bottomCta}
            </Link>
          </div>
        )}
      </Section>

      {/* 02 — Who Operates */}
      <Section num="02" title={tr.operatesTitle} lead={tr.operatesLead}>
        <div className="card p-6 space-y-3">
          <p className="text-[#475569]">
            {cfg.configured
              ? tr.operatesBody.replace("{entity}", cfg.legalEntity)
              : tr.operatesNotConfigured}
          </p>
          <div>
            <div className="text-xs uppercase tracking-wide text-[#64748b]">
              {tr.scopeTitle}
            </div>
            <p className="text-[#475569] mt-1">{tr.scopeBody}</p>
          </div>
        </div>
      </Section>

      {/* 03 — What We Verify */}
      <Section num="03" title={tr.verifyTitle} lead={tr.verifyLead}>
        <ul className="grid md:grid-cols-2 gap-2">
          {tr.verify.map((x) => (
            <li key={x} className="card p-3 text-[#475569]">
              ✓ {x}
            </li>
          ))}
        </ul>
      </Section>

      {/* 04 — What We Do Not Verify */}
      <Section num="04" title={tr.notVerifyTitle} lead={tr.notVerifyLead}>
        <ul className="space-y-2">
          {tr.notVerify.map((x) => (
            <li key={x} className="text-[#475569]">
              ✕ {x}
            </li>
          ))}
        </ul>
      </Section>

      {/* 05 — Methodology */}
      <Section num="05" title={tr.methodTitle} lead={tr.methodLead}>
        <p className="text-[#475569]">
          <Link href={p("/methodology")} className="text-[#0f4c81] underline">
            {tr.methodLink}
          </Link>
        </p>
      </Section>

      {/* 06 — Verification Levels */}
      <Section num="06" title={tr.levelsTitle} lead={tr.levelsLead}>
        <ol className="space-y-2">
          {v.levels.map((label, i) => (
            <li key={label} className="card p-4">
              <div className="font-semibold text-[#0f172a]">
                Level {i} — {v.levelsShort[i]}
              </div>
              <p className="text-sm text-[#475569] mt-1">{tr.levelDescs[i]}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 07 — Evidence Policy */}
      <Section num="07" title={tr.evidenceTitle} lead={tr.evidenceLead}>
        <ul className="space-y-2">
          {tr.evidence.map((x) => (
            <li key={x} className="text-[#475569]">
              · {x}
            </li>
          ))}
        </ul>
      </Section>

      {/* 08 — Privacy */}
      <Section num="08" title={tr.privacyTitle} lead={tr.privacyLead}>
        <ul className="space-y-2">
          {tr.privacy.map((x) => (
            <li key={x} className="text-[#475569]">
              · {x}
            </li>
          ))}
        </ul>
      </Section>

      {/* 09 — Contact */}
      <Section num="09" title={tr.contactTitle} lead={tr.contactLead}>
        <div className="card p-6 space-y-2 text-[#475569]">
          {cfg.contactEmail && (
            <div>
              <span className="text-[#64748b]">{tr.contactEmailLabel}: </span>
              <a href={`mailto:${cfg.contactEmail}`} className="text-[#0f4c81] underline">
                {cfg.contactEmail}
              </a>
            </div>
          )}
          <div>
            <Link href={p("/custom-services")} className="text-[#0f4c81] underline">
              {t.servicesIndex.badge} → {t.home.bottomLead}
            </Link>
          </div>
          {whatsappConfigured() && (
            <WhatsAppLink
              label={t.common.whatsappChat}
              message="Hi FactoryAuditB2B, I have a question about your verification service."
              className="inline-block rounded bg-[#25D366] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
            />
          )}
        </div>
      </Section>

      {/* Why trust us */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold text-[#0f172a]">{tr.whyTitle}</h2>
        <p className="text-[#64748b] mt-1 mb-5">{tr.whyLead}</p>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            [tr.why1Title, tr.why1Body],
            [tr.why2Title, tr.why2Body],
            [tr.why3Title, tr.why3Body],
            [tr.why4Title, tr.why4Body],
          ].map(([title, body]) => (
            <div key={title} className="card p-5">
              <h3 className="font-bold text-[#0f4c81]">{title}</h3>
              <p className="text-sm text-[#475569] mt-2">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[#64748b]">{tr.aiNote}</p>
      </section>
    </main>
  );
}
