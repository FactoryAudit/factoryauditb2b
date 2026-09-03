"use client";

// components/CheckoutButton.tsx —— 会员结账按钮
//
// 三种状态，一律诚实呈现，绝不"点了才发现付不了款"：
//   1. 未登录          → 跳 /login?next=<当前页>，登录后能直接回来接着付
//   2. 已登录 + Stripe 已配置 → 调 /api/stripe/checkout 拿 URL 后跳转
//   3. 已登录 + Stripe 未配置 → 降级跳 /custom-services（人工对接）
//
// 为什么第 3 种不隐藏按钮：
//   隐藏 = 用户永远不知道有付费这回事；报错 = 用户体验崩。
//   降级到人工服务是最诚实的处理 —— 我们确实还没开在线收款，
//   但用户想买单的意图要接住（这正是 PRD 里"先跑询盘、线下成交"的策略）。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";
import { localePath, type Locale } from "@/i18n/config";

export type CheckoutDict = {
  /** 按钮文案（"Become a Founding Buyer"） */
  cta: string;
  submitting: string;
  /** 通用失败提示 */
  errorGeneric: string;
};

type Props = {
  locale: Locale;
  dict: CheckoutDict;
  /** 结账成功后想回到的页面（登录跳回用） */
  returnTo?: string;
  className?: string;
};

export default function CheckoutButton({
  locale,
  dict,
  returnTo = "/membership",
  className,
}: Props) {
  const router = useRouter();
  const { me, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setError(null);

    // ---- 未登录：先去登录，带 returnTo 回来 ----
    if (!me.authenticated) {
      const next = encodeURIComponent(returnTo);
      router.push(localePath(locale, `/login?next=${next}`));
      return;
    }

    setBusy(true);
    trackEvent(ANALYTICS_EVENTS.foundingBuyerCheckoutStart);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };

      if (data.ok && data.url) {
        // Stripe 托管页：整页跳转，不用 router（跨域）
        window.location.href = data.url;
        return;
      }

      // ---- 降级：在线收款未开通 / 服务异常 → 走人工 ----
      // payment_not_configured 是"还没开"，其余是临时故障，都引导到人工服务，
      // 因为用户此刻的意图是"我要付费"，不能让他落空。
      if (data.error === "payment_not_configured" || !res.ok) {
        router.push(localePath(locale, "/custom-services"));
        return;
      }

      setError(dict.errorGeneric);
    } catch {
      setError(dict.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || loading}
        className={className}
      >
        {busy ? dict.submitting : dict.cta}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-[#d4232a]">
          {error}
        </p>
      )}
    </div>
  );
}
