import type { Metadata } from "next";
import Link from "next/link";
import HeroSearch from "@/components/HeroSearch";
import JsonLd from "@/components/JsonLd";
import RelativeTime from "@/components/RelativeTime";
import { listSuppliers, listPublicRfqs } from "@/lib/queries";
import { STATIC_INDUSTRIES } from "@/lib/staticData";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";

/** STEP-07：industry_code → 展示名（与 /rfq 表单同源，复用 STATIC_INDUSTRIES）。 */
function industryName(code: string | null): string {
  if (!code) return "";
  return STATIC_INDUSTRIES.find((i) => i.code === code)?.name ?? code;
}
import { TOOL_ORDER } from "@/lib/nav";
import { featuredGuides } from "@/lib/guides";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";
import { OG_IMAGE } from "@/lib/pageMeta";
import { pickZhCopy, pickZhPair } from "@/lib/tw";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

const BASE = "https://factoryauditb2b.com";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const title = `${t.home.h1} | FactoryAuditB2B`;
  return {
    title,
    description: t.home.lead,
    alternates: {
      canonical: canonicalFor(locale, "/"),
      languages: hreflangFor("/"),
    },
    openGraph: {
      title,
      description: t.home.lead,
      type: "website",
      url: canonicalFor(locale, "/"),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: t.home.lead,
      images: [OG_IMAGE],
    },
  };
}

