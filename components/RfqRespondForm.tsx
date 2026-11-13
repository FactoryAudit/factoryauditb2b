"use client";

import { useState } from "react";
import type { RfqFormDict } from "./RfqForm";

/**
 * 供应商报价表单 —— /rfq?request=RFQ-XXXX
 *
 * 背景（2026-11-13）：/suppliers 的「Respond to Request」此前链到 /rfq，
 * 而 /rfq 是**买家发需求**的表单，`request` 参数没有任何人读 —— 供应商点进来
 * 看到的是一张空白采购单，是彻底的死链。
 *
 * 这个组件的职责只有一个：让供应商在一个明确的上下文里回一句「我能供，价格/交期是」。
 * 铁律：
 *   · 只展示买家已授权公开的字段；联系方式在服务端已打码，这里不再二次处理；
 *   · 提交报价 ≠ 被选中，成功文案必须写清这一点。
 */

export type RfqRespondDict = {
  labels: Pick<
    RfqFormDict["labels"],
    "firstName" | "company" | "email" | "phone" | "optional" | "message" | "submit" | "submitting"
  >;
  offer: RfqFormDict["offer"];
  respond: { to: string; note: string; success: string };
  error: string;
  errorRequired: string;
};

export type RfqRespondTarget = {
  referenceId: string;
  product: string;
  quantity: string | null;
  targetMarket: string | null;
  certificationsReq: string[] | null;
  messageExcerpt: string | null;
};

export default function RfqRespondForm({
  t,
  target,
}: {
  t: RfqRespondDict;
  target: RfqRespondTarget;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg("");
    const form = new FormData(e.currentTarget);
    const payload = {
      reference: target.referenceId,
      company: String(form.get("company") || ""),
      contact_name: String(form.get("contact_name") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
      price: String(form.get("price") || ""),
      moq: String(form.get("moq") || ""),
      lead_time: String(form.get("lead_time") || ""),
      message: String(form.get("message") || ""),
      // 反灌水蜜罐（真人填不到，脚本会填满所有 input）
      hp_website: String(form.get("hp_website") || ""),
    };
    try {
      const res = await fetch("/api/rfq/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("ok");
      } else {
        setStatus("error");
        setErrMsg(data.error === "missing_fields" ? t.errorRequired : t.error);
      }
    } catch {
      setStatus("error");
      setErrMsg(t.error);
    }
  }

  if (status === "ok") {
    return (
      <div className="card p-6 text-center bg-[#f0fdf4] max-w-2xl">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{t.respond.success}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* 需求摘要：只展示买家已授权公开的字段 */}
      <div className="card p-5 bg-[#f5f3ee]">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#6d6b66]">
          {target.referenceId}
        </div>
        <div className="font-semibold text-[#171717] mt-1">{target.product}</div>
        <div className="text-sm text-[#3f4650] mt-1 space-x-2">
          {target.quantity && <span>{target.quantity}</span>}
          {target.targetMarket && <span>· {target.targetMarket}</span>}
          {target.certificationsReq?.length ? (
            <span>· {target.certificationsReq.join(", ")}</span>
          ) : null}
        </div>
        {target.messageExcerpt && (
          <p className="text-sm text-[#3f4650] mt-2 whitespace-pre-line">
            {target.messageExcerpt}
          </p>
        )}
        <p className="text-xs text-[#6d6b66] mt-3">{t.respond.note}</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium" htmlFor="rp-contact">
              {t.labels.firstName}
            </label>
            <input id="rp-contact" className="input" name="contact_name" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="rp-company">
              {t.labels.company} <span className="text-[#d4232a]">*</span>
            </label>
            <input id="rp-company" className="input" name="company" required />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="rp-email">
              {t.labels.email} <span className="text-[#d4232a]">*</span>
            </label>
            <input id="rp-email" className="input" name="email" type="email" required />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="rp-phone">
              {t.labels.phone}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input id="rp-phone" className="input" name="phone" type="tel" inputMode="tel" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="rp-price">
              {t.offer.price}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input id="rp-price" className="input" name="price" placeholder="USD 12.50 / pc" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="rp-moq">
              {t.offer.moq}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input id="rp-moq" className="input" name="moq" placeholder="1,000 pcs" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="rp-lead">
              {t.offer.leadTime}{" "}
              <span className="text-[#6d6b66] font-normal">({t.labels.optional})</span>
            </label>
            <input id="rp-lead" className="input" name="lead_time" placeholder="30 days" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="rp-message">
            {t.offer.notes} <span className="text-[#d4232a]">*</span>
          </label>
          <textarea
            id="rp-message"
            className="textarea"
            name="message"
            rows={4}
            required
            placeholder={t.labels.message}
          />
        </div>

        {/* ---- 反灌水蜜罐：离屏、aria-hidden、tabIndex=-1，只有脚本会填 ---- */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
          style={{ left: "-9999px", top: 0 }}
        >
          <label htmlFor="rp-website">Website</label>
          <input
            id="rp-website"
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
    </div>
  );
}
