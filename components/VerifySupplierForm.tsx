"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

export type VerifySupplierFormDict = {
  supplierUrlLabel: string;
  supplierUrlHint: string;
  supplierUrlPlaceholder: string;
  supplierNameLabel: string;
  supplierNameHint: string;
  supplierNamePlaceholder: string;
  eitherHint: string;
  emailLabel: string;
  emailHint: string;
  emailPlaceholder: string;
  nameLabel: string;
  companyLabel: string;
  countryLabel: string;
  productLabel: string;
  productPlaceholder: string;
  valueLabel: string;
  valueHint: string;
  valueOptions: {
    lt5k: string;
    "5k-25k": string;
    "25k-100k": string;
    gt100k: string;
    unknown: string;
  };
  urgencyLabel: string;
  urgencyOptions: { now: string; "30days": string; planning: string };
  concernsLabel: string;
  concernsHint: string;
  submit: string;
  submitting: string;
  privacyNote: string;
  notAVerdict: string;
  successTitle: string;
  successLead: string;
  errorGeneric: string;
  errorRateLimited: string;
  errorInvalidEmail: string;
  errorSupplierRequired: string;
};

type Props = {
  t: VerifySupplierFormDict;
  /** 语言前缀路径（如 "" 或 "/zh"），用于拼 API 请求里的 referrer 语义标签 */
  localePrefix?: string;
};

