"use client";

// components/admin/SupplierEditor.tsx —— 供应商编辑表单（CS-16 扩展版）
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
  publish: string;
  unpublish: string;
  publishBlocked: string;
  consentHistoryNote: string;
  authorizedTitle: string;
  labels: {
    legalName: string;
    englishName: string;
    companyType: string;
    registrationNumber: string;
    website: string;
    country: string;
    province: string;
    city: string;
    address: string;
    industry: string;
    businessType: string;
    established: string;
    employees: string;
    products: string;
    exportMarkets: string;
    contactPerson: string;
    contactEmail: string;
    phone: string;
    whatsapp: string;
    companyDescription: string;
    verification: string;
    auditStatus: string;
    riskScore: string;
    inspectionHistory: string;
    accessTier: string;
    published: string;
    cluster?: string;
    authorized: string;
    authorizedBy: string;
    authorizedAt: string;
    consentVersion: string;
    consentAt: string;
    consentIp: string;
    consentUserAgent: string;
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
  english_name: string;
  company_type: string;
  registration_number: string;
  website: string;
  country_code: string;
  province: string;
  city: string;
  address: string;
  industry_code: string;
  business_type: string;
  established: string;
  employees: string;
  main_products: string; // 逗号分隔，提交时服务端拆分数组
  export_markets: string; // 逗号分隔
  contact_person: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
  company_description: string;
  verification_status: string;
  audit_status: string;
  risk_score: string;
  inspection_history: string;
  access_tier: "public" | "free" | "paid";
  is_published: boolean;
  cluster_slug: string; // STEP 10-B：关联产业带 slug（空串 = 不关联 / None·REVIEW）
};

/** STEP 10-B：产业带下拉选项（仅已发布集群；value=slug，label=名称 + 国家·省·市）。 */
export type ClusterOption = { slug: string; label: string };

/** 只读授权信息（来自 suppliers 行 + supplier_consents 最新一条）。 */
export type SupplierAuthInfo = {
  profileAuthorized: boolean | null;
  authorizedBy: string | null;
  authorizedAt: string | null;
  consentVersion: string | null;
  consentAt: string | null;
  consentIp: string | null;
  consentUserAgent: string | null;
};

type Props = {
  slug: string;
  initial: SupplierFormValues;
  auth: SupplierAuthInfo;
  countryOptions: { code: string; name: string }[];
  clusterOptions: ClusterOption[];
  dict: SupplierEditorDict;
};

