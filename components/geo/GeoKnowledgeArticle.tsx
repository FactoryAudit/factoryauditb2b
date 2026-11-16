// components/geo/GeoKnowledgeArticle.tsx —— GEO / AI Search 问答页的**唯一渲染壳**
//
// 三个路由族共用：/guides/[slug]（guide|comparison）、/standards/[slug]（standard）、
// /industry/[slug]（industry）。数据源：lib/geoKnowledge.ts（表 geo_knowledge_pages）。
//
// ── 为什么刻意写这么"朴素" ───────────────────────────────────────────────
// 这批页面的唯一目的是被搜索引擎与 AI 答案引擎**抽取**，所以：
//   · 对比表服务端直出真实 <table>，带 <caption>/<thead>/scope，不做图片、
//     不做 JS tab 折叠、不做横向截断 —— 藏在交互后面的表格等于不存在；
//   · FAQ 既可见渲染，又注入 FAQPage 结构化数据（两者必须一致，否则视为作弊）；
//   · 正文顺序 = BLUF 结论 → 对比表 → 零容忍红线 → FAQ，结论永远在第一屏。
//
// ── 文案口径 ─────────────────────────────────────────────────────────────
// 区块标题（对比表 / 零容忍）随数据携带，**不进字典**：站内 9 语字典已冻结
// （en 叶子数 3293）。通用 chrome（面包屑、Quick Answer、FAQ、Related）一律复用
// 既有字典键，因此本组件**零新增字典键**。

import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/getDictionary";
import { geoPath, listRelatedGeoPages, type GeoKnowledgePage } from "@/lib/geoKnowledge";
import { GEO_HUB_PATH, buildGeoJsonLd } from "@/lib/geoKnowledgeSeo";
import { legacyLinkFor } from "@/lib/geoLegacyLinks";
import { findGuide } from "@/lib/guides";
import { pickZhPair } from "@/lib/tw";

