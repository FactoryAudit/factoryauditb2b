"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
// 审核类型取值由 lib/auditScope 单一提供：顺序即下标，页面与范围推荐共用同一份，
// 避免两边各写一份数组导致下标对不上
import { AUDIT_TYPES } from "@/lib/auditScope";
import type { AppliedScope } from "./AuditScopeAdvisor";
import type { AuditRequestFormPhrases } from "@/lib/auditI18n";
import { CopyButton } from "./verify/CopyButton";

export type AuditRequestFormDict = {
  labels: {
    firstName: string;
    company: string;
    email: string;
    supplierName: string;
    country: string;
    industry: string;
    auditType: string;
    standard: string;
    message: string;
    messageHint: string;
    submit: string;
    submitting: string;
  };
  success: string;
  error: string;
  rateLimited: string;
  /** 行业下拉显示文案，顺序与组件内 INDUSTRIES value 一致（11 项） */
  industries: string[];
  /** 认证下拉「None / Custom」显示文案 */
  noneCustom: string;
  /** 审核类型下拉显示文案，顺序与 lib/auditScope.AUDIT_TYPES 一致（8 项） */
  auditTypes: string[];
};

const STANDARDS = [
  "SMETA",
  "BSCI",
  "WRAP",
  "SA8000",
  "RBA",
  "ISO 9001",
  "ISO 14001",
  "ISO 45001",
  "IATF 16949",
  "CE",
  "UL",
  "None / Custom",
];

const INDUSTRIES = [
  "Electronics",
  "Textiles & Garments",
  "Furniture",
  "Toys",
  "Automotive",
  "Machinery",
  "Plastics",
  "Food",
  "Packaging",
  "Chemicals",
  "Other",
];

type SupplierOption = { id: string; name: string };

