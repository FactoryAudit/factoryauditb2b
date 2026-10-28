"use client";

import { useState } from "react";

/**
 * 档案页询价表单（2026-10-28）
 *
 * 为什么存在：档案页此前 8 个按钮全是"卖给买家的验厂服务"，没有一个能让买家
 * 向这家供应商询价。采购商看完就断了动作。
 *
 * 文案为什么没走 9 语字典：这个表单的服务对象是**境外采购商**（中文档案页的读者是
 * 中国供应商，他们不填询价表），实际只会命中 en / es 两种。为两种语言去动 9 语叶数
 * 不变量不划算 —— 这是刻意取舍，不是遗漏。新增语言时在 L 表里加一支即可。
 */

type Copy = {
  title: string;
  lead: string;
  attribution: string;
  name: string;
  company: string;
  email: string;
  country: string;
  product: string;
  quantity: string;
  note: string;
  noteHint: string;
  needsAudit: string;
  needsAuditHint: string;
  submit: string;
  submitting: string;
  okTitle: string;
  okLead: string;
  okRef: string;
  errGeneric: string;
  required: string;
  again: string;
};

const EN: Copy = {
  title: "Request a quotation from this supplier",
  lead: "Tell us what you need. We pass your enquiry to the supplier and keep a record of it.",
  attribution:
    "Your enquiry reaches the supplier with a note that it came through FactoryAuditB2B, so they know where the business came from.",
  name: "Your name",
  company: "Company",
  email: "Work email",
  country: "Country",
  product: "What you need",
  quantity: "Quantity / target price",
  note: "Additional details",
  noteHint: "Specifications, Incoterms, delivery window, certifications required…",
  needsAudit: "I also want this supplier verified on site before ordering",
  needsAuditHint: "Optional. An on-site audit is quoted separately and does not delay the quotation.",
  submit: "Send enquiry",
  submitting: "Sending…",
  okTitle: "Enquiry sent",
  okLead:
    "We have forwarded it to the supplier and sent you a confirmation email. If the supplier does not reply within two working days, we will follow up on your behalf.",
  okRef: "Reference",
  errGeneric: "Something went wrong. Please try again, or email support@factoryauditb2b.com.",
  required: "Please fill in the required fields.",
  again: "Send another enquiry",
};

const ES: Copy = {
  title: "Solicitar cotización a este proveedor",
  lead: "Cuéntenos qué necesita. Trasladamos su consulta al proveedor y dejamos constancia de ella.",
  attribution:
    "Su consulta llega al proveedor indicando que proviene de FactoryAuditB2B, para que sepa de dónde viene la oportunidad.",
  name: "Su nombre",
  company: "Empresa",
  email: "Correo corporativo",
  country: "País",
  product: "Qué necesita",
  quantity: "Cantidad / precio objetivo",
  note: "Detalles adicionales",
  noteHint: "Especificaciones, Incoterms, plazo de entrega, certificaciones requeridas…",
  needsAudit: "También quiero verificar este proveedor en planta antes de comprar",
  needsAuditHint: "Opcional. La auditoría en planta se cotiza aparte y no retrasa la cotización.",
  submit: "Enviar consulta",
  submitting: "Enviando…",
  okTitle: "Consulta enviada",
  okLead:
    "La hemos trasladado al proveedor y le enviamos un correo de confirmación. Si el proveedor no responde en dos días hábiles, haremos el seguimiento por usted.",
  okRef: "Referencia",
  errGeneric: "Algo salió mal. Inténtelo de nuevo o escriba a support@factoryauditb2b.com.",
  required: "Complete los campos obligatorios.",
  again: "Enviar otra consulta",
};