export default async function Home({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);

  const suppliers = await listSuppliers();
  const buyerRequests = await listPublicRfqs(5);
  const searchData = suppliers.map((s) => ({
    slug: s.slug,
    legalName: s.legalName,
    city: s.city,
    country: s.country,
    mainProducts: s.mainProducts,
  }));

  const eva = [
    { title: t.home.evaluateTitle, body: t.home.evaluateBody, cta: t.home.evaluateCta, href: "/tools/supplier-risk-calculator" },
    { title: t.home.verifyTitle, body: t.home.verifyBody, cta: t.home.verifyCta, href: "/services/supplier-verification" },
    { title: t.home.auditTitle, body: t.home.auditBody, cta: t.home.auditCta, href: "/factory-audit/request" },
  ];

  const featuredTools = TOOL_ORDER.slice(0, 4).map((x) => ({
    ...t.toolCards[x.cardKey],
    href: x.href,
  }));

  const guides = featuredGuides().map((g) => ({
    title: pickZhPair(locale, g.titleEn, g.titleZh),
    desc: pickZhPair(locale, g.metaDescEn, g.metaDescZh).slice(0, 120),
    href: `/guides/${g.slug}`,
  }));

  const values = [
    [t.home.why1Title, t.home.why1Body],
    [t.home.why2Title, t.home.why2Body],
    [t.home.why3Title, t.home.why3Body],
    [t.home.why4Title, t.home.why4Body],
  ];

  // 首页结构化数据：工具导航 ItemList。
  // 站点身份（Organization / WebSite）由根布局 app/[locale]/layout.tsx 的 siteGraph
  // 统一输出一次（全站唯一事实源），此处不再重复，避免同页两套 @id 相同但字段
  // 不同的 Organization 让 Google 混淆。
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.home.toolsTitle,
    url: canonicalFor(locale, "/"),
    itemListElement: featuredTools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.title,
      url: canonicalFor(locale, tool.href),
    })),
  };

  return (
    <>
      {/* HERO */}
      <section className="bg-gradient-to-b from-[#e6eef6] to-[#f7f9fc]">
        <div className="container py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-[#fff4e0] text-[#8a5410] text-sm font-semibold mb-4">
              {t.home.badge}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[#0f172a] leading-tight">
              {t.home.h1}
            </h1>
            <p className="mt-4 text-lg text-[#0f172a] font-medium max-w-xl">{t.home.lead}</p>
            <p className="mt-2 text-[#475569] max-w-xl">{t.home.sub}</p>
            <div className="mt-6 flex gap-3 flex-wrap">
              <Link href={p("/suppliers")} className="btn btn-primary">
                {t.home.ctaPrimary}
              </Link>
              <Link href={p("/verify-supplier")} className="btn btn-accent">
                {t.home.ctaSecondary}
              </Link>
            </div>
          </div>
          <HeroSearch suppliers={searchData} t={t.common.heroSearch} />
        </div>
      </section>

      {/* WHAT DO YOU NEED? —— STEP-06 四入口轻量卡片
          位置：Hero 正下方。每张卡是真实 <a href>（SSR 直出，非 JS 跳转），
          点击经全局 AnalyticsTracker 的 data-track 委托发 *_cta_click。
          四张卡语义互斥：找供应商 / 按产业带找 / 已有供应商要核验 / 有明确采购需求。
          为避免与下方各自专区重复，本区块只做「分流入口」，不承载详细内容。 */}
      <section className="container pb-16">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.needTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.needLead}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href={p("/suppliers")}
            data-track={ANALYTICS_EVENTS.homeFindSuppliersClick}
            className="card p-6 flex flex-col hover:border-[#0f4c81] transition"
          >
            <div className="text-sm font-semibold text-[#0f4c81] mb-1">01</div>
            <h3 className="text-lg font-bold text-[#0f172a]">{t.home.entryFindTitle}</h3>
            <p className="text-sm text-[#475569] mt-2 flex-1">{t.home.entryFindDesc}</p>
            <span className="btn btn-outline mt-5 self-start">{t.home.entryFindCta}</span>
          </Link>
          <Link
            href={p("/industrial-clusters")}
            data-track={ANALYTICS_EVENTS.homeIndustrialClustersClick}
            className="card p-6 flex flex-col hover:border-[#0f4c81] transition"
          >
            <div className="text-sm font-semibold text-[#0f4c81] mb-1">02</div>
            <h3 className="text-lg font-bold text-[#0f172a]">{t.home.entryClusterTitle}</h3>
            <p className="text-sm text-[#475569] mt-2 flex-1">{t.home.entryClusterDesc}</p>
            <span className="btn btn-outline mt-5 self-start">{t.home.entryClusterCta}</span>
          </Link>
          <Link
            href={p("/verify-supplier")}
            data-track={ANALYTICS_EVENTS.homeVerifySupplierClick}
            className="card p-6 flex flex-col hover:border-[#0f4c81] transition"
          >
            <div className="text-sm font-semibold text-[#0f4c81] mb-1">03</div>
            <h3 className="text-lg font-bold text-[#0f172a]">{t.home.entryVerifyTitle}</h3>
            <p className="text-sm text-[#475569] mt-2 flex-1">{t.home.entryVerifyDesc}</p>
            <span className="btn btn-outline mt-5 self-start">{t.home.entryVerifyCta}</span>
          </Link>
          <Link
            href={p("/rfq")}
            data-track={ANALYTICS_EVENTS.homeRfqClick}
            className="card p-6 flex flex-col hover:border-[#0f4c81] transition"
          >
            <div className="text-sm font-semibold text-[#0f4c81] mb-1">04</div>
            <h3 className="text-lg font-bold text-[#0f172a]">{t.home.entryRfqTitle}</h3>
            <p className="text-sm text-[#475569] mt-2 flex-1">{t.home.entryRfqDesc}</p>
            <span className="btn btn-outline mt-5 self-start">{t.home.entryRfqCta}</span>
          </Link>
        </div>
      </section>

      {/* LIVE BUYER REQUESTS —— STEP-07：首页买家需求流展示层
           位置：STEP-06 四入口正下方。数据源 listPublicRfqs（构建期冻结，与 suppliers 同源）。
           仅展示公开白名单字段；CTA 复用现有 /rfq（不新建 detail/list 路由、不改 /rfq 逻辑）。
           data-track-view 发曝光事件；卡片 CTA 发 home_live_buyer_request_cta_click（点击层）。 */}
      <section
        className="container pb-16"
        data-track-view={ANALYTICS_EVENTS.homeLiveBuyerRequestView}
      >
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.liveTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.liveLead}</p>

        {buyerRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#cbd5e1] p-8 text-center">
            <p className="text-lg font-semibold text-[#0f172a]">{t.home.liveEmptyTitle}</p>
            <p className="text-sm text-[#64748b] mt-2">{t.home.liveEmptyLead}</p>
            <Link href={p("/rfq")} className="btn btn-primary mt-5 inline-block">
              {t.home.liveEmptyCta}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {buyerRequests.map((r, i) => (
                <div key={r.referenceId} className="card p-6 flex flex-col">
                  <h3 className="text-lg font-bold text-[#0f172a]">{r.product}</h3>
                  <dl className="mt-3 space-y-1 text-sm text-[#475569]">
                    {r.quantity ? (
                      <div>
                        <dt className="inline font-medium text-[#0f172a]">
                          {t.home.liveQuantity}:{" "}
                        </dt>
                        <dd className="inline">{r.quantity}</dd>
                      </div>
                    ) : null}
                    {r.targetMarket ? (
                      <div>
                        <dt className="inline font-medium text-[#0f172a]">
                          {t.home.liveMarket}:{" "}
                        </dt>
                        <dd className="inline">{r.targetMarket}</dd>
                      </div>
                    ) : null}
                    {r.industryCode ? (
                      <div>
                        <dt className="inline font-medium text-[#0f172a]">
                          {t.home.liveIndustry}:{" "}
                        </dt>
                        <dd className="inline">{industryName(r.industryCode)}</dd>
                      </div>
                    ) : null}
                    {r.certificationsReq && r.certificationsReq.length > 0 ? (
                      <div>
                        <dt className="inline font-medium text-[#0f172a]">
                          {t.home.liveCerts}:{" "}
                        </dt>
                        <dd className="inline">{r.certificationsReq.join(", ")}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="text-xs text-[#94a3b8] mt-3">
                    <RelativeTime date={r.createdAt} prefix={t.home.livePosted} />
                  </div>
                  <Link
                    href={p(`/rfq?request=${encodeURIComponent(r.referenceId)}`)}
                    data-track={ANALYTICS_EVENTS.homeLiveBuyerRequestClick}
                    data-track-value={String(i + 1)}
                    className="btn btn-outline mt-5 self-start"
                  >
                    {t.home.liveRespondCta}
                  </Link>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Link
                href={p("/rfq")}
                className="text-[#0f4c81] font-medium hover:underline"
              >
                {t.home.liveViewAll} →
              </Link>
            </div>
          </>
        )}
      </section>

      {/* EVALUATE / VERIFY / AUDIT */}
      <section className="container section-pad">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.evaTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.evaLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {eva.map((x) => (
            <div key={x.title} className="card p-6 flex flex-col">
              <h3 className="text-xl font-bold text-[#0f4c81]">{x.title}</h3>
              <p className="text-sm text-[#475569] mt-2 flex-1">{x.body}</p>
              <Link href={p(x.href)} className="btn btn-outline mt-5 self-start">
                {x.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED TOOLS */}
      <section className="container pb-16">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.toolsTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.toolsLead}</p>
        <JsonLd data={jsonLd} />
        <div className="grid md:grid-cols-4 gap-5">
          {featuredTools.map((tool) => (
            <Link key={tool.href} href={p(tool.href)} className="card p-5 hover:border-[#0f4c81] transition">
              <div className="font-semibold text-[#0f4c81] mb-2">{tool.title}</div>
              <p className="text-sm text-[#475569]">{tool.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-[#f7f9fc]">
        <div className="container section-pad">
          <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.howTitle}</h2>
          <p className="text-[#64748b] mt-2 mb-8">{t.home.howLead}</p>
          <ol className="grid md:grid-cols-4 gap-5">
            {t.home.howSteps.map((step, i) => (
              <li key={step.title} className="card p-6">
                <div className="w-9 h-9 rounded-full bg-[#0f4c81] text-white grid place-items-center font-bold text-sm">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-[#0f172a] mt-3">{step.title}</h3>
                <p className="text-sm text-[#475569] mt-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* WHERE WE VERIFY */}
      <section className="container section-pad">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.coverageTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.coverageLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {COVERAGE_COUNTRIES.map((c) => (
            <div key={c.code} className="card p-6">
              <h3 className="text-xl font-bold text-[#0f172a]">{pickZhPair(locale, c.name, c.nameZh)}</h3>
              <p className="text-sm text-[#475569] mt-2">{pickZhCopy(locale, c).hook}</p>
              {/* 三项服务做成可点链接：验货直达 /services/inspection（V4.0 定位不变，入口打通） */}
              <ul className="mt-4 space-y-1 text-sm">
                <li>
                  <Link
                    href={p(`/services/${c.slug}-supplier-verification`)}
                    className="text-[#0f4c81] hover:underline"
                  >
                    · {t.home.coverageService1}
                  </Link>
                </li>
                <li>
                  <Link
                    href={p(`/services/${c.slug}-factory-audit`)}
                    className="text-[#0f4c81] hover:underline"
                  >
                    · {t.home.coverageService2}
                  </Link>
                </li>
                <li>
                  <Link
                    href={p("/services/inspection")}
                    className="text-[#0f4c81] hover:underline"
                  >
                    · {t.home.coverageService3}
                  </Link>
                </li>
              </ul>
              <Link href={p(`/countries/${c.slug}`)} className="btn btn-outline mt-5 inline-block">
                {t.home.coverageCta}
              </Link>
            </div>
          ))}
          {/* 客户指定的其他地区：把 5 国卡片之后的第 6 格填上，明确「不列出的国家也可接单」 */}
          <div
            data-other-region
            className="card p-6 border-dashed border-[#cbd5e1] flex flex-col"
          >
            <h3 className="text-xl font-bold text-[#0f172a]">{t.home.otherRegionTitle}</h3>
            <p className="text-sm text-[#475569] mt-2 flex-1">
              {t.home.otherRegionBody}
            </p>
            <Link
              href={p("/custom-services")}
              className="btn btn-outline mt-5 self-start"
            >
              {t.home.otherRegionCta}
            </Link>
          </div>
        </div>
        <div className="mt-8 rounded-lg border border-dashed border-[#cbd5e1] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="font-semibold text-[#0f172a]">{t.coverage.anotherCountryTitle}</div>
            <p className="text-sm text-[#475569] mt-1">{t.coverage.anotherCountryLead}</p>
          </div>
          <Link href={p("/custom-services")} className="btn btn-primary whitespace-nowrap">
            {t.coverage.anotherCountryCta}
          </Link>
        </div>
      </section>

      {/* INDUSTRIAL CLUSTERS 入口已并入上方「What do you need?」四卡区（入口 02），
          此处不再保留独立紧凑卡，避免同页出现两个 /industrial-clusters 入口。
          home.clustersTitle/Lead/Cta 字典键保留（孤儿键，无害），不回改 STEP-04。 */}

      {/* WHY */}
      <section className="bg-[#f7f9fc]">
        <div className="container section-pad">
          <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.whyTitle}</h2>
          <p className="text-[#64748b] mt-2 mb-8">{t.home.whyLead}</p>
          <div className="grid md:grid-cols-4 gap-5">
            {values.map(([title, body]) => (
              <div key={title} className="card p-6">
                <h3 className="font-bold text-[#0f4c81]">{title}</h3>
                <p className="text-sm text-[#475569] mt-2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED GUIDES */}
      <section className="container section-pad">
        <h2 className="text-3xl font-bold text-[#0f172a]">{t.home.guidesTitle}</h2>
        <p className="text-[#64748b] mt-2 mb-8">{t.home.guidesLead}</p>
        <div className="grid md:grid-cols-3 gap-5">
          {guides.map((g) => (
            <Link key={g.href} href={p(g.href)} className="card p-6 hover:border-[#0f4c81] transition">
              <h3 className="font-semibold text-[#0f4c81]">{g.title}</h3>
              <p className="text-sm text-[#475569] mt-2">{g.desc}…</p>
            </Link>
          ))}
        </div>
      </section>

      {/* HAVE A SUPPLIER ALREADY */}
      <section className="bg-[#0f4c81]">
        <div className="container py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">{t.home.bottomTitle}</h2>
          <p className="mt-3 text-white/80 max-w-2xl mx-auto">{t.home.bottomLead}</p>
          <Link href={p("/services/supplier-verification")} className="btn btn-accent mt-6 inline-block">
            {t.home.bottomCta}
          </Link>
          <div className="mt-4">
            <Link href={p("/rfq")} className="text-white/80 hover:text-white text-sm underline">
              {t.suppliers.notListedTitle}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export const revalidate = 3600;
