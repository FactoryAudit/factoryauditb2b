"use client";

// AnalyticsTracker —— 全局事件委托（全站只挂一次，见 root layout）
//
// 四类埋点全部走事件委托 / 统一读取，页面里只需加属性，不用各自写监听：
//   1) data-track="事件名" + data-track-value="值"        → 点击
//   2) data-track-submit="事件名"（可选 data-track-field） → 表单提交
//   3) data-track-page="页面类型"                        → 页面浏览（按类型聚合）
//   4) data-track-view="事件名"                          → 页面级曝光（如 founding_buyer_view）
//      与 data-track-page 的区别：后者只能有一个且用于分组，
//      前者是「这个页面本身就是某个商业意图的曝光」，两者可同时存在。
//
// 无 gtag / dataLayer 时全部 no-op（fail-open），绝不阻塞渲染或业务。
//
// 关于 SPA 路由：GA4 的 gtag.js 只在首次加载时上报一次 page_view，
// App Router 的客户端跳转它感知不到，所以这里用 usePathname 补发。
// 只用 usePathname、不用 useSearchParams —— 后者会要求 Suspense 边界，
// 可能让静态页面退化，违反「不影响 SSR」的硬要求。

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent, trackPageView } from "@/lib/analytics";

/** 读取当前页面类型标记（路由切换后 DOM 已更新，延后一帧更稳） */
function readPageType(): string | undefined {
  const el = document.querySelector("[data-track-page]");
  return el?.getAttribute("data-track-page") ?? undefined;
}

/** 读取页面级曝光事件（如会员页 = Founding Buyer 曝光） */
function readViewEvent(): string | undefined {
  const el = document.querySelector("[data-track-view]");
  return el?.getAttribute("data-track-view") ?? undefined;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  // ---- 点击 / 表单提交委托（只注册一次）----
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.("[data-track]");
      if (!target) return;
      const name = target.getAttribute("data-track");
      if (!name) return;
      const value = target.getAttribute("data-track-value") ?? undefined;
      trackEvent(name, value ? { value } : undefined);
    };

    // submit 事件在部分场景不冒泡，用 capture 阶段兜底
    const onSubmit = (e: Event) => {
      const form = (e.target as HTMLElement | null)?.closest?.(
        "[data-track-submit]"
      );
      if (!form) return;
      const name = form.getAttribute("data-track-submit");
      if (!name) return;
      // 可选：指定读取哪个字段的值（如搜索框的 q）
      const field = form.getAttribute("data-track-field");
      let query: string | undefined;
      if (field) {
        const input = form.querySelector<HTMLInputElement>(`[name="${field}"]`);
        query = input?.value?.trim() || undefined;
      }
      trackEvent(name, query ? { query } : undefined);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // ---- 页面浏览 ----
  useEffect(() => {
    // 延后一帧，确保路由切换后的 DOM 已更新，能读到新页面的 data-track-page
    const id = window.setTimeout(() => {
      const page = readPageType();
      const view = readViewEvent();

      if (isFirstRender.current) {
        // 首次加载：gtag('config') 已自动上报标准 page_view，这里只补页面类型，
        // 不要再发一次 page_view，否则 PV 翻倍。
        isFirstRender.current = false;
      } else if (pathname) {
        // 客户端路由跳转：手动补发标准 page_view（GA4 感知不到 SPA 跳转）
        trackEvent("page_view", { page_path: pathname });
      }

      if (page) trackPageView(page);
      // 页面级曝光事件（如 founding_buyer_view）：每次页面呈现发一次
      if (view) trackEvent(view);
    }, 0);

    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