export default function SupplierInquiryForm({
  slug,
  supplierName,
  locale,
}: {
  slug: string;
  supplierName: string;
  locale: string;
}) {
  const L = locale === "es" ? ES : EN;
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [err, setErr] = useState("");
  const [ref, setRef] = useState("");
  const [supplierNotified, setSupplierNotified] = useState(true);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      slug,
      name: String(fd.get("name") || "").trim(),
      company: String(fd.get("company") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      country: String(fd.get("country") || "").trim(),
      product: String(fd.get("product") || "").trim(),
      quantity: String(fd.get("quantity") || "").trim(),
      note: String(fd.get("note") || "").trim(),
      needsAudit: fd.get("needsAudit") === "on",
    };
    if (!payload.name || !payload.company || !payload.email || !payload.product) {
      setStatus("error");
      setErr(L.required);
      return;
    }
    setStatus("sending");
    setErr("");
    try {
      const res = await fetch("/api/supplier-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setRef(String(data.referenceId || ""));
        setSupplierNotified(data.supplierNotified !== false);
        setStatus("ok");
        return;
      }
      setStatus("error");
      setErr(
        data?.error === "rate_limited"
          ? "Too many enquiries from this address. Please wait a while, or email us directly."
          : L.errGeneric
      );
    } catch {
      setStatus("error");
      setErr(L.errGeneric);
    }
  }

  if (status === "ok") {
    return (
      <div className="card p-6 bg-[#f0fdf4] border-[#bbf7d0]">
        <div className="text-2xl mb-2">✓</div>
        <h3 className="text-lg font-bold text-[#1f7a36]">{L.okTitle}</h3>
        <p className="mt-2 text-sm text-[#3f4650]">{L.okLead}</p>
        {!supplierNotified && (
          <p className="mt-2 text-sm text-[#8a5410] bg-[#fff4e0] rounded px-3 py-2">
            This supplier has no registered email on file — our team will forward your enquiry manually
            and reply to you directly.
          </p>
        )}
        {ref && (
          <p className="mt-3 text-xs text-[#6d6b66]">
            {L.okRef}: <span className="font-mono text-[#171717]">{ref}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm underline text-[#3f4650]"
        >
          {L.again}
        </button>
      </div>
    );
  }

  const input =
    "mt-1 w-full rounded-lg border border-[#ddd9d0] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#a8a49c] focus:border-[#171717] focus:outline-none";
  const label = "text-xs font-medium text-[#3f4650]";

  return (
    <div className="card p-6" id="inquiry">
      <h3 className="text-xl font-bold text-[#171717]">{L.title}</h3>
      <p className="mt-1.5 text-sm text-[#3f4650]">{L.lead}</p>
      <p className="mt-2 text-xs text-[#6d6b66] bg-[#f8f6f1] rounded px-3 py-2">
        {L.attribution}
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="iq-name">
            {L.name} <span className="text-[#b42318]">*</span>
          </label>
          <input id="iq-name" name="name" required maxLength={120} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="iq-company">
            {L.company} <span className="text-[#b42318]">*</span>
          </label>
          <input id="iq-company" name="company" required maxLength={160} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="iq-email">
            {L.email} <span className="text-[#b42318]">*</span>
          </label>
          <input id="iq-email" name="email" type="email" required maxLength={254} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="iq-country">
            {L.country}
          </label>
          <input id="iq-country" name="country" maxLength={80} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="iq-product">
            {L.product} <span className="text-[#b42318]">*</span>
          </label>
          <input
            id="iq-product"
            name="product"
            required
            maxLength={200}
            placeholder={supplierName}
            className={input}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="iq-qty">
            {L.quantity}
          </label>
          <input id="iq-qty" name="quantity" maxLength={80} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="iq-note">
            {L.note}
          </label>
          <textarea
            id="iq-note"
            name="note"
            rows={3}
            maxLength={2000}
            placeholder={L.noteHint}
            className={input}
          />
        </div>

        <div className="sm:col-span-2 rounded-lg border border-[#ebe8e1] bg-[#fbfaf7] px-3 py-2.5">
          <label className="flex items-start gap-2 text-sm text-[#171717] cursor-pointer">
            <input type="checkbox" name="needsAudit" className="mt-1" />
            <span>
              {L.needsAudit}
              <span className="block text-xs text-[#6d6b66] mt-0.5">{L.needsAuditHint}</span>
            </span>
          </label>
        </div>

        {status === "error" && (
          <p className="sm:col-span-2 text-sm text-[#b42318] bg-[#fef2f2] rounded px-3 py-2">{err}</p>
        )}

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={status === "sending"}
            className="btn btn-primary disabled:opacity-60"
          >
            {status === "sending" ? L.submitting : L.submit}
          </button>
          <span className="text-xs text-[#8c8982]">
            {locale === "es"
              ? "No compartimos sus datos con terceros."
              : "We do not share your details with third parties."}
          </span>
        </div>
      </form>
    </div>
  );
}
