"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DirectoryView, {
  type DirectoryActive,
  type DirectoryDict,
  type DirectoryEvents,
  type DirectoryItem,
} from "./DirectoryView";
import type { TrustProfileDict } from "./VerificationBadge";

/**
 * stage1.8：/suppliers 目录的**客户端过滤层**。
 *
 * 为什么过滤放在客户端：
 *   页面已改为预渲染（构建期冻结全部已发布供应商）。若不把 searchParams 从
 *   服务端渲染路径里摘掉，Next 会强制动态渲染 —— 每次请求 4 次 Supabase 往返，
 *   在 Cloudflare Workers Free（CPU 10ms/req）下极易 5xx。
 *   现在：HTML 一次生成（含全量列表），过滤在浏览器本地完成（< 10ms）。
 *
 * 🔴 三条不可动摇的约束：
 *   1. **禁止客户端 fetch**。全量数据由服务端作为 props 传进来 —— 客户端拉数据
 *      会把 `redactSupplier` 的权限裁剪点搬到前端，属于权限边界后退。
 *   2. **首次渲染必须与预渲染 HTML 一致**。`mounted` 闸门让首帧保持「不过滤」，
 *      避免 hydration mismatch；挂载后才按真实 URL 过滤。过滤态首屏会有一帧
 *      未过滤内容，这是本方案（静态 HTML + 客户端过滤）的既定代价。
 *   3. **过滤口径与改造前逐字一致** —— 国家 / 行业精确相等，关键词对
 *      legalName / mainProducts / city 做不区分大小写的子串匹配，且同样
 *      先 trim → 截 80 → 转小写。
 */

/** 读 URL 过滤条件。空串 = 不筛选（与改造前 searchParams 缺省语义一致）。 */
function readActive(sp: { get(key: string): string | null }): DirectoryActive {
  return {
    country: sp.get("country") ?? "",
    industry: sp.get("industry") ?? "",
    // 与改造前服务端口径逐字一致：`rawQ?.trim().slice(0, 80).toLowerCase() ?? ""`
    q: (sp.get("q") ?? "").trim().slice(0, 80).toLowerCase(),
  };
}

export default function DirectoryGrid({
  items,
  countries,
  industries,
  directoryPath,
  supplierPathPrefix,
  dict,
  events,
  trustProfileDict,
}: {
  items: DirectoryItem[];
  countries: string[];
  industries: string[];
  directoryPath: string;
  supplierPathPrefix: string;
  dict: DirectoryDict;
  events: DirectoryEvents;
  trustProfileDict: TrustProfileDict;
}) {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 首帧（服务端预渲染 + 客户端 hydration 首帧）一律不过滤 ⇒ 与静态 HTML 一致。
  const active: DirectoryActive = mounted
    ? readActive(searchParams)
    : { country: "", industry: "", q: "" };

  const filtered = useMemo(() => {
    const { country, industry, q } = active;
    return items.filter(
      (x) =>
        (!country || x.country === country) &&
        (!industry || x.industryCode === industry) &&
        (!q ||
          x.legalName.toLowerCase().includes(q) ||
          x.mainProducts.some((m) => m.toLowerCase().includes(q)) ||
          x.city.toLowerCase().includes(q))
    );
    // active 每次渲染都是新对象，依赖收敛到三个原始值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, active.country, active.industry, active.q]);

  return (
    <DirectoryView
      items={filtered}
      countries={countries}
      industries={industries}
      active={active}
      directoryPath={directoryPath}
      supplierPathPrefix={supplierPathPrefix}
      dict={dict}
      events={events}
      trustProfileDict={trustProfileDict}
    />
  );
}
