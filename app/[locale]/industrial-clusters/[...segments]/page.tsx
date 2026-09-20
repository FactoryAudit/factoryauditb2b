import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import {
  getPublishedClusterBySlug,
  listPublishedClusters,
  type IndustrialCluster,
} from "@/lib/industrialClusters";
import { listSuppliersByClusterSlug, countSuppliersByClusterSlugs } from "@/lib/queries";
import { overallLevel } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import {
  buildClusterCanonicalPath,
  COUNTRY_SEGMENT_TO_CODE,
  COUNTRY_URL_SEGMENT,
  slugifySegment,
  type ClusterRouteInput,
} from "@/lib/clusterRoutes";

// =============================================================================
// Industrial Clusters 层级路由（STEP 09 ROUTE-03）
//
// 承接原 [slug] 扁平详情页的全部职责，并扩展为国家 / 省(市) / 产业带 三级：
//   /industrial-clusters                          全球目录（另有独立 index 页）
//   /industrial-clusters/china                    国家聚合页
//   /industrial-clusters/china/guangdong          省级聚合页
//   /industrial-clusters/china/guangdong/dongguan-electronics  产业带详情
//   /industrial-clusters/thailand/rayong-automotive            产业带详情（无独立省段）
//
// 旧扁平 URL（/industrial-clusters/<slug>）由 middleware 统一 301 到本路由；
// 兜底：若某 slug 命中但当前路径 ≠ canonical，本页 permanentRedirect 到 canonical。
//
// 🔴 可见性铁律（同原 [slug] 页）：getPublishedClusterBySlug 显式 .eq(is_published,true)；
//    未发布 / 不存在 → notFound()。不区分「不存在」与「未发布」，避免被探测草稿。
// 🔴 force-dynamic：cluster 数据可后台随时改，必须「改完即见」。
// =============================================================================

const BASE = "https://factoryauditb2b.com";
const PATH = "/industrial-clusters";

const COUNTRY_DISPLAY: Record<string, string> = {
  CN: "China",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
};

type Props = { params: Promise<{ locale: string; segments: string[] }> };

function toInput(c: IndustrialCluster): ClusterRouteInput {
  return { slug: c.slug, country_code: c.country_code, province: c.province, city: c.city };
}

// ── 路由解析（generateMetadata 与组件共用，避免重复查询）───────────────────────
type Resolved =
  | { kind: "notfound" }
  | { kind: "redirect"; canonical: string }
  | { kind: "detail"; cluster: IndustrialCluster; canonical: string }
  | {
      kind: "aggregator";
      countryCode: string;
      countrySeg: string;
      parentSeg: string | null;
      clusters: IndustrialCluster[];
    };

async function resolveClusterRoute(segments: string[]): Promise<Resolved> {
  if (segments.length < 1 || segments.length > 3) return { kind: "notfound" };

  const last = segments[segments.length - 1];
  const cluster = await getPublishedClusterBySlug(last);
  if (cluster) {
    const canonical = buildClusterCanonicalPath(toInput(cluster));
    const currentPath = `${PATH}/${segments.join("/")}`;
    if (canonical === currentPath) return { kind: "detail", cluster, canonical };
    return { kind: "redirect", canonical };
  }

  // 非 cluster slug → 视为聚合页
  const countrySeg = segments[0];
  const countryCode = COUNTRY_SEGMENT_TO_CODE[countrySeg];
  if (!countryCode) return { kind: "notfound" };

  const all = await listPublishedClusters(); // 已是 is_published 过滤后的全集
  const inCountry = all.filter((c) => c.country_code === countryCode);
  let scoped = inCountry;
  if (segments.length >= 2) {
    const parent = segments[1];
    scoped = inCountry.filter(
      (c) =>
        slugifySegment(c.province ?? "") === parent ||
        slugifySegment(c.city ?? "") === parent
    );
  }
  if (scoped.length === 0) return { kind: "notfound" };
  return { kind: "aggregator", countryCode, countrySeg, parentSeg: segments[1] ?? null, clusters: scoped };
}

// 详情页 / 聚合页的 breadcrumb 展示名（与 URL 段严格一致，不臆造层级）
function clusterParentDisplay(cluster: IndustrialCluster): string | null {
  if (cluster.country_code === "CN") return cluster.province;
  return cluster.city;
}

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, segments } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const resolved = await resolveClusterRoute(segments);

  if (resolved.kind === "detail") {
    const { cluster, canonical } = resolved;
    const description = (
      cluster.seo_description ||
      cluster.description ||
      t.clusters.detailMetaDesc.replace("{cluster}", cluster.name)
    ).trim();
    return buildPageMetadata({
      locale,
      path: canonical,
      title: (cluster.seo_title || cluster.name).trim(),
      description,
    });
  }
  if (resolved.kind === "redirect" || resolved.kind === "aggregator") {
    const path = `${PATH}/${segments.join("/")}`;
    const head =
      resolved.kind === "aggregator"
        ? resolved.clusters[0]
        : null;
    const title =
      resolved.kind === "aggregator"
        ? `${COUNTRY_DISPLAY[resolved.countryCode] ?? resolved.countrySeg}${
            resolved.parentSeg ? ` · ${clusterParentDisplay(head!) ?? resolved.parentSeg}` : ""
          } ${t.clusters.breadcrumb}`
        : t.clusters.h1;
    return buildPageMetadata({
      locale,
      path,
      title: title.trim(),
      description: t.clusters.metaDesc,
    });
  }
  // notfound：noindex，不泄露后台细节
  return buildPageMetadata({
    locale,
    path: `${PATH}/${segments.join("/")}`,
    title: t.clusters.h1,
    description: t.clusters.metaDesc,
    robots: { index: false, follow: false },
  });
}

