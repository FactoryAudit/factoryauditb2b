"use client";

// components/LoginForm.tsx —— 邮箱密码登录（V2.1）
//
// 错误处理的三条原则：
//   1. 不区分"邮箱不存在"与"密码错误" —— 服务端已经统一返回 invalid_credentials，
//      前端也不得给出更细的提示（否则等于把服务端的防枚举设计废掉）。
//   2. Supabase 未配置时（M0 阻塞项没做完）诚实报"登录尚未开通"，
//      绝不假装登录成功。
//   3. 埋点只发事件名，不发邮箱（lib/analytics 有 PII 二次拦截，这里也不主动给）。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics";

export type LoginFormDict = {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submit: string;
  submitting: string;
  errorGeneric: string;
  errorInvalidCredentials: string;
  errorRateLimited: string;
  /** Supabase 未配置（M0 未完成）时的诚实提示 */
  errorNotConfigured: string;
};

export default function LoginForm({
  t,
  redirectTo,
}: {
  t: LoginFormDict;
  /** 登录成功后跳转的目标（由页面用 localePath 生成，已带语言前缀） */
  redirectTo: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const { refresh } = useAuth();
  const router = useRouter();

  function messageFor(code: unknown): string {
    if (code === "invalid_credentials") return t.errorInvalidCredentials;
    if (code === "rate_limited") return t.errorRateLimited;
    if (code === "auth_not_configured") return t.errorNotConfigured;
    return t.errorGeneric;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrMsg(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data?.ok) {
        // 先刷新会员状态，再跳转 —— 否则目标页首帧还是未登录态
        await refresh();
        trackEvent(ANALYTICS_EVENTS.login);
        router.push(redirectTo);
        return;
      }

      trackEvent(ANALYTICS_EVENTS.loginFailed);
      setErrMsg(messageFor(data?.error));
    } catch {
      trackEvent(ANALYTICS_EVENTS.loginFailed);
      setErrMsg(t.errorGeneric);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div>
        <label htmlFor="login-email" className="text-sm font-medium">
          {t.emailLabel}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="text-sm font-medium">
          {t.passwordLabel}
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={t.passwordPlaceholder}
          className="input"
        />
      </div>

      <button type="submit" disabled={status === "loading"} className="btn btn-primary w-full">
        {status === "loading" ? t.submitting : t.submit}
      </button>
      {errMsg && <p className="text-sm text-[#d4232a]">{errMsg}</p>}
    </form>
  );
}
