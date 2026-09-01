"use client";

import { useState } from "react";

// 字段结构（与 lib/supplierNetwork.ts 的 REGISTRATION_FIELDS 对应）：
// 每个区块渲染一组字段，label 文案来自字典 form.labels。
const SECTION_FIELDS: Record<string, string[]> = {
  company: [
    "companyName",
    "englishName",
    "companyType",
    "registrationNumber",
    "establishedYear",
    "website",
  ],
  factory: ["factoryCountry", "factoryCity", "factoryAddress", "employees", "factorySize"],
  products: ["mainProducts", "productionCapacity", "monthlyOutput"],
  export: ["exportMarkets", "exportSince"],
  certificates: ["certificates"],
  contact: ["contactName", "contactEmail", "contactPhone", "contactWhatsapp"],
};

const REQUIRED = new Set(["companyName", "factoryCountry", "mainProducts", "contactEmail"]);

export type SupplierNetworkFormDict = {
  sections: Record<string, string>;
  labels: Record<string, string>;
  submit: string;
  submitting: string;
  privacyNote: string;
};

type Props = {
  t: SupplierNetworkFormDict;
  success: string;
  error: string;
};

const CONTACT_VISIBILITY = ["contactVisibilityPublic", "contactVisibilityPlatform", "contactVisibilityPrivate"] as const;

export default function SupplierRegistrationForm({ t, success, error }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);
    // await 前捕获表单元素，避免 React 事件处理同步段结束后 currentTarget 被置空
    const formEl = e.currentTarget;
    const form = new FormData(e.currentTarget);

    const fields: Record<string, string> = {};
    for (const group of Object.values(SECTION_FIELDS)) {
      for (const key of group) {
        const v = String(form.get(key) || "").trim();
        if (v) fields[key] = v;
      }
    }
    // 可选项（Availability / Authorization / Message）
    fields.auditAvailability = form.get("auditAvailability") === "yes" ? "yes" : "no";
    fields.inspectionAvailability = form.get("inspectionAvailability") === "yes" ? "yes" : "no";
    const auth = String(form.get("authorizeCompanyProfile") || "");
    if (auth) fields.authorizeCompanyProfile = auth;
    const visibility = String(form.get("contactVisibility") || "");
    if (visibility) fields.contactVisibility = visibility;
    const message = String(form.get("message") || "").trim();
    if (message) fields.message = message;

    try {
      const res = await fetch("/api/supplier-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
        setReferenceId(String(data.supplierId || ""));
        formEl.reset();
        return;
      }
      setStatus("error");
      if (data?.error === "rate_limited") {
        setErrMsg(error);
      } else if (typeof data?.message === "string" && data.message) {
        setErrMsg(data.message);
      } else {
        setErrMsg(error);
      }
    } catch {
      setStatus("error");
      setErrMsg(error);
    }
  }

  if (status === "ok") {
    return (
      <div className="card p-6 text-center bg-[#f0fdf4]">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{success}</p>
        {referenceId && (
          <p className="text-xs text-[#64748b] mt-2 break-all">Reference: {referenceId}</p>
        )}
      </div>
    );
  }

  const renderField = (key: string) => (
    <div key={key}>
      <label className="text-sm font-medium">
        {t.labels[key] || key}
        {REQUIRED.has(key) && <span className="text-[#d4232a]">*</span>}
      </label>
      {key === "message" ? (
        <textarea className="textarea" name={key} rows={4} />
      ) : (
        <input
          className="input"
          name={key}
          type={key === "contactEmail" ? "email" : "text"}
          required={REQUIRED.has(key)}
        />
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-3xl space-y-8">
      {Object.keys(t.sections).map((section) => {
        const keys = SECTION_FIELDS[section];
        return (
          <fieldset key={section} className="space-y-4">
            <legend className="text-lg font-bold text-[#0f4c81] pb-2 border-b border-[#e2e8f0] w-full">
              {t.sections[section]}
            </legend>
            {keys && <div className="grid md:grid-cols-2 gap-4">{keys.map(renderField)}</div>}
            {section === "availability" && (
              <div className="grid md:grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="auditAvailability" value="yes" className="h-4 w-4" />
                  {t.labels.auditAvailability}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="inspectionAvailability" value="yes" className="h-4 w-4" />
                  {t.labels.inspectionAvailability}
                </label>
              </div>
            )}
            {section === "authorization" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">
                    {t.labels.authorizeCompanyProfile}
                    <span className="text-[#d4232a]">*</span>
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="authorizeCompanyProfile" value="yes" required className="h-4 w-4" />
                      {t.labels.authorizeCompanyProfileYes}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="authorizeCompanyProfile" value="no" className="h-4 w-4" />
                      {t.labels.authorizeCompanyProfileNo}
                    </label>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">{t.labels.contactVisibility}</p>
                  <div className="space-y-2">
                    {CONTACT_VISIBILITY.map((v) => (
                      <label key={v} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="contactVisibility" value={v.replace("contactVisibility", "").toLowerCase()} className="h-4 w-4" />
                        {t.labels[v]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {section === "message" && renderField("message")}
          </fieldset>
        );
      })}

      <p className="text-xs text-[#64748b]">{t.privacyNote}</p>

      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.submitting : t.submit}
      </button>
      {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
