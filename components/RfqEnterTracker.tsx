"use client";

// RfqEnterTracker —— 进入 /rfq 时发一次独立业务事件 rfq_enter。
//
// 为什么需要它（STEP 08 Phase 3 / P2）：
//   此前「进入 /rfq」只能靠自动 page_view(/rfq) 弱代理判断，无法与 CTA 点击精确对应
//   （page_view 也含直接访问 / 刷新）。rfq_enter 是明确的业务语义事件，让漏斗
//   「CTA 点击 → 进入 /rfq」环节可精确计量。
//
// 触发：组件挂载（即真正进入 /rfq 页面）后发一次，用 ref 守卫防重复（StrictMode / 重渲染）。
// 参数（仅安全数据，绝不携带 PII）：
//   locale   —— 当前语言
//   source   —— URL ?src=（行业页 CTA 带入的来源归因），无则省略
//   request  —— URL ?request=RFQ-XXXX（从首页 Live Buyer Requests 卡片带入），无则省略
// 禁止：email / company / country / message / contact_name / user_id 等一律不发送。

import { useEffect, useRef } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

export default function RfqEnterTracker({ locale }: { locale: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const sp =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const source = sp.get("src") ?? undefined;
    const request = sp.get("request") ?? undefined;

    const params: Record<string, string> = { locale };
    if (source) params.source = source;
    if (request) params.request = request;

    trackEvent(ANALYTICS_EVENTS.rfqEnter, params);
  }, [locale]);

  return null;
}
