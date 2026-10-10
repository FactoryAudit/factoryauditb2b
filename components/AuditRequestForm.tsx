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
  // R85：supplierSource —— 'platform' 走目录下拉，'external' 走客户自填的工厂信息。
  //   默认 'platform'（与改造前一致，老用户无感）；没有可选供应商时默认 'external'。
  const [supplierSource, setSupplierSource] = useState<"platform" | "external">(
    suppliers.length > 0 ? "platform" : "external"
  );
  const [supplierId, setSupplierId] = useState("");
  // R85：外部供应商（客户自述，未核验）
  const [extName, setExtName] = useState("");
  const [extContact, setExtContact] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extPhone, setExtPhone] = useState("");
  const [extAddress, setExtAddress] = useState("");
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
    // R85：先按来源分别校验 —— 两条路径的必填项完全不同，不能用同一套判断。
    if (supplierSource === "platform") {
      if (!supplierId) {
        setStatus("error");
        setErrMsg(reqT.supplierPlaceholder);
        return;
      }
    } else {
      if (!extName.trim()) {
        setStatus("error");
        setErrMsg(reqT.externalNameRequired);
        return;
      }
      // 邮箱与电话至少要有一项：没有联系方式，运营无法联系工厂安排审核。
      if (!extEmail.trim() && !extPhone.trim()) {
        setStatus("error");
        setErrMsg(reqT.externalContactRequired);
        return;
      }
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
      supplierSource,
      // 平台内路径才带 supplierId；external 时传 null（服务端 CHECK 要求二选一自洽）
      supplierId: supplierSource === "platform" ? supplierId : null,
      externalSupplier:
        supplierSource === "external"
          ? {
              name: extName.trim(),
              contact: extContact.trim() || null,
              email: extEmail.trim() || null,
              phone: extPhone.trim() || null,
              address: extAddress.trim() || null,
            }
          : null,
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
        // R85：外部供应商字段一并清掉，并把来源复位到默认（有目录就回平台内）
        setSupplierSource(suppliers.length > 0 ? "platform" : "external");
        setExtName("");
        setExtContact("");
        setExtEmail("");
        setExtPhone("");
        setExtAddress("");
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
      } else if (data?.error === "invalid_external_supplier") {
        // R85：服务端回传具体缺哪个字段（与前端校验同源，避免前后端口径不一）
        const f = Array.isArray(data?.fields) ? String(data.fields[0]) : "";
        setErrMsg(f === "externalSupplier.name" ? reqT.externalNameRequired : reqT.externalContactRequired);
      } else if (data?.error === "invalid_input" && Array.isArray(data?.fields) && data.fields.length > 0) {
        // R76 起 API 会回传出错字段名（path），让用户知道该改哪里，
        // 而不是笼统的「出错了」。字段名走本地化映射，缺失则回退原字段名。
        const labels: Record<string, string> = {
          supplierId: reqT.supplier,
          buyerEmail: t.labels.email,
          buyerCompany: t.labels.company,
          buyerCountry: t.labels.country,
          auditType: t.labels.auditType,
          standard: t.labels.standard,
        };
        const named = (data.fields as string[]).map((f) => labels[f] ?? f).join("、");
        setErrMsg(`${t.error} (${named})`);
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {reqT.sourceLabel} <span className="text-[#d4232a]">*</span>
          </label>
          {/* R85：来源二选一。用 radio 而不是下拉 —— 这是一个「先去哪条路」的分叉，
              选中后展开的字段完全不同，radio 能让两条路同时可见。 */}
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="supplierSource"
                value="platform"
                checked={supplierSource === "platform"}
                onChange={() => setSupplierSource("platform")}
                disabled={suppliers.length === 0}
              />
              {reqT.sourcePlatform}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="supplierSource"
                value="external"
                checked={supplierSource === "external"}
                onChange={() => setSupplierSource("external")}
              />
              {reqT.sourceExternal}
            </label>
          </div>
          {/* 目录里一家都没有时，平台内选项不可选，必须明说原因，
              否则用户看到的是「一个点不动的选项」，不知道发生了什么。 */}
          {suppliers.length === 0 && (
            <p className="mt-1 text-xs text-[#6d6b66]">{reqT.supplierPlaceholder}</p>
          )}
        </div>

        {supplierSource === "platform" ? (
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
        ) : (
          <div className="md:col-span-2 space-y-3 rounded-md border border-[#ebe8e1] bg-[#fbfaf7] p-3">
            {/* 讲清楚「为什么必须给联系方式」：没有它我们就触达不了工厂，审核无从安排。 */}
            <p className="text-xs text-[#6d6b66]">{reqT.externalHint}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">
                  {reqT.externalName} <span className="text-[#d4232a]">*</span>
                </label>
                <input
                  className="input"
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  placeholder={reqT.externalName}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{reqT.externalContact}</label>
                <input
                  className="input"
                  value={extContact}
                  onChange={(e) => setExtContact(e.target.value)}
                  placeholder={reqT.externalContact}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {reqT.externalEmail} <span className="text-[#d4232a]">*</span>
                </label>
                <input
                  className="input"
                  type="email"
                  value={extEmail}
                  onChange={(e) => setExtEmail(e.target.value)}
                  placeholder={reqT.externalEmail}
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {reqT.externalPhone} <span className="text-[#d4232a]">*</span>
                </label>
                <input
                  className="input"
                  value={extPhone}
                  onChange={(e) => setExtPhone(e.target.value)}
                  placeholder={reqT.externalPhone}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">{reqT.externalAddress}</label>
                <input
                  className="input"
                  value={extAddress}
                  onChange={(e) => setExtAddress(e.target.value)}
                  placeholder={reqT.externalAddress}
                />
              </div>
              {/* 邮箱与电话二选一：两个框都标了 *，但实际是「至少一项」，
                  这里用一行小字说明真实规则，避免用户以为必须两个都填。 */}
              <p className="md:col-span-2 text-xs text-[#6d6b66]">{reqT.externalContactRequired}</p>
            </div>
          </div>
        )}
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
