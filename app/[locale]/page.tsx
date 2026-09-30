import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { canonicalFor } from "@/i18n/hreflang";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy, pickZhPair } from "@/lib/tw";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: "/",
    title: t.home.metaTitle,
    description: t.home.metaDesc,
  });
}

export default async function Home({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);

  const capabilities = [
    t.home.capVerification,
    t.home.capAudit,
    t.home.capInspection,
    t.home.capSourcing,
  ];

  const workflowChecks = [
    t.home.wfCheck1,
    t.home.wfCheck2,
    t.home.wfCheck3,
    t.home.wfCheck4,
  ];

  const values = [
    [t.home.why1Title, t.home.why1Body],
    [t.home.why2Title, t.home.why2Body],
    [t.home.why3Title, t.home.why3Body],
    [t.home.why4Title, t.home.why4Body],
  ];

  const sampleFields = [
    { label: t.home.sample.fieldLocation, value: t.home.sample.valLocation },
    { label: t.home.sample.fieldIndustry, value: t.home.sample.valIndustry },
    { label: t.home.sample.fieldCert, value: t.home.sample.valCert },
    { label: t.home.sample.fieldCapacity, value: t.home.sample.valCapacity },
    { label: t.home.sample.fieldAuditType, value: t.home.sample.valAuditType },
    { label: t.home.sample.fieldAuditDate, value: t.home.sample.valAuditDate },
  ];

  const sampleSteps = [
    t.home.sample.stepRequested,
    t.home.sample.stepScheduled,
    t.home.sample.stepOnsite,
    t.home.sample.stepReport,
  ];

  return (
    <>
      {/* 1. HERO —— 标题 + 副标题 + 两个 CTA + 右侧工厂图 + VERIFIED 浮层 */}
      <section className="container py-16 md:py-20 grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-5">
            {t.home.badge}
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#111111] leading-tight">
            {t.home.h1}
          </h1>
          <p className="mt-4 text-lg text-[#111111] font-medium max-w-xl">{t.home.lead}</p>
          <p className="mt-2 text-[#6b7280] max-w-xl">{t.home.sub}</p>
          <div className="mt-7 flex gap-3 flex-wrap">
            <Link
              href={p("/suppliers")}
              data-track={ANALYTICS_EVENTS.homeFindSuppliersClick}
              className="btn btn-primary"
            >
              {t.home.ctaPrimary}
            </Link>
            <Link href={p("/verify-supplier")} className="btn btn-accent">
              {t.home.ctaSecondary}
            </Link>
          </div>
        </div>

        <div className="relative hero-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/static/images/hero-factory.webp"
            alt={t.home.h1}
            width={1200}
            height={1296}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute left-5 bottom-5 bg-white px-4 py-3 rounded-md shadow-md flex items-center gap-2.5 text-[13px] font-semibold text-[#111111]">
            <span className="bg-[#eafaf1] text-[#0a7a44] text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide">
              VERIFIED
            </span>
            {t.home.sample.valLocation} · {t.home.sample.valCert}
          </div>
        </div>
      </section>

      {/* 2. CAPABILITIES STRIP —— What we offer：4 项 */}
      <section className="border-t border-b border-[#e8e8e8] py-6">
        <div className="container flex items-center gap-6 lg:gap-10 flex-wrap">
          <span className="text-xs font-bold tracking-wide uppercase text-[#6b7280] shrink-0">
            {t.home.capabilitiesLabel}
          </span>
          <div className="flex gap-6 lg:gap-9 flex-wrap flex-1">
            {capabilities.map((cap) => (
              <span key={cap} className="flex items-center gap-2.5 text-sm font-medium text-[#111111]">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#e94560]" />
                {cap}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 3. STEPS —— How buyers use FactoryAuditB2B：Discover → Verify → Audit → Source */}
      <section className="container py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-[#111111]">{t.home.howTitle}</h2>
          <p className="text-[#6b7280] mt-2">{t.home.howLead}</p>
        </div>
        <div className="grid md:grid-cols-4 gap-0">
          {t.home.howSteps.map((step, i) => (
            <div key={step.title} className="px-6 md:px-8 py-2 md:border-r border-[#e8e8e8] last:border-r-0 first:pl-0">
              <div className="text-3xl font-extrabold text-[#e0e0e0] mb-3 leading-none">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="text-lg font-bold text-[#111111] mb-2">{step.title}</h3>
              <p className="text-sm text-[#6b7280] leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. WORKFLOW —— 图 + 标题 + 4 条 checklist */}
      <section className="container py-16 grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="workflow-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/static/images/audit-onsite.webp"
            alt={t.home.workflowTitle}
            width={1200}
            height={1020}
            loading="lazy"
          />
        </div>
        <div>
          <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-5">
            {t.home.workflowEyebrow}
          </span>
          <h2 className="text-3xl font-bold text-[#111111] leading-tight">{t.home.workflowTitle}</h2>
          <p className="text-[#6b7280] mt-4 leading-relaxed max-w-lg">{t.home.workflowLead}</p>
          <ul className="mt-6">
            {workflowChecks.map((check) => (
              <li key={check} className="flex items-start gap-3 py-3.5 border-b border-[#e8e8e8] last:border-b-0 text-[15px] text-[#111111]">
                <span aria-hidden="true" className="flex-none w-5 h-5 rounded-full bg-[#fdecef] text-[#e94560] grid place-items-center text-xs font-bold mt-0.5">✓</span>
                {check}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. WHY —— 01 Evidence / 02 Consistent / 03 Built（现有 4 项 why 值） */}
      <section className="bg-[#f7f7f8] border-y border-[#e8e8e8]">
        <div className="container py-16">
          <div className="max-w-2xl mb-10">
            <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-5">
              {t.home.whyLead}
            </span>
            <h2 className="text-3xl font-bold text-[#111111]">{t.home.whyTitle}</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-10">
            {values.map(([title, body], i) => (
              <div key={title}>
                <div className="text-sm font-bold tracking-wide text-[#e94560] mb-4">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-lg font-bold text-[#111111] mb-2">{title}</h3>
                <p className="text-sm text-[#6b7280] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. SAMPLE SUPPLIER PROFILE —— 示例供应商档案（Demo，明确标注） */}
      <section className="container py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-3">
              {t.home.sample.eyebrow}
            </span>
            <h2 className="text-3xl font-bold text-[#111111]">{t.home.sample.title}</h2>
            <p className="text-[#6b7280] mt-4 leading-relaxed max-w-xl">{t.home.sample.lead}</p>
            <div className="mt-5 flex items-center gap-2 text-xs text-[#6b7280]">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#c8c8c8]" />
              {t.home.sample.demoNote}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-3 bg-[#f7f7f8] border-b border-[#e8e8e8] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
              {t.home.sample.tag}
            </div>
            <div className="px-6 py-4 border-b border-[#e8e8e8] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-bold text-[#111111]">
                <span aria-hidden="true" className="w-5 h-5 rounded-full bg-[#eafaf1] text-[#0a7a44] grid place-items-center text-[11px] font-bold">✓</span>
                {t.home.sample.company}
              </div>
              <span className="badge badge-verified whitespace-nowrap">{t.home.sample.status}</span>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
              {sampleFields.map((f) => (
                <div key={f.label}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{f.label}</div>
                  <div className="text-sm font-semibold text-[#111111] mt-0.5">{f.value}</div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#e8e8e8] flex items-center">
              {sampleSteps.map((s, i) => (
                <Fragment key={s}>
                  <div className="flex items-center gap-1.5 text-xs text-[#111111] font-medium whitespace-nowrap">
                    <span aria-hidden="true" className="w-4 h-4 rounded-full bg-[#0a7a44] text-white grid place-items-center text-[10px]">✓</span>
                    {s}
                  </div>
                  {i < sampleSteps.length - 1 && <div aria-hidden="true" className="flex-1 h-px bg-[#e8e8e8] mx-2" />}
                </Fragment>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#e8e8e8] bg-[#fafafa] flex items-center justify-between gap-4 text-xs text-[#6b7280]">
              <span>{t.home.sample.evidence}</span>
              <Link href={p("/suppliers")} className="text-[#e94560] font-semibold whitespace-nowrap hover:underline">
                {t.home.sample.viewSample} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. WHERE WE OPERATE —— 5 国 */}
      <section className="container py-16">
        <div className="flex justify-between items-end flex-wrap gap-6 mb-10">
          <div className="max-w-2xl">
            <span className="inline-block text-xs font-semibold tracking-wide uppercase text-[#e94560] mb-5">
              {t.home.coveragePhase}
            </span>
            <h2 className="text-3xl font-bold text-[#111111]">{t.home.coverageTitle}</h2>
            <p className="text-[#6b7280] mt-2">{t.home.coverageLead}</p>
          </div>
          <Link href={p("/countries")} className="btn btn-accent">
            {t.home.coverageCta}
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {COVERAGE_COUNTRIES.map((c) => (
            <Link key={c.code} href={p(`/countries/${c.slug}`)} className="card p-6 hover:border-[#e94560] transition">
              <h3 className="text-xl font-bold text-[#111111]">{pickZhPair(locale, c.name, c.nameZh)}</h3>
              <p className="text-sm text-[#6b7280] mt-2">{pickZhCopy(locale, c).hook}</p>
              <ul className="mt-4 space-y-1 text-sm text-[#6b7280]">
                <li>· {t.home.capVerification}</li>
                <li>· {t.home.capAudit}</li>
                <li>· {t.home.capInspection}</li>
              </ul>
            </Link>
          ))}
        </div>
      </section>

      {/* 8. CTA BAND —— Ready to find your next supplier? */}
      <section className="border-t border-[#e8e8e8] bg-[#f7f7f8]">
        <div className="container py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#111111]">{t.home.bottomTitle}</h2>
          <p className="text-[#6b7280] text-lg mt-4 max-w-xl mx-auto">{t.home.bottomLead}</p>
          <div className="mt-8 flex gap-3 justify-center flex-wrap">
            <Link href={p("/rfq")} data-track={ANALYTICS_EVENTS.homeRfqClick} className="btn btn-primary">
              {t.nav.postRfq}
            </Link>
            <Link href={p("/custom-services")} className="btn btn-accent">
              {t.home.otherRegionCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export const revalidate = 3600;
