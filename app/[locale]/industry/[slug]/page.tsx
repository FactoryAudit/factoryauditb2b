import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getSeoMatrix, getSupplierCapabilitiesResolved, industryDisplayName, listIndustries } from "@/lib/taxonomy";
import { listSuppliersByIndustry } from "@/lib/queries";
import { overallLevel } from "@/lib/riskEngine";
import { industryCopy, topicsForIndustry } from "@/lib/industryContent";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhPair } from "@/lib/tw";
import JsonLd from "@/components/JsonLd";
import WhatsAppLink from "@/components/WhatsAppLink";
import RfqForm from "@/components/RfqForm";

const BASE = "https://factoryauditb2b.com";

type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  const industries = await listIndustries();
  return LOCALES.flatMap((locale) => industries.map((i) => ({ locale, slug: i.code })));
}

async function resolve(slug: string, locale: string) {
  const industries = await listIndustries();
  const industry = industries.find((i) => i.code === slug);
  if (!industry) notFound();
  // name 在 zh-TW 下就地繁化（「Electronics / 电子」→「Electronics / 電子」）
  return { code: industry.code, name: industryDisplayName(locale, industry.name), description: null };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const industry = await resolve(slug, locale);
  const t = await getDictionary(locale);
  const title = `${industry.name} ${t.industryPage.pageTitle}`;
  const description = t.industryPage.metaDesc.replaceAll("{industry}", industry.name);
  return buildPageMetadata({ locale, path: `/industry/${slug}`, title, description });
}

