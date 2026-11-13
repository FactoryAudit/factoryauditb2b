"use client";

import { useRef, useState } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { RFQ_REQUEST_TYPES, type RfqRequestType } from "@/lib/buyerRequest";

/**
 * 买家需求表单文案。
 *
 * 2026-11-13 重构：从「只问买货」改为「先问要什么，再问对应的问题」。
 * 原来的字段只有 Product / Quantity / Target country，服务型买家（验厂、
 * 验货、找供应商）无处可填 —— 科威特 RFQ-2MSL3N 就是这么被塞进 Product 的。
 */
export type RfqFormDict = {
  labels: {
    requestType: string;
    firstName: string;
    company: string;
    email: string;
    phone: string;
    optional: string;
    product: string;
    quantity: string;
    country: string;
    message: string;
    messageHint: string;
    publicConsent: string;
    submit: string;
    submitting: string;
    factoryName: string;
    factoryLocation: string;
    auditType: string;
    auditTypeHint: string;
    preferredDate: string;
    destinationPort: string;
    inspectionStandard: string;
  };
  /** 五类需求的显示名，键与 RFQ_REQUEST_TYPES 一一对应 */
  types: Record<RfqRequestType, string>;
  /** 按类型而异的说明占位符 */
  hints: { audit: string; inspection: string; other: string };
  /** 供应商报价模式专用（/rfq?request=RFQ-XXXX），买家表单不渲染这组 */
  offer: { price: string; moq: string; leadTime: string; notes: string };
  respond: { to: string; note: string; success: string };
  success: string;
  error: string;
  errorRequired: string;
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

/** 需要买家填「产品」的类型：产品本身 / 产品品类 / 待验货的产品 */
const PRODUCT_REQUIRED_TYPES: readonly RfqRequestType[] = [
  "product",
  "sourcing",
  "inspection",
];

export default function RfqForm({
  t,
  context,
}: {
  t: RfqFormDict;
  context?: RfqFormContext;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string>("");
  // 默认「采购产品」：行业页 / 化学品页带来的都是买货意图，不改变既有转化路径。
  const [requestType, setRequestType] = useState<RfqRequestType>("product");

  // rfq_start 只发一次：用户首次与表单交互即视为产生询价意图
  const startedRef = useRef(false);
  const handleFirstTouch = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent(ANALYTICS_EVENTS.rfqStart);
  };

  const needsProduct = PRODUCT_REQUIRED_TYPES.includes(requestType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg("");
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

    const payload: Record<string, unknown> = {
      // ---- 基础字段 ----
      contact_name: String(form.get("firstName") || ""), // 只进管理员邮件，不落库
      company: String(form.get("company") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      country: String(form.get("country") || ""),
      product: String(form.get("product") || ""),
      quantity: String(form.get("quantity") || ""),
      message: String(form.get("message") || ""),
      // ---- migration 042：先问「要什么」，再按类型收对应字段 ----
      request_type: requestType,
      factory_name: String(form.get("factory_name") || ""),
      factory_location: String(form.get("factory_location") || ""),
      audit_type: String(form.get("audit_type") || ""),
      preferred_date: String(form.get("preferred_date") || ""),
      destination_port: String(form.get("destination_port") || ""),
      inspection_standard: String(form.get("inspection_standard") || ""),
      // ---- CS-02C G3：可空上下文；undefined 的键会被服务端归一为 NULL ----
      locale: context?.locale,
      industry_code: context?.industryCode,
      certifications_req: context?.certificationsReq,
      oem_required: context?.oemRequired,
      target_market: context?.targetMarket,
      incoterm: context?.incoterm,
      source_path: srcParam,
      source_type: context?.sourceType,
      // ---- 反灌水：蜜罐值（真人填不到，脚本会填满所有 input）----
      hp_website: String(form.get("hp_website") || ""),
      // STEP 12 C2：公开与否**只**来自买家明确授权；缺省 false，绝不自动公开
      is_public: allowPublic,
    };

    try {
      const res = await fetch("/api/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
        // 业务真实性：rfq_submit 仅在「真实落库成功」时发。
        // /api/rfq 返回 { ok, stored }；stored=false（落库失败）即使 ok=true 也绝不记为转化，
        // 否则 Analytics 成功事件会与数据库写入真相解耦（见 STEP 08 Phase 1-2 审计）。
        if (data.stored === true) {
          // 核心转化：询价提交成功。
          // 只发事件名，绝不附带表单内容（邮箱/电话/公司名等一律不进 Analytics）。
          trackEvent(ANALYTICS_EVENTS.rfqSubmit);
          formEl.reset();
        }
      } else {
        setStatus("error");
        // 缺必填项与「提交失败」必须分开说：前者用户自己能改，后者要联系我们。
        setErrMsg(data.error === "missing_fields" ? t.errorRequired : t.error);
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
    <form
      onSubmit={handleSubmit}
      onFocus={handleFirstTouch}
      className="card p-6 max-w-2xl space-y-5"
    >
      {/* ---- 第一问：要什么。选错这一步，后面所有问题都会问错 ---- */}
      <fieldset>
        <legend className="text-sm font-medium mb-2">
          {t.labels.requestType} <span className="text-[#d4232a]">*</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {RFQ_REQUEST_TYPES.map((key) => (
            <label
              key={key}
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                requestType === key
                  ? "border-[#171717] bg-[#f5f3ee] font-medium"
                  : "border-[#e5e2db] hover:border-[#c9c4b8]"
              }`}
            >
              <input
                type="radio"
                name="request_type_choice"
                value={key}
                checked={requestType === key}
                onChange={() => setRequestType(key)}
                className="h-4 w-4 shrink-0"
              />
              <span>{t.types[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium" htmlFor="rfq-name">
            {t.labels.firstName}
          </label>
          <input id="rfq-name" className="input" name="firstName" placeholder={t.labels.firstName} />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="rfq-company">
            {t.labels.company} <span className="text-[#d4232a]">*</span>
          </label>
          <input
            id="rfq-company"
            className="input"
            name="company"
            required
            placeholder={t.labels.company}
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="rfq-email">
            {t.labels.email} <span className="text-[#d4232a]">*</span>
          </label>
          <input
            id="rfq-email"
            className="input"
            name="email"
            type="email"
            required
            placeholder={t.labels.email}
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="rfq-phone">
            {t.labels.phone}{" "}
            <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
          </label>
          <input
            id="rfq-phone"
            className="input"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="+1 555 000 0000"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium" htmlFor="rfq-country">
            {t.labels.country} <span className="text-[#d4232a]">*</span>
          </label>
          <input
            id="rfq-country"
            className="input"
            name="country"
            required
            placeholder={t.labels.country}
          />
        </div>

        {/* ---- 按类型展开的字段组 ---- */}
        {needsProduct && (
          <div>
            <label className="text-sm font-medium" htmlFor="rfq-product">
              {t.labels.product} <span className="text-[#d4232a]">*</span>
            </label>
            <input
              id="rfq-product"
              className="input"
              name="product"
              required
              defaultValue={context?.defaultProduct ?? ""}
              placeholder={t.labels.product}
            />
          </div>
        )}

        {(requestType === "product" || requestType === "sourcing") && (
          <div>
            <label className="text-sm font-medium" htmlFor="rfq-quantity">
              {t.labels.quantity}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input
              id="rfq-quantity"
              className="input"
              name="quantity"
              placeholder="5,000 pcs"
            />
          </div>
        )}

        {(requestType === "product" || requestType === "sourcing") && (
          <div>
            <label className="text-sm font-medium" htmlFor="rfq-port">
              {t.labels.destinationPort}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input
              id="rfq-port"
              className="input"
              name="destination_port"
              placeholder="Jebel Ali"
            />
          </div>
        )}

        {(requestType === "audit" || requestType === "inspection") && (
          <div>
            <label className="text-sm font-medium" htmlFor="rfq-factory-name">
              {t.labels.factoryName}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input
              id="rfq-factory-name"
              className="input"
              name="factory_name"
              placeholder={t.labels.factoryName}
            />
          </div>
        )}

        {(requestType === "audit" || requestType === "inspection") && (
          <div>
            <label className="text-sm font-medium" htmlFor="rfq-factory-location">
              {t.labels.factoryLocation}
            </label>
            <input
              id="rfq-factory-location"
              className="input"
              name="factory_location"
              placeholder={t.labels.factoryLocation}
            />
          </div>
        )}

        {requestType === "audit" && (
          <div>
            <label className="text-sm font-medium" htmlFor="rfq-audit-type">
              {t.labels.auditType}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input
              id="rfq-audit-type"
              className="input"
              name="audit_type"
              placeholder={t.labels.auditTypeHint}
            />
          </div>
        )}

        {requestType === "inspection" && (
          <>
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-quantity">
                {t.labels.quantity}{" "}
                <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
              </label>
              <input
                id="rfq-quantity"
                className="input"
                name="quantity"
                placeholder="5,000 pcs"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-aql">
                {t.labels.inspectionStandard}{" "}
                <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
              </label>
              <input
                id="rfq-aql"
                className="input"
                name="inspection_standard"
                placeholder="AQL 2.5"
              />
            </div>
          </>
        )}

        {(requestType === "audit" || requestType === "inspection") && (
          <div>
            <label className="text-sm font-medium" htmlFor="rfq-date">
              {t.labels.preferredDate}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input id="rfq-date" className="input" name="preferred_date" type="date" />
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="rfq-message">
          {t.labels.message} <span className="text-[#d4232a]">*</span>
        </label>
        <textarea
          id="rfq-message"
          className="textarea"
          name="message"
          rows={4}
          required
          defaultValue={context?.defaultMessage ?? ""}
          placeholder={
            requestType === "audit"
              ? t.hints.audit
              : requestType === "inspection"
                ? t.hints.inspection
                : requestType === "other"
                  ? t.hints.other
                  : t.labels.messageHint
          }
        />
      </div>

      {/* STEP 12 C2：公开授权勾选项（默认不勾选 —— 未获明确同意绝不公开） */}
      <label className="flex items-start gap-2 text-sm text-[#3f4650]">
        <input
          type="checkbox"
          name="allowPublic"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{t.labels.publicConsent}</span>
      </label>

      {/* ---- 反灌水蜜罐：不在视觉流里、Tab 也到不了，只有脚本会填 ----
           aria-hidden + tabIndex=-1 保证读屏与键盘用户完全感知不到它 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        style={{ left: "-9999px", top: 0 }}
      >
        <label htmlFor="rfq-website">Website</label>
        <input
          id="rfq-website"
          name="hp_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <button type="submit" disabled={status === "loading"} className="btn btn-accent w-full">
        {status === "loading" ? t.labels.submitting : t.labels.submit}
      </button>
      {status === "error" && <p className="text-sm text-[#d4232a]">{errMsg || t.error}</p>}
    </form>
  );
}
