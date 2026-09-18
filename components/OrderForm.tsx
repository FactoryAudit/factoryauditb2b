"use client";

// components/OrderForm.tsx —— 服务下单表单（CS-17 Commerce V1）
//
// 设计要点：
//   1. **不传金额**。只发 serviceCode + quantity，金额由服务端价目表算。
//      这是本表单最重要的安全属性：任何人改前端都改不了价格。
//   2. 不需要登录 —— B2B 买家不愿为下一单先注册，注册门槛会直接杀死转化。
//   3. 提交成功后跳订单详情页 /checkout/ORD-XXXXXX，付款动作在那里发生。
//   4. 失败时如实报错，不假装成功（订单号是要拿去付款的，假号比报错更糟）。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { localePath, type Locale } from "@/i18n/config";

export type OrderServiceOption = {
  code: string;
  label: string;
  unit: string;
  /** 展示用金额文案；待报价为 null */
  amountText: string | null;
  quantifiable: boolean;
};

export type OrderFormDict = {
  serviceLabel: string;
  quantityLabel: string;
  emailLabel: string;
  companyLabel: string;
  countryLabel: string;
  notesLabel: string;
  notesHint: string;
  amountHint: string;
  submit: string;
  submitting: string;
  errorGeneric: string;
  quoted: string;
};

type Props = {
  locale: Locale;
  dict: OrderFormDict;
  services: OrderServiceOption[];
};

export default function OrderForm({ locale, dict, services }: Props) {
  const router = useRouter();
  const [serviceCode, setServiceCode] = useState(services[0]?.code ?? "verification_basic");
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = services.find((s) => s.code === serviceCode) ?? services[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceCode,
          quantity: selected?.quantifiable ? quantity : 1,
          email,
          company: company || null,
          country: country || null,
          notes: notes || null,
          locale,
          sourcePath: typeof window === "undefined" ? null : window.location.pathname,
        }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        referenceId?: string;
        error?: string;
      };
      if (data.ok && data.referenceId) {
        router.push(localePath(locale, `/checkout/${data.referenceId}`));
        return;
      }
      setError(dict.errorGeneric);
    } catch {
      setError(dict.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-[#64748b]">{dict.serviceLabel}</span>
        <select
          value={serviceCode}
          onChange={(e) => setServiceCode(e.target.value)}
          className={input}
        >
          {services.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label} — {s.amountText ?? dict.quoted} ({s.unit})
            </option>
          ))}
        </select>
      </label>

      {selected?.quantifiable && (
        <label className="block">
          <span className="text-xs font-medium text-[#64748b]">
            {dict.quantityLabel} ({selected.unit})
          </span>
          <input
            type="number"
            min={1}
            max={30}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className={input}
          />
        </label>
      )}

      <label className="block">
        <span className="text-xs font-medium text-[#64748b]">{dict.emailLabel} *</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[#64748b]">{dict.companyLabel}</span>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={input}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[#64748b]">{dict.countryLabel}</span>
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={input}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[#64748b]">{dict.notesLabel}</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={dict.notesHint}
          className={input}
        />
      </label>

      <p className="text-xs text-[#64748b]">{dict.amountHint}</p>

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-[#0f4c81] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0d3f6c] disabled:opacity-60"
      >
        {busy ? dict.submitting : dict.submit}
      </button>

      {error && (
        <p role="alert" className="text-xs text-[#d4232a]">
          {error}
        </p>
      )}
    </form>
  );
}
