"use client";

import { useState } from "react";

/**
 * 联系页表单。
 *
 * 为什么复用 /api/lead 而不是新建一个 /api/contact：
 *   /api/lead 已经是全站商业意向的统一入口，自带
 *     ① IP 限流（每小时 5 条，挡住脚本灌数据与邮件轰炸）
 *     ② 邮箱格式校验
 *     ③ 落库（public.leads，kind=buyer_lead，运营可在后台查）
 *     ④ 双邮件（管理员通知 + 客户回执，走 Resend）
 *   再开一个 /api/contact 等于把这些护栏全部绕开一遍，是重复且更脆弱的实现。
 *   这里只需传 tool:"contact" 作来源标识。
 *
 * 失败口径：只陈述"提交没成功"，不猜原因；限流时原样透出服务端给的提示。
 */

export type ContactFormCopy = {
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  company: string;
  companyPlaceholder: string;
  country: string;
  countryPlaceholder: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  errorBody: string;
  required: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ContactForm({ copy }: { copy: ContactFormCopy }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string>(copy.errorBody);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const email = String(fd.get("email") || "").trim();
    if (!email || !EMAIL_RE.test(email)) {
      setErrorText(copy.required);
      setStatus("error");
      return;
    }

    const lead = {
      tool: "contact",
      name: String(fd.get("name") || "").trim(),
      email,
      company: String(fd.get("company") || "").trim(),
      country: String(fd.get("country") || "").trim(),
      message: String(fd.get("message") || "").trim(),
    };

    setStatus("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, result: {} }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        // 限流(429)与邮箱非法(400)服务端都带 message，原样透出
        setErrorText(typeof j.message === "string" && j.message ? j.message : copy.errorBody);
        setStatus("error");
        return;
      }
      setReferenceId(typeof j.referenceId === "string" ? j.referenceId : null);
      setStatus("ok");
      form.reset();
    } catch {
      setErrorText(copy.errorBody);
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <h3 className="font-semibold text-[#166534]">{copy.successTitle}</h3>
        <p className="mt-2 text-sm text-[#15803d] leading-relaxed">{copy.successBody}</p>
        {referenceId && (
          <p className="mt-3 text-sm font-medium text-[#166534]">
            {copy.successTitle.indexOf("Reference") >= 0 || /^[A-Za-z]/.test(copy.successTitle)
              ? "Reference: "
              : "编号: "}
            {referenceId}
          </p>
        )}
      </div>
    );
  }

  const labelCls = "block text-sm font-medium text-[#334155] mb-1";
  const inputCls =
    "w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#0f4c81] focus:ring-1 focus:ring-[#0f4c81]";

  return (
    <form onSubmit={onSubmit} className="card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="c-name">
            {copy.name}
          </label>
          <input id="c-name" name="name" className={inputCls} placeholder={copy.namePlaceholder} />
        </div>
        <div>
          <label className={labelCls} htmlFor="c-email">
            {copy.email} <span className="text-red-600">*</span>
          </label>
          <input
            id="c-email"
            name="email"
            type="email"
            required
            className={inputCls}
            placeholder={copy.emailPlaceholder}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="c-company">
            {copy.company}
          </label>
          <input id="c-company" name="company" className={inputCls} placeholder={copy.companyPlaceholder} />
        </div>
        <div>
          <label className={labelCls} htmlFor="c-country">
            {copy.country}
          </label>
          <input id="c-country" name="country" className={inputCls} placeholder={copy.countryPlaceholder} />
        </div>
      </div>

      <div className="mt-4">
        <label className={labelCls} htmlFor="c-message">
          {copy.message}
        </label>
        <textarea
          id="c-message"
          name="message"
          rows={5}
          className={inputCls}
          placeholder={copy.messagePlaceholder}
        />
      </div>

      {status === "error" && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-[#991b1b]">{copy.errorTitle}</p>
          <p className="mt-1 text-sm text-[#b91c1c]">{errorText}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-[#0f4c81] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d3f6b] disabled:opacity-60"
      >
        {status === "sending" ? copy.sending : copy.submit}
      </button>
    </form>
  );
}
