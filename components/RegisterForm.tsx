"use client";

import { useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";
import { isSignupEnabled } from "@/lib/access";
import { useAuth } from "./AuthProvider";

export type RegisterFormDict = {
  emailLabel: string;
  emailPlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  companyLabel: string;
  companyPlaceholder: string;
  /** 仅 Supabase 已配置时渲染（真实建号需要密码） */
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordHint: string;
  submit: string;
  submitting: string;
  privacyNote: string;
  /** 旧路径（V2.0 邮件线索）成功文案 */
  successTitle: string;
  successLead: string;
  /** 真实建号成功文案 */
  successTitleInstant: string;
  successLeadInstant: string;
  errorGeneric: string;
  errorRateLimited: string;
  errorInvalidEmail: string;
  errorWeakPassword: string;
  errorEmailInUse: string;
  errorNotConfigured: string;
};

type Props = {
  t: RegisterFormDict;
};

/** 密码最短 8 位，与 app/api/auth/signup 的 MIN_PASSWORD_LENGTH 保持一致 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * 构建期常量：真实建号是否可用（判定逻辑见 lib/access.ts 的 isSignupEnabled）。
 * NEXT_PUBLIC_ 变量在构建时内联，所以这里可以当常量用，SSR 与 CSR 结果一致，
 * 不会出现"服务端渲染了密码框、客户端没渲染"的水合不匹配。
 */
const SIGNUP_ENABLED = isSignupEnabled();

export default function RegisterForm({ t }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  /** 区分本次提交走的是哪条路径，决定成功文案 */
  const [instant, setInstant] = useState(false);
  const { refresh } = useAuth();
  // signup_start 只发一次：用户首次与表单交互即视为产生注册意图
  const startedRef = useRef(false);
  const handleFirstTouch = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent(ANALYTICS_EVENTS.signupStart);
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const email = String(form.get("email") || "").trim().toLowerCase();
    const name = String(form.get("name") || "").trim();
    const company = String(form.get("company") || "").trim();
    const password = String(form.get("password") || "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus("error");
      setErrMsg(t.errorInvalidEmail);
      return;
    }

    // 表单通过校验、真实发起提交（register 系列：view → cta → submit → signup_complete）
    trackEvent(ANALYTICS_EVENTS.registerSubmit);

    // ---- V2.1：Supabase 已配置 → 真实建号（需要密码） ----
    if (SIGNUP_ENABLED) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setStatus("error");
        setErrMsg(t.errorWeakPassword);
        return;
      }
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, company }),
        });
        const data = await res.json();
        if (data?.ok) {
          // 关掉邮箱确认时注册即可用，刷新会员状态让导航立刻变成已登录
          await refresh();
          trackEvent(ANALYTICS_EVENTS.signupComplete);
          setInstant(true);
          setStatus("ok");
          formEl.reset();
          return;
        }
        setStatus("error");
        setErrMsg(
          data?.error === "rate_limited"
            ? t.errorRateLimited
            : data?.error === "invalid_email"
              ? t.errorInvalidEmail
              : data?.error === "weak_password"
                ? t.errorWeakPassword
                : data?.error === "email_in_use"
                  ? t.errorEmailInUse
                  : data?.error === "auth_not_configured"
                    ? t.errorNotConfigured
                    : t.errorGeneric
        );
        return;
      } catch {
        setStatus("error");
        setErrMsg(t.errorGeneric);
        return;
      }
    }

    // ---- V2.0 原路径：邮件线索 + Google Sheets（不建号） ----
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { email, name, company } }),
      });
      const data = await res.json();
      if (data.ok) {
        // 核心转化：注册提交成功。
        // 注意：旧实现把 email 当事件参数发出，违反「不向 Analytics 发送个人敏感信息」，
        // 这里已移除（且 lib/analytics 的 PII 清洗层会二次拦截）。
        trackEvent(ANALYTICS_EVENTS.signupComplete);
        setInstant(false);
        setStatus("ok");
        formEl.reset();
        return;
      }
      setStatus("error");
      // 只显示本地化文案（API 的英文 message 不作为用户可见文本）
      setErrMsg(
        data?.error === "rate_limited"
          ? t.errorRateLimited
          : data?.error === "invalid_email"
            ? t.errorInvalidEmail
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
        <p className="font-semibold text-[#1f7a36]">
          {instant ? t.successTitleInstant : t.successTitle}
        </p>
        <p className="text-sm text-[#64748b] mt-2">
          {instant ? t.successLeadInstant : t.successLead}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocus={handleFirstTouch}
      className="card p-6 max-w-xl space-y-4"
    >
      <div>
        <label htmlFor="reg-email" className="text-sm font-medium">
          {t.emailLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          className="input"
        />
      </div>

      {/* 密码字段只在真实建号时渲染 —— 旧路径（邮件线索）不收集密码，
          避免用户以为自己创建了账号、结果根本登录不了 */}
      {SIGNUP_ENABLED && (
        <div>
          <label htmlFor="reg-password" className="text-sm font-medium">
            {t.passwordLabel} <span className="text-[#d4232a]">*</span>
          </label>
          <input
            id="reg-password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            placeholder={t.passwordPlaceholder}
            className="input"
          />
          <p className="text-xs text-[#64748b] mt-1">{t.passwordHint}</p>
        </div>
      )}

      <div>
        <label htmlFor="reg-name" className="text-sm font-medium">
          {t.nameLabel} <span className="text-[#d4232a]">*</span>
        </label>
        <input
          id="reg-name"
          name="name"
          type="text"
          required
          placeholder={t.namePlaceholder}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="reg-company" className="text-sm font-medium">
          {t.companyLabel}
        </label>
        <input
          id="reg-company"
          name="company"
          type="text"
          placeholder={t.companyPlaceholder}
          className="input"
        />
      </div>

      <p className="text-xs text-[#64748b]">{t.privacyNote}</p>

      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.submitting : t.submit}
      </button>
      {status === "error" && errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
