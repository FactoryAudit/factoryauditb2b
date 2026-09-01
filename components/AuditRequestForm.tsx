"use client";

import { useEffect, useState } from "react";
// 审核类型取值由 lib/auditScope 单一提供：顺序即下标，页面与范围推荐共用同一份，
// 避免两边各写一份数组导致下标对不上
import { AUDIT_TYPES } from "@/lib/auditScope";
import type { AppliedScope } from "./AuditScopeAdvisor";

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
};

// 已迁至 lib/auditScope（AUDIT_TYPES），此处不再本地声明。

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

export default function AuditRequestForm({
  t,
  auditTypeLabels,
  preset,
}: {
  t: AuditRequestFormDict;
  /** 审核类型的展示文案，顺序与 AUDIT_TYPES 一致；缺省回退英文原值 */
  auditTypeLabels?: string[];
  /** 由审核范围推荐器「应用到下方表单」写入，用户仍可自行修改 */
  preset?: AppliedScope | null;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // 受控：范围推荐器要能回填审核类型与需求说明
  const [auditType, setAuditType] = useState(0);
  const [message, setMessage] = useState("");

  // 用户点「应用到下方表单」后回填。追加而不是覆盖，
  // 避免把用户已经写好的要求冲掉。
  useEffect(() => {
    if (!preset) return;
    setAuditType(preset.auditTypeIndex);
    setMessage((prev) => (prev.trim() ? `${prev.trim()}\n\n${preset.note}` : preset.note));
  }, [preset]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);
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
        supplierName: String(form.get("supplierName") || ""),
        country: String(form.get("country") || ""),
        sourcing: String(form.get("industry") || ""),
        message: [
          // 下拉的 value 改成了下标（与 lib/auditScope 的下标对齐），
          // 这里换回英文原值再入库，避免邮件里出现「Audit type: 2」
          `Audit type: ${AUDIT_TYPES[auditType] ?? ""}`,
          `Standard: ${String(form.get("standard") || "")}`,
          message,
        ]
          .filter(Boolean)
          .join("\n"),
        tool: "audit-request",
      },
    };
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
        formEl.reset();
        // 受控字段不受 form.reset() 影响，手动清掉，避免成功后仍留着上一单的内容
        setMessage("");
        setAuditType(0);
        return;
      }
      // 区分失败原因：限流给出专门提示，其余展示服务端消息（有则用）
      setStatus("error");
      if (data?.error === "rate_limited") {
        setErrMsg(t.rateLimited);
      } else if (typeof data?.message === "string" && data.message) {
        setErrMsg(data.message);
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
          <label className="text-sm font-medium">{t.labels.supplierName}</label>
          <input className="input" name="supplierName" placeholder={t.labels.supplierName} />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.industry}</label>
          <select className="select" name="industry">
            {INDUSTRIES.map((i, idx) => (
              <option key={i} value={i}>{t.industries[idx] ?? i}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.auditType}</label>
          <select
            className="select"
            name="auditType"
            value={auditType}
            onChange={(e) => setAuditType(Number(e.target.value))}
          >
            {AUDIT_TYPES.map((a, i) => (
              <option key={a} value={i}>
                {auditTypeLabels?.[i] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.standard}</label>
          <select className="select" name="standard">
            {STANDARDS.map((s) => (
              <option key={s} value={s}>{s === "None / Custom" ? t.noneCustom : s}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">{t.labels.message}</label>
        <textarea
          className="textarea"
          name="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.labels.messageHint}
        />
      </div>
      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.labels.submitting : t.labels.submit}
      </button>
      {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
