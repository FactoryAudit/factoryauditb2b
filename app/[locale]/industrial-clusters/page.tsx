import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { listPublishedClusters } from "@/lib/industrialClusters";
import {
  buildClusterDirectory,
  flattenClusterDirectory,
  type ClusterDirectoryCard,
} from "@/lib/clusterDirectory";
import { countSuppliersByClusterSlugs } from "@/lib/queries";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
// STEP 09 ROUTE-05：目录页内链 / JSON-LD 一律指向正式层级 canonical URL。
import { buildClusterCanonicalPath } from "@/lib/clusterRoutes";

/**
 * Industrial Clusters —— 产业带目录（链路：Homepage → Industrial Clusters →
 * Cluster Detail → Supplier Profile 的第 2 跳）
 *
 * 🔴 STEP 13-B 信息架构：**Country → Region → Industry(标签) → Cluster → Suppliers**
 *    过去是"8 张卡片平铺"，每张卡顶部重复 `China · South China`，国家/地区没有成为
 *    页面的视觉层级，条目一多就散。现在：
 *      · 顶部 = 国家 tab（真实数据生成 + 计数，纯同页锚点，**不产生新 URL / 新索引页**）
 *      · H2   = Country
 *      · H3   = Region
 *      · 卡片 = Industry 徽章 / Cluster 名 / City · Province · Country / 简介 / 供应商数 / CTA
 *    分组与排序逻辑全在 `lib/clusterDirectory.ts`（纯函数），本文件只负责渲染。
 *
 * 数据来源只有一处：`industrial_clusters` 表 —— 与后台 Admin 是同一张表，
 * 前台不写死任何产业带内容，**也不写死国家列表**（国家 tab 由数据决定）。
 *
 * 🔴 未发布不可见：公开读走 service_role，RLS 对 service_role 不生效，
 *    因此 `listPublishedClusters()` 内部那行**显式** `.eq("is_published", true)`
 *    是唯一闸门。后台下架 ⇒ 前台立即消失。
 *
 * 🔴 禁止 N+1：本页固定两次数据库往返 ——
 *    ① listPublishedClusters()            1 次
 *    ② countSuppliersByClusterSlugs()     1 次（一次查询 + 内存分组）
 *    绝不写 `clusters.map(c => countSuppliersInCluster(c.slug))`（那就是 N+1）。
 */

const BASE = "https://factoryauditb2b.com";
const PATH = "/industrial-clusters";
type Props = { params: Promise<{ locale: string }> };

// STEP 09 ROUTE-05：目录卡 / JSON-LD 一律指向正式层级 canonical URL（非旧扁平 slug）。
const urlOf = (x: {
  slug: string;
  country_code: string | null;
  province: string | null;
  city: string | null;
}): string =>
  buildClusterCanonicalPath({
    slug: x.slug,
    country_code: x.country_code,
    province: x.province,
    city: x.city,
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.clusters.metaTitle,
    description: t.clusters.metaDesc,
  });
}

