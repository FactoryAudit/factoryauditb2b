import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { getPublishedClusterBySlug } from "@/lib/industrialClusters";
import { listSuppliersByClusterSlug } from "@/lib/queries";
import { overallLevel } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

/**
 * Industrial Cluster 详情页
 * （链路：Homepage → Industrial Clusters → **Cluster Detail** → Supplier Profile）
 *
 * 🔴 可见性铁律：
 *    `getPublishedClusterBySlug()` 内部**显式** `.eq("is_published", true)`，
 *    未发布与不存在走同一条路 ⇒ `notFound()`（404）。
 *    刻意**不区分**「slug 不存在」与「slug 存在但未发布」——
 *    否则 404 页面就成了一个可以逐条试探后台草稿的探针。
 *
 * 🔴 查询次数：1 次 cluster + 1 次 supplier list，不在循环里查库。
 *
 * 供应商卡片只列名称/城市/风险分，并链接到**既有** `/suppliers/[slug]` 档案页 ——
 * 不复制 Supplier Profile 的任何展示逻辑。
 */

const BASE = "https://factoryauditb2b.com";
const PATH = "/industrial-clusters";
type Params = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);

  const cluster = await getPublishedClusterBySlug(slug);
  if (!cluster) {
    // 不存在 / 未发布：noindex，且 metadata 不透露任何后台细节
    return buildPageMetadata({
      locale,
      path: `${PATH}/${slug}`,
      title: t.clusters.h1,
      description: t.clusters.metaDesc,
      robots: { index: false, follow: false },
    });
  }

  const description = (
    cluster.seo_description ||
    cluster.description ||
    t.clusters.detailMetaDesc.replace("{cluster}", cluster.name)
  ).trim();

  return buildPageMetadata({
    locale,
    path: `${PATH}/${cluster.slug}`,
    title: (cluster.seo_title || cluster.name).trim(),
    description,
  });
}

export default async function ClusterDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;

  const cluster = await getPublishedClusterBySlug(slug);
  if (!cluster) notFound();

  const t = await getDictionary(locale);
  const c = t.clusters;
  const p = (href: string) => localePath(locale, href);

  const suppliers = await listSuppliersByClusterSlug(cluster.slug);

  // 只展示真实存在的行政/行业字段；空值整项不渲染（不写 "Unknown" / "N/A"）
  const facts: { label: string; value: string }[] = [];
  if (cluster.country) facts.push({ label: c.countryLabel, value: cluster.country });
  if (cluster.region) facts.push({ label: c.regionLabel, value: cluster.region });
  if (cluster.industry) facts.push({ label: c.industryLabel, value: cluster.industry });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: c.breadcrumbHome, item: `${BASE}${p("/")}` },
      { "@type": "ListItem", position: 2, name: c.breadcrumb, item: `${BASE}${p(PATH)}` },
      {
        "@type": "ListItem",
        position: 3,
        name: cluster.name,
        item: `${BASE}${p(`${PATH}/${cluster.slug}`)}`,
      },
    ],
  };

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd data={jsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:underline">
          {c.breadcrumbHome}
        </Link>
        {" / "}
        <Link href={p(PATH)} className="hover:underline">
          {c.breadcrumb}
        </Link>
        {" / "}
        {cluster.name}
      </nav>

      <h1 className="text-4xl font-extrabold text-[#0f172a]">{cluster.name}</h1>

      {cluster.description && (
        <p className="mt-3 text-lg text-[#475569]">{cluster.description}</p>
      )}

      {facts.length > 0 && (
        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {facts.map((f) => (
            <div key={f.label} className="card p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                {f.label}
              </dt>
              <dd className="text-[#0f172a] font-medium mt-1">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-4 text-sm text-[#64748b]">
        {c.supplierCount.replace("{count}", String(suppliers.length))}
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-[#0f172a]">{c.suppliersTitle}</h2>
        {suppliers.length === 0 ? (
          <p className="mt-2 text-[#475569]">{c.suppliersEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border border-[#e2e8f0]">
            {suppliers.map((s) => (
              <li key={s.slug} className="flex items-center justify-between p-3">
                <Link
                  href={p(`/suppliers/${s.slug}`)}
                  className="font-medium text-[#0f4c81] hover:underline"
                >
                  {s.legalName}
                </Link>
                <span className="text-sm text-[#64748b]">
                  {s.city} · {t.supplierProfile.riskScore}{" "}
                  {typeof s.riskScore === "number"
                    ? `${s.riskScore} / 100 · ${t.risk.ui.level[overallLevel(s.riskScore)]}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// 🔴 动态渲染（与目录页同口径）：cluster 的名字/简介/上下架都可能在后台随时改动，
//    必须「改完即见」。刻意**不用** generateStaticParams —— 构建期快照会把
//    新发布的产业带挡在缓存之后（目录页已实测到这个坑）。
export const dynamic = "force-dynamic";
