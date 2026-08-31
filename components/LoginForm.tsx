"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export type LoginDict = {
  login: Record<string, string>;
  register: Record<string, string>;
  errors: Record<string, string>;
};

export default function LoginForm({
  dict,
  googleEnabled,
  callbackUrl,
  initialError,
}: {
  dict: LoginDict;
  googleEnabled: boolean;
  callbackUrl: string;
  initialError?: string;
}) {
  const t = dict.login;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError(t.errorInvalid);
      setLoading(false);
    } else {
      window.location.href = callbackUrl;
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="login-email" className="text-sm font-medium block mb-1.5">
            {t.email}
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@factoryauditb2b.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="login-pass" className="text-sm font-medium block mb-1.5">
            {t.password}
          </label>
          <input
            id="login-pass"
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-[#d4232a]">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full py-3" disabled={loading}>
          {loading ? t.submitting : t.submit}
        </button>
      </form>

      {googleEnabled && (
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="btn btn-outline w-full"
        >
          {t.google}
        </button>
      )}

      <p className="text-xs text-[#64748b]">{t.demoHint}</p>
    </>
  );
}
