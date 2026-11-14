"use client";

import { useRef, useState } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

// 字段结构（与 lib/supplierNetwork.ts 的 REGISTRATION_FIELDS 对应）：
// 每个区块渲染一组字段，label 文案来自字典 form.labels。
// ⚠️ certificates 不在下表 —— 它是可重复的结构化子表单（见 certs state），
//    提交时被序列化成 certificates（人类可读多行）+ certificatesJson（结构化数组）。
const SECTION_FIELDS: Record<string, string[]> = {
  company: [
    "companyName",
    "englishName",
    "companyType",
    "industryCode",
    "registrationNumber",
    "establishedYear",
    "website",
    "companyDescription",
  ],
  factory: ["factoryCountry", "factoryCity", "factoryAddress", "employees", "factorySize"],
  products: ["mainProducts", "productionCapacity", "monthlyOutput"],
  export: ["exportMarkets", "exportSince"],
  contact: ["contactName", "contactEmail", "contactPhone", "contactWhatsapp"],
};

// 🔴 2026-11-14：factoryCity 加进必填。
//    原因是它与发布闸门错位：lib/supplierCompleteness.ts 把「city 缺失」列为**阻断项**
//    （missing city ⇒ publishable=false），但表单却允许留空 ⇒ 用户按提示填完带星号的四项
//    提交后，档案 city 落 "unknown"、永远发不出去，后台只能人工补。
//    2026-11 第一批 5 家正是这么卡住的（全是 city=unknown）。
//    宁可让他在注册时多填一个城市，也不要事后由我们替他猜。
//
// 🔴 2026-11-14：industryCode 同样加进必填，理由完全一致 ——
//    `missing industry` 是第二个阻断项，而表单此前**没有这个字段**，
//    于是每个走注册进来的草稿都缺 industry_code，只能人工补。
//    它不是自由文本：选项来自 STATIC_INDUSTRIES（与 /industry、sitemap 同源），
//    落库前服务端还会按白名单再过滤一次（见 app/api/supplier-register/route.ts）。
const REQUIRED = new Set([
  "companyName",
  "factoryCountry",
  "factoryCity",
  "industryCode",
  "mainProducts",
  "contactEmail",
]);

/**
 * 展示范围标签（2026-11-14）。
 *
 * 背景：供应商不知道「填了给谁看」，于是只填带星号的四五项，档案上线后一片空白。
 * 这两组集合不是文案判断，而是**照抄 lib/suppliers.ts 的分层边界**：
 *   PUBLIC_TAG  ⊆ PUBLIC_FIELDS —— 游客（含搜索引擎）直接可见
 *   MEMBER_TAG  ⊆ FREE_FIELDS   —— 注册买家可见
 *
 * 🔴 严禁把某个字段凭直觉加进来。加错一行 = 页面对供应商作出的展示承诺是假的。
 *    · 联系方式（contactName/contactEmail/contactPhone/contactWhatsapp）虽然在 FREE_FIELDS 里，
 *      但它受下面 contactVisibility 三档控制 —— 选 private 就完全不展示，
 *      所以**不给它打标签**，避免出现「标着买家可见、实际选了不展示」的矛盾。
 *    · message 只是给我们看的说明，永不展示，也不打标签。
 */
const PUBLIC_TAG = new Set([
  "companyName", // legalName
  "englishName",
  "companyType",
  "industryCode",
  "registrationNumber",
  "website",
  "factoryCountry", // country
  "factoryCity", // city
  "factoryAddress", // address
  "mainProducts",
  // 简介已从 FREE_FIELDS 移入 PUBLIC_FIELDS（2026-11-14），标的是一致的事实
  "companyDescription",
]);
const MEMBER_TAG = new Set([
  "establishedYear", // established
  "employees",
  "factorySize",
  "productionCapacity",
  "monthlyOutput",
  "exportMarkets",
  "exportSince",
]);

export type SupplierNetworkFormDict = {
  sections: Record<string, string>;
  labels: Record<string, string>;
  submit: string;
  submitting: string;
  privacyNote: string;
  /** 表单顶部说明：标签含义 + 为什么值得填全 */
  intro: string;
  /** 字段徽标：游客可见 */
  tagPublic: string;
  /** 字段徽标：注册买家可见 */
  tagMembers: string;
};

