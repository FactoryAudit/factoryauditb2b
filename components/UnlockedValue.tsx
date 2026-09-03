"use client";

// components/UnlockedValue.tsx —— 按需取回"已解锁字段"
//
// 为什么不是直接把真值作为 children 传给 UnlockGate：
//   React 会把传给客户端组件的所有 props（包括 JSX children）序列化进
//   RSC flight payload（页面底部的 self.__next_f.push）。也就是说，
//   真值虽然没渲染进 DOM，却以明文躺在 HTML 源码里，游客打开源码就能读到。
//
//   正确做法：页面只下发**字段名**（slug + field），真值由本组件在浏览器里
//   向 /api/suppliers/[slug]/unlocked 索要，服务端校验档位后才返回。
//
// 与 UnlockGate 的分工：
//   UnlockGate 决定"这一块显示锁态还是解锁态"（整块二选一，含 CTA 引导）；
//   UnlockedValue 负责"解锁之后那个值到底是什么"（按需 fetch）。
//   两者都读 AuthProvider，都不含真值，都可以在 SSG 页面里安全使用。

import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "./AuthProvider";

type Unlocked = {
  fields: Record<string, string>;
  evidenceStatus: Record<string, string>;
  /** 免费额度已用尽：字段拿不到不是因为档位不够，而是本月额度用完了 */
  quotaExceeded?: boolean;
  /** 服务端已本地化的额度提示，直接展示即可 */
  quotaMessage?: string;
};

// 模块级缓存：一个详情页有 5 个字段要取，去重后只发一次请求。
// key 里带 tier —— 用户升级后 tier 变化会自然触发重新取数，不会读到旧档位的缓存。
const CACHE = new Map<string, Unlocked>();
const INFLIGHT = new Map<string, Promise<Unlocked | null>>();

function cacheKey(slug: string, locale: string, tier: string): string {
  return `${slug}|${locale}|${tier}`;
}

async function loadUnlocked(
  slug: string,
  locale: string,
  tier: string
): Promise<Unlocked | null> {
  const key = cacheKey(slug, locale, tier);

  const cached = CACHE.get(key);
  if (cached) return cached;

  const pending = INFLIGHT.get(key);
  if (pending) return pending;

  const task = (async (): Promise<Unlocked | null> => {
    try {
      const res = await fetch(
        `/api/suppliers/${encodeURIComponent(slug)}/unlocked?locale=${encodeURIComponent(locale)}`,
        { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as Partial<Unlocked>;
      const value: Unlocked = {
        fields: data.fields ?? {},
        evidenceStatus: data.evidenceStatus ?? {},
        quotaExceeded: data.quotaExceeded === true,
        quotaMessage: data.quotaMessage,
      };
      CACHE.set(key, value);
      return value;
    } catch {
      // 网络失败 = 拿不到值。不抛错、不重试风暴，交给页面显示锁态。
      return null;
    } finally {
      INFLIGHT.delete(key);
    }
  })();

  INFLIGHT.set(key, task);
  return task;
}

/**
 * 取当前供应商的已解锁字段。
 *
 * @param slug    供应商 slug
 * @param locale  内容语言（en / zh / zh-TW），只影响状态标签措辞
 */
export function useUnlocked(slug: string, locale: string) {
  const { me, loading: authLoading } = useAuth();
  const [data, setData] = useState<Unlocked | null>(null);
  const [loading, setLoading] = useState(true);

  const authed = me.authenticated;
  const tier = me.tier;

  useEffect(() => {
    // 等 /api/me 回来再决定，避免游客也发一次注定为空的请求
    if (authLoading) return;
    if (!authed) {
      setData(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    void loadUnlocked(slug, locale, tier).then((result) => {
      if (!alive) return;
      setData(result);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [slug, locale, tier, authed, authLoading]);

  return { data, loading: loading || authLoading };
}

/**
 * 单个字段的值。未登录 / 加载中 / 该档位无此字段 → 渲染 fallback。
 *
 * 用法（在 Server Component 里，真值不进 payload）：
 *   <div className="font-semibold">
 *     <UnlockedValue slug={s.slug} locale={contentLocale} field="employees" />
 *   </div>
 */
export function UnlockedValue({
  slug,
  locale,
  field,
  fallback = "—",
  className,
}: {
  slug: string;
  locale: string;
  /** 字段名，取值来自 /api/suppliers/[slug]/unlocked 的 fields */
  field: string;
  /** 拿不到值时的占位（默认破折号，不用 🔒 —— 外层 UnlockGate 已经管锁态了） */
  fallback?: string;
  /** 有值时套 <span className>，无则不套包装（保持原有排版） */
  className?: string;
}) {
  const { data, loading } = useUnlocked(slug, locale);
  const value = data?.fields?.[field];
  if (loading || !value) {
    // 额度用尽时给出解释。否则用户只看到一个占位符却不知道为什么 ——
    // 比"不显示"更让人困惑，也不知道该去升级还是换个账号。
    const hint = data?.quotaExceeded ? data.quotaMessage : undefined;
    if (className) {
      return (
        <span className={className} title={hint}>
          {fallback}
        </span>
      );
    }
    return hint ? <span title={hint}>{fallback}</span> : <>{fallback}</>;
  }
  return className ? <span className={className}>{value}</span> : <>{value}</>;
}

/**
 * 某条证据的核验状态（paid 层）。
 * 与 UnlockedValue 的区别：按 evidence id 取值，且返回值已本地化。
 */
export function UnlockedEvidenceStatus({
  slug,
  locale,
  evidenceId,
  fallback = "🔒",
  className,
  style,
}: {
  slug: string;
  locale: string;
  evidenceId: string;
  fallback?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { data, loading } = useUnlocked(slug, locale);
  const label = data?.evidenceStatus?.[evidenceId];
  if (loading || !label) {
    const hint = data?.quotaExceeded ? data.quotaMessage : undefined;
    return (
      <span className={className} role="img" aria-label="Locked" title={hint}>
        {fallback}
      </span>
    );
  }
  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}
