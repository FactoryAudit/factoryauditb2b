import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import RegisterForm from "@/components/RegisterForm";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { FREE_PROFILE_LIMIT, ANALYTICS_EVENTS } from "@/lib/suppliers";

const PATH = "/register";
const BASE = "https://factoryauditb2b.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.register.metaTitle,
    description: t.register.metaDesc,
  });
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const r = t.register;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: r.h1,
    url: `${BASE}${p(PATH)}`,
    description: r.metaDesc,
  };

  return (
    <main
      className="container py-12 max-w-4xl"
      data-track-page={ANALYTICS_EVENTS.registerView}
    >
      <JsonLd data={jsonLd} />

      <section className="mb-8">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {r.badge}
        </span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">{r.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-3xl">{r.lead}</p>
      </section>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* 权益说明（先价值后表单） */}
        <section>
          <h2 className="text-xl font-bold text-[#0f172a] mb-3">{r.benefitsTitle}</h2>
          <ul className="space-y-3">
            {r.benefits.map((b: string) => (
              <li key={b} className="flex gap-3 text-sm text-[#475569]">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#e6eef6] text-[#0f4c81] text-xs flex items-center justify-center font-bold">
                  ✓
                </span>
                {b.replace("{n}", String(FREE_PROFILE_LIMIT))}
              </li>
            ))}
          </ul>

          <div className="card p-5 mt-6 bg-[#f7f9fc]">
            <h3 className="font-semibold text-[#0f172a]">{r.nextTitle}</h3>
            <p className="text-sm text-[#475569] mt-1">{r.nextLead}</p>
          </div>

          <p className="text-xs text-[#64748b] mt-4">
            {r.noCard}{" "}
            <Link href={p("/membership")} className="text-[#0f4c81] underline">
              {r.membershipLink}
            </Link>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#0f172a] mb-3">{r.formTitle}</h2>
          <RegisterForm t={r.form} />
        </section>
      </div>
    </main>
  );
}