/** 把 timestamptz 显示成 2026-11-16；无效值返回 null（宁可不显示，不显示 Invalid Date）。 */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export default async function GeoKnowledgeArticle({
  page,
  locale,
  t,
}: {
  page: GeoKnowledgePage;
  locale: Locale;
  t: Dictionary;
}) {
  const p = (href: string) => localePath(locale, href);
  const date = formatDate(page.updatedAt);
  // 互链：同批 GEO 页面在页尾互相指向，避免新页面只靠 sitemap 被发现而成为孤岛
  const related = await listRelatedGeoPages(page, locale);
  // 撞题页：GEO 新页单向指向既有权威静态指南（方向见 lib/geoLegacyLinks.ts 注释）
  const legacySlug = legacyLinkFor(page.slug);
  const legacyGuide = legacySlug ? findGuide(legacySlug) : null;

  const table = page.comparisonTable;
  const zeroTolerance = page.zeroToleranceList;
  // 页级 CTA 必须 label 与 href 同时有效才覆盖；否则退回全局默认（已上线 7 篇走这条）。
  const pageCta = page.ctaLabel && page.ctaHref ? { label: page.ctaLabel, href: page.ctaHref } : null;

  return (
    <article className="container py-12 max-w-3xl">
      <JsonLd
        data={buildGeoJsonLd(page, locale, {
          home: t.common.ui.home,
          hub: t.resourcesIndex.h1,
        })}
      />

      <nav className="mb-4 text-sm text-[#6d6b66]">
        <Link href={p("/")} className="hover:underline">
          {t.common.ui.home}
        </Link>
        {" / "}
        <Link href={p(GEO_HUB_PATH)} className="hover:underline">
          {t.resourcesIndex.h1}
        </Link>
        {" / "}
        {page.h1Question}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#171717]">{page.h1Question}</h1>

      {/* 可见署名 + 更新时间：E-E-A-T 要求内容能关联到负责的实体、能看出何时核过。 */}
      <p className="text-sm text-[#6d6b66] mt-2">
        <Link href={p("/methodology")} className="font-medium text-[#171717] hover:underline">
          FactoryAuditB2B
        </Link>
        {/* 时间只在真实存在时输出（R60 同口径：宁可缺失，不填占位） */}
        {date ? ` · ${t.supplierProfile.lastUpdated}: ${date}` : null}
      </p>

      {/* BLUF：一句话结论。AI 摘要与 Google 精选摘要优先抓这一段。 */}
      <section className="mt-6 rounded-lg bg-[#f5f3ee] p-6">
        <h2 className="font-bold text-[#171717]">{t.common.ui.quickAnswer}</h2>
        <p className="text-[#3f4650] mt-2">{page.blufSummary}</p>
      </section>

      {/* 对比表：原生语义化 <table>。列数逐页不同，故渲染完全由数据驱动。 */}
      {table && (
        <section className="mt-8">
          {page.comparisonTitle && (
            <h2 className="text-2xl font-bold text-[#171717]">{page.comparisonTitle}</h2>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              {/* caption 与可见标题同文：既满足表格语义，又不影响视觉 */}
              <caption className="sr-only">
                {page.comparisonTitle ?? page.h1Question}
              </caption>
              <thead>
                <tr className="bg-[#f5f3ee]">
                  {table.headers.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border border-[#ddd9d0] px-3 py-2 text-left font-semibold text-[#171717]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={`row-${i}`}>
                    {row.map((cell, j) =>
                      // 第 1 列是行标签（Verification Tier / Dimension …），用 <th scope="row">
                      // 让屏幕阅读器与解析器都能把它与其余单元格关联起来。
                      j === 0 ? (
                        <th
                          key={`cell-${i}-${j}`}
                          scope="row"
                          className="border border-[#ddd9d0] px-3 py-2 text-left align-top font-semibold text-[#171717]"
                        >
                          {cell}
                        </th>
                      ) : (
                        <td
                          key={`cell-${i}-${j}`}
                          className="border border-[#ddd9d0] px-3 py-2 align-top text-[#3f4650]"
                        >
                          {cell}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 零容忍红线：空数组时整块不渲染，绝不留空标题 */}
      {zeroTolerance.length > 0 && (
        <section className="mt-8">
          {page.zeroToleranceTitle && (
            <h2 className="text-2xl font-bold text-[#171717]">{page.zeroToleranceTitle}</h2>
          )}
          <ul className="mt-3 space-y-2">
            {zeroTolerance.map((x) => (
              <li key={x} className="flex gap-2 text-[#3f4650]">
                {/* aria-hidden：装饰性标记，读屏会读成"乘号"，等于噪声 */}
                <span aria-hidden="true" className="mt-[1px] font-bold text-[#d4232a]">
                  ×
                </span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FAQ：可见内容 + FAQPage 结构化数据同源（buildGeoJsonLd 里用的是同一份数组） */}
      {page.faqs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold text-[#171717]">{t.countryHub.faqTitle}</h2>
          <div className="mt-3 space-y-4">
            {page.faqs.map((f) => (
              <div key={f.question}>
                <h3 className="font-semibold text-[#171717]">{f.question}</h3>
                <p className="text-[#3f4650] mt-1">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(legacyGuide || related.length > 0) && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.relatedGuides}</h2>
          <ul className="mt-3 space-y-2">
            {legacyGuide && (
              <li key={`legacy-${legacyGuide.slug}`}>
                <Link href={p(`/guides/${legacyGuide.slug}`)} className="text-[#171717] hover:underline">
                  {pickZhPair(locale, legacyGuide.titleEn, legacyGuide.titleZh)}
                </Link>
              </li>
            )}
            {related.map((x) => (
              <li key={x.slug}>
                <Link href={p(geoPath(x))} className="text-[#171717] hover:underline">
                  {x.h1Question}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 card p-8 bg-[#171717]">
        <h2 className="text-2xl font-bold text-white">{t.home.bottomTitle}</h2>
        <p className="mt-2 text-white/80">{t.home.bottomLead}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {pageCta ? (
            <Link href={p(pageCta.href)} className="btn btn-accent" data-track="geoPageCta">
              {pageCta.label}
            </Link>
          ) : (
            <Link href={p("/services/supplier-verification")} className="btn btn-accent">
              {t.home.bottomCta}
            </Link>
          )}
          {/* 次 CTA 始终保留：页级 CTA 指向入驻时，次入口给买家侧工具，两边都不丢 */}
          <Link
            href={p(pageCta ? "/services/supplier-verification" : "/tools/supplier-risk-calculator")}
            className="btn btn-outline-dark"
          >
            {pageCta ? t.home.bottomCta : t.methodology.ctaSecondary}
          </Link>
        </div>
      </section>
    </article>
  );
}