// ── 页面 ───────────────────────────────────────────────────────────────────────
export default async function IndustrialClustersHierarchyPage({ params }: Props) {
  const { locale: raw, segments } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.clusters;
  const p = (href: string) => localePath(locale, href);
  const resolved = await resolveClusterRoute(segments);

  if (resolved.kind === "notfound") notFound();
  if (resolved.kind === "redirect") permanentRedirect(resolved.canonical);

  // ── 详情 ──
  if (resolved.kind === "detail") {
    const { cluster, canonical } = resolved;
    const suppliers = await listSuppliersByClusterSlug(cluster.slug);

    // breadcrumb：与 canonical URL 段严格对应
    const crumbs: { name: string; href: string }[] = [
      { name: c.breadcrumbHome, href: "/" },
      { name: c.breadcrumb, href: PATH },
    ];
    // 国家段
    crumbs.push({ name: COUNTRY_DISPLAY[cluster.country_code ?? ""] ?? cluster.country ?? "", href: `${PATH}/${COUNTRY_URL_SEGMENT[cluster.country_code ?? ""]}` });
    // 父段（真实层级：CN=省；其他=市）—— 始终展示并链接到聚合页，
    // 与用户 §13/§14「breadcrumb 必须反映真实层级」一致（泰国也显示 Rayong）。
    const parentName = clusterParentDisplay(cluster);
    if (parentName) {
      const parentSeg = cluster.country_code === "CN"
        ? slugifySegment(cluster.province ?? "")
        : slugifySegment(cluster.city ?? "");
      if (parentSeg) crumbs.push({ name: parentName, href: `${PATH}/${COUNTRY_URL_SEGMENT[cluster.country_code ?? ""]}/${parentSeg}` });
    }
    crumbs.push({ name: cluster.name, href: canonical });

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((cr, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: cr.name,
        item: `${BASE}${p(cr.href)}`,
      })),
    };

    const facts: { label: string; value: string }[] = [];
    if (cluster.country) facts.push({ label: c.countryLabel, value: cluster.country });
    if (cluster.region) facts.push({ label: c.regionLabel, value: cluster.region });
    if (cluster.province) facts.push({ label: "Province", value: cluster.province });
    if (cluster.city) facts.push({ label: "City", value: cluster.city });
    if (cluster.industry) facts.push({ label: c.industryLabel, value: cluster.industry });

    return (
      <main className="container py-12 max-w-4xl">
        <JsonLd data={jsonLd} />

        <nav className="mb-4 text-sm text-[#64748b]" aria-label="Breadcrumb">
          {crumbs.map((cr, i) => (
            <span key={cr.href}>
              {i > 0 && " / "}
              {i < crumbs.length - 1 ? (
                <Link href={p(cr.href)} className="hover:underline">
                  {cr.name}
                </Link>
              ) : (
                <span>{cr.name}</span>
              )}
            </span>
          ))}
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

  // ── 聚合页（国家 / 省·市）──
  const { clusters, countryCode, parentSeg } = resolved;
  const counts = await countSuppliersByClusterSlugs(clusters.map((x) => x.slug));

  const aggCrumbs: { name: string; href: string }[] = [
    { name: c.breadcrumbHome, href: "/" },
    { name: c.breadcrumb, href: PATH },
    { name: COUNTRY_DISPLAY[countryCode] ?? countryCode, href: `${PATH}/${COUNTRY_URL_SEGMENT[countryCode]}` },
  ];
  if (parentSeg) {
    const parentName = clusterParentDisplay(clusters[0]);
    aggCrumbs.push({ name: parentName ?? parentSeg, href: `${PATH}/${COUNTRY_URL_SEGMENT[countryCode]}/${parentSeg}` });
  }

  const aggJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${COUNTRY_DISPLAY[countryCode] ?? countryCode} ${c.breadcrumb}`,
    url: `${BASE}${p(`${PATH}/${segments.join("/")}`)}`,
    numberOfItems: clusters.length,
    itemListElement: clusters.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      url: `${BASE}${p(buildClusterCanonicalPath(toInput(x)))}`,
    })),
  };

  const heading =
    parentSeg && clusterParentDisplay(clusters[0])
      ? `${clusterParentDisplay(clusters[0])} · ${COUNTRY_DISPLAY[countryCode]}`
      : COUNTRY_DISPLAY[countryCode] ?? countryCode;

  return (
    <main className="container py-12">
      <JsonLd data={aggJsonLd} />

      <nav className="mb-4 text-sm text-[#64748b]" aria-label="Breadcrumb">
        {aggCrumbs.map((cr, i) => (
          <span key={cr.href}>
            {i > 0 && " / "}
            {i < aggCrumbs.length - 1 ? (
              <Link href={p(cr.href)} className="hover:underline">
                {cr.name}
              </Link>
            ) : (
              <span>{cr.name}</span>
            )}
          </span>
        ))}
      </nav>

      <section className="max-w-3xl mb-10">
        <h1 className="text-4xl font-extrabold text-[#0f172a]">{heading}</h1>
        <p className="text-[#64748b] mt-3 text-lg">{c.lead}</p>
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        {clusters.map((x) => {
          const place = [x.country, x.region, x.province, x.city].filter(
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
                href={p(buildClusterCanonicalPath(toInput(x)))}
                className="btn btn-outline mt-5 self-start"
              >
                {c.viewSuppliers}
              </Link>
            </div>
          );
        })}
      </section>
    </main>
  );
}

export const dynamic = "force-dynamic";
