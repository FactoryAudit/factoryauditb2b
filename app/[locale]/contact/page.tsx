import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import ContactForm, { type ContactFormCopy } from "@/components/ContactForm";
import WhatsAppLink, { whatsappConfigured } from "@/components/WhatsAppLink";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/pageMeta";
import { pickZhCopy } from "@/lib/tw";
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

const COPY = {
  en: {
    metaTitle: "Contact FactoryAuditB2B — Supplier Verification & Factory Audit",
    metaDesc:
      "Tell us what you are sourcing, or which supplier you want checked. We reply within one business day.",
    eyebrow: "Contact",
    title: "Talk to us about your suppliers",
    lead: "Send us what you are sourcing, or the factory you want checked. We will tell you what we can verify, what we cannot, and what it takes to find out.",
    directTitle: "Or reach us directly",
    emailLabel: "Email",
    responseNote: "We reply within one business day. We do not sell or share your details.",
    altTitle: "Other ways to start",
    rfqTitle: "Submit an RFQ",
    rfqBody: "Have a specific product? Send the details and we will route it to suppliers worth checking.",
    supplierTitle: "Join the supplier network",
    supplierBody: "Are you a factory? Get listed and open yourself up to buyer-requested audits and inspections.",
    form: {
      name: "Your name",
      namePlaceholder: "Jane Doe",
      email: "Work email",
      emailPlaceholder: "jane@company.com",
      company: "Company",
      companyPlaceholder: "Company name",
      country: "Country / market",
      countryPlaceholder: "e.g. Germany",
      message: "What do you need?",
      messagePlaceholder:
        "Tell us what you are sourcing, or which supplier you would like us to check.",
      submit: "Send message",
      sending: "Sending…",
      successTitle: "Message received",
      successBody: "Thank you. Our team will reply within one business day.",
      errorTitle: "Could not send",
      errorBody: "Please try again, or email us directly.",
      required: "Please enter a valid email address.",
    } satisfies ContactFormCopy,
  },
  zh: {
    metaTitle: "联系我们 — FactoryAuditB2B 供应商核验与工厂审核",
    metaDesc: "告诉我们您在采购什么，或想核验哪家工厂。我们将在一个工作日内回复。",
    eyebrow: "联系我们",
    title: "和我们聊聊您的供应商",
    lead: "告诉我们您在采购什么，或想核验哪家工厂。我们会说明哪些能核实、哪些不能，以及需要走哪些步骤。",
    directTitle: "也可以直接联系我们",
    emailLabel: "邮箱",
    responseNote: "我们将在一个工作日内回复。我们不会出售或分享您的信息。",
    altTitle: "其他开始方式",
    rfqTitle: "提交询价单（RFQ）",
    rfqBody: "有具体产品？发来详情，我们帮您对接值得核查的供应商。",
    supplierTitle: "加入供应商网络",
    supplierBody: "您是工厂？可以免费登记，并开放接受买家发起的验厂与验货。",
    form: {
      name: "您的姓名",
      namePlaceholder: "张三",
      email: "工作邮箱",
      emailPlaceholder: "you@company.com",
      company: "公司",
      companyPlaceholder: "公司名称",
      country: "国家 / 市场",
      countryPlaceholder: "例如：德国",
      message: "您的需求",
      messagePlaceholder: "请说明您在采购什么，或想核验哪家供应商。",
      submit: "发送",
      sending: "发送中…",
      successTitle: "已收到您的留言",
      successBody: "谢谢。我们将在一个工作日内回复。",
      errorTitle: "发送失败",
      errorBody: "请稍后重试，或直接发邮件给我们。",
      required: "请填写有效的邮箱地址。",
    } satisfies ContactFormCopy,
  },
};

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const c = pickZhCopy(locale, COPY);
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
  const c = pickZhCopy(locale, COPY);
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
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
              { "@type": "ListItem", position: 2, name: c.title, item: `${BASE}${p(PATH)}` },
            ],
          },
        ]}
      />

      <header>
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {c.eyebrow}
        </span>
        <h1 className="text-4xl font-extrabold text-[#0f172a] mt-2 leading-tight">{c.title}</h1>
        <p className="text-[#64748b] mt-4 text-lg max-w-3xl">{c.lead}</p>
      </header>

      {/* 直接联系方式：不装 WhatsApp 的访客也能走邮箱，两条路都给 */}
      <section className="mt-8 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="text-lg font-semibold text-[#0f172a]">{c.directTitle}</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <span className="text-[#334155]">
            {c.emailLabel}:{" "}
            <a href={`mailto:${email}`} className="text-[#0f4c81] underline">
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
        <p className="mt-3 text-sm text-[#64748b]">{c.responseNote}</p>
      </section>

      {/* 表单 */}
      <section className="mt-10">
        <ContactForm copy={c.form} />
      </section>

      {/* 其他入口 */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-[#0f172a]">{c.altTitle}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Link href={p("/rfq")} className="card p-5 hover:border-[#0f4c81]">
            <h3 className="font-bold text-[#0f172a]">{c.rfqTitle}</h3>
            <p className="mt-2 text-sm text-[#475569] leading-relaxed">{c.rfqBody}</p>
          </Link>
          <Link href={p("/join-supplier-network")} className="card p-5 hover:border-[#0f4c81]">
            <h3 className="font-bold text-[#0f172a]">{c.supplierTitle}</h3>
            <p className="mt-2 text-sm text-[#475569] leading-relaxed">{c.supplierBody}</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
