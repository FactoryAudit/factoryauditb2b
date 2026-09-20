"use client";

import { useState, useEffect } from "react";

// RelativeTime —— 「Posted X ago」相对时间标签（STEP-07 Live Buyer Requests）。
//
// 设计：服务端只传 ISO 日期，客户端用 Intl.RelativeTimeFormat 实时计算，
// 让首页不因「实时时间」退化为动态页（首页仍是构建期冻结的 Server Component）。
// 无任何数据请求。
//
// SSR 安全：初始 state = 静态日期（toISOString，UTC，确定性），SSR 直出即有内容、
// 且与客户端首帧一致（无 hydration mismatch）；挂载后升级为相对时间并每分钟刷新。

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function relative(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.round((then - now) / 1000);
  const abs = Math.abs(diff);
  for (const [unit, secs] of UNITS) {
    if (abs >= secs) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        Math.round(diff / secs),
        unit
      );
    }
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(0, "minute");
}

function staticDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function RelativeTime({
  date,
  prefix,
}: {
  date: string;
  prefix?: string;
}) {
  const [label, setLabel] = useState<string>(() => staticDate(date));

  useEffect(() => {
    const update = () => setLabel(relative(date, Date.now()));
    update();
    const t = window.setInterval(update, 60 * 1000);
    return () => window.clearInterval(t);
  }, [date]);

  if (!label) return null;
  return (
    <>
      {prefix ? `${prefix} ` : ""}
      {label}
    </>
  );
}
