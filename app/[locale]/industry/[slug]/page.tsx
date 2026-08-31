import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSeoMatrix, getSupplierCapabilitiesResolved, listIndustries } from "@/lib/taxonomy";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALES, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import JsonLd from "@/components/JsonLd";
import WhatsAppLink from "@/components/WhatsAppLink";

const BASE = "https://factoryauditb2b.com";

type Params = { locale: string; slug: string };

export async function generateStaticParams() {
  const industries = await listIndustries();
  return LOCALES.flatMap((locale) => industries.map((i) => ({ locale, slug: i.code })));
}

async function resolve(slug: string) {
  const industry = await prisma.industry.findUnique({ where: { code: slug } });
  if (!industry) notFound();
  return industry;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const industry = await resolve(slug);
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
  const industry = await resolve(slug);
  const p = t.industryPage;

  const suppliers = await prisma.supplier.findMany({
    where: { industryCode: slug },
    orderBy: { riskScore: "asc" },
    take: 20,
  });
  const capsBySupplier = await Promise.all(
    suppliers.map(async (s) => ({
      s,
      caps: await getSupplierCapabilitiesResolved(s.id),
    }))
  );

  const { auditTypes } = await getSeoMatrix();

  // 只有 getSeoMatrix() 返回的 auditTypes 才有对应的 /audit-guide/{country}/{code} 页面
  // （它按 isAudit=true 过滤）。供应商能力表里可能挂着 WRAP 这类 isAudit=false 的项，
  // 直接渲染会产生 404 死链，所以这里必须按有效 code 集合过滤。
  const validAuditCodes = new Set(auditTypes.map((a) => a.code));

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
              // /industry 没有索引页，面包屑指向真实存在的供应商目录，避免结构化数据里的死链
              { "@type": "ListItem", position: 2, name: p.breadcrumb, item: `${BASE}/suppliers` },
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
        <a href={lp("/")} className="hover:underline">Home</a> / {p.breadcrumb} / {industry.name}
      </nav>

      <h1 className="text-3xl font-bold">{industry.name} {p.pageTitle}</h1>
      {industry.description && <p className="mt-2 max-w-3xl text-gray-600">{industry.description}</p>}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{p.relatedAudit}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {auditTypes.map((a) => (
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
              <li key={s.id} className="p-3">
                <a href={lp(`/supplier/${s.countryCode}/${s.slug}`)} className="font-medium hover:underline">
                  {s.legalName}
                </a>
                <span className="ml-2 text-sm text-gray-500">
                  {s.city} · {s.countryCode} · {p.riskLabel} {s.riskLevel || "—"}
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

      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">{p.ctaTitle.replaceAll("{industry}", industry.name)}</h2>
        <p className="mt-1 text-sm text-[#475569]">{p.ctaDesc.replaceAll("{industry}", industry.name)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={lp("/training-plans")} className="btn btn-primary inline-block">
            {p.ctaButton}
          </a>
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
