import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { SERVICE_CATALOG, formatUsdMinor } from "@/lib/commerce";
import { serviceLabel, unitLabel } from "@/lib/orderCopy";
import OrderForm from "@/components/OrderForm";

// /[locale]/order —— 服务下单页（CS-17 Commerce V1）
//
// 为什么 noindex：
//   这是交易页不是内容页，没有独立搜索价值；放进 sitemap 只会稀释站点主题。
//   入口来自定价页与客服链路，不靠自然搜索。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function OrderPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const t = await getDictionary(locale);

  // 价目表来自服务端单一事实源；前端只拿到 code + 展示文案，**拿不到改金额的入口**。
  const services = SERVICE_CATALOG.map((s) => ({
    code: s.code,
    label: serviceLabel(t, s.code),
    unit: unitLabel(t, s.code),
    amountText: formatUsdMinor(s.unitAmountMinor),
    quantifiable: s.quantifiable,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-[#0f172a]">{t.order.title}</h1>
      <p className="mt-2 text-sm text-[#64748b]">{t.order.lead}</p>

      <OrderForm
        locale={locale}
        dict={{
          serviceLabel: t.order.serviceLabel,
          quantityLabel: t.order.quantityLabel,
          emailLabel: t.order.emailLabel,
          companyLabel: t.order.companyLabel,
          countryLabel: t.order.countryLabel,
          notesLabel: t.order.notesLabel,
          notesHint: t.order.notesHint,
          amountHint: t.order.amountHint,
          submit: t.order.submit,
          submitting: t.order.submitting,
          errorGeneric: t.order.errorGeneric,
          quoted: t.checkout.quoted,
        }}
        services={services}
      />
    </div>
  );
}
