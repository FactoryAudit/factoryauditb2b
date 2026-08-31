"use client";

import { useState } from "react";

export type RfqFormDict = {
  labels: {
    firstName: string;
    company: string;
    email: string;
    product: string;
    quantity: string;
    country: string;
    message: string;
    messageHint: string;
    submit: string;
    submitting: string;
  };
  success: string;
  error: string;
};

export default function RfqForm({ t }: { t: RfqFormDict }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    // 必须在 await 之前捕获表单元素：React 17+ 在事件处理同步段结束后
    // 会把 e.currentTarget 置空，await 之后再读会拿到 null（此前导致
    // 提交成功却报"提交失败"的隐藏 bug）
    const formEl = e.currentTarget;
    const form = new FormData(e.currentTarget);
    const payload = {
      lead: {
        firstName: String(form.get("firstName") || ""),
        company: String(form.get("company") || ""),
        email: String(form.get("email") || ""),
        country: String(form.get("country") || ""),
        sourcing: [
          String(form.get("product") || ""),
          String(form.get("quantity") || ""),
        ]
          .filter(Boolean)
          .join(" · "),
        message: String(form.get("message") || ""),
        tool: "rfq",
      },
    };
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setStatus(data.ok ? "ok" : "error");
      if (data.ok) formEl.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="card p-6 text-center bg-[#f0fdf4]">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{t.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-2xl space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{t.labels.firstName}</label>
          <input className="input" name="firstName" placeholder={t.labels.firstName} />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.company}</label>
          <input className="input" name="company" placeholder={t.labels.company} />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.email}</label>
          <input className="input" name="email" type="email" required placeholder={t.labels.email} />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.country}</label>
          <input className="input" name="country" placeholder={t.labels.country} />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.product}</label>
          <input className="input" name="product" placeholder={t.labels.product} />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.quantity}</label>
          <input className="input" name="quantity" placeholder={t.labels.quantity} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">{t.labels.message}</label>
        <textarea className="textarea" name="message" rows={4} placeholder={t.labels.messageHint} />
      </div>
      <button type="submit" disabled={status === "loading"} className="btn btn-accent w-full">
        {status === "loading" ? t.labels.submitting : t.labels.submit}
      </button>
      {status === "error" && <p className="text-sm text-[#d4232a]">{t.error}</p>}
    </form>
  );
}