export default function AuditRequestForm({
  t,
  auditTypeLabels,
  preset,
  // —— V2.1 真实审核请求接线 ——
  suppliers,
  reqT,
  locale,
}: {
  t: AuditRequestFormDict;
  /** 审核类型的展示文案，顺序与 AUDIT_TYPES 一致；缺省回退英文原值 */
  auditTypeLabels?: string[];
  /** 由审核范围推荐器「应用到下方表单」写入，用户仍可自行修改 */
  preset?: AppliedScope | null;
  /** 已发布供应商列表（生成真实 audits 记录的 FK） */
  suppliers: SupplierOption[];
  /** 新增字段的本地化文案（§18-§21） */
  reqT: AuditRequestFormPhrases;
  locale: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [auditCode, setAuditCode] = useState<string | null>(null);
  // 受控：范围推荐器要能回填审核类型与需求说明
  const [auditType, setAuditType] = useState(0);
  const [message, setMessage] = useState("");
  // 真实审核请求字段
  const [supplierId, setSupplierId] = useState("");
  const [executionMethod, setExecutionMethod] = useState<"announced" | "semi-announced" | "unannounced">("announced");
  const [product, setProduct] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredWindow, setPreferredWindow] = useState("");
  const [previousAudit, setPreviousAudit] = useState(false);
  const [documentsAvailable, setDocumentsAvailable] = useState(false);
  const [additionalComments, setAdditionalComments] = useState("");

  // 用户点「应用到下方表单」后回填。追加而不是覆盖，
  // 避免把用户已经写好的要求冲掉。
  useEffect(() => {
    if (!preset) return;
    setAuditType(preset.auditTypeIndex);
    setMessage((prev) => (prev.trim() ? `${prev.trim()}\n\n${preset.note}` : preset.note));
  }, [preset]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supplierId) {
      setStatus("error");
      setErrMsg(reqT.supplierPlaceholder);
      return;
    }
    // 埋点：发起验厂请求（带验厂类型，用于统计哪种审核最受欢迎；不含任何表单内容）
    trackEvent(ANALYTICS_EVENTS.auditRequest, {
      value: AUDIT_TYPES[auditType] ?? "",
    });
    setStatus("loading");
    setErrMsg(null);
    // 必须在 await 之前捕获表单元素：React 17+ 在事件处理同步段结束后
    // 会把 e.currentTarget 置空，await 之后再读会拿到 null（此前导致
    // 提交成功却报"提交失败"的隐藏 bug）
    const formEl = e.currentTarget;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const payload = {
      supplierId,
      buyerEmail: email,
      buyerCompany: String(form.get("company") || ""),
      buyerCountry: String(form.get("country") || ""),
      auditType: executionMethod,
      category: AUDIT_TYPES[auditType] ?? "",
      standard: String(form.get("standard") || ""),
      product,
      productCategory,
      preferredDate,
      preferredWindow,
      specialRequirements: message,
      previousAuditAvailable: previousAudit,
      documentsAvailable,
      additionalComments,
      locale,
      sourcePath: "/factory-audit/request",
    };
    try {
      const res = await fetch("/api/audit/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok && data.auditCode) {
        // 核心转化：真实审核请求已落库（audits 表，status=requested）
        trackEvent(ANALYTICS_EVENTS.auditRequestSubmit, {
          value: AUDIT_TYPES[auditType] ?? "",
        });
        setAuditCode(data.auditCode);
        setStatus("ok");
        formEl.reset();
        // 受控字段不受 form.reset() 影响，手动清掉，避免成功后仍留着上一单的内容
        setMessage("");
        setAuditType(0);
        setSupplierId("");
        setExecutionMethod("announced");
        setProduct("");
        setProductCategory("");
        setPreferredDate("");
        setPreferredWindow("");
        setPreviousAudit(false);
        setDocumentsAvailable(false);
        setAdditionalComments("");
        return;
      }
      // 区分失败原因：限流给出专门提示，其余统一本地化文案（API 英文 message 不作为用户可见文本）
      setStatus("error");
      if (data?.error === "rate_limited") {
        setErrMsg(t.rateLimited);
      } else if (data?.error === "invalid_supplier") {
        setErrMsg(reqT.supplierPlaceholder);
      } else {
        setErrMsg(t.error);
      }
    } catch {
      setStatus("error");
      setErrMsg(t.error);
    }
  }

  if (status === "ok") {
    return (
      <div className="card p-6 text-center bg-[#f0fdf4]">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{t.success}</p>
        <p className="text-sm text-[#3f7a4e] mt-1">{reqT.requestReceived}</p>
        {auditCode && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-xs uppercase tracking-wide text-[#3f7a4e]">{reqT.yourCode}:</span>
            <code className="rounded bg-white px-2 py-1 font-mono text-sm text-[#1f7a36]">{auditCode}</code>
            <CopyButton value={auditCode} label={reqT.copyCode} copiedLabel={reqT.copyCode} />
          </div>
        )}
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
        <div className="md:col-span-2">
          <label className="text-sm font-medium">
            {reqT.supplier} <span className="text-[#d4232a]">*</span>
          </label>
          <select className="select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">{reqT.supplierPlaceholder}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{reqT.executionMethod}</label>
          <select
            className="select"
            value={executionMethod}
            onChange={(e) => setExecutionMethod(e.target.value as typeof executionMethod)}
          >
            <option value="announced">{reqT.announced}</option>
            <option value="semi-announced">{reqT.semiAnnounced}</option>
            <option value="unannounced">{reqT.unannounced}</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.auditType}</label>
          <select className="select" name="auditType" value={auditType} onChange={(e) => setAuditType(Number(e.target.value))}>
            {AUDIT_TYPES.map((a, i) => (
              <option key={a} value={i}>
                {auditTypeLabels?.[i] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.industry}</label>
          <select className="select" name="industry">
            {INDUSTRIES.map((i, idx) => (
              <option key={i} value={i}>
                {t.industries[idx] ?? i}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.standard}</label>
          <select className="select" name="standard">
            {STANDARDS.map((s) => (
              <option key={s} value={s}>
                {s === "None / Custom" ? t.noneCustom : s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{reqT.product}</label>
          <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder={reqT.product} />
        </div>
        <div>
          <label className="text-sm font-medium">{reqT.productCategory}</label>
          <input
            className="input"
            value={productCategory}
            onChange={(e) => setProductCategory(e.target.value)}
            placeholder={reqT.productCategory}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{reqT.preferredDate}</label>
          <input className="input" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">{reqT.preferredWindow}</label>
          <input
            className="input"
            value={preferredWindow}
            onChange={(e) => setPreferredWindow(e.target.value)}
            placeholder={reqT.preferredWindow}
          />
        </div>
        <div className="md:col-span-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={previousAudit} onChange={(e) => setPreviousAudit(e.target.checked)} />
            {reqT.previousAudit}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={documentsAvailable} onChange={(e) => setDocumentsAvailable(e.target.checked)} />
            {reqT.documentsAvailable}
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">{t.labels.message}</label>
          <textarea
            className="textarea"
            name="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.labels.messageHint}
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">{reqT.additionalComments}</label>
          <textarea
            className="textarea"
            rows={3}
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            placeholder={reqT.additionalComments}
          />
        </div>
      </div>
      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.labels.submitting : t.labels.submit}
      </button>
      {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
