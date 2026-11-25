import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import CategoryDirectoryBrowser, {
  type CategorySupplierLite,
  type CategoryLinkLite,
} from "@/components/category/CategoryDirectoryBrowser";
import { listSuppliersByIndustry } from "@/lib/queries";
import { listIndustries, industryDisplayName } from "@/lib/taxonomy";
import { countryDisplayName } from "@/lib/countryNames";
import { supplierDisplayName } from "@/lib/supplierDisplayName";
import {
  CATEGORY_DIRECTORY,
  assertCategoryDensity,
  getCategoryDirectoryEntry,
} from "@/lib/categoryDirectory";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";

type Props = { params: Promise<{ locale: string; slug: string }> };

// 9 语 × 5 品类，构建期全量预渲染（与 sitemap 同源）。
export async function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    CATEGORY_DIRECTORY.map((c) => ({ locale, slug: c.slug }))
  );
}

// 密度闸门：任一品类供应商掉到阈值以下 ⇒ build 失败，不允许开空页。
let densityChecked = false;
function checkAllDensity(counts: Map<string, number>) {
  if (densityChecked) return;
  for (const c of CATEGORY_DIRECTORY) {
    const verdict = assertCategoryDensity(c.slug, counts.get(c.slug) ?? 0);
    if (!verdict.ok) {
      throw new Error(
        `[category-directory] 品类 ${c.slug} 仅 ${verdict.count} 家（需 >= ${verdict.min}）；` +
          `拒绝渲染空页，请先补足真实供应商或下调清单。`
      );
    }
  }
  densityChecked = true;
}

async function resolve(locale: Locale, slug: string) {
  const entry = getCategoryDirectoryEntry(slug);
  if (!entry) return null;
  const t = await getDictionary(locale);
  const suppliers = await listSuppliersByIndustry(slug);
  const verdict = assertCategoryDensity(slug, suppliers.length);
  if (!verdict.ok) return null; // 密度掉了 ⇒ 该页 404，绝不渲染空壳
  const industries = await listIndustries();
  const tax = industries.find((i) => i.code === slug);
  const label = tax ? industryDisplayName(locale, tax.name) : entry.label;
  return { entry, suppliers, t, label };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const r = await resolve(locale, slug);
  if (!r) return buildPageMetadata({ locale, path: "/categories", title: "", description: "" });
  const { t, label } = r;
  const title = `${t.industryPage.pageTitle} — ${label}`;
  const description = t.industryPage.metaDesc.replaceAll("{industry}", label);
  return buildPageMetadata({
    locale,
    path: `/categories/${slug}`,
    title,
    description,
    robots: { index: true, follow: true },
  });
}

export default async function CategoryDirectoryPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const r = await resolve(locale, slug);
  if (!r) notFound();

  const { suppliers, t, label } = r;
  const p = (href: string) => localePath(locale, href);

  // build 期全量密度断言（用真实查询数，不用 observedCount 文档值）
  const counts = new Map<string, number>();
  await Promise.all(
    CATEGORY_DIRECTORY.map(async (c) => {
      counts.set(c.slug, (await listSuppliersByIndustry(c.slug)).length);
    })
  );
  checkAllDensity(counts);

  // 客户端浏览器消费的公开数据：服务端预生成显示名/国名/带语种前缀的 href。
  const liteSuppliers: CategorySupplierLite[] = suppliers.map((s) => ({
    supplier: s,
    displayName: supplierDisplayName(locale, s),
    countryName: countryDisplayName(locale, s.countryCode, "") || s.countryCode || "—",
    href: p(`/suppliers/${s.slug}`),
  }));

  // 行业侧栏：只列真实够密度的品类（含各自计数），当前品类高亮。
  const liteCategories: CategoryLinkLite[] = CATEGORY_DIRECTORY.map((c) => ({
    slug: c.slug,
    label: c.label,
    count: counts.get(c.slug) ?? c.observedCount,
    href: p(`/categories/${c.slug}`),
    active: c.slug === slug,
  }));

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${label} — ${t.industryPage.pageTitle}`,
      url: `${BASE}${p(`/categories/${slug}`)}`,
      numberOfItems: suppliers.length,
      itemListElement: suppliers.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE}${p(`/suppliers/${s.slug}`)}`,
      })),
    },
  ];

  // 文案全部复用既有字典键，零新增翻译叶子（守住 9 语 3351 不变量）。
  return (
    <main className="container py-10">
      <JsonLd data={jsonLd} />

      <nav className="text-sm text-[#6d6b66] mb-6" aria-label={t.suppliers.h1}>
        <Link href={p("/")} className="hover:underline">
          {t.brand.name}
        </Link>
        <span className="mx-2">/</span>
        <Link href={p("/suppliers")} className="hover:underline">
          {t.suppliers.h1}
        </Link>
        <span className="mx-2">/</span>
        <span>{label}</span>
      </nav>

      <CategoryDirectoryBrowser
        locale={locale}
        title={`${label} — ${t.industryPage.pageTitle}`}
        subtitle={t.industryPage.metaDesc.replaceAll("{industry}", label)}
        suppliers={liteSuppliers}
        categories={liteCategories}
        backHref={p("/suppliers")}
        backLabel={t.suppliers.h1}
        labels={{
          filterCountry: t.suppliers.filterCountry,
          filterIndustry: t.suppliers.filterIndustry,
          filterProduct: t.suppliers.filterProduct,
          scoredOnly: t.suppliers.riskLabel,
          countLabel: t.suppliers.countLabel,
          sortByScore: t.toolsUi.scorecard.scoreLabel,
          sortByName: t.claim.companyNameLabel,
          employeesLabel: t.supplierProfile.employeesLabel,
          establishedTemplate: t.supplierProfile.established,
          selfReported: t.supplierProfile.selfReported,
          viewAllCategories: t.nav.more,
        }}
      />
    </main>
  );
}
