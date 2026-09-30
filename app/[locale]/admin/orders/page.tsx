import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/adminData";
import { listOrders } from "@/lib/orders";
import { formatUsdMinor } from "@/lib/commerce";
import { serviceLabel } from "@/lib/orderCopy";
import OrderStatusActions from "@/components/admin/OrderStatusActions";

// /[locale]/admin/orders —— 后台订单列表（CS-17 Commerce V1）
//
// 权限：requireAdmin() 在本页自己再拦一次（不依赖 layout）。
// 数据来源：service_role（public.orders 对 authenticated 是零权限）。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-[#fef3c7] text-[#92400e]",
  paid: "bg-[#dcfce7] text-[#166534]",
  cancelled: "bg-[#ebe8e1] text-[#3f4650]",
  refunded: "bg-[#e0e7ff] text-[#3730a3]",
};

export default async function AdminOrdersPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const sp = await searchParams;
  const status = (str(sp.status) || "all") as "all" | "pending_payment" | "paid" | "cancelled" | "refunded";
  const search = str(sp.search).trim();

  const t = await getDictionary(locale);
  const o = t.admin.orders;
  const c = t.checkout;
  const p = (href: string) => localePath(locale, href);

  const rows = await listOrders({
    status: status === "all" ? "" : status,
    search,
  });

  const statusLabel = (s: string) =>
    s === "pending_payment"
      ? c.statusPending
      : s === "paid"
        ? c.statusPaid
        : s === "cancelled"
          ? c.statusCancelled
          : c.statusRefunded;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171717]">{o.ordersTitle}</h1>
      <p className="mt-1 text-sm text-[#6d6b66]">{o.ordersLead}</p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[#6d6b66]">{o.ordersSearch}</span>
          <input
            name="search"
            defaultValue={search}
            placeholder={o.ordersSearch}
            className="mt-1 w-72 rounded-md border border-[#ebe8e1] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#6d6b66]">{c.colStatus}</span>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 rounded-md border border-[#ebe8e1] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
          >
            <option value="all">{t.admin.filterAll}</option>
            <option value="pending_payment">{c.statusPending}</option>
            <option value="paid">{c.statusPaid}</option>
            <option value="cancelled">{c.statusCancelled}</option>
            <option value="refunded">{c.statusRefunded}</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-[#171717] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d3f6c]"
        >
          {t.suppliers.filterSubmit}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-[#6d6b66]">{o.empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#ebe8e1] text-xs text-[#6d6b66]">
                <th className="py-2 pr-4">{o.colRef}</th>
                <th className="py-2 pr-4">{c.colService}</th>
                <th className="py-2 pr-4">{c.colAmount}</th>
                <th className="py-2 pr-4">{c.colStatus}</th>
                <th className="py-2 pr-4">{o.colEmail}</th>
                <th className="py-2 pr-4">{o.colCreated}</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reference_id} className="border-b border-[#f5f3ee]">
                  <td className="py-2 pr-4 font-mono text-xs text-[#171717]">
                    <Link
                      href={p(`/checkout/${r.reference_id}`)}
                      className="text-[#171717] hover:underline"
                    >
                      {r.reference_id}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-[#171717]">{serviceLabel(t, r.service_code)}</td>
                  <td className="py-2 pr-4 text-[#171717]">
                    {formatUsdMinor(r.amount_minor) ?? c.quoted}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        STATUS_STYLE[r.status] ?? "bg-[#ebe8e1] text-[#3f4650]"
                      }`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-[#3f4650]">{r.email}</td>
                  <td className="py-2 pr-4 text-[#3f4650]">
                    {r.created_at.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="py-2 pr-4">
                    <OrderStatusActions
                      referenceId={r.reference_id}
                      current={r.status}
                      labels={{
                        paid: o.actionPaid,
                        cancel: o.actionCancel,
                        refund: o.actionRefund,
                        updated: o.updated,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
