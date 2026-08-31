"use client";

import { useState } from "react";

export type InspectionFormDict = {
  firstName: string;
  company: string;
  email: string;
  stageLabel: string;
  stageHint: string;
  stages: string[];
  factoryLocation: string;
  factoryLocationHint: string;
  product: string;
  quantity: string;
  inspectionDate: string;
  requirements: string;
  requirementsHint: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
};

export default function InspectionRequestForm({ t }: { t: InspectionFormDict }) {
  const [form, setForm] = useState({
    firstName: "",
    company: "",
    email: "",
    stage: t.stages[2], // 默认 PSI：这是买家下单频率最高的节点
    factoryLocation: "",
    product: "",
    quantity: "",
    inspectionDate: "",
    requirements: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.factoryLocation.trim() || !form.product.trim() || !form.email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: {
            firstName: form.firstName,
            company: form.company,
            email: form.email,
            country: "",
            tool: "inspection-request",
            sourcing: form.product,
            message: [
              `Stage: ${form.stage}`,
              `Factory location: ${form.factoryLocation}`,
              `Product: ${form.product}`,
              `Quantity: ${form.quantity || "not specified"}`,
              `Inspection date: ${form.inspectionDate || "not specified"}`,
              `Requirements: ${form.requirements || "not specified"}`,
            ].join("\n"),
          },
        }),
      });
      const data = await res.json();
      setStatus(data.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "ok") {
    return (
      <div className="card p-6 text-center bg-[#f0fdf4]" role="status">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{t.success}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card p-6 sm:p-8 max-w-3xl space-y-6"
    >
      {/* 联系字段：/api/lead 强制要求 email，缺少会导致提交永远 400（此前是写死空串，表单必败） */}
      <div className="grid md:grid-cols-3 gap-5">
        <div>
          <label
            htmlFor="inspection-name"
            className="block text-sm font-medium text-[#0f172a] mb-1.5"
          >
            {t.firstName}
          </label>
          <input
            id="inspection-name"
            className="input"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            autoComplete="name"
          />
        </div>
        <div>
          <label
            htmlFor="inspection-company"
            className="block text-sm font-medium text-[#0f172a] mb-1.5"
          >
            {t.company}
          </label>
          <input
            id="inspection-company"
            className="input"
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
            autoComplete="organization"
          />
        </div>
        <div>
          <label
            htmlFor="inspection-email"
            className="block text-sm font-medium text-[#0f172a] mb-1.5"
          >
            {t.email}
          </label>
          <input
            id="inspection-email"
            type="email"
            required
            className="input"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
      </div>

      {/* 阶段单选：5 个选项排成 2-3 列的按钮组，窄屏自动换行，比 5 个 radio 挤一行清晰 */}
      <fieldset>
        <legend className="text-sm font-medium text-[#0f172a]">{t.stageLabel}</legend>
        <p className="text-xs text-[#64748b] mt-1 mb-3">{t.stageHint}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {t.stages.map((s) => {
            const active = form.stage === s;
            return (
              <label
                key={s}
                className={`flex items-center gap-2 cursor-pointer rounded-md border px-4 py-3 transition ${
                  active
                    ? "border-[#0f4c81] bg-[#e6eef6] text-[#0f4c81]"
                    : "border-[#e2e8f0] hover:border-[#0f4c81] hover:bg-[#f7f9fc]"
                }`}
              >
                <input
                  type="radio"
                  name="stage"
                  value={s}
                  checked={active}
                  onChange={(e) => set("stage", e.target.value)}
                  className="accent-[#0f4c81]"
                />
                <span className="text-sm font-medium">{s}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="inspection-factory"
          className="block text-sm font-medium text-[#0f172a] mb-1.5"
        >
          {t.factoryLocation}
        </label>
        <input
          id="inspection-factory"
          required
          className="input"
          value={form.factoryLocation}
          onChange={(e) => set("factoryLocation", e.target.value)}
          placeholder={t.factoryLocationHint}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div>
          <label
            htmlFor="inspection-product"
            className="block text-sm font-medium text-[#0f172a] mb-1.5"
          >
            {t.product}
          </label>
          <input
            id="inspection-product"
            required
            className="input"
            value={form.product}
            onChange={(e) => set("product", e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="inspection-qty"
            className="block text-sm font-medium text-[#0f172a] mb-1.5"
          >
            {t.quantity}
          </label>
          <input
            id="inspection-qty"
            className="input"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="inspection-date"
            className="block text-sm font-medium text-[#0f172a] mb-1.5"
          >
            {t.inspectionDate}
          </label>
          <input
            id="inspection-date"
            type="date"
            className="input"
            value={form.inspectionDate}
            onChange={(e) => set("inspectionDate", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="inspection-req"
          className="block text-sm font-medium text-[#0f172a] mb-1.5"
        >
          {t.requirements}
        </label>
        <textarea
          id="inspection-req"
          className="textarea"
          rows={5}
          value={form.requirements}
          onChange={(e) => set("requirements", e.target.value)}
          placeholder={t.requirementsHint}
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn btn-primary w-full py-3"
      >
        {status === "loading" ? t.submitting : t.submit}
      </button>
      {status === "error" && <p className="text-sm text-[#d4232a]">{t.error}</p>}
    </form>
  );
}