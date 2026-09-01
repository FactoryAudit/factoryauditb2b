"use client";

// AnalyticsTracker —— 全局事件委托：
// 1) 监听 [data-track] 元素的点击，触发 trackEvent(name, { value })
// 2) 读取 <body data-track-page="...">，在 mount 时触发页面浏览事件
// 无 gtag/dataLayer 时全部 no-op（fail-open），不影响任何功能。

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function AnalyticsTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.("[data-track]");
      if (!target) return;
      const name = target.getAttribute("data-track");
      const value = target.getAttribute("data-track-value") ?? undefined;
      if (!name) return;
      trackEvent(name, value ? { value } : undefined);
    };
    document.addEventListener("click", onClick);

    const pageEl = document.querySelector("[data-track-page]");
    const page = pageEl?.getAttribute("data-track-page");
    if (page) trackEvent("page_view", { page });

    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