// STEP-05：Verify Supplier 表单。
//
// 闭环的**起点**：买家把「我拿不准的这个供应商」交给我们。
// 本组件只负责「收集 + 提交 + 反馈」，不做任何评分/判定 ——
// 第一版明确不做自动评分，也不承诺结果。
//
// 🔴 关键设计：**供应商名由客户端从 URL 读取，不由服务端读 searchParams**。
//
// 为什么：只要页面读了 `searchParams`，Next 就把该路由排除出静态生成
// （实测对照：/en/tools 不读 ⇒ 预渲染 true；/en/suppliers 读 ⇒ false）。
// 本页是 SEO 落地页，必须能预渲染成静态 HTML —— 否则
//   · 站点地图提交了它，构建产物里却没有对应静态文件；
//   · 首次访问落到服务端渲染，白拿一次 Supabase 往返。
// 预填只是**外观**，服务端渲染它没有任何收益，因此放到 useEffect 里做：
// 服务端渲染出的 HTML 是「无人名预填」的干净版本（可静态化），
// 客户端挂载后再按 ?supplier= 填上。
export default function VerifySupplierForm({ t, localePrefix = "" }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  /** 从 ?supplier= 解析出的档案 slug：既是后台关联键，也是供应商名的查询键 */
  const [linkedSlug, setLinkedSlug] = useState<string>("");
  /** 服务端查不到该 slug 时的兜底：把 URL 里原样带的供应商名填进文本框 */
  const [slugFallback, setSlugFallback] = useState<string>("");

  useEffect(() => {
    // useSearchParams() 会强制 Suspense 边界并进一步影响静态化，
    // 这里直接读 window.location —— 效果等价、零框架副作用。
    const sp = new URLSearchParams(window.location.search);
    const slug = (sp.get("supplier") ?? "").trim().slice(0, 200);
    const name = (sp.get("supplier_name") ?? "").trim().slice(0, 300);
    if (slug) setLinkedSlug(slug);
    if (name) setSlugFallback(name);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const supplierUrl = String(form.get("supplierUrl") || "").trim().slice(0, 500);
    const supplierCompanyName = String(form.get("supplierCompanyName") || "")
      .trim()
      .slice(0, 300);

    // 主字段校验放在最前：没有「要查谁」，这条请求对后台零价值
    if (!supplierUrl && !supplierCompanyName) {
      setStatus("error");
      setErrMsg(t.errorSupplierRequired);
      return;
    }

    const fields = {
      buyerEmail: String(form.get("buyerEmail") || "").trim().toLowerCase(),
      contactName: String(form.get("contactName") || "").trim(),
      buyerCompany: String(form.get("buyerCompany") || "").trim(),
      buyerCountry: String(form.get("buyerCountry") || "").trim(),
      productCategory: String(form.get("productCategory") || "").trim(),
      orderValueBand: String(form.get("orderValueBand") || ""),
      urgency: String(form.get("urgency") || ""),
      concerns: String(form.get("concerns") || "").trim().slice(0, 2000),
    };

    if (!fields.buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.buyerEmail)) {
      setStatus("error");
      setErrMsg(t.errorInvalidEmail);
      return;
    }

    try {
      const res = await fetch("/api/verify-supplier/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: linkedSlug,
          supplierUrl,
          supplierCompanyName,
          fields,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        trackEvent(ANALYTICS_EVENTS.verifySupplierSubmit, {
          slug: linkedSlug || "external",
        });
        setReferenceId(typeof data.referenceId === "string" ? data.referenceId : null);
        setStatus("ok");
        formEl.reset();
        return;
      }
      setStatus("error");
      // 只显示本地化文案：API 的英文 message 不作为用户可见文本
      setErrMsg(
        data?.error === "rate_limited"
          ? t.errorRateLimited
          : data?.error === "invalid_email"
            ? t.errorInvalidEmail
            : data?.error === "supplier_required"
              ? t.errorSupplierRequired
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
        {referenceId && (
          <p className="text-sm font-mono font-semibold text-[#0f172a] mt-3">{referenceId}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-xl space-y-4">
      {/* 供应商：URL 或公司名，填其一即可 */}
      <div>
        <label htmlFor="vs-url" className="text-sm font-medium">
          {t.supplierUrlLabel}
        </label>
        <input
          id="vs-url"
          name="supplierUrl"
          type="text"
          placeholder={t.supplierUrlPlaceholder}
          className="input"
        />
        <p className="text-xs text-[#64748b] mt-1">{t.supplierUrlHint}</p>
      </div>

      <div>
        <label htmlFor="vs-name" className="text-sm font-medium">
          {t.supplierNameLabel}
        </label>
        <input
          id="vs-name"
          name="supplierCompanyName"
          type="text"
          defaultValue={slugFallback}
          placeholder={t.supplierNamePlaceholder}
          className="input"
        />
        <p className="text-xs text-[#64748b] mt-1">{t.supplierNameHint}</p>
      </div>

      <p className="text-xs text-[#8a5410] bg-[#fff4e0] rounded-md px-2 py-1.5">
        {t.eitherHint}
      </p>

      {/* 买家联系方式 */}
      <div>
        <label htmlFor="vs-email" className="text-sm font-medium">
          {t.emailLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="vs-email"
          name="buyerEmail"
          type="email"
          required
          placeholder={t.emailPlaceholder}
          className="input"
        />
        <p className="text-xs text-[#64748b] mt-1">{t.emailHint}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="vs-contact" className="text-sm font-medium">
            {t.nameLabel}
          </label>
          <input id="vs-contact" name="contactName" type="text" className="input" />
        </div>
        <div>
          <label htmlFor="vs-company" className="text-sm font-medium">
            {t.companyLabel}
          </label>
          <input id="vs-company" name="buyerCompany" type="text" className="input" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="vs-country" className="text-sm font-medium">
            {t.countryLabel}
          </label>
          <input id="vs-country" name="buyerCountry" type="text" className="input" />
        </div>
        <div>
          <label htmlFor="vs-product" className="text-sm font-medium">
            {t.productLabel}
          </label>
          <input
            id="vs-product"
            name="productCategory"
            type="text"
            placeholder={t.productPlaceholder}
            className="input"
          />
        </div>
      </div>

      {/* 金额档位 + 紧急度：单选，给后台排优先级用 */}
      <div>
        <label htmlFor="vs-value" className="text-sm font-medium">
          {t.valueLabel}
        </label>
        <select id="vs-value" name="orderValueBand" defaultValue="unknown" className="input">
          <option value="lt5k">{t.valueOptions.lt5k}</option>
          <option value="5k-25k">{t.valueOptions["5k-25k"]}</option>
          <option value="25k-100k">{t.valueOptions["25k-100k"]}</option>
          <option value="gt100k">{t.valueOptions.gt100k}</option>
          <option value="unknown">{t.valueOptions.unknown}</option>
        </select>
        <p className="text-xs text-[#64748b] mt-1">{t.valueHint}</p>
      </div>

      <div>
        <label htmlFor="vs-urgency" className="text-sm font-medium">
          {t.urgencyLabel}
        </label>
        <select id="vs-urgency" name="urgency" defaultValue="30days" className="input">
          <option value="now">{t.urgencyOptions.now}</option>
          <option value="30days">{t.urgencyOptions["30days"]}</option>
          <option value="planning">{t.urgencyOptions.planning}</option>
        </select>
      </div>

      <div>
        <label htmlFor="vs-concerns" className="text-sm font-medium">
          {t.concernsLabel}
        </label>
        <textarea
          id="vs-concerns"
          name="concerns"
          rows={4}
          className="textarea"
          placeholder={t.concernsHint}
        />
      </div>

      <p className="text-xs text-[#64748b]">{t.privacyNote}</p>
      <p className="text-xs text-[#8a5410] bg-[#fff4e0] rounded-md px-2 py-1.5">{t.notAVerdict}</p>

      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.submitting : t.submit}
      </button>
      {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