/** 行业下拉选项（服务端算好标签后传入，客户端不 import server-only 的 taxonomy） */
export type IndustryOption = { code: string; label: string };

/** 成功页「下一步」文案（字典 supplierNetwork.next*） */
export type NextStepDict = {
  title: string;
  lead: string;
  photo: string;
  desc: string;
  capacity: string;
  cta: string;
};

type Props = {
  t: SupplierNetworkFormDict;
  success: string;
  error: string;
  industries: IndustryOption[];
  /** 成功页下一步清单（页面级文案，不在 form 命名空间下） */
  next: NextStepDict;
  /** 当前语言段（如 zh / en）。成功页要在这里拼出带语言前缀的站内链接，
   *  不能用固定 /supplier-dashboard —— 那会把中文用户扔回英文站。 */
  locale: string;
};

const CONTACT_VISIBILITY = ["contactVisibilityPublic", "contactVisibilityPlatform", "contactVisibilityPrivate"] as const;

// 证书行：与字典 supplierNetwork.form.labels 的 certName/certNumber/certIssued/certExpires 对应
type CertRow = { name: string; number: string; issued: string; expires: string };
const EMPTY_CERT: CertRow = { name: "", number: "", issued: "", expires: "" };
const MAX_CERTS = 10;

// 「我要获得证书」咨询表单（不在主表单内 —— 避免嵌套 <form>）
type HelpFields = { wanted: string; company: string; contactName: string; contactEmail: string; note: string };
const EMPTY_HELP: HelpFields = { wanted: "", company: "", contactName: "", contactEmail: "", note: "" };

