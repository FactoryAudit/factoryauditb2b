"use client";

import { useRef, useState } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

// 字段结构（与 lib/supplierNetwork.ts 的 REGISTRATION_FIELDS 对应）：
// 每个区块渲染一组字段，label 文案来自字典 form.labels。
// ⚠️ certificates 不在下表 —— 它是可重复的结构化子表单（见 certs state），
//    提交时被序列化成 certificates（人类可读多行）+ certificatesJson（结构化数组）。
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

// 证书行：与字典 supplierNetwork.form.labels 的 certName/certNumber/certIssued/certExpires 对应
type CertRow = { name: string; number: string; issued: string; expires: string };
const EMPTY_CERT: CertRow = { name: "", number: "", issued: "", expires: "" };
const MAX_CERTS = 10;

// 「我要获得证书」咨询表单（不在主表单内 —— 避免嵌套 <form>）
type HelpFields = { wanted: string; company: string; contactName: string; contactEmail: string; note: string };
const EMPTY_HELP: HelpFields = { wanted: "", company: "", contactName: "", contactEmail: "", note: "" };

export default function SupplierRegistrationForm({ t, success, error }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  // 结构化证书行（至少 1 行；行内容可全空，提交时自动过滤）
  const [certs, setCerts] = useState<CertRow[]>([{ ...EMPTY_CERT }]);
  // 认证辅导需求弹窗
  const [helpOpen, setHelpOpen] = useState(false);
  const [help, setHelp] = useState<HelpFields>({ ...EMPTY_HELP });
  const [helpStatus, setHelpStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  // 埋点：首次聚焦 = 开始填写入驻表（每个会话只发一次）
  const startedRef = useRef(false);
  const handleFirstTouch = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent(ANALYTICS_EVENTS.supplierNetworkStart);
  };

  const setCert = (i: number, patch: Partial<CertRow>) =>
    setCerts((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addCert = () => setCerts((prev) => (prev.length >= MAX_CERTS ? prev : [...prev, { ...EMPTY_CERT }]));
  const removeCert = (i: number) =>
    setCerts((prev) => (prev.length <= 1 ? [{ ...EMPTY_CERT }] : prev.filter((_, idx) => idx !== i)));

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

    // 结构化证书 → 两个派生载荷键
    const certList = certs
      .map((r) => ({
        name: r.name.trim(),
        number: r.number.trim(),
        issued: r.issued.trim(),
        expires: r.expires.trim(),
      }))
      .filter((c) => c.name || c.number || c.issued || c.expires);
    if (certList.length) {
      fields.certificates = certList
        .map((c) =>
          [
            c.name,
            c.number ? `No. ${c.number}` : "",
            c.issued ? `Issued ${c.issued}` : "",
            c.expires ? `Valid until ${c.expires}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        )
        .join("\n");
      fields.certificatesJson = JSON.stringify(certList);
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
        // 供应商入驻转化：提交成功（不携带任何表单内容，referenceId 属敏感追踪号也不发）
        trackEvent(ANALYTICS_EVENTS.supplierNetworkSubmit);
        setStatus("ok");
        setReferenceId(String(data.supplierId || ""));
        formEl.reset();
        setCerts([{ ...EMPTY_CERT }]);
        return;
      }
      setStatus("error");
      // 只显示本地化文案（API 英文 message 不作为用户可见文本）
      setErrMsg(error);
    } catch {
      setStatus("error");
      setErrMsg(error);
    }
  }

  async function handleHelpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHelpStatus("loading");
    const fields: Record<string, string> = {};
    if (help.wanted.trim()) fields.certHelpWanted = help.wanted.trim();
    if (help.company.trim()) fields.certHelpCompany = help.company.trim();
    if (help.contactName.trim()) fields.certHelpContactName = help.contactName.trim();
    if (help.contactEmail.trim()) fields.certHelpContactEmail = help.contactEmail.trim();
    if (help.note.trim()) fields.certHelpNote = help.note.trim();
    try {
      const res = await fetch("/api/supplier-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "certification_request", fields }),
      });
      const data = await res.json();
      if (data.ok) {
        setHelpStatus("ok");
        setHelp({ ...EMPTY_HELP });
        return;
      }
      setHelpStatus("error");
    } catch {
      setHelpStatus("error");
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
    <>
      <form onSubmit={handleSubmit} onFocus={handleFirstTouch} className="card p-6 max-w-3xl space-y-8">
        {Object.keys(t.sections).map((section) => {
          const keys = SECTION_FIELDS[section];
          return (
            <fieldset key={section} className="space-y-4">
              <legend className="text-lg font-bold text-[#0f4c81] pb-2 border-b border-[#e2e8f0] w-full">
                {t.sections[section]}
              </legend>
              {keys && <div className="grid md:grid-cols-2 gap-4">{keys.map(renderField)}</div>}

              {section === "certificates" && (
                <div className="space-y-4">
                  {certs.map((row, i) => (
                    <div
                      key={i}
                      className="grid md:grid-cols-2 gap-3 p-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc]"
                    >
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-name-${i}`}>
                          {t.labels.certName}
                        </label>
                        <input
                          id={`cert-name-${i}`}
                          className="input"
                          value={row.name}
                          onChange={(e) => setCert(i, { name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-number-${i}`}>
                          {t.labels.certNumber}
                        </label>
                        <input
                          id={`cert-number-${i}`}
                          className="input"
                          value={row.number}
                          onChange={(e) => setCert(i, { number: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-issued-${i}`}>
                          {t.labels.certIssued}
                        </label>
                        <input
                          id={`cert-issued-${i}`}
                          className="input"
                          type="date"
                          value={row.issued}
                          onChange={(e) => setCert(i, { issued: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-expires-${i}`}>
                          {t.labels.certExpires}
                        </label>
                        <input
                          id={`cert-expires-${i}`}
                          className="input"
                          type="date"
                          value={row.expires}
                          onChange={(e) => setCert(i, { expires: e.target.value })}
                        />
                      </div>
                      {certs.length > 1 && (
                        <div className="md:col-span-2 flex justify-end">
                          <button
                            type="button"
                            className="text-sm text-[#d4232a] underline"
                            onClick={() => removeCert(i)}
                          >
                            {t.labels.certRemove}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={addCert}
                      disabled={certs.length >= MAX_CERTS}
                    >
                      + {t.labels.certAdd}
                    </button>
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => {
                        setHelpStatus("idle");
                        setHelpOpen(true);
                      }}
                    >
                      {t.labels.certHelpOpen}
                    </button>
                  </div>
                </div>
              )}

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

      {/* 「我要获得证书」咨询弹窗 —— 独立表单，不嵌套在主表单内 */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-lg my-8 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-lg font-bold text-[#0f172a]">{t.labels.certHelpTitle}</h3>
              <button
                type="button"
                className="text-[#64748b] text-2xl leading-none"
                onClick={() => setHelpOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {helpStatus === "ok" ? (
              <p className="text-sm text-[#1f7a36]">{t.labels.certHelpSuccess}</p>
            ) : (
              <form onSubmit={handleHelpSubmit} className="space-y-4">
                <p className="text-sm text-[#64748b]">{t.labels.certHelpLead}</p>
                <div>
                  <label className="text-sm font-medium" htmlFor="certHelpWanted">
                    {t.labels.certHelpWanted}
                    <span className="text-[#d4232a]">*</span>
                  </label>
                  <textarea
                    id="certHelpWanted"
                    className="textarea"
                    rows={3}
                    required
                    value={help.wanted}
                    onChange={(e) => setHelp({ ...help, wanted: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="certHelpCompany">
                    {t.labels.certHelpCompany}
                  </label>
                  <input
                    id="certHelpCompany"
                    className="input"
                    value={help.company}
                    onChange={(e) => setHelp({ ...help, company: e.target.value })}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium" htmlFor="certHelpContactName">
                      {t.labels.certHelpContactName}
                    </label>
                    <input
                      id="certHelpContactName"
                      className="input"
                      value={help.contactName}
                      onChange={(e) => setHelp({ ...help, contactName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium" htmlFor="certHelpContactEmail">
                      {t.labels.certHelpContactEmail}
                      <span className="text-[#d4232a]">*</span>
                    </label>
                    <input
                      id="certHelpContactEmail"
                      className="input"
                      type="email"
                      required
                      value={help.contactEmail}
                      onChange={(e) => setHelp({ ...help, contactEmail: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="certHelpNote">
                    {t.labels.certHelpNote}
                  </label>
                  <textarea
                    id="certHelpNote"
                    className="textarea"
                    rows={2}
                    value={help.note}
                    onChange={(e) => setHelp({ ...help, note: e.target.value })}
                  />
                </div>
                {helpStatus === "error" && <p className="text-sm text-[#d4232a]">{t.labels.certHelpError}</p>}
                <button type="submit" className="btn btn-primary w-full" disabled={helpStatus === "loading"}>
                  {helpStatus === "loading" ? t.labels.certHelpSubmitting : t.labels.certHelpSubmit}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
