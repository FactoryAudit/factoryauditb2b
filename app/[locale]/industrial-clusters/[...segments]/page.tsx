import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import {
  getPublishedClusterBySlug,
  listPublishedClusters,
  clusterDisplayName,
  clusterDisplayDescription,
  type IndustrialCluster,
} from "@/lib/industrialClusters";
import { listSuppliersByClusterSlug, countSuppliersByClusterSlugs } from "@/lib/queries";
import { overallLevel } from "@/lib/riskEngine";
import { supplierDisplayName } from "@/lib/supplierDisplayName";
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
// 🔴 stage1.8：本路由已由 force-dynamic 改为**预渲染（构建期冻结）**，
//    与 `industrial-clusters/page.tsx` 同一决策（详见该页尾部注释：TTFB 2.6–3.3s +
//    Workers Free CPU 10ms ⇒ 现场渲染是 5xx 主因；「改完即见」改为对齐供应商的
//    「改库 → 重新 build/deploy」流程）。`revalidate` 在 staticAssetsIncrementalCache
//    下等价于构建期冻结，不会每小时自更新。
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

// ── stage1.8：静态化（构建期冻结全部已发布产业带）──────────────────────────────
// 同一个 catch-all 路由同时承载「详情页」与「聚合页」，两类都要进静态产物：
//   · 详情页：8 个产业带 × 9 语 = **72 页**（canonical 层级路径）
//   · 聚合页：国家段（/china、/thailand…）与国家 + 省/市段（/china/guangdong…）
// 未列出的路径由 `dynamicParams`（默认 true）在运行时按需渲染 —— 新发布的产业带
// 不会 404，只是不进静态产物（因此也不享受「不进 Worker」的收益）。
// 中间层规则与 buildClusterCanonicalPath 严格一致：CN→省，VN/ID→市，TH→无（见 lib/clusterRoutes.ts）。
export async function generateStaticParams() {
  const clusters = await listPublishedClusters();
  const out: { segments: string[] }[] = [];
  const seen = new Set<string>();
  const push = (segments: string[]) => {
    if (segments.length === 0 || segments.length > 3) return;
    const key = segments.join("/");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ segments });
  };

  for (const c of clusters) {
    // 详情页 —— canonical 路径去掉 `/industrial-clusters` 前缀即是 segments
    const canonical = buildClusterCanonicalPath(toInput(c));
    if (canonical.startsWith(`${PATH}/`)) {
      push(canonical.slice(PATH.length + 1).split("/"));
    }
    const countrySeg = COUNTRY_URL_SEGMENT[c.country_code ?? ""];
    if (!countrySeg) continue;
    push([countrySeg]); // 国家聚合页
    const parent =
      c.country_code === "CN"
        ? c.province
        : c.country_code === "VN" || c.country_code === "ID"
          ? c.city
          : null;
    if (parent) push([countrySeg, slugifySegment(parent)]); // 省 / 市聚合页
  }
  return out;
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

