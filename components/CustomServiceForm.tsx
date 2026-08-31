"use client";

import { useState } from "react";

export type CustomServiceFormDict = {
  labels: {
    firstName: string;
    company: string;
    email: string;
    country: string;
    message: string;
    messageHint: string;
    submit: string;
    submitting: string;
  };
  success: string;
  error: string;
};

export default function CustomServiceForm({ t }: { t: CustomServiceFormDict }) {
  const [form, setForm] = useState({
    firstName: "",
    company: "",
    email: "",
    country: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.message.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: {
            ...form,
            tool: "custom-services",
          },
        }),
      });
      const data = await res.json();
      setStatus(data.ok ? "ok" : "error");
      if (data.ok) setForm({ firstName: "", company: "", email: "", country: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  if (status === "ok") {
    return (
      <div className="card p-6 text-center bg-[#f0fdf4]">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-[#1f7a36]">{t.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-2xl space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{t.labels.firstName}</label>
          <input
            className="input"
            value={form.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            placeholder={t.labels.firstName}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.company}</label>
          <input
            className="input"
            value={form.company}
            onChange={(e) => handleChange("company", e.target.value)}
            placeholder={t.labels.company}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.email}</label>
          <input
            required
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder={t.labels.email}
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t.labels.country}</label>
          <input
            className="input"
            value={form.country}
            onChange={(e) => handleChange("country", e.target.value)}
            placeholder={t.labels.country}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">{t.labels.message}</label>
        <textarea
          required
          className="textarea"
          rows={5}
          value={form.message}
          onChange={(e) => handleChange("message", e.target.value)}
          placeholder={t.labels.messageHint}
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="btn btn-primary w-full"
      >
        {status === "loading" ? t.labels.submitting : t.labels.submit}
      </button>
      {status === "error" && <p className="text-sm text-[#d4232a]">{t.error}</p>}
    </form>
  );
}
