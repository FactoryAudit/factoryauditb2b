"use client";

// components/portal/SupplierProfileForm.tsx —— 供应商自助「完善档案」
//
// 为什么需要：13 章尽职调查报告要的字段，此前只有管理员后台能填。供应商自己填不了，
//   报告就只能靠运营手抄。本表单让供应商把「自己能确定的事实」补上，
//   后台「从档案预填」时自动带进报告。
//
// 🔴 这里**没有** contact_email：它是归属主键，供应商改了就失去对自己档案的访问权。
// 🔴 这里**没有**发布/核验/风险字段：那些是平台判断，供应商填了等于自己发证书。

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SupplierProfileValues = {
  legal_name: string;
  english_name: string;
  company_type: string;
  business_type: string;
  registration_number: string;
  established: string;
  address: string;
  city: string;
  province: string;
  industry_code: string;
  employees: string;
  legal_representative: string;
  registered_capital: string;
  business_scope: string;
  production_workers: string;
  factory_size: string;
  monthly_output: string;
  production_capacity: string;
  export_since: string;
  main_products: string;
  export_markets: string;
  reference_customers: string;
  contact_person: string;
  phone: string;
  whatsapp: string;
  website: string;
  company_description: string;
};

const BUSINESS_TYPES = [
  { v: "", zh: "请选择", en: "Select…" },
  { v: "factory", zh: "自产制造", en: "Manufacturer" },
  { v: "trading", zh: "贸易", en: "Trading" },
  { v: "both", zh: "自产 + 贸易", en: "Both" },
  { v: "other", zh: "其他", en: "Other" },
];

