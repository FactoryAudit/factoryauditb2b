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

/**
 * 分析通道是否可用。
 * GA4 的内联初始化片段一旦执行，至少会提供 window.gtag 或 window.dataLayer 之一；
 * 两者皆无 = 脚本尚未注入（此时调用 trackEvent 会静默 no-op）。
 */
function isAnalyticsReady(): boolean {
  const w = window as unknown as { gtag?: unknown; dataLayer?: unknown };
  return typeof w.gtag === "function" || Array.isArray(w.dataLayer);
}

/** 等待分析通道就绪的轮询间隔 / 上限 */
const READY_POLL_MS = 50;
const READY_TIMEOUT_MS = 10000;

/**
 * 等分析通道就绪后再执行（fail-open：超时即放弃，绝不阻塞渲染或业务）。
 *
 * ⚠️ 为什么必须等：
 * GA4 的内联初始化片段由 next/script(strategy="afterInteractive") 注入，其执行时机
 * 与 React 首次 passive effect 处于同一时间段，二者先后顺序**不保证**。
 * 若本组件先跑，trackEvent 会因「既无 gtag 也无 dataLayer」而静默 no-op ——
 * 该次页面浏览的事件就**永久丢失**：不报错、不重试、GA4 里也看不出来少了什么。
 * 轮询等待可把这个不确定因素彻底消除（脚本就绪后 dataLayer 垫片路径已被实测
 * 证明能真实投递到 /g/collect）。
 *
 * 返回取消函数，供 effect 清理时调用。
 */
function whenAnalyticsReady(run: () => void): () => void {
  if (isAnalyticsReady()) {
    run();
    return () => {};
  }

  let done = false;
  let deadline = 0;

  const timer = window.setInterval(() => {
    if (done || !isAnalyticsReady()) return;
    done = true;
    window.clearInterval(timer);
    window.clearTimeout(deadline);
    run();
  }, READY_POLL_MS);

  deadline = window.setTimeout(() => {
    if (done) return;
    done = true;
    window.clearInterval(timer);
  }, READY_TIMEOUT_MS);

  return () => {
    done = true;
    window.clearInterval(timer);
    window.clearTimeout(deadline);
  };
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);
  // 页面级曝光（如 Live Buyer Requests）只触发一次，防止 React re-render / hydration /
  // StrictMode 双调用造成重复 impression。每次路由切换重新武装，保证「每次访问最多一次」。
  const viewFiredRef = useRef(false);

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
    // 每次路由切换重新武装曝光守卫：一次页面访问最多一次 impression
    viewFiredRef.current = false;
    // 首次渲染标记在 effect 主体里就地消费：若放到延后回调里，
    // 回调被 cleanup 取消时标记会悬空，后续 SPA 跳转会漏发 page_view。
    const isFirst = isFirstRender.current;
    isFirstRender.current = false;

    let domTimer: number | undefined;

    // 两道等待，缺一不可：
    //   ① 等分析通道就绪 —— 否则事件静默丢失（见 whenAnalyticsReady 注释）
    //   ② 再延后一帧读 DOM —— 确保路由切换后新页面的 data-track-page 已挂上
    const cancelReady = whenAnalyticsReady(() => {
      domTimer = window.setTimeout(() => {
        const page = readPageType();
        const view = readViewEvent();

        if (!isFirst && pathname) {
          // 客户端路由跳转：手动补发标准 page_view（GA4 感知不到 SPA 跳转）。
          // 首次加载不发 —— gtag('config') 已自动上报标准 page_view，再发一次 PV 会翻倍。
          trackEvent("page_view", { page_path: pathname });
        }

        if (page) trackPageView(page);
        // 页面级曝光事件（如 home_live_buyer_request_view）：每次页面呈现最多发一次
        if (view && !viewFiredRef.current) {
          viewFiredRef.current = true;
          trackEvent(view);
        }
      }, 0);
    });

    return () => {
      cancelReady();
      if (domTimer !== undefined) window.clearTimeout(domTimer);
    };
  }, [pathname]);

  return null;
}
