"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export type AuthDict = {
  login: Record<string, string>;
  register: Record<string, string>;
  errors: Record<string, string>;
};

/**
 * 注册表单。
 * 约定：
 * - 角色只开放 BUYER / SUPPLIER（ADMIN / AUDITOR 只能后台授予，API 侧也做了白名单）。
 * - 注册成功后自动用同一组凭据登录，避免用户"刚注册完还要再填一遍"。
 * - 所有文案走 dict，不硬编码。
 */
export default function RegisterForm({
  dict,
  localePrefix,
  callbackUrl,
  googleEnabled,
}: {
  dict: AuthDict;
  localePrefix: string;
  callbackUrl: string;
  googleEnabled: boolean;
}) {
  const t = dict.register;
  const err = dict.errors;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState<"BUYER" | "SUPPLIER">("BUYER");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError(err.password_mismatch ?? "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, company, country, role }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setError(err[data.error ?? "server_error"] ?? err.server_error);
        setLoading(false);
        return;
      }

      // 注册成功 → 用同一凭据自动登录
      setSuccess(t.success);
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.error) {
        // 账号已建好，只是自动登录失败：引导去登录页，不让用户以为注册失败
        window.location.href = `${localePrefix}/login`;
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError(err.network);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="reg-role" className="text-sm font-medium block mb-1.5">
          {t.roleLabel}
        </label>
        <div id="reg-role" className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("BUYER")}
            aria-pressed={role === "BUYER"}
            className={`text-left border rounded-lg p-3 transition ${
              role === "BUYER"
                ? "border-[#0f4c81] bg-[#e6eef6] text-[#0f4c81]"
                : "border-[#e2e8f0] hover:border-[#0f4c81] text-[#475569]"
            }`}
          >
            <div className="font-semibold text-sm">{t.roleBuyer}</div>
            <div className="text-xs mt-1 opacity-80">{t.roleBuyerHint}</div>
          </button>
          <button
            type="button"
            onClick={() => setRole("SUPPLIER")}
            aria-pressed={role === "SUPPLIER"}
            className={`text-left border rounded-lg p-3 transition ${
              role === "SUPPLIER"
                ? "border-[#0f4c81] bg-[#e6eef6] text-[#0f4c81]"
                : "border-[#e2e8f0] hover:border-[#0f4c81] text-[#475569]"
            }`}
          >
            <div className="font-semibold text-sm">{t.roleSupplier}</div>
            <div className="text-xs mt-1 opacity-80">{t.roleSupplierHint}</div>
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="reg-name" className="text-sm font-medium block mb-1.5">
          {t.name}
        </label>
        <input
          id="reg-name"
          className="input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="reg-email" className="text-sm font-medium block mb-1.5">
          {t.email}
        </label>
        <input
          id="reg-email"
          type="email"
          className="input"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-pass" className="text-sm font-medium block mb-1.5">
            {t.password}
          </label>
          <input
            id="reg-pass"
            type="password"
            className="input"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="text-xs text-[#64748b] mt-1">{t.passwordHint}</p>
        </div>
        <div>
          <label htmlFor="reg-confirm" className="text-sm font-medium block mb-1.5">
            {t.confirm}
          </label>
          <input
            id="reg-confirm"
            type="password"
            className="input"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-company" className="text-sm font-medium block mb-1.5">
            {t.company}
          </label>
          <input
            id="reg-company"
            className="input"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
          />
          <p className="text-xs text-[#64748b] mt-1">{t.companyHint}</p>
        </div>
        <div>
          <label htmlFor="reg-country" className="text-sm font-medium block mb-1.5">
            {t.country}
          </label>
          <input
            id="reg-country"
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            autoComplete="country-name"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[#d4232a]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-[#1f7a36]">
          {success}
        </p>
      )}

      <button type="submit" className="btn btn-primary w-full py-3" disabled={loading}>
        {loading ? t.submitting : t.submit}
      </button>

      {googleEnabled && (
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="btn btn-outline w-full"
        >
          {dict.login.google}
        </button>
      )}

      <p className="text-xs text-[#64748b] text-center">{t.termsNote}</p>
    </form>
  );
}
