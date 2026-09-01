"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

export type ClaimFormDict = {
  emailLabel: string;
  emailHint: string;
  emailPlaceholder: string;
  nameLabel: string;
  companyLabel: string;
  authorizationLabel: string;
  authorizationYes: string;
  authorizationNo: string;
  supportLabel: string;
  supportHint: string;
  submit: string;
  submitting: string;
  privacyNote: string;
  successTitle: string;
  successLead: string;
  errorGeneric: string;
  errorRateLimited: string;
  errorInvalidEmail: string;
  errorAuthorization: string;
};

type Props = {
  t: ClaimFormDict;
  slug: string;
  legalName: string;
};

// Claim Profile：公司邮箱 + 授权代表验证。提交 → 邮件工作流，人工审核。
// 明确规则（需求 §24 + 反伪造铁律）：核验结果不出售、不保证变更、人工审核。
export default function ClaimForm({ t, slug, legalName }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const fields = {
      companyEmail: String(form.get("companyEmail") || "").trim().toLowerCase(),
      contactName: String(form.get("contactName") || "").trim(),
      companyName: String(form.get("companyName") || "").trim(),
      authorization: String(form.get("authorization") || ""),
      supportNote: String(form.get("supportNote") || "").trim().slice(0, 2000),
    };

    if (!fields.companyEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.companyEmail)) {
      setStatus("error");
      setErrMsg(t.errorInvalidEmail);
      return;
    }
    if (fields.authorization !== "yes" && fields.authorization !== "no") {
      setStatus("error");
      setErrMsg(t.errorAuthorization);
      return;
    }

    try {
      const res = await fetch("/api/supplier-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, fields }),
      });
      const data = await res.json();
      if (data.ok) {
        trackEvent(ANALYTICS_EVENTS.claimSubmit, { slug });
        setStatus("ok");
        formEl.reset();
        return;
      }
      setStatus("error");
      // 只显示本地化文案：rate_limited / invalid_email 映射到字典，其余统一 generic（API 的英文 message 不作为用户可见文本）
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
      <div className="card p-6 text-center bg-[#f0fdf4]">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{t.successTitle}</p>
        <p className="text-sm text-[#64748b] mt-2">{t.successLead}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-xl space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <label htmlFor="claim-email" className="text-sm font-medium">
          {t.emailLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="claim-email"
          name="companyEmail"
          type="email"
          required
          placeholder={t.emailPlaceholder}
          className="input"
        />
        <p className="text-xs text-[#64748b] mt-1">{t.emailHint}</p>
      </div>

      <div>
        <label htmlFor="claim-name" className="text-sm font-medium">
          {t.nameLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="claim-name"
          name="contactName"
          type="text"
          required
          className="input"
        />
      </div>

      <div>
        <label htmlFor="claim-company" className="text-sm font-medium">
          {t.companyLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="claim-company"
          name="companyName"
          type="text"
          required
          defaultValue={legalName}
          className="input"
        />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">
          {t.authorizationLabel} <span className="text-[#d4232a]">*</span>
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="authorization" value="yes" required className="h-4 w-4" />
            {t.authorizationYes}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="authorization" value="no" className="h-4 w-4" />
            {t.authorizationNo}
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="claim-support" className="text-sm font-medium">
          {t.supportLabel}
        </label>
        <textarea
          id="claim-support"
          name="supportNote"
          rows={4}
          className="textarea"
          placeholder={t.supportHint}
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
