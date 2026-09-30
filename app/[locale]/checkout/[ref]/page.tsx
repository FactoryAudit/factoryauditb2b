import Link from "next/link";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { getOrderByRef } from "@/lib/orders";
import { formatUsdMinor } from "@/lib/commerce";
import { serviceLabel } from "@/lib/orderCopy";

// /[locale]/checkout/[ref] —— 订单详情页（CS-17 Commerce V1）
//
// 关键设计：
//   1. **订单号即凭据**：客户不注册也能查自己的订单（B2B 买家不愿为查单先开户）。
//      代价是"知道号即可看"，所以本页只渲染**这一条订单自身**的字段，
//      绝不展示任何列表、其他客户数据或内部备注。
//   2. noindex：订单页含联系方式与金额，绝不能进搜索索引。
//   3. 待报价（amount_minor 为 NULL）显示「To be quoted」，**绝不当 0**。
//   4. 银行电汇信息只在 PAYMENT_BANK_DETAILS 配置了才展示 —— 没配置就不编造账户。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; ref: string }> };

const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-[#fef3c7] text-[#92400e]",
  paid: "bg-[#dcfce7] text-[#166534]",
  cancelled: "bg-[#ebe8e1] text-[#3f4650]",
  refunded: "bg-[#e0e7ff] text-[#3730a3]",
};

export default async function CheckoutPage({ params }: Props) {
  const { locale: raw, ref } = await params;
  if (!isLocale(raw)) return null;
  const locale: Locale = raw;

  const t = await getDictionary(locale);
  const c = t.checkout;

  const order = await getOrderByRef(decodeURIComponent(ref));

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold text-[#171717]">{c.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-[#6d6b66]">{c.notFoundBody}</p>
        <Link
          href={localePath(locale, "/custom-services")}
          className="btn btn-primary mt-6 inline-block"
        >
          {c.notFoundTitle}
        </Link>
      </div>
    );
  }

  const amountText = formatUsdMinor(order.amount_minor);
  const statusLabel =
    order.status === "pending_payment"
      ? c.statusPending
      : order.status === "paid"
        ? c.statusPaid
        : order.status === "cancelled"
          ? c.statusCancelled
          : c.statusRefunded;

  const bankDetails = process.env.PAYMENT_BANK_DETAILS?.trim() || null;
  const canPay = order.status === "pending_payment" && Boolean(order.pay_url);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-[#171717]">{c.title}</h1>
      <p className="mt-2 text-sm text-[#6d6b66]">{c.lead}</p>

      <dl className="mt-6 divide-y divide-[#ebe8e1] rounded-lg border border-[#ebe8e1]">
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-xs font-medium text-[#6d6b66]">{c.orderRef}</dt>
          <dd className="font-mono text-sm font-semibold text-[#171717]">
            {order.reference_id}
          </dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-xs font-medium text-[#6d6b66]">{c.colService}</dt>
          <dd className="text-sm text-[#171717]">{serviceLabel(t, order.service_code)}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-xs font-medium text-[#6d6b66]">{c.colQuantity}</dt>
          <dd className="text-sm text-[#171717]">{order.quantity}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-xs font-medium text-[#6d6b66]">{c.colAmount}</dt>
          <dd className="text-sm font-semibold text-[#171717]">
            {amountText ?? c.quoted}
          </dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-xs font-medium text-[#6d6b66]">{c.colStatus}</dt>
          <dd>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                STATUS_STYLE[order.status] ?? "bg-[#ebe8e1] text-[#3f4650]"
              }`}
            >
              {statusLabel}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-[#6d6b66]">{c.referenceNote}</p>

      {canPay && (
        <section className="mt-8">
          <h2 className="font-semibold text-[#171717]">{c.payTitle}</h2>
          <a
            href={order.pay_url as string}
            className="btn btn-primary mt-3 inline-block bg-[#171717] text-white"
          >
            {c.payPaypal}
          </a>
        </section>
      )}

      {order.status === "pending_payment" && !canPay && (
        <section className="mt-8">
          <h2 className="font-semibold text-[#171717]">{c.payManualTitle}</h2>
          <p className="mt-2 text-sm text-[#3f4650]">{c.payManualBody}</p>
          {bankDetails && (
            <div className="mt-4">
              <h3 className="text-xs font-medium text-[#6d6b66]">{c.bankTitle}</h3>
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-[#fbfaf7] p-3 text-sm text-[#171717]">
                {bankDetails}
              </pre>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold text-[#171717]">{c.nextTitle}</h2>
        <p className="mt-2 text-sm text-[#3f4650]">{c.nextBody}</p>
      </section>
    </div>
  );
}
