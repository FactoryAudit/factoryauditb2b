"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import DirectoryView, {
  type DirectoryActive,
  type DirectoryDict,
  type DirectoryEntry,
  type DirectoryEvents,
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
 * 🔴 四条不可动摇的约束：
 *   1. **公开 HTML 只含锁定视图**。服务端传进来的 `items` 已由
 *      `lib/directoryWall.ts` 脱敏（真实公司名置空、href 指登录页）。
 *      这里**不再**由客户端决定"谁能看名字" —— 那会退化成权限边界后退。
 *   2. **完整档只来自授权接口**。已登录时才去 `/api/suppliers/directory`
 *      取真实名称与档案地址；接口在**服务端**校验 cookie，客户端传什么都不信。
 *      这是方案 A 的既定代价：首屏（SSR + hydration 首帧）恒为锁定视图，
 *      已登录用户在 auth 解析完成后看到列表刷新一次。
 *   3. **失败方向绝不放行**：接口失败 / 401 / 断网 ⇒ 保持锁定视图，不报错、不半开。
 *   4. **过滤口径不变** —— 国家 / 行业精确相等，关键词对 legalName / mainProducts / city
 *      做不区分大小写的子串匹配，且同样先 trim → 截 80 → 转小写。
 *      锁定态 legalName 为空串 ⇒ `"".includes(q)` 在 q 非空时恒为 false，
 *      因此"按名称搜索"在未登录时自然失效，不会误命中全量。
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
  locale,
  dict,
  events,
  trustProfileDict,
}: {
  /** 服务端预渲染的**锁定**视图（正常情况直接用它渲染） */
  items: DirectoryEntry[];
  countries: string[];
  industries: string[];
  directoryPath: string;
  /** 当前语言（授权接口据此本地化 CTA 与档案地址前缀） */
  locale: string;
  dict: DirectoryDict;
  events: DirectoryEvents;
  trustProfileDict: TrustProfileDict;
}) {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── 阶段 1：登录墙 ────────────────────────────────────────────────────────
  // 已登录 → 从授权接口取完整档并替换锁定视图。未登录 / 失败 → 保持锁定视图。
  const { loading: authLoading, me } = useAuth();
  const [unlocked, setUnlocked] = useState<DirectoryEntry[] | null>(null);

  useEffect(() => {
    if (authLoading) return; // auth 未就绪时不动 —— 避免游客态闪一下再锁定
    if (!me.authenticated) {
      setUnlocked(null);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/suppliers/directory?locale=${encodeURIComponent(locale)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return; // 401 / 5xx ⇒ 保持锁定视图（失败方向绝不放行）
        const data = (await res.json()) as { items?: DirectoryEntry[] };
        if (alive && Array.isArray(data.items)) setUnlocked(data.items);
      } catch {
        // 断网 / 解析失败 ⇒ 同样保持锁定视图，不报错、不半开
      }
    })();
    return () => {
      alive = false;
    };
  }, [authLoading, me.authenticated, locale]);

  const source = unlocked ?? items;

  // 首帧（服务端预渲染 + 客户端 hydration 首帧）一律不过滤 ⇒ 与静态 HTML 一致。
  const active: DirectoryActive = mounted
    ? readActive(searchParams)
    : { country: "", industry: "", q: "" };

  const filtered = useMemo(() => {
    const { country, industry, q } = active;
    return source.filter(
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
  }, [source, active.country, active.industry, active.q]);

  return (
    <DirectoryView
      items={filtered}
      countries={countries}
      industries={industries}
      active={active}
      directoryPath={directoryPath}
      locale={locale}
      dict={dict}
      events={events}
      trustProfileDict={trustProfileDict}
    />
  );
}
