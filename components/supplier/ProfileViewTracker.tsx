"use client";

import { useEffect } from "react";

/**
 * CS-A：档案浏览埋点（PROFILE_VIEW + UNIQUE_VISIT）。
 *
 * 存在理由：档案页是预渲染静态产物，服务端在构建期没有请求上下文，
 * 直接写库要么拿不到访客信息、要么把整页拖回动态渲染（放弃静态产物）。
 * 所以由这个零 UI 的客户端组件在挂载后补发一次 POST。
 *
 * 纪律：
 *   · 只传 slug + ref，绝不传内部 supplier UUID；
 *   · 失败静默 —— 统计埋点绝不能影响页面可用性；
 *   · 依赖数组里放 slug，同一页面切换供应商时重新计数。
 */
export default function ProfileViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const ref = new URLSearchParams(window.location.search).get("ref");
        await fetch("/api/supplier-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, ref: ref ?? null }),
          keepalive: true,
        });
      } catch {
        // 埋点失败什么都不做
      }
    };
    if (!cancelled) void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return null;
}