export default function SupplierProfileForm({
  supplierId,
  email,
  initial,
  zh,
}: {
  supplierId: string;
  email: string;
  initial: SupplierProfileValues;
  zh: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<SupplierProfileValues>(initial);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const set = (k: keyof SupplierProfileValues, val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    setOkMsg(null);
    setErrMsg(null);
  };

  const inputCls =
    "mt-1 w-full rounded-md border border-[#d9d5cc] bg-white px-3 py-2.5 text-sm text-[#171717] outline-none transition focus:border-[#e07a49]";

  function Field({
    k,
    labelZh,
    labelEn,
    placeholder,
    type = "text",
    multiline = false,
  }: {
    k: keyof SupplierProfileValues;
    labelZh: string;
    labelEn: string;
    placeholder?: string;
    type?: string;
    multiline?: boolean;
  }) {
    return (
      <label className="block">
        <span className="text-[13px] font-semibold text-[#2b2b2b]">
          {zh ? labelZh : labelEn}
        </span>
        {multiline ? (
          <textarea
            className={inputCls}
            rows={3}
            value={v[k]}
            placeholder={placeholder}
            onChange={(e) => set(k, e.target.value)}
          />
        ) : (
          <input
            type={type}
            className={inputCls}
            value={v[k]}
            placeholder={placeholder}
            onChange={(e) => set(k, e.target.value)}
          />
        )}
      </label>
    );
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setOkMsg(null);
    setErrMsg(null);
    try {
      const payload: Record<string, unknown> = {
        supplierId,
        email,
        legal_name: v.legal_name,
        english_name: v.english_name,
        company_type: v.company_type,
        business_type: v.business_type,
        registration_number: v.registration_number,
        address: v.address,
        city: v.city,
        province: v.province,
        industry_code: v.industry_code,
        employees: v.employees,
        legal_representative: v.legal_representative,
        registered_capital: v.registered_capital,
        business_scope: v.business_scope,
        production_workers: v.production_workers,
        factory_size: v.factory_size,
        monthly_output: v.monthly_output,
        production_capacity: v.production_capacity,
        main_products: v.main_products.split(",").map((s) => s.trim()).filter(Boolean),
        export_markets: v.export_markets.split(",").map((s) => s.trim()).filter(Boolean),
        reference_customers: v.reference_customers,
        contact_person: v.contact_person,
        phone: v.phone,
        whatsapp: v.whatsapp,
        website: v.website,
        company_description: v.company_description,
      };
      // 数值字段只在填了才提交（空串不发送，避免把"没填"变成 0）
      if (v.established.trim()) payload.established = v.established.trim();
      if (v.export_since.trim()) payload.export_since = v.export_since.trim();

      const res = await fetch("/api/supplier-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setErrMsg(`${zh ? "保存失败：" : "Save failed: "}${j?.error ?? res.status}`);
        return;
      }
      setOkMsg(zh ? `已保存（${j.updated} 项）` : `Saved (${j.updated} fields)`);
      router.refresh();
    } catch {
      setErrMsg(zh ? "网络错误，请重试" : "Network error, please retry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 基本信息 */}
      <section className="rounded-xl border border-[#ecebe7] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">
          {zh ? "基本信息" : "Basic information"}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field k="legal_name" labelZh="企业法定名称（中文）" labelEn="Legal name (Chinese)" placeholder="与营业执照一致" />
          <Field k="english_name" labelZh="企业英文名称" labelEn="English name" placeholder="As shown to buyers" />
          <Field k="company_type" labelZh="公司类型" labelEn="Company type" placeholder="如 有限责任公司" />
          <label className="block">
            <span className="text-[13px] font-semibold text-[#2b2b2b]">
              {zh ? "企业类型" : "Business type"}
            </span>
            <select
              className={inputCls}
              value={v.business_type}
              onChange={(e) => set("business_type", e.target.value)}
            >
              {BUSINESS_TYPES.map((o) => (
                <option key={o.v} value={o.v}>
                  {zh ? o.zh : o.en}
                </option>
              ))}
            </select>
          </label>
          <Field k="registration_number" labelZh="营业执照号码 / 注册号" labelEn="Business licence no." placeholder="统一社会信用代码" />
          <Field k="established" labelZh="成立年份" labelEn="Year established" placeholder="2013" type="number" />
        </div>
      </section>

      {/* 地址与行业 */}
      <section className="rounded-xl border border-[#ecebe7] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">
          {zh ? "地址与行业" : "Address & industry"}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field k="address" labelZh="工厂 / 注册地址" labelEn="Factory / registered address" placeholder="详细街道门牌" />
          </div>
          <Field k="province" labelZh="省份" labelEn="Province" />
          <Field k="city" labelZh="城市" labelEn="City" />
          <Field k="industry_code" labelZh="所属行业" labelEn="Industry" placeholder="如 hardware-tools" />
        </div>
      </section>

      {/* 法人信息 */}
      <section className="rounded-xl border border-[#ecebe7] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">
          {zh ? "法人信息（进入报告主体档案）" : "Legal & registration (feeds the report)"}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field k="legal_representative" labelZh="法定代表人" labelEn="Legal representative" />
          <Field k="registered_capital" labelZh="注册资本" labelEn="Registered capital" placeholder="人民币 800 万元" />
          <div className="sm:col-span-2">
            <Field
              k="business_scope"
              labelZh="经营范围"
              labelEn="Business scope"
              placeholder="取自营业执照原文"
              multiline
            />
          </div>
        </div>
      </section>

      {/* 规模与产能 */}
      <section className="rounded-xl border border-[#ecebe7] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">
          {zh ? "规模与产能（进入报告生产能力章节）" : "Scale & capacity"}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field k="employees" labelZh="员工总数" labelEn="Total employees" placeholder="如 120-200" />
          <Field k="production_workers" labelZh="生产一线人数" labelEn="Production workers" />
          <Field k="factory_size" labelZh="厂房面积" labelEn="Factory area" placeholder="如 12,000 m²" />
          <Field k="monthly_output" labelZh="月产量" labelEn="Monthly output" />
          <Field k="production_capacity" labelZh="年产能" labelEn="Annual capacity" />
          <Field k="export_since" labelZh="出口起始年份" labelEn="Export since" placeholder="2015" type="number" />
        </div>
      </section>

      {/* 产品与市场 */}
      <section className="rounded-xl border border-[#ecebe7] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">
          {zh ? "产品与市场" : "Products & markets"}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field k="main_products" labelZh="主营产品（逗号分隔）" labelEn="Main products (comma separated)" placeholder="Precision CNC parts, Fasteners" />
          <Field k="export_markets" labelZh="主要出口市场（逗号分隔）" labelEn="Export markets (comma separated)" placeholder="Germany, United States" />
          <div className="sm:col-span-2">
            <Field
              k="reference_customers"
              labelZh="参考客户（逗号分隔，可不填）"
              labelEn="Reference customers (optional)"
              placeholder="仅在获得客户同意后填写"
            />
          </div>
        </div>
      </section>

      {/* 联系与描述 */}
      <section className="rounded-xl border border-[#ecebe7] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">
          {zh ? "联系方式与公司简介" : "Contact & description"}
        </h2>
        <p className="mt-1 text-xs text-[#8c8982]">
          {zh
            ? "登录邮箱不可在此修改（它是你与档案的绑定凭证）。如需更换请联系平台。"
            : "Your sign-in email cannot be changed here — it is what binds you to this listing."}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field k="contact_person" labelZh="联系人" labelEn="Contact person" />
          <Field k="phone" labelZh="电话" labelEn="Phone" />
          <Field k="whatsapp" labelZh="WhatsApp" labelEn="WhatsApp" />
          <Field k="website" labelZh="公司官网" labelEn="Website" placeholder="https://" />
          <div className="sm:col-span-2">
            <Field k="company_description" labelZh="公司简介" labelEn="Company description" multiline />
          </div>
        </div>
      </section>

      {/* 提交 */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-[#e07a49] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d06c3c] disabled:opacity-60"
        >
          {busy ? (zh ? "保存中…" : "Saving…") : zh ? "保存档案" : "Save profile"}
        </button>
        {okMsg ? <span className="text-sm text-[#2e7d4f]">{okMsg}</span> : null}
        {errMsg ? <span className="text-sm text-[#b42318]">{errMsg}</span> : null}
      </div>

      <p className="text-xs leading-relaxed text-[#8c8982]">
        {zh
          ? "这些字段会进入你的尽职调查报告。留空的项在报告里显示「无记录」，我们不会替你编造。涉诉、税务评级、现场核验由平台核验后另行填入。"
          : "These fields feed your due-diligence report. Anything you leave blank shows as “no record” — we will not invent it. Litigation, tax rating and on-site findings are added by the platform after verification."}
      </p>
    </div>
  );
}
