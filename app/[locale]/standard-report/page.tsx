import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import StandardReportDocument from "@/components/StandardReportDocument";
import StandardReportDownloadForm from "@/components/StandardReportDownloadForm";
import { SECTIONS, type Bi, type Lang } from "@/lib/standardReport";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

// /{locale}/standard-report —— 公开的标准版报告样张
//
// 口径（用户 2026-09-11）：
//   ① 放在前台公开展示（进 sitemap / 页脚 / llms.txt，可索引）
//   ② **免注册**即可阅读全部 13 个章节（正文在服务端渲染，不设任何门禁）
//   ③ **下载**需要填写注册信息 → 走 /api/lead → 后台自动发邮件 → 留销售线索
//
// 与后台 /admin/report-standard 共用同一个渲染器（components/StandardReportDocument.tsx），
// 保证「标准版」在内外两处长得一模一样。
//
// 语言：报告正文是 en/zh 双语内联（lib/standardReport.ts）；页面框架（标题/门禁/CTA）
//       走 9 语字典。zh / zh-TW 显示中文正文，其余显示英文正文 —— 与后台一致。

const PATH = "/standard-report";
const BASE = "https://factoryauditb2b.com";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.standardReport.metaTitle,
    description: t.standardReport.metaDesc,
  });
}

export default async function StandardReportPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.standardReport;
  const p = (href: string) => localePath(locale, href);

  const lang: Lang = locale === "zh" || locale === "zh-TW" ? "zh" : "en";
  const tr = (b: Bi) => b[lang];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: s.h1,
      description: s.metaDesc,
      url: `${BASE}${p(PATH)}`,
      inLanguage: locale,
      about: { "@type": "Thing", name: "Supplier due diligence report" },
      publisher: { "@id": `${BASE}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.common.ui.home, item: `${BASE}${p("/")}` },
        { "@type": "ListItem", position: 2, name: s.h1, item: `${BASE}${p(PATH)}` },
      ],
    },
  ];

  return (
    <main className="container max-w-4xl py-12" data-track-page="standard_report">
      <JsonLd data={jsonLd} />

      <span className="text-sm font-semibold uppercase tracking-wide text-[#171717]">
        {s.badge}
      </span>
      <h1 className="mt-2 text-4xl font-extrabold text-[#171717]">{s.h1}</h1>
      <p className="mt-3 text-lg text-[#6d6b66]">{s.lead}</p>

      {/* 免注册声明：先把「不用注册也能读完」说清楚，再谈下载 */}
      <div className="mt-6 rounded-md border border-[#1f7a36] bg-[#e8f5ea] px-4 py-3 text-sm font-medium text-[#1f7a36]">
        {s.freeNote}
      </div>

      {/* 目录（锚点跳转到正文各章节） */}
      <nav className="mt-6 rounded-lg border border-[#ebe8e1] bg-[#fbfaf7] p-5">
        <div className="text-sm font-bold text-[#171717]">{s.tocTitle}</div>
        <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {SECTIONS.map((sec) => (
            <li key={sec.no}>
              <a href={`#s${sec.no}`} className="text-[#171717] hover:underline">
                <span className="text-[#8c8982]">{sec.no}</span> {tr(sec.title)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* ===== 报告全文（免注册可读） ===== */}
      <div className="mt-8">
        <StandardReportDocument lang={lang} />
      </div>

      {/* ===== 下载门禁 ===== */}
      <section id="download" className="mt-10 card bg-[#fbfaf7] p-6 md:p-8">
        <h2 className="text-xl font-bold text-[#171717]">{s.downloadTitle}</h2>
        <p className="mt-1 text-sm text-[#3f4650]">{s.downloadLead}</p>
        <div className="mt-4">
          <StandardReportDownloadForm
            defaultLang={lang}
            labels={{
              formName: s.formName,
              formEmail: s.formEmail,
              formCompany: s.formCompany,
              formCountry: s.formCountry,
              formSourcing: s.formSourcing,
              formLang: s.formLang,
              langEn: s.langEn,
              langZh: s.langZh,
              formCta: s.formCta,
              formPrivacy: s.formPrivacy,
              formError: s.formError,
              unlockedTitle: s.unlockedTitle,
              unlockedNote: s.unlockedNote,
              downloadCta: s.downloadCta,
            }}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 card p-8">
        <h2 className="text-xl font-bold text-[#171717]">{s.ctaTitle}</h2>
        <p className="mt-2 text-[#3f4650]">{s.ctaLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={p("/services/supplier-verification")} className="btn btn-primary">
            {s.ctaPrimary}
          </Link>
          <Link href={p("/rfq")} className="btn btn-outline">
            {s.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