export default function SupplierRegistrationForm({ t, success, error, industries, next, locale }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  // 成功页的下一步链接需要这两个值：supplierId 用于精确指定档案，email 用于归属兜底。
  // 提交成功后表单会 reset，所以必须在 await 之前把值留下来。
  const [contactEmail, setContactEmail] = useState<string>("");
  const [draftSupplierId, setDraftSupplierId] = useState<string>("");
  // 结构化证书行（至少 1 行；行内容可全空，提交时自动过滤）
  const [certs, setCerts] = useState<CertRow[]>([{ ...EMPTY_CERT }]);
  // 认证辅导需求弹窗
  const [helpOpen, setHelpOpen] = useState(false);
  const [help, setHelp] = useState<HelpFields>({ ...EMPTY_HELP });
  const [helpStatus, setHelpStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  // 埋点：首次聚焦 = 开始填写入驻表（每个会话只发一次）
  const startedRef = useRef(false);
  const handleFirstTouch = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent(ANALYTICS_EVENTS.supplierNetworkStart);
  };

  const setCert = (i: number, patch: Partial<CertRow>) =>
    setCerts((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addCert = () => setCerts((prev) => (prev.length >= MAX_CERTS ? prev : [...prev, { ...EMPTY_CERT }]));
  const removeCert = (i: number) =>
    setCerts((prev) => (prev.length <= 1 ? [{ ...EMPTY_CERT }] : prev.filter((_, idx) => idx !== i)));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);
    // await 前捕获表单元素，避免 React 事件处理同步段结束后 currentTarget 被置空
    const formEl = e.currentTarget;
    const form = new FormData(e.currentTarget);

    const fields: Record<string, string> = {};
    for (const group of Object.values(SECTION_FIELDS)) {
      for (const key of group) {
        const v = String(form.get(key) || "").trim();
        if (v) fields[key] = v;
      }
    }

    // 结构化证书 → 两个派生载荷键
    const certList = certs
      .map((r) => ({
        name: r.name.trim(),
        number: r.number.trim(),
        issued: r.issued.trim(),
        expires: r.expires.trim(),
      }))
      .filter((c) => c.name || c.number || c.issued || c.expires);
    if (certList.length) {
      fields.certificates = certList
        .map((c) =>
          [
            c.name,
            c.number ? `No. ${c.number}` : "",
            c.issued ? `Issued ${c.issued}` : "",
            c.expires ? `Valid until ${c.expires}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        )
        .join("\n");
      fields.certificatesJson = JSON.stringify(certList);
    }

    // 可选项（Availability / Authorization / Message）
    fields.auditAvailability = form.get("auditAvailability") === "yes" ? "yes" : "no";
    fields.inspectionAvailability = form.get("inspectionAvailability") === "yes" ? "yes" : "no";
    const auth = String(form.get("authorizeCompanyProfile") || "");
    if (auth) fields.authorizeCompanyProfile = auth;
    const visibility = String(form.get("contactVisibility") || "");
    if (visibility) fields.contactVisibility = visibility;
    const message = String(form.get("message") || "").trim();
    if (message) fields.message = message;

    try {
      const res = await fetch("/api/supplier-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (data.ok) {
        // 供应商入驻转化：提交成功（不携带任何表单内容，referenceId 属敏感追踪号也不发）
        trackEvent(ANALYTICS_EVENTS.supplierNetworkSubmit);
        // CS-02D：优先展示落库短号 LEAD-XXXXXX（供应商可直接拿它问进度），
        // 落库失败时接口没有 referenceId，退回旧键 supplierId（UUID）保持 UX 不空窗。
        setStatus("ok");
        setCerts([{ ...EMPTY_CERT }]);
        setReferenceId(String(data.referenceId || data.supplierId || ""));
        // 先留住跳转所需的值，再 reset 表单
        setContactEmail(String(fields.contactEmail || "").trim());
        // draftId 是 suppliers 行的真实主键；supplierId 为兜底（老接口可能只回它）
        setDraftSupplierId(String(data.draftId || data.supplierId || ""));
        formEl.reset();
        return;
      }
      setStatus("error");
      // 只显示本地化文案（API 英文 message 不作为用户可见文本）
      setErrMsg(error);
    } catch {
      setStatus("error");
      setErrMsg(error);
    }
  }

  async function handleHelpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHelpStatus("loading");
    const fields: Record<string, string> = {};
    if (help.wanted.trim()) fields.certHelpWanted = help.wanted.trim();
    if (help.company.trim()) fields.certHelpCompany = help.company.trim();
    if (help.contactName.trim()) fields.certHelpContactName = help.contactName.trim();
    if (help.contactEmail.trim()) fields.certHelpContactEmail = help.contactEmail.trim();
    if (help.note.trim()) fields.certHelpNote = help.note.trim();
    try {
      const res = await fetch("/api/supplier-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "certification_request", fields }),
      });
      const data = await res.json();
      if (data.ok) {
        setHelpStatus("ok");
        setHelp({ ...EMPTY_HELP });
        return;
      }
      setHelpStatus("error");
    } catch {
      setHelpStatus("error");
    }
  }

  // 提交成功 —— 不再只是「我们收到了」。
  // 2026-11-14 审计发现：73 家已发布档案里照片只有 1 家、真实简介 11 条。
  // 用户在提交那一刻的意愿最强，错过这个时刻，之后再喊「来补资料」基本没人回来。
  // 所以成功态直接给出三条下一步 + 一个直达自评页的入口（带归属参数，无需登录）。
  if (status === "ok") {
    const qs = new URLSearchParams();
    if (draftSupplierId) qs.set("supplier", draftSupplierId);
    if (contactEmail) qs.set("email", contactEmail);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const profileHref = `/${locale}/supplier-assessment${suffix}`;
    const steps = [next.photo, next.desc, next.capacity].filter(Boolean);

    return (
      <div className="card p-6 max-w-3xl space-y-6">
        <div className="rounded-lg border border-[#d7f0dd] bg-[#f0fdf4] p-5 text-center">
          <div className="text-2xl mb-2">✓</div>
          <p className="font-semibold text-[#1f7a36]">{success}</p>
          {referenceId && (
            <p className="text-xs text-[#6d6b66] mt-2 break-all">Reference: {referenceId}</p>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#171717]">{next.title}</h2>
          <p className="text-sm text-[#3f4650] mt-2 leading-relaxed">{next.lead}</p>
          {steps.length > 0 && (
            <ul className="mt-4 space-y-3">
              {steps.map((line, i) => (
                <li key={i} className="flex gap-3 text-sm text-[#2b2b2b] leading-relaxed">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#171717] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 没有邮箱就不给按钮：归属裁决要求邮箱，缺了只会把用户送到一张「请登录」的墙 */}
        {contactEmail && (
          <div>
            <a className="btn-primary inline-block px-6 py-3" href={profileHref}>
              {next.cta}
            </a>
          </div>
        )}
      </div>
    );
  }

  const renderField = (key: string) => {
    // 展示范围徽标：只有能被买家看到的字段才打标（见 PUBLIC_TAG / MEMBER_TAG 注释）
    const tag = PUBLIC_TAG.has(key) ? { text: t.tagPublic, cls: "bg-[#e7f6ec] text-[#1f7a36]" }
      : MEMBER_TAG.has(key) ? { text: t.tagMembers, cls: "bg-[#f2f0ea] text-[#6d6b66]" }
      : null;
    return (
      <div key={key} className={key === "companyDescription" ? "md:col-span-2" : undefined}>
        <label className="text-sm font-medium">
          {t.labels[key] || key}
          {REQUIRED.has(key) && <span className="text-[#d4232a]">*</span>}
          {tag && (
            <span className={`ml-2 align-middle rounded px-1.5 py-0.5 text-[10px] font-medium ${tag.cls}`}>
              {tag.text}
            </span>
          )}
        </label>
        {key === "industryCode" ? (
          // 空选项 disabled：逼用户真选一个，而不是默认落在「第一个行业」上造成错配
          <select className="input" name={key} required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {industries.map((i) => (
              <option key={i.code} value={i.code}>
                {i.label}
              </option>
            ))}
          </select>
        ) : key === "message" ? (
          <textarea className="textarea" name={key} rows={4} />
        ) : key === "companyDescription" ? (
          // 上限与服务端 clamp 一致（1200），避免用户敲了长文被静默截断
          <textarea className="textarea" name={key} rows={4} maxLength={1200} />
        ) : (
          <input
            className="input"
            name={key}
            type={key === "contactEmail" ? "email" : "text"}
            required={REQUIRED.has(key)}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit} onFocus={handleFirstTouch} className="card p-6 max-w-3xl space-y-8">
        {/* 展示范围说明（2026-11-14）：告诉供应商「你填的每一项会出现在哪里」。
            此前表单只讲「我们会审核」，一个字都没说填完会展示给谁 —— 于是大部分申请人
            只填带星号的四五项就提交，档案上线后买家看不到任何可判断的信息。 */}
        <p className="rounded-lg border border-[#ebe8e1] bg-[#fbfaf7] px-4 py-3 text-sm text-[#3f4650]">
          {t.intro}
        </p>

        {Object.keys(t.sections).map((section) => {
          const keys = SECTION_FIELDS[section];
          return (
            <fieldset key={section} className="space-y-4">
              <legend className="text-lg font-bold text-[#171717] pb-2 border-b border-[#ebe8e1] w-full">
                {t.sections[section]}
              </legend>
              {keys && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{keys.map(renderField)}</div>}

              {section === "certificates" && (
                <div className="space-y-4">
                  {certs.map((row, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-[#ebe8e1] bg-[#fbfaf7]"
                    >
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-name-${i}`}>
                          {t.labels.certName}
                        </label>
                        <input
                          id={`cert-name-${i}`}
                          className="input"
                          value={row.name}
                          onChange={(e) => setCert(i, { name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-number-${i}`}>
                          {t.labels.certNumber}
                        </label>
                        <input
                          id={`cert-number-${i}`}
                          className="input"
                          value={row.number}
                          onChange={(e) => setCert(i, { number: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-issued-${i}`}>
                          {t.labels.certIssued}
                        </label>
                        <input
                          id={`cert-issued-${i}`}
                          className="input"
                          type="date"
                          value={row.issued}
                          onChange={(e) => setCert(i, { issued: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium" htmlFor={`cert-expires-${i}`}>
                          {t.labels.certExpires}
                        </label>
                        <input
                          id={`cert-expires-${i}`}
                          className="input"
                          type="date"
                          value={row.expires}
                          onChange={(e) => setCert(i, { expires: e.target.value })}
                        />
                      </div>
                      {certs.length > 1 && (
                        <div className="md:col-span-2 flex justify-end">
                          <button
                            type="button"
                            className="text-sm text-[#d4232a] underline"
                            onClick={() => removeCert(i)}
                          >
                            {t.labels.certRemove}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={addCert}
                      disabled={certs.length >= MAX_CERTS}
                    >
                      + {t.labels.certAdd}
                    </button>
                    <button
                      type="button"
                      className="btn btn-accent"
                      onClick={() => {
                        setHelpStatus("idle");
                        setHelpOpen(true);
                      }}
                    >
                      {t.labels.certHelpOpen}
                    </button>
                  </div>
                </div>
              )}

              {section === "availability" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="auditAvailability" value="yes" className="h-4 w-4" />
                    {t.labels.auditAvailability}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="inspectionAvailability" value="yes" className="h-4 w-4" />
                    {t.labels.inspectionAvailability}
                  </label>
                </div>
              )}

              {section === "authorization" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">
                      {t.labels.authorizeCompanyProfile}
                      <span className="text-[#d4232a]">*</span>
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="authorizeCompanyProfile" value="yes" required className="h-4 w-4" />
                        {t.labels.authorizeCompanyProfileYes}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="authorizeCompanyProfile" value="no" className="h-4 w-4" />
                        {t.labels.authorizeCompanyProfileNo}
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">{t.labels.contactVisibility}</p>
                    <div className="space-y-2">
                      {CONTACT_VISIBILITY.map((v) => (
                        <label key={v} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="contactVisibility" value={v.replace("contactVisibility", "").toLowerCase()} className="h-4 w-4" />
                          {t.labels[v]}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {section === "message" && renderField("message")}
            </fieldset>
          );
        })}

        <p className="text-xs text-[#6d6b66]">{t.privacyNote}</p>

        <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
          {status === "loading" ? t.submitting : t.submit}
        </button>
        {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
      </form>

      {/* 「我要获得证书」咨询弹窗 —— 独立表单，不嵌套在主表单内 */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-lg my-8 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-lg font-bold text-[#171717]">{t.labels.certHelpTitle}</h3>
              <button
                type="button"
                className="text-[#6d6b66] text-2xl leading-none"
                onClick={() => setHelpOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {helpStatus === "ok" ? (
              <p className="text-sm text-[#1f7a36]">{t.labels.certHelpSuccess}</p>
            ) : (
              <form onSubmit={handleHelpSubmit} className="space-y-4">
                <p className="text-sm text-[#6d6b66]">{t.labels.certHelpLead}</p>
                <div>
                  <label className="text-sm font-medium" htmlFor="certHelpWanted">
                    {t.labels.certHelpWanted}
                    <span className="text-[#d4232a]">*</span>
                  </label>
                  <textarea
                    id="certHelpWanted"
                    className="textarea"
                    rows={3}
                    required
                    value={help.wanted}
                    onChange={(e) => setHelp({ ...help, wanted: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="certHelpCompany">
                    {t.labels.certHelpCompany}
                  </label>
                  <input
                    id="certHelpCompany"
                    className="input"
                    value={help.company}
                    onChange={(e) => setHelp({ ...help, company: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium" htmlFor="certHelpContactName">
                      {t.labels.certHelpContactName}
                    </label>
                    <input
                      id="certHelpContactName"
                      className="input"
                      value={help.contactName}
                      onChange={(e) => setHelp({ ...help, contactName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium" htmlFor="certHelpContactEmail">
                      {t.labels.certHelpContactEmail}
                      <span className="text-[#d4232a]">*</span>
                    </label>
                    <input
                      id="certHelpContactEmail"
                      className="input"
                      type="email"
                      required
                      value={help.contactEmail}
                      onChange={(e) => setHelp({ ...help, contactEmail: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor="certHelpNote">
                    {t.labels.certHelpNote}
                  </label>
                  <textarea
                    id="certHelpNote"
                    className="textarea"
                    rows={2}
                    value={help.note}
                    onChange={(e) => setHelp({ ...help, note: e.target.value })}
                  />
                </div>
                {helpStatus === "error" && <p className="text-sm text-[#d4232a]">{t.labels.certHelpError}</p>}
                <button type="submit" className="btn btn-primary w-full" disabled={helpStatus === "loading"}>
                  {helpStatus === "loading" ? t.labels.certHelpSubmitting : t.labels.certHelpSubmit}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
