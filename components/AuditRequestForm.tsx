"use client";

import { useState } from "react";

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
};

const AUDIT_TYPES = [
  "Factory Verification",
  "Factory Audit",
  "Supplier Quality Audit",
  "Production Capacity Audit",
  "Social Compliance Audit",
  "Environmental Audit",
  "Technical Audit",
  "Custom Buyer Audit",
];

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

export default function AuditRequestForm({ t }: { t: AuditRequestFormDict }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

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
          `Audit type: ${String(form.get("auditType") || "")}`,
          `Standard: ${String(form.get("standard") || "")}`,
          String(form.get("message") || ""),
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
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.auditType}</label>
          <select className="select" name="auditType">
            {AUDIT_TYPES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.standard}</label>
          <select className="select" name="standard">
            {STANDARDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">{t.labels.message}</label>
        <textarea className="textarea" name="message" rows={4} placeholder={t.labels.messageHint} />
      </div>
      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.labels.submitting : t.labels.submit}
      </button>
      {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
