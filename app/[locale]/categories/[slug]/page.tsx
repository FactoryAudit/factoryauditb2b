import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import CategorySupplierCard from "@/components/category/CategorySupplierCard";
import { listSuppliersByIndustry } from "@/lib/queries";
import { listIndustries, industryDisplayName } from "@/lib/taxonomy";
import {
  CATEGORY_DIRECTORY,
  assertCategoryDensity,
  getCategoryDirectoryEntry,
} from "@/lib/categoryDirectory";
import { overallLevel } from "@/lib/riskEngine";
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
// 只在 build 期（generateStaticParams 之后首个页面渲染）断言一次即可，用模块级 Set 去重。
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

  const { entry, suppliers, t, label } = r;
  const p = (href: string) => localePath(locale, href);

  // build 期全量密度断言（用真实查询数，不用 observedCount 文档值）
  const counts = new Map<string, number>();
  await Promise.all(
    CATEGORY_DIRECTORY.map(async (c) => {
      counts.set(c.slug, (await listSuppliersByIndustry(c.slug)).length);
    })
  );
  checkAllDensity(counts);

  const hasRisk = (score: number | null): score is number => typeof score === "number";

  const cardLabels = {
    viewSupplier: t.suppliers.cardCta,
    riskLabel: t.suppliers.riskLabel,
    employeesLabel: t.supplierProfile.employeesLabel,
    riskLevelText: "", // 逐卡按分数填
  };

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

  return (
    <main className="container py-12">
      <JsonLd data={jsonLd} />

      <nav className="text-sm text-[#6d6b66] mb-4">
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

      <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
        {t.suppliers.heroBadge}
      </span>
      <h1 className="text-3xl font-bold text-[#171717] mt-2">
        {label} — {t.industryPage.pageTitle}
      </h1>
      <p className="text-[#6d6b66] mt-2 max-w-3xl">
        {t.industryPage.metaDesc.replaceAll("{industry}", label)}
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-[#171717]">
          {t.industryPage.verifiedSuppliers.replaceAll("{industry}", label)} ({suppliers.length})
        </h2>
        <p className="text-sm text-[#6d6b66] mt-2 max-w-2xl">{t.suppliers.trustNote}</p>
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {suppliers.map((s) => (
            <CategorySupplierCard
              key={s.slug}
              supplier={s}
              locale={locale}
              href={p(`/suppliers/${s.slug}`)}
              labels={{
                ...cardLabels,
                riskLevelText: hasRisk(s.riskScore)
                  ? t.risk.ui.level[overallLevel(s.riskScore)]
                  : "",
              }}
            />
          ))}
        </ul>
      </section>

      {/* 品类间互链：只列真实够密度的品类，避免死链与空页 */}
      <section className="mt-10 card p-6">
        <h2 className="text-lg font-semibold text-[#171717]">{t.suppliers.h1}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_DIRECTORY.map((c) => (
            <Link
              key={c.slug}
              href={p(`/categories/${c.slug}`)}
              className={`rounded-full px-3 py-1 text-sm ${
                c.slug === slug
                  ? "bg-[#171717] text-white"
                  : "bg-[#f5f3ee] text-[#171717] hover:underline"
              }`}
            >
              {c.label} ({counts.get(c.slug) ?? c.observedCount})
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <Link href={p("/suppliers")} className="text-sm text-[#e07a49] font-medium hover:underline">
          ← {t.suppliers.h1}
        </Link>
      </section>
    </main>
  );
}
