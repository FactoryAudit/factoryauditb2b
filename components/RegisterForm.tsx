"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

export type RegisterFormDict = {
  emailLabel: string;
  emailPlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  companyLabel: string;
  companyPlaceholder: string;
  submit: string;
  submitting: string;
  privacyNote: string;
  successTitle: string;
  successLead: string;
  errorGeneric: string;
  errorRateLimited: string;
  errorInvalidEmail: string;
};

type Props = {
  t: RegisterFormDict;
};

// Free Account 注册：无数据库（V2.0），提交 → 邮件工作流，人工建号。
// 表单只收集建号所需最小字段，不收集密码（真实登录系统为后续阶段）。
export default function RegisterForm({ t }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const fields = {
      email: String(form.get("email") || "").trim().toLowerCase(),
      name: String(form.get("name") || "").trim(),
      company: String(form.get("company") || "").trim(),
    };

    if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email)) {
      setStatus("error");
      setErrMsg(t.errorInvalidEmail);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (data.ok) {
        trackEvent(ANALYTICS_EVENTS.registerSubmit, { email: fields.email });
        setStatus("ok");
        formEl.reset();
        return;
      }
      setStatus("error");
      // 只显示本地化文案（API 的英文 message 不作为用户可见文本）
      setErrMsg(
        data?.error === "rate_limited"
          ? t.errorRateLimited
          : data?.error === "invalid_email"
            ? t.errorInvalidEmail
            : t.errorGeneric
      );
    } catch {
      setStatus("error");
      setErrMsg(t.errorGeneric);
    }
  }

  if (status === "ok") {
    return (
      <div className="card p-6 text-center bg-[#f0fdf4]" data-track={ANALYTICS_EVENTS.registerSubmit}>
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{t.successTitle}</p>
        <p className="text-sm text-[#64748b] mt-2">{t.successLead}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-xl space-y-4">
      <div>
        <label htmlFor="reg-email" className="text-sm font-medium">
          {t.emailLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          placeholder={t.emailPlaceholder}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="reg-name" className="text-sm font-medium">
          {t.nameLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="reg-name"
          name="name"
          type="text"
          required
          placeholder={t.namePlaceholder}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="reg-company" className="text-sm font-medium">
          {t.companyLabel}
        </label>
        <input
          id="reg-company"
          name="company"
          type="text"
          placeholder={t.companyPlaceholder}
          className="input"
        />
      </div>

      <p className="text-xs text-[#64748b]">{t.privacyNote}</p>

      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.submitting : t.submit}
      </button>
      {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
