import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import ContactForm from "@/components/ContactForm";
import WhatsAppLink, { whatsappConfigured } from "@/components/WhatsAppLink";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";
import { getDictionary } from "@/i18n/getDictionary";
import { operatorEmail } from "@/lib/aboutContent";
import {
  contactConfigured,
  contactPhoneDisplay,
  contactTelHref,
  WECHAT_QR_PATH,
} from "@/lib/contact";

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

      {/* 直接联系方式：邮箱 + 手机 / 微信 + WhatsApp，三条路都给。
          微信二维码只在中国大陆语境下有意义，但它同时也是「手机号」的可视载体 ——
          海外访客看到号码可以直接拨 / 存，不必理解微信是什么。 */}
      <section className="mt-8 rounded-lg bg-[#f5f3ee] p-6">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <h2 className="text-lg font-semibold text-[#171717]">{c.directTitle}</h2>
            <div className="mt-3 flex flex-col gap-3">
              <span className="text-[#2b2b2b]">
                {c.emailLabel}:{" "}
                <a href={`mailto:${email}`} className="text-[#171717] underline">
                  {email}
                </a>
              </span>
              {contactConfigured() && (
                <span className="text-[#2b2b2b]">
                  {c.wechatLabel}:{" "}
                  <a href={contactTelHref()} className="text-[#171717] underline">
                    {contactPhoneDisplay()}
                  </a>
                </span>
              )}
              {whatsappConfigured() && (
                <WhatsAppLink
                  label="WhatsApp"
                  message="Hi FactoryAuditB2B, I would like to ask about supplier verification."
                  className="inline-block w-fit rounded bg-[#25D366] px-3 py-2 text-sm font-medium text-[#0a3320] hover:opacity-90"
                />
              )}
            </div>
            <p className="mt-4 text-sm text-[#6d6b66]">{c.responseNote}</p>
          </div>

          {contactConfigured() && (
            <div
              id="wechat"
              // scroll-mt-24：页头是 sticky 74px，不加滚动外边距时从页脚跳过来
              // 会把二维码上半部压在页头下面（180px 的码被遮 74px 就扫不了）。
              className="flex scroll-mt-24 flex-col items-center gap-2 text-center md:pt-1"
            >
              {/* 二维码是 480×480 白底 PNG（public/wechat-qr.png），显示 180px 保证手机可扫。
                  用原生 img：静态资源无需 Next 图片优化，也避免额外运行时。
                  ⚠️ 用户重置微信二维码后必须换图，见 lib/contact.ts 顶部说明。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={WECHAT_QR_PATH}
                alt={c.wechatAlt}
                width={180}
                height={180}
                loading="lazy"
                decoding="async"
                className="h-[180px] w-[180px] rounded-md border border-black/[.08] bg-white p-1.5"
              />
              <p className="max-w-[220px] text-xs leading-relaxed text-[#6d6b66]">{c.wechatNote}</p>
            </div>
          )}
        </div>
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