// 每请求去重：generateMetadata 与页面组件各调用一次 resolveClusterRoute，
// 两次拿到的 segments 是**不同的数组实例**，直接 cache() 命中不了，
// 所以用 join("/") 的字符串做 key —— 省掉一整轮 Supabase 往返
// （聚合页尤其贵：listPublishedClusters() 是全表查询）。
const resolveClusterRouteCached = cache(async (key: string): Promise<Resolved> =>
  resolveClusterRoute(key === "" ? [] : key.split("/"))
);

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
  const resolved = await resolveClusterRouteCached(segments.join("/"));

  if (resolved.kind === "detail") {
    const { cluster, canonical } = resolved;
    // P1-15/P1-19：`seo_title`/`seo_description` 是**只有英文**的列，只能给 en 用。
    //   非 en 语种若仍让 seo_* 优先 ⇒ 8 个语种的 meta 全变英文（门禁① 128 条）。
    //   故按 locale 分流：en 用 seo_*（英文 SEO 专用字段）；其余 8 语本地化值优先，
    //   最终兜底是**已本地化**的字典模板，绝不回落到英文列。
    const isEn = locale === "en";
    const displayName = clusterDisplayName(locale, cluster);
    const displayDescription = clusterDisplayDescription(locale, cluster);
    const title = (
      isEn
        ? cluster.seo_title || displayName
        : displayName || cluster.seo_title || ""
    ).trim();
    const description = (
      isEn
        ? cluster.seo_description ||
          displayDescription ||
          t.clusters.detailMetaDesc.replace("{cluster}", displayName)
        : displayDescription || t.clusters.detailMetaDesc.replace("{cluster}", displayName)
    ).trim();
    return buildPageMetadata({
      locale,
      path: canonical,
      title,
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
  const resolved = await resolveClusterRouteCached(segments.join("/"));

  if (resolved.kind === "notfound") notFound();
  if (resolved.kind === "redirect") permanentRedirect(resolved.canonical);

  // ── 详情 ──
  if (resolved.kind === "detail") {
    const { cluster, canonical } = resolved;
    // P1-15：H1 / 导语 / breadcrumb 一律走本地化取值。
    const displayName = clusterDisplayName(locale, cluster);
    const displayDescription = clusterDisplayDescription(locale, cluster);
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
    crumbs.push({ name: displayName, href: canonical });

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
    if (cluster.province) facts.push({ label: c.provinceLabel, value: cluster.province });
    if (cluster.city) facts.push({ label: c.cityLabel, value: cluster.city });
    if (cluster.industry) facts.push({ label: c.industryLabel, value: cluster.industry });

    return (
      <main className="container py-12 max-w-4xl">
        <JsonLd data={jsonLd} />

        <nav className="mb-4 text-sm text-[#6d6b66]" aria-label="Breadcrumb">
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

        <h1 className="text-4xl font-extrabold text-[#171717]">{displayName}</h1>

        {displayDescription && (
          <p className="mt-3 text-lg text-[#3f4650]">{displayDescription}</p>
        )}

        {facts.length > 0 && (
          <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {facts.map((f) => (
              <div key={f.label} className="card p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#6d6b66]">
                  {f.label}
                </dt>
                <dd className="text-[#171717] font-medium mt-1">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-4 text-sm text-[#6d6b66]">
          {c.supplierCount.replace("{count}", String(suppliers.length))}
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-[#171717]">{c.suppliersTitle}</h2>
          {suppliers.length === 0 ? (
            <p className="mt-2 text-[#3f4650]">{c.suppliersEmpty}</p>
          ) : (
            <ul className="mt-3 divide-y rounded-lg border border-[#ebe8e1]">
              {suppliers.map((s) => (
                <li key={s.slug} className="flex items-center justify-between p-3">
                  <Link
                    href={p(`/suppliers/${s.slug}`)}
                    className="font-medium text-[#171717] hover:underline"
                  >
                    {supplierDisplayName(locale, s)}
                  </Link>
                  <span className="text-sm text-[#6d6b66]">
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
      name: clusterDisplayName(locale, x),
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

      <nav className="mb-4 text-sm text-[#6d6b66]" aria-label="Breadcrumb">
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
        <h1 className="text-4xl font-extrabold text-[#171717]">{heading}</h1>
        <p className="text-[#6d6b66] mt-3 text-lg">{c.lead}</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {clusters.map((x) => {
          const xName = clusterDisplayName(locale, x);
          const xDesc = clusterDisplayDescription(locale, x);
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
              <h2 className="text-2xl font-bold text-[#171717] mt-1">{xName}</h2>
              {x.industry && (
                <p className="text-sm font-medium text-[#171717] mt-2">{x.industry}</p>
              )}
              {xDesc && (
                <p className="text-sm text-[#3f4650] mt-2 flex-1">{xDesc}</p>
              )}
              <div className="mt-4 text-sm text-[#6d6b66]">
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

// stage1.8：预渲染（构建期冻结）。`revalidate` 在 staticAssetsIncrementalCache 下
// 等价于「永不自动更新」—— 改库后必须重新 build + deploy 才会生效。
// 🔴 不得声明 revalidate（2026-10-07 实测钉死）：OpenNext 的 cache interception 会**绕开**声明了 revalidate 的路由，改交给 Worker 运行时 SSR ⇒ prerender-manifest 里 initialRevalidateSeconds=3600 ⇒ 每请求现场渲染 ⇒ 撞 Workers 128MB 内存上限 ⇒ `error code: 1102` / HTTP 503 ⇒ Google 抓取失败、crawl budget 崩。只读 staticAssetsIncrementalCache 下 revalidate 本就永不生效（set() 是 no-op），删掉零功能损失；要真 ISR 请改 r2IncrementalCache（见 open-next.config.ts 注释）。
export const dynamicParams = true;
