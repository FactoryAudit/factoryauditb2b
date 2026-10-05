import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import ContactForm from "@/components/ContactForm";
import WhatsAppLink, { whatsappConfigured } from "@/components/WhatsAppLink";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";
import { getDictionary } from "@/i18n/getDictionary";
import { operatorEmail } from "@/lib/aboutContent";

const PATH = "/contact";
const BASE = "https://factoryauditb2b.com";

/**
 * 联系页。
 *
 * 为什么单独建这一页：
 *   此前全站没有 /contact —— 访客想找人只能翻页脚的邮箱。询盘主入口缺失，
 *   而联系页恰恰是「搜索品牌词 + contact」这类高意图流量的落点。
 *
 * 表单去向：复用 /api/lead（tool:"contact"），落库 + 管理员通知 + 客户回执 + 限流，
 *   不新建接口、不重复实现护栏。见 components/ContactForm.tsx 顶部说明。
 *
 * 文案口径（沿用全站铁律）：只承诺「一个工作日内回复」，
 *   不承诺具体交付物、不做"保证找到供应商"之类的无据声称。
 */

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.contact;
  return buildPageMetadata({
    locale,
    path: PATH,
    title: c.metaTitle,
    description: c.metaDesc,
  });
}

export default async function ContactPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.contact;
  const p = (href: string) => localePath(locale, href);
  const email = operatorEmail();

  return (
    <main className="container py-12 max-w-4xl">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: c.title,
            description: c.metaDesc,
            url: `${BASE}${p(PATH)}`,
            mainEntity: {
              "@type": "Organization",
              "@id": `${BASE}/#organization`,
              name: "FactoryAuditB2B",
              email,
              url: BASE,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: t.common.ui.home, item: `${BASE}${p("/")}` },
              { "@type": "ListItem", position: 2, name: c.title, item: `${BASE}${p(PATH)}` },
            ],
          },
        ]}
      />

      <header>
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          {c.eyebrow}
        </span>
        <h1 className="text-4xl font-extrabold text-[#171717] mt-2 leading-tight">{c.title}</h1>
        <p className="text-[#6d6b66] mt-4 text-lg max-w-3xl">{c.lead}</p>
      </header>

      {/* 直接联系方式：不装 WhatsApp 的访客也能走邮箱，两条路都给 */}
      <section className="mt-8 rounded-lg bg-[#f5f3ee] p-6">
        <h2 className="text-lg font-semibold text-[#171717]">{c.directTitle}</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <span className="text-[#2b2b2b]">
            {c.emailLabel}:{" "}
            <a href={`mailto:${email}`} className="text-[#171717] underline">
              {email}
            </a>
          </span>
          {whatsappConfigured() && (
            <WhatsAppLink
              label="WhatsApp"
              message="Hi FactoryAuditB2B, I would like to ask about supplier verification."
              className="inline-block rounded bg-[#25D366] px-3 py-2 text-sm font-medium text-[#0a3320] hover:opacity-90"
            />
          )}
        </div>
        <p className="mt-3 text-sm text-[#6d6b66]">{c.responseNote}</p>
      </section>

      {/* 表单 */}
      <section className="mt-10">
        <ContactForm copy={c.form} />
      </section>

      {/* 其他入口 */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-[#171717]">{c.altTitle}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link href={p("/rfq")} className="card p-5 hover:border-[#171717]">
            <h3 className="font-bold text-[#171717]">{c.rfqTitle}</h3>
            <p className="mt-2 text-sm text-[#3f4650] leading-relaxed">{c.rfqBody}</p>
          </Link>
          <Link href={p("/join-supplier-network")} className="card p-5 hover:border-[#171717]">
            <h3 className="font-bold text-[#171717]">{c.supplierTitle}</h3>
            <p className="mt-2 text-sm text-[#3f4650] leading-relaxed">{c.supplierBody}</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
