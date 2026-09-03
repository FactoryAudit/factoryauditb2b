"use client";

// components/admin/SupplierEditor.tsx —— 供应商编辑表单
//
// 刻意做得"朴素"：Admin 是你自己用的工具，不是给用户看的门面。
// 优先保证字段全、提交稳、错误看得见，不做花哨交互。
//
// 提交走 PATCH /api/admin/suppliers（服务端白名单 + requireAdmin）。
// 本组件不做任何权限判断 —— 权限在服务端，客户端判断毫无意义。

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SupplierEditorDict = {
  save: string;
  saving: string;
  saved: string;
  error: string;
  labels: {
    legalName: string;
    city: string;
    industry: string;
    businessType: string;
    established: string;
    employees: string;
    verification: string;
    riskScore: string;
    auditStatus: string;
    inspectionHistory: string;
    accessTier: string;
    published: string;
  };
  tierPublic: string;
  tierFree: string;
  tierPaid: string;
  riskHint: string;
  tierHint: string;
};

export type SupplierFormValues = {
  slug: string;
  legal_name: string;
  city: string;
  industry_code: string;
  business_type: string;
  established: string;
  employees: string;
  verification_status: string;
  risk_score: string;
  audit_status: string;
  inspection_history: string;
  access_tier: "public" | "free" | "paid";
  is_published: boolean;
};

type Props = {
  slug: string;
  initial: SupplierFormValues;
  dict: SupplierEditorDict;
};

export default function SupplierEditor({ slug, initial, dict }: Props) {
  const router = useRouter();
  const [v, setV] = useState<SupplierFormValues>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const set = <K extends keyof SupplierFormValues>(k: K, val: SupplierFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, slug }),
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean };
      setStatus(data.ok ? "saved" : "error");
      if (data.ok) router.refresh();
    } catch {
      setStatus("error");
    }
  }

  const L = dict.labels;
  const inputClass =
    "w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.legalName}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={v.legal_name}
            onChange={(e) => set("legal_name", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.city}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.industry}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={v.industry_code}
            onChange={(e) => set("industry_code", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.businessType}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={v.business_type}
            onChange={(e) => set("business_type", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.established}</span>
          <input
            type="number"
            className={`mt-1 ${inputClass}`}
            value={v.established}
            onChange={(e) => set("established", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.employees}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={v.employees}
            onChange={(e) => set("employees", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.verification}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={v.verification_status}
            onChange={(e) => set("verification_status", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.auditStatus}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={v.audit_status}
            onChange={(e) => set("audit_status", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.riskScore}</span>
          <input
            type="number"
            min={0}
            max={100}
            className={`mt-1 ${inputClass}`}
            value={v.risk_score}
            onChange={(e) => set("risk_score", e.target.value)}
          />
          <span className="mt-1 block text-xs text-[#94a3b8]">{dict.riskHint}</span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.inspectionHistory}</span>
          <input
            type="number"
            min={0}
            className={`mt-1 ${inputClass}`}
            value={v.inspection_history}
            onChange={(e) => set("inspection_history", e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.accessTier}</span>
          <select
            className={`mt-1 ${inputClass}`}
            value={v.access_tier}
            onChange={(e) => set("access_tier", e.target.value as "public" | "free" | "paid")}
          >
            <option value="public">{dict.tierPublic}</option>
            <option value="free">{dict.tierFree}</option>
            <option value="paid">{dict.tierPaid}</option>
          </select>
          <span className="mt-1 block text-xs text-[#94a3b8]">{dict.tierHint}</span>
        </label>

        <label className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={v.is_published}
            onChange={(e) => set("is_published", e.target.checked)}
          />
          <span className="text-sm font-medium text-[#0f172a]">{L.published}</span>
        </label>
      </div>

      <div className="flex items-center gap-4 border-t border-[#e2e8f0] pt-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="btn btn-primary disabled:opacity-70"
        >
          {status === "saving" ? dict.saving : dict.save}
        </button>
        {status === "saved" && (
          <span className="text-sm text-[#0f4c81]">{dict.saved}</span>
        )}
        {status === "error" && (
          <span className="text-sm text-[#d4232a]">{dict.error}</span>
        )}
      </div>
    </form>
  );
}
