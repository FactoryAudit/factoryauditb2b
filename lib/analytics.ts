// lib/analytics.ts —— 轻量埋点通道（fail-open）
//
// 现状：站点未接入任何第三方分析（无 GA ID / 无自建埋点后端）。
// 因此事件统一走 data-track 属性 + AnalyticsTracker 组件：
//   - 有 window.gtag / window.dataLayer 时透传（未来接 GA 只需在 layout 注入脚本）
//   - 没有时静默 no-op，不抛错、不阻塞渲染
// 事件名以 lib/suppliers.ts 的 ANALYTICS_EVENTS 为准。
// 注意：本模块可被服务端组件 import（只读常量）；trackEvent 仅在客户端调用。

type GtagFn = (...args: unknown[]) => void;

export function trackEvent(name: string, payload?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      gtag?: GtagFn;
      dataLayer?: unknown[];
      [k: string]: unknown;
    };
    if (typeof w.gtag === "function") {
      w.gtag("event", name, payload ?? {});
      return;
    }
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: name, ...(payload ?? {}) });
    }
  } catch {
    // fail-open：埋点出错绝不影响用户操作
  }
}
