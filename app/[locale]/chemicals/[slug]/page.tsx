import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CHEMICALS, findChemical } from "@/lib/chemicals";
import { industryDisplayName, listIndustries } from "@/lib/taxonomy";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata, trimMetaDescription } from "@/lib/pageMeta";
import { pickZhPair, twText } from "@/lib/tw";
import JsonLd from "@/components/JsonLd";
import RfqForm from "@/components/RfqForm";

const BASE = "https://factoryauditb2b.com";
// 🔴 化工行业的 RFQ 落在 industry_code = chemicals 下；
//    没有「化学品」这张表，也不为此改数据库 —— 具体品种靠 source_path + product 承载。
const INDUSTRY_CODE = "chemicals";

type Params = { locale: string; slug: string };

export const dynamicParams = false;

export async function generateStaticParams() {
  return LOCALES.flatMap((locale) => CHEMICALS.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const chem = findChemical(slug);
  if (!chem) {
    return buildPageMetadata({
      locale,
      path: `/chemicals/${slug}`,
      title: "Chemical",
      description: "Chemical raw material.",
      robots: { index: false },
    });
  }
  const t = await getDictionary(locale);
  const name = pickZhPair(locale, chem.nameEn, chem.nameZh);
  // ★ 工单 SEO-20260918-FAB 任务 2.1 —— 化工详情页的 title / description 收口。
  //
  // 实测（2026-09-18，读构建产物逐页量取）：本模板是全站最长的标题族。
  //   · title  48–124 字符 / 最高 1,121px（fr）—— Google 桌面端标题区约 600px，
  //            等于被砍掉近一半。成因是三段拼接：品种名 + CAS（最长约 32 字符）
  //            + `chemicals.metaTitle`（fr 70 / es 64 / pt 63 / de 59 字符，
  //            而它是**列表页**的关键词堆叠串）+ 品牌后缀（18 字符）。
  //   · desc   169–200 字符，且 `.slice(0, 200)` 把正文截在句中——
  //            实测 fr 版以「…whiteness, 」结尾（半个清单，缺收尾）。
  //
  // 修法（只改模板，不动那 212 个分散页面）：
  //   ① 标题尾部改用**短标签** `chemicals.detailTitleTail`（≤25 字符，9 语齐备），
  //      并去掉品牌后缀（`withBrand: false`）—— 18 字符的品牌位是这 60 字符
  //      预算里最贵的一段，而 Google 现已单独展示站点名，删它不损失品牌识别。
  //      结果：9 语 × 6 品种的 title 全部 ≤ 60 字符 / ≤ ~560px。
  //   ② 描述改走 `trimMetaDescription()`：按书写系统给预算（CJK 90 / 拉丁 158），
  //      并在句末标点处收尾，不再是半句话。
  //
  // ⚠️ 未做（需人工内容，不属代码范围）：化学品正文（application / compliance）
  //    只有 en / zh 两版，`pickZhPair` 对 ja/de/fr/es/pt/ar 一律回落英文 ⇒
  //    **这 6 个语言的详情页正文与描述目前都是英文**。要真正本地化描述，需要
  //    6 语言 × 6 品种的译文（36 条）。按项目「不编造」铁律，此处不代为翻译。
  return buildPageMetadata({
    locale,
    path: `/chemicals/${slug}`,
    title: `${name} (CAS ${chem.cas}) — ${t.chemicals.detailTitleTail}`,
    withBrand: false,
    description: trimMetaDescription(pickZhPair(locale, chem.application.en, chem.application.zh)),
  });
}

export default async function ChemicalPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const lp = (href: string) => localePath(locale, href);
  const c = t.chemicals;

  const chem = findChemical(slug);
  if (!chem) notFound();

  const name = pickZhPair(locale, chem.nameEn, chem.nameZh);
  const industries = await listIndustries();
  const downstream = chem.downstream
    .map((code) => industries.find((i) => i.code === code))
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map((i) => ({ code: i.code, name: industryDisplayName(locale, i.name) }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${name} (CAS ${chem.cas})`,
            description: pickZhPair(locale, chem.application.en, chem.application.zh),
            inLanguage: locale,
            url: `${BASE}${lp(`/chemicals/${slug}`)}`,
            publisher: { "@id": `${BASE}/#organization` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              { "@type": "ListItem", position: 2, name: c.metaTitle, item: `${BASE}/chemicals` },
              { "@type": "ListItem", position: 3, name, item: `${BASE}/chemicals/${slug}` },
            ],
          },
        ]}
      />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={lp("/")} className="hover:underline">{t.common.ui.home}</Link> /{" "}
        <Link href={lp("/chemicals")} className="hover:underline">{c.metaTitle}</Link> / {name}
      </nav>

      <h1 className="text-3xl font-bold">{name}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {c.casLabel}: <span className="font-mono">{chem.cas}</span>
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">{c.synonymsLabel}</h2>
        {/* 🔴 同义词是数组，不能像正文那样走 pickZhPair —— zh-TW 下必须逐条繁化。
            此前直接取 synonyms.zh 原样输出，导致繁体页里出现简体「柠檬酸」。 */}
        <p className="mt-2 text-gray-600">
          {(locale === "zh" || locale === "zh-TW" ? chem.synonyms.zh : chem.synonyms.en)
            .map((x) => (locale === "zh-TW" ? twText(x) : x))
            .join(" · ")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{c.applicationLabel}</h2>
        <p className="mt-2 text-gray-600">
          {pickZhPair(locale, chem.application.en, chem.application.zh)}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{c.complianceLabel}</h2>
        <p className="mt-2 text-gray-600">
          {pickZhPair(locale, chem.compliance.en, chem.compliance.zh)}
        </p>
      </section>

      {downstream.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{c.relatedIndustries}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {downstream.map((i) => (
              <Link
                key={i.code}
                href={lp(`/industry/${i.code}`)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
              >
                {i.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA：把「化学品」作为合法 context 带进 RFQ ——
          industry_code=chemicals（已有列）+ source_path（已有列）+ product 预填。
          不新增任何数据库列，也不注入 certifications_req（买家还没说要什么证书）。 */}
      <section className="mt-10 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">
          {t.industryPage.ctaTitle.replaceAll("{industry}", name)}
        </h2>
        <p className="mt-1 text-sm text-[#475569]">
          {t.industryPage.ctaDesc.replaceAll("{industry}", name)}
        </p>
        <div className="mt-4">
          <RfqForm
            t={t.rfq.form}
            context={{
              locale,
              industryCode: INDUSTRY_CODE,
              sourcePath: `/chemicals/${slug}`,
              defaultProduct: name,
            }}
          />
        </div>
      </section>
    </main>
  );
}
