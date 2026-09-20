import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { listPublishedClusters } from "@/lib/industrialClusters";
import { countSuppliersByClusterSlugs } from "@/lib/queries";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

/**
 * Industrial Clusters —— 产业带目录
 * （链路：Homepage → Industrial Clusters → Cluster Detail → Supplier Profile 的第 2 跳）
 *
 * 数据来源只有一处：`industrial_clusters` 表 —— 与后台 Admin 是同一张表，
 * 前台不写死任何产业带内容。
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

  // ① 产业带（已发布，稳定排序：sort_order → name）
  const clusters = await listPublishedClusters();
  // ② 批量计数（一次查询；不随产业带数量增长）
  const counts = await countSuppliersByClusterSlugs(clusters.map((x) => x.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.h1,
    url: `${BASE}${p(PATH)}`,
    numberOfItems: clusters.length,
    itemListElement: clusters.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      url: `${BASE}${p(`${PATH}/${x.slug}`)}`,
    })),
  };

  return (
    <main className="container py-12">
      {/* 空目录时不输出空 ItemList —— 0 条结构化数据对搜索引擎没有价值 */}
      {clusters.length > 0 && <JsonLd data={jsonLd} />}

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

      {clusters.length === 0 ? (
        /* Empty State —— 当前 industrial_clusters = 0，这是线上真实走到的分支。
           不报错、不白屏、不渲染空卡片、不泄漏未发布数据。 */
        <section className="rounded-lg border border-dashed border-[#cbd5e1] p-10 text-center">
          <h2 className="text-xl font-bold text-[#0f172a]">{c.emptyTitle}</h2>
          <p className="text-[#475569] mt-2">{c.emptyLead}</p>
        </section>
      ) : (
        <section className="grid md:grid-cols-3 gap-5">
          {clusters.map((x) => {
            // 行政维度只展示真实存在的字段，空值不占位（不写 "Unknown" / "N/A"）
            const place = [x.country, x.region].filter(
              (v): v is string => typeof v === "string" && v.trim().length > 0
            );
            return (
              <div key={x.slug} className="card p-6 flex flex-col">
                {place.length > 0 && (
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#8a5410]">
                    {place.join(" · ")}
                  </div>
                )}
                <h2 className="text-2xl font-bold text-[#0f172a] mt-1">{x.name}</h2>
                {x.industry && (
                  <p className="text-sm font-medium text-[#0f4c81] mt-2">{x.industry}</p>
                )}
                {x.description && (
                  <p className="text-sm text-[#475569] mt-2 flex-1">{x.description}</p>
                )}
                <div className="mt-4 text-sm text-[#64748b]">
                  {c.supplierCount.replace("{count}", String(counts.get(x.slug) ?? 0))}
                </div>
                <Link
                  href={p(`${PATH}/${x.slug}`)}
                  className="btn btn-outline mt-5 self-start"
                >
                  {c.viewSuppliers}
                </Link>
              </div>
            );
          })}
        </section>
      )}
    </main>
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