export default function SupplierEditor({ slug, initial, auth, countryOptions, clusterOptions, dict }: Props) {
  const router = useRouter();
  const [v, setV] = useState<SupplierFormValues>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pubStatus, setPubStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [pubError, setPubError] = useState<string | null>(null);

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
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setStatus(data.ok ? "saved" : "error");
      if (data.ok) router.refresh();
    } catch {
      setStatus("error");
    }
  }

  async function handlePublish(published: boolean) {
    setPubStatus("working");
    setPubError(null);
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, is_published: published }),
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setPubStatus("done");
        router.refresh();
      } else {
        // 422 = 未授权不能发布
        setPubStatus("error");
        setPubError(res.status === 422 ? dict.publishBlocked : dict.error);
      }
    } catch {
      setPubStatus("error");
      setPubError(dict.error);
    }
  }

  const L = dict.labels;
  const inputClass =
    "w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none";
  const canPublish = auth.profileAuthorized === true;

  const authText = (val: string | null | boolean) =>
    val === null || val === ""
      ? "—"
      : typeof val === "boolean"
        ? val
          ? L.authorized
          : "No"
        : String(val);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        {/* 公司信息 */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.legalName}</span>
            <input className={`mt-1 ${inputClass}`} value={v.legal_name} onChange={(e) => set("legal_name", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.englishName}</span>
            <input className={`mt-1 ${inputClass}`} value={v.english_name} onChange={(e) => set("english_name", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.companyType}</span>
            <input className={`mt-1 ${inputClass}`} value={v.company_type} onChange={(e) => set("company_type", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.registrationNumber}</span>
            <input className={`mt-1 ${inputClass}`} value={v.registration_number} onChange={(e) => set("registration_number", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.website}</span>
            <input className={`mt-1 ${inputClass}`} value={v.website} onChange={(e) => set("website", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.industry}</span>
            <input className={`mt-1 ${inputClass}`} value={v.industry_code} onChange={(e) => set("industry_code", e.target.value)} />
          </label>
        </div>

        {/* 地址 */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.country}</span>
            <select className={`mt-1 ${inputClass}`} value={v.country_code} onChange={(e) => set("country_code", e.target.value)}>
              <option value="">—</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.province}</span>
            <input className={`mt-1 ${inputClass}`} value={v.province} onChange={(e) => set("province", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.city}</span>
            <input className={`mt-1 ${inputClass}`} value={v.city} onChange={(e) => set("city", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.address}</span>
            <input className={`mt-1 ${inputClass}`} value={v.address} onChange={(e) => set("address", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">
              {L.cluster ?? "Manufacturing Cluster / 产业带"}
            </span>
            <select
              className={`mt-1 ${inputClass}`}
              value={v.cluster_slug}
              onChange={(e) => set("cluster_slug", e.target.value)}
            >
              <option value="">— None / REVIEW —</option>
              {clusterOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 经营信息 */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.businessType}</span>
            <input className={`mt-1 ${inputClass}`} value={v.business_type} onChange={(e) => set("business_type", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.established}</span>
            <input type="number" className={`mt-1 ${inputClass}`} value={v.established} onChange={(e) => set("established", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.employees}</span>
            <input className={`mt-1 ${inputClass}`} value={v.employees} onChange={(e) => set("employees", e.target.value)} />
          </label>
        </div>

        {/* 产品 / 出口 */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.products}</span>
            <input className={`mt-1 ${inputClass}`} value={v.main_products} onChange={(e) => set("main_products", e.target.value)} placeholder="Comma separated" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.exportMarkets}</span>
            <input className={`mt-1 ${inputClass}`} value={v.export_markets} onChange={(e) => set("export_markets", e.target.value)} placeholder="Comma separated" />
          </label>
        </div>

        {/* 联系方式（FREE 层，注册买家可见） */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.contactPerson}</span>
            <input className={`mt-1 ${inputClass}`} value={v.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.contactEmail}</span>
            <input className={`mt-1 ${inputClass}`} value={v.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.phone}</span>
            <input className={`mt-1 ${inputClass}`} value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.whatsapp}</span>
            <input className={`mt-1 ${inputClass}`} value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </label>
        </div>

        {/* 公司描述 */}
        <label className="block">
          <span className="text-sm font-medium text-[#0f172a]">{L.companyDescription}</span>
          <textarea className={`mt-1 ${inputClass}`} rows={3} value={v.company_description} onChange={(e) => set("company_description", e.target.value)} />
        </label>

        {/* 核验 / 风险（高信任字段，谨慎填写） */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.verification}</span>
            <input className={`mt-1 ${inputClass}`} value={v.verification_status} onChange={(e) => set("verification_status", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.auditStatus}</span>
            <input className={`mt-1 ${inputClass}`} value={v.audit_status} onChange={(e) => set("audit_status", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.riskScore}</span>
            <input type="number" min={0} max={100} className={`mt-1 ${inputClass}`} value={v.risk_score} onChange={(e) => set("risk_score", e.target.value)} />
            <span className="mt-1 block text-xs text-[#94a3b8]">{dict.riskHint}</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.inspectionHistory}</span>
            <input type="number" min={0} className={`mt-1 ${inputClass}`} value={v.inspection_history} onChange={(e) => set("inspection_history", e.target.value)} />
          </label>
        </div>

        {/* 访问层 + 发布 */}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[#0f172a]">{L.accessTier}</span>
            <select className={`mt-1 ${inputClass}`} value={v.access_tier} onChange={(e) => set("access_tier", e.target.value as "public" | "free" | "paid")}>
              <option value="public">{dict.tierPublic}</option>
              <option value="free">{dict.tierFree}</option>
              <option value="paid">{dict.tierPaid}</option>
            </select>
            <span className="mt-1 block text-xs text-[#94a3b8]">{dict.tierHint}</span>
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" className="h-4 w-4" checked={v.is_published} onChange={(e) => set("is_published", e.target.checked)} />
            <span className="text-sm font-medium text-[#0f172a]">{L.published}</span>
          </label>
        </div>

        <div className="flex items-center gap-4 border-t border-[#e2e8f0] pt-4">
          <button type="submit" disabled={status === "saving"} className="btn btn-primary disabled:opacity-70">
            {status === "saving" ? dict.saving : dict.save}
          </button>
          {status === "saved" && <span className="text-sm text-[#0f4c81]">{dict.saved}</span>}
          {status === "error" && <span className="text-sm text-[#d4232a]">{dict.error}</span>}
        </div>
      </form>

      {/* 发布 / 下架：规则由服务端强制（未授权不能发布） */}
      <div className="card space-y-3 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canPublish || pubStatus === "working"}
            onClick={() => handlePublish(true)}
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            title={canPublish ? "" : dict.publishBlocked}
          >
            {dict.publish}
          </button>
          <button
            type="button"
            disabled={pubStatus === "working"}
            onClick={() => handlePublish(false)}
            className="btn btn-outline"
          >
            {dict.unpublish}
          </button>
          {pubStatus === "done" && <span className="text-sm text-[#0f4c81]">{dict.saved}</span>}
          {pubStatus === "error" && pubError && <span className="text-sm text-[#d4232a]">{pubError}</span>}
        </div>
        {!canPublish && <p className="text-xs text-[#d4232a]">{dict.publishBlocked}</p>}
      </div>

      {/* Authorization 区块（只读历史元数据） */}
      <div className="card space-y-3 p-6">
        <h2 className="text-lg font-bold text-[#0f172a]">{dict.authorizedTitle}</h2>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#64748b]">{L.authorized}</dt>
            <dd className="font-medium text-[#0f172a]">
              {auth.profileAuthorized === true ? L.authorized : auth.profileAuthorized === false ? "No" : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#64748b]">{L.authorizedBy}</dt>
            <dd className="font-medium text-[#0f172a]">{authText(auth.authorizedBy)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#64748b]">{L.authorizedAt}</dt>
            <dd className="font-medium text-[#0f172a]">{authText(auth.authorizedAt)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#64748b]">{L.consentVersion}</dt>
            <dd className="font-medium text-[#0f172a]">{authText(auth.consentVersion)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#64748b]">{L.consentAt}</dt>
            <dd className="font-medium text-[#0f172a]">{authText(auth.consentAt)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#64748b]">{L.consentIp}</dt>
            <dd className="font-mono text-xs font-medium text-[#0f172a]">{authText(auth.consentIp)}</dd>
          </div>
          <div className="sm:col-span-2 flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#64748b]">{L.consentUserAgent}</dt>
            <dd className="max-w-[60%] truncate text-xs font-medium text-[#0f172a]" title={auth.consentUserAgent ?? ""}>
              {authText(auth.consentUserAgent)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-[#64748b]">{dict.consentHistoryNote}</p>
      </div>
    </div>
  );
}