export default async function IndustrialClustersPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.clusters;
  const p = (href: string) => localePath(locale, href);

  // ① 产业带（已发布）—— 排序在 buildClusterDirectory 内部统一完成
  const clusters = await listPublishedClusters();
  // ② 批量计数（一次查询；不随产业带数量增长）
  const counts = await countSuppliersByClusterSlugs(clusters.map((x) => x.slug));
  // ③ 国家 → 地区 分组（纯函数，顺序确定）
  const directory = buildClusterDirectory(clusters);
  const all = flattenClusterDirectory(directory);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.h1,
    url: `${BASE}${p(PATH)}`,
    numberOfItems: all.length,
    itemListElement: all.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      url: `${BASE}${p(urlOf(x))}`,
    })),
  };

  const chip =
    "inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#0f172a] hover:border-[#0f4c81] hover:text-[#0f4c81]";
  const chipCount = "text-xs font-semibold text-[#64748b]";

  return (
    <main className="container py-12">
      {/* 空目录时不输出空 ItemList —— 0 条结构化数据对搜索引擎没有价值 */}
      {all.length > 0 && <JsonLd data={jsonLd} />}

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:underline">
          {c.breadcrumbHome}
        </Link>
        {" / "}
        <span>{c.breadcrumb}</span>
      </nav>

      <section className="max-w-3xl mb-10">
        <h1 className="text-4xl font-extrabold text-[#0f172a]">{c.h1}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{c.lead}</p>
      </section>

      {all.length === 0 ? (
        /* Empty State —— 不报错、不白屏、不渲染空卡片、不泄漏未发布数据。 */
        <section className="rounded-lg border border-dashed border-[#cbd5e1] p-10 text-center">
          <h2 className="text-xl font-bold text-[#0f172a]">{c.emptyTitle}</h2>
          <p className="text-[#475569] mt-2">{c.emptyLead}</p>
        </section>
      ) : (
        <>
          {/* LEVEL 1 —— 国家 tab。纯同页锚点：不新增路由、不新增索引页、无客户端 JS。
              条目来自真实数据；没有产业带的国家根本不会出现在这里。 */}
          <nav aria-label={c.h1} className="mb-10 flex flex-wrap items-center gap-2">
            <a href="#clusters" className={chip}>
              {c.allCountries}
              <span className={chipCount}>{all.length}</span>
            </a>
            {directory.map((co) => (
              <a key={co.key} href={`#${co.anchor}`} className={chip}>
                {co.name}
                <span className={chipCount}>{co.count}</span>
              </a>
            ))}
          </nav>

          <div id="clusters">
            {directory.map((co, ci) => (
              /* LEVEL 2 —— Country。section 之间留出明显纵向间隔。 */
              <section key={co.key} className={ci === 0 ? "" : "mt-16"}>
                <h2
                  id={co.anchor}
                  className="scroll-mt-24 text-3xl font-extrabold text-[#0f172a]"
                >
                  {co.name}
                </h2>

                {co.regions.map((rg) => (
                  /* LEVEL 3 —— Region。比 Country 小一级；数据缺 region 时不渲染 H3。 */
                  <div key={rg.key} className="mt-8">
                    {rg.name && (
                      <h3 className="border-b border-[#e2e8f0] pb-2 text-xl font-bold text-[#0f172a]">
                        {rg.name}
                      </h3>
                    )}
                    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                      {rg.clusters.map((x) => (
                        <ClusterCard
                          key={x.slug}
                          x={x}
                          href={p(urlOf(x))}
                          supplierText={c.supplierCount.replace(
                            "{count}",
                            String(counts.get(x.slug) ?? 0)
                          )}
                          cta={c.viewSuppliers}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

/** LEVEL 4 —— Cluster 卡片。信息顺序：行业徽章 → 名称 → 定位 → 简介 → 供应商数 → CTA。 */
function ClusterCard({
  x,
  href,
  supplierText,
  cta,
}: {
  x: ClusterDirectoryCard;
  href: string;
  supplierText: string;
  cta: string;
}) {
  return (
    <article className="card flex flex-col p-6">
      {x.industry && (
        <span className="self-start rounded bg-[#f1f5f9] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">
          {x.industry}
        </span>
      )}
      <h4 className="mt-3 text-xl font-bold text-[#0f172a]">{x.name}</h4>
      {x.location && <div className="mt-1 text-sm text-[#64748b]">{x.location}</div>}
      {x.description && <p className="mt-3 flex-1 text-sm text-[#475569]">{x.description}</p>}
      <div className="mt-4 text-sm text-[#64748b]">{supplierText}</div>
      <Link href={href} className="btn btn-outline mt-4 self-start">
        {cta}
      </Link>
    </article>
  );
}

// 🔴 必须是**动态渲染**，不能是 ISR / 预渲染。
//
// 实测（CHANGE SET B 验收）：改成 ISR 后 Cloudflare 会把预渲染产物按
//   `Cache-Control: s-maxage=3275, stale-while-revalidate=2592000` + `x-nextjs-prerender: 1`
// 缓存约 55 分钟 —— 表现为「后台已经发布了产业带，前台目录页仍然是空的」，
// 而运营自己无法判断是没保存成功还是缓存没到期。
//
// 产业带是后台增删改的内容实体，必须「改完即见」。本页恒定 ≤ 2 次索引查找，
// 动态渲染的成本可忽略，不值得用缓存换这个不可预期的延迟。
export const dynamic = "force-dynamic";
