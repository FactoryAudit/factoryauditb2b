import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import JsonLd from "@/components/JsonLd";
import { getTrustConfig } from "@/lib/trust";

const PATH = "/about";
const BASE = "https://factoryauditb2b.com";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.about.metaTitle,
    description: t.about.metaDesc,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const a = t.about;
  const lp = (href: string) => localePath(locale, href);
  const trustConfig = getTrustConfig();
  const trustConfigured = trustConfig.configured;
  const trustEntity = trustConfig.legalEntity;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: a.h1,
            description: a.metaDesc,
            mainEntity: { "@type": "Organization", name: "FactoryAuditB2B", url: BASE },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              { "@type": "ListItem", position: 2, name: a.h1, item: `${BASE}${lp(PATH)}` },
            ],
          },
        ]}
      />

      <nav className="mb-6 text-sm text-[#64748b]">
        <Link href={lp("/")} className="hover:underline">
          Home
        </Link>{" "}
        / {a.h1}
      </nav>

      <h1 className="text-3xl font-bold text-[#0f172a]">{a.h1}</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#475569]">{a.lead}</p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[#0f172a]">{a.statsTitle}</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {a.stats.map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-2xl font-extrabold text-[#0f4c81]">{s.value}</div>
              <div className="mt-1 text-xs text-[#64748b]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-[#0f172a]">{a.storyTitle}</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[#475569]">{a.storyBody}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-[#0f172a]">{a.valuesTitle}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {a.values.map((v) => (
            <div key={v.title} className="card p-5">
              <div className="font-semibold text-[#0f172a]">{v.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 公司身份：品牌名 ≠ 法律主体，且未配置时不渲染任何公司信息 */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-[#0f172a]">{t.trust.operatesTitle}</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-[#475569]">
          {trustConfigured
            ? t.trust.operatesBody.replace("{entity}", trustEntity)
            : t.trust.operatesNotConfigured}
        </p>
        <p className="mt-2 max-w-3xl text-sm text-[#64748b]">{t.trust.scopeBody}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={lp("/trust")} className="btn btn-outline">
            {t.footer.trustCenter}
          </Link>
        </div>
      </section>

      <section className="mt-12 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="font-semibold text-[#0f172a]">{a.ctaTitle}</h2>
        <p className="mt-1 text-sm text-[#475569]">{a.ctaDesc}</p>
        <Link href={lp("/custom-services")} className="btn btn-primary mt-4 inline-block">
          {a.ctaButton}
        </Link>
      </section>
    </main>
  );
}