export default async function IndustryPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const lp = (href: string) => localePath(locale, href);
  const industry = await resolve(slug, locale);
  const p = t.industryPage;

  const suppliers = await listSuppliersByIndustry(slug);
  // 内容层只有 en/zh 两版：zh-TW 走 zh 文案并在函数内繁化，其余语言一律 en。
  const contentLocale: "en" | "zh" | "zh-TW" =
    locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh" : "en";
  const capsBySupplier = await Promise.all(
    suppliers.map(async (s) => ({
      s,
      caps: await getSupplierCapabilitiesResolved(s.slug, contentLocale),
    }))
  );

  const { auditTypes } = await getSeoMatrix();

  // 只有 getSeoMatrix() 返回的 auditTypes 才有对应的 /audit-guide/{country}/{code} 页面
  // （它按 isAudit=true 过滤）。供应商能力表里可能挂着 WRAP 这类 isAudit=false 的项，
  // 直接渲染会产生 404 死链，所以这里必须按有效 code 集合过滤。
  const validAuditCodes = new Set(auditTypes.map((a) => a.code));

  // Block A / Block B 的行业差异化内容全部来自 lib/industryContent.ts。
  // 未配置行业的 copy / topics 均为空 ⇒ 两块整块不渲染，绝不套模板话术。
  const copy = industryCopy(slug);
  const topics = topicsForIndustry(slug);

  // 行业相关审核项目：从该行业的子主题里收集 programCode（数据驱动，无行业分支）。
  // 排序时把它们顶到前面，其余保持原有字母序 —— 对没有子主题的行业完全无变化。
  const industryPrograms = new Set(
    topics.flatMap((tp) => tp.programCodes ?? (tp.programCode ? [tp.programCode] : []))
  );
  const orderedAuditTypes =
    industryPrograms.size === 0
      ? auditTypes
      : [...auditTypes].sort((a, b) => {
          const av = industryPrograms.has(a.code) ? 0 : 1;
          const bv = industryPrograms.has(b.code) ? 0 : 1;
          return av - bv || a.code.localeCompare(b.code);
        });

  // 行业页的审核类型链接需要国家维度：取该行业供应商最集中的国家，没有则回退 china
  const countryCount = suppliers.reduce<Record<string, number>>((acc, s) => {
    acc[s.countryCode] = (acc[s.countryCode] ?? 0) + 1;
    return acc;
  }, {});
  const primaryCountry =
    Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "china";

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: `${industry.name} Supplier Verification & Training`,
            description: p.metaDesc.replaceAll("{industry}", industry.name),
            serviceType: "Supplier Verification",
            areaServed: industry.name,
            provider: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              // CS-02A：/industry 索引页已建成，面包屑回到真实存在的行业索引，
              // 不再借用 /suppliers 凑数（结构化数据里不得出现降级死链）。
              { "@type": "ListItem", position: 2, name: p.breadcrumb, item: `${BASE}/industry` },
              { "@type": "ListItem", position: 3, name: industry.name, item: `${BASE}/industry/${slug}` },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: p.whyTitle.replaceAll("{industry}", industry.name),
                acceptedAnswer: { "@type": "Answer", text: p.whyLead },
              },
            ],
          },
        ]}
      />

      <nav className="mb-4 text-sm text-gray-500">
        <Link href={lp("/")} className="hover:underline">{t.common.ui.home}</Link> /{" "}
        <Link href={lp("/industry")} className="hover:underline">{p.breadcrumb}</Link> / {industry.name}
      </nav>

      <h1 className="text-3xl font-bold">{industry.name} {p.pageTitle}</h1>
      {industry.description && <p className="mt-2 max-w-3xl text-gray-600">{industry.description}</p>}

      {/* Block A：行业特殊性。只在配置了该行业差异化文案时渲染。 */}
      {copy?.differenceTitle && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">
            {pickZhPair(locale, copy.differenceTitle.en, copy.differenceTitle.zh)}
          </h2>
          <div className="mt-3 space-y-3 text-gray-600 max-w-3xl">
            {(copy.differenceBody ?? []).map((b, i) => (
              <p key={i}>{pickZhPair(locale, b.en, b.zh)}</p>
            ))}
          </div>
        </section>
      )}

      {/* whyTitle / whyLead 此前只出现在 JSON-LD FAQPage 里、页面上根本看不见，
          属于「结构化数据与可见内容不一致」的隐患。这里补上可见渲染。 */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">{p.whyTitle.replaceAll("{industry}", industry.name)}</h2>
        <p className="mt-2 max-w-3xl text-gray-600">{p.whyLead}</p>
      </section>

      {/* Block B：行业子主题（P2–P5）。只在配置了该行业子主题时渲染。 */}
      {topics.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">{p.topicsTitle.replaceAll("{industry}", industry.name)}</h2>
          <ul className="mt-3 space-y-2">
            {topics.map((tp) => (
              <li key={tp.slug}>
                <Link
                  href={lp(`/industry/${slug}/${tp.slug}`)}
                  className="text-[#0f4c81] hover:underline"
                >
                  {pickZhPair(locale, tp.title.en, tp.title.zh)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{p.relatedAudit}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {orderedAuditTypes.map((a) => (
            <Link
              key={a.code}
              href={lp(`/audit-guide/${primaryCountry}/${a.code}`)}
              className="rounded-full bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
            >
              {a.nameEn}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{p.verifiedSuppliers.replaceAll("{industry}", industry.name)} ({suppliers.length})</h2>
        {suppliers.length === 0 ? (
          <p className="mt-2 text-gray-500">{p.empty.replaceAll("{industry}", industry.name)}</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {capsBySupplier.map(({ s, caps }) => (
              <li key={s.slug} className="p-3">
                <a href={lp(`/suppliers/${s.slug}`)} className="font-medium hover:underline">
                  {s.legalName}
                </a>
                <span className="ml-2 text-sm text-gray-500">
                  {s.city} · {s.countryCode} · {p.riskLabel}{" "}
                  {/* 🔴 无分数（null）必须显示「—」。旧的 `{s.riskScore} / 100` 在 null 下
                      会渲染成「0 / 100 · High risk」——对真实企业的诋毁性陈述。 */}
                  {typeof s.riskScore === "number"
                    ? `${s.riskScore} / 100 · ${t.risk.ui.level[overallLevel(s.riskScore)]}`
                    : "—"}
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {caps
                    .filter((c) => c.refType === "AUDIT_TYPE" && validAuditCodes.has(c.refCode))
                    .slice(0, 6)
                    .map((c) => (
                      <Link
                        key={c.refCode}
                        href={lp(`/audit-guide/${s.countryCode}/${c.refCode}`)}
                        className="rounded bg-[#eef2f7] px-2 py-0.5 text-xs text-[#0f4c81] hover:underline"
                      >
                        {c.label}
                      </Link>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* CTA：CS-02A 起改为内嵌 RFQ 表单（CS-02C G3 落库通道），
          并注入行业上下文 + 来源路径，用于 CS-02 ROI 归因。
          certifications_req 一律不注入 —— 买家还没说要什么证书，绝不替他编。 */}
      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">{p.ctaTitle.replaceAll("{industry}", industry.name)}</h2>
        <p className="mt-1 text-sm text-[#475569]">{p.ctaDesc.replaceAll("{industry}", industry.name)}</p>
        <div className="mt-4">
          <RfqForm
            t={t.rfq.form}
            context={{ locale, industryCode: slug, sourcePath: `/industry/${slug}` }}
          />
        </div>
        <div className="mt-3">
          <WhatsAppLink
            label={t.common.whatsappChat}
            message={`Hi FactoryAuditB2B, I would like to ask about supplier verification for ${industry.name}.`}
            className="btn btn-outline inline-block"
          />
        </div>
      </section>
    </main>
  );
}
