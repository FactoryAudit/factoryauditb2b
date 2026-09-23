"use client";

import { useState } from "react";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * CS-A #11：分享档案。
 *
 * 对外只暴露 share_token（sup_xxxxxxxx），不暴露 suppliers.id：
 *   · 点击后由服务端按 slug 签发/取回 token，返回 /suppliers/{slug}?ref={token}
 *   · token → supplier 的映射只存在于服务端，链接本身不含任何内部标识
 *   · 同一个供应商的 token 一经生成就不再变，买家手里的旧链接不会失效
 *
 * 失败处理：拿不到 token 时显示文案并保留按钮可再点，绝不静默变成"分享成功"。
 */
export default function ShareProfileButton({
  slug,
  dict,
}: {
  slug: string;
  dict: { shareCta: string; shareCopied: string; shareFailed: string };
}) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");

  const onClick = async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/supplier-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; sharePath?: string }
        | null;
      if (!res.ok || !json?.ok || !json.sharePath) {
        setState("error");
        return;
      }
      const url = `${window.location.origin}${json.sharePath}`;
      // clipboard API 在非 HTTPS / 老浏览器上可能不可用 —— 失败要明确报出，不能假装成功
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setState("copied");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={state === "loading"}
        className="btn btn-outline text-sm"
        data-track={ANALYTICS_EVENTS.profileShareClick}
        data-track-value={slug}
      >
        {state === "loading" ? "…" : dict.shareCta}
      </button>
      {state === "copied" && (
        <p className="mt-2 text-xs text-[#15803d]" role="status">
          {dict.shareCopied}
        </p>
      )}
      {state === "error" && (
        <p className="mt-2 text-xs text-[#b45309]" role="alert">
          {dict.shareFailed}
        </p>
      )}
    </div>
  );
}
