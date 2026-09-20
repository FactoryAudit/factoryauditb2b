"use client";

import { useRef, useState } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

export type RfqFormDict = {
  labels: {
    firstName: string;
    company: string;
    email: string;
    product: string;
    quantity: string;
    country: string;
    message: string;
    messageHint: string;
    /** STEP 12 C2：公开授权勾选项文案。默认不勾选 —— 未获明确同意绝不公开 RFQ。 */
    publicConsent: string;
    submit: string;
    submitting: string;
  };
  success: string;
  error: string;
};

/**
 * CS-02C G3：行业化上下文（全部可选）。
 * 由宿主页面注入（CS-02A 起 /industry/* 的 RFQ CTA 会带上 industryCode /
 * certificationsReq）；locale 由 /rfq 页传入。缺省时这些字段不进 payload，
 * 服务端落库为 NULL —— 绝不编值。
 */
export type RfqFormContext = {
  locale?: string;
  industryCode?: string;
  certificationsReq?: string[];
  oemRequired?: boolean;
  targetMarket?: string;
  incoterm?: string;
  /** 询价来源页路径；未注入时回退读 URL 的 ?src= 参数，再回退到当前页路径 */
  sourcePath?: string;
  /** STEP 12 C1：显式来源类型（可选）。缺省时由服务端从 source_path 推导（仍走白名单）。 */
  sourceType?: string;
  /**
   * CS-02B：来源页的合法主题预填（化学品名、审核类型名之类）。
   * 只预填**页面的主题本身**，不替买家编需求 —— 与 certificationsReq 的区别在于：
   * 买家点进「柠檬酸」页发询价时，采购品就是柠檬酸，这是页面事实而非推断。
   */
  defaultProduct?: string;
  /** 预填的补充说明，同样只写页面已知事实。用户可自由清空。 */
  defaultMessage?: string;
};

export default function RfqForm({
  t,
  context,
}: {
  t: RfqFormDict;
  context?: RfqFormContext;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  // rfq_start 只发一次：用户首次与表单交互即视为产生询价意图
  const startedRef = useRef(false);
  const handleFirstTouch = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent(ANALYTICS_EVENTS.rfqStart);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    // 必须在 await 之前捕获表单元素：React 17+ 在事件处理同步段结束后
    // 会把 e.currentTarget 置空，await 之后再读会拿到 null（此前导致
    // 提交成功却报"提交失败"的隐藏 bug）
    const formEl = e.currentTarget;
    const form = new FormData(e.currentTarget);
    // CS-02C G3：来源归因。页面注入优先，其次取落地 URL 的 ?src=（行业页 CTA 带参）。
    // STEP 12 C1：来源归因优先级 = 显式注入 → 落地页 ?src= → 当前页路径
    //   （直接进 /rfq 提交 ⇒ 当前路径就是 /rfq ⇒ 服务端推导为 direct）
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : null;
    const srcParam =
      context?.sourcePath ??
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("src")
        : null) ??
      currentPath ??
      undefined;
    // STEP 12 C2：公开授权。勾选 = "on"，未勾选 = null ⇒ 严格 false。
    // 🔴 默认不勾选：没有买家明确同意，绝不把 RFQ 公开出去。
    const allowPublic = Boolean(form.get("allowPublic"));
    const payload = {
      // ---- 既有 12 列对应的字段 ----
      contact_name: String(form.get("firstName") || ""), // 只进管理员邮件，不落库
      company: String(form.get("company") || ""),
      email: String(form.get("email") || ""),
      country: String(form.get("country") || ""),
      product: String(form.get("product") || ""),
      quantity: String(form.get("quantity") || ""),
      message: String(form.get("message") || ""),
      // ---- CS-02C G3：可空上下文；undefined 的键会被服务端归一为 NULL ----
      locale: context?.locale,
      industry_code: context?.industryCode,
      certifications_req: context?.certificationsReq,
      oem_required: context?.oemRequired,
      target_market: context?.targetMarket,
      incoterm: context?.incoterm,
      source_path: srcParam,
      source_type: context?.sourceType,
      // STEP 12 C2：公开与否**只**来自买家明确授权；缺省 false，绝不自动公开
      is_public: allowPublic,
    };
    try {
      // 🔴 CS-02C 修复：此前这里 POST /api/lead —— 只发邮件、**一行不落库**，
      //    /account/rfqs 永远查不到记录，admin 匹配（rfq_matches）也无从谈起。
      //    /api/rfq 才是「正式询价单」通道：落库 + 双邮件 + 限流 3/h。
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setStatus(data.ok ? "ok" : "error");
      // 业务真实性：rfq_submit 仅在「真实落库成功」时发。
      // /api/rfq 返回 { ok, stored }；stored=false（落库失败）即使 ok=true 也绝不记为转化，
      // 否则 Analytics 成功事件会与数据库写入真相解耦（见 STEP 08 Phase 1-2 审计）。
      // 注：UI 成功/失败文案保持原样，不在本轮调整（FOLLOW-UP BUSINESS SEMANTICS ISSUE）。
      if (data.ok && data.stored === true) {
        // 核心转化：询价提交成功。
        // 只发事件名，绝不附带表单内容（邮箱/电话/公司名等一律不进 Analytics）。
        trackEvent(ANALYTICS_EVENTS.rfqSubmit);
        formEl.reset();
      }
    } catch {
      setStatus("error");
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
    <form
      onSubmit={handleSubmit}
      onFocus={handleFirstTouch}
      className="card p-6 max-w-2xl space-y-4"
    >
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
          {/* /api/rfq 强制要求 product（product_required 400）。此前留空提交
              在 /api/lead 时代静默成功，切到落库通道后必须在表单层拦住 */}
          <label className="text-sm font-medium">{t.labels.product}</label>
          <input
            className="input"
            name="product"
            required
            defaultValue={context?.defaultProduct ?? ""}
            placeholder={t.labels.product}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.quantity}</label>
          <input className="input" name="quantity" placeholder={t.labels.quantity} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">{t.labels.message}</label>
        <textarea
          className="textarea"
          name="message"
          rows={4}
          defaultValue={context?.defaultMessage ?? ""}
          placeholder={t.labels.messageHint}
        />
      </div>
      {/* STEP 12 C2：公开授权勾选项（默认不勾选 —— 未获明确同意绝不公开） */}
      <label className="flex items-start gap-2 text-sm text-[#475569]">
        <input
          type="checkbox"
          name="allowPublic"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{t.labels.publicConsent}</span>
      </label>
      <button type="submit" disabled={status === "loading"} className="btn btn-accent w-full">
        {status === "loading" ? t.labels.submitting : t.labels.submit}
      </button>
      {status === "error" && <p className="text-sm text-[#d4232a]">{t.error}</p>}
    </form>
  );
}
