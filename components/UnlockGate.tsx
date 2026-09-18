"use client";

// components/UnlockGate.tsx —— 会员软锁（V2.1 最核心的组件）
//
// 解决的问题：
//   /suppliers/[slug] 是 ● SSG 静态页面，服务端不能读 cookie（一读就退化 ƒ Dynamic，
//   且 Cloudflare 缓存会把付费 HTML 发给游客）。所以付费内容不能由服务端决定。
//
// 工作方式：
//   1. 服务端渲染 → 输出 locked 态。**付费值根本不在 HTML 里**，游客看不到，也爬不走。
//   2. hydration 后 → AuthProvider 拿到 /api/me，若档位足够，用 children 替换 locked。
//   3. 付费用户看到真实值，游客/免费用户看到锁定态 + 升级引导。
//
// 代价：已登录用户会看到 <300ms 的锁定态闪烁。这是为保住 SSG + 防 CDN 串号付出的代价，值得。
//
// 安全边界：
//   children 是 **React 元素**，在服务端渲染时就被替换成 locked，
//   所以真实值连字符串都不会出现在 HTML 里（不是 CSS 隐藏，是真的没渲染）。

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { useGuestAccess } from "./GuestAccessProvider";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

export type AccessLayer = "public" | "free" | "paid";

type Labels = {
  /** 未登录时的引导文案 */
  signupCta: string;
  /** 已登录但档位不够时的引导文案 */
  upgradeCta: string;
  /** 无障碍标签：锁定图标 */
  lockedLabel?: string;
};

const DEFAULT_LABELS: Labels = {
  signupCta: "Sign up free",
  upgradeCta: "Upgrade",
  lockedLabel: "Locked",
};

type BaseProps = {
  /** 内容所需的最低档位 */
  layer: AccessLayer;
  labels?: Partial<Labels>;
  /** 由页面用 localePath(locale, "/register") 生成，保证链接带语言前缀 */
  registerHref: string;
  /** 由页面用 localePath(locale, "/pricing#founding-buyer") 生成（V2.2 §48/§52：/membership 已合并进 /pricing） */
  membershipHref: string;
  className?: string;
};

type InlineProps = BaseProps & {
  /** 锁定态显示什么（通常是 🔒 或 "—"） */
  locked: ReactNode;
  children: ReactNode;
  /** 行内模式：不给整块 CTA，只做值替换 */
  variant?: "inline";
};

type BlockProps = BaseProps & {
  /** 区块模式：锁定态展示标题 + 说明 + CTA 按钮 */
  variant: "block";
  title: string;
  lead: string;
  children: ReactNode;
};

/**
 * 原样模式：锁定态与解锁态都原样渲染，不套 <span>/<div> 包装。
 *
 * 用于"整块元素二选一"的场景，例如整个卡片在锁定/解锁时样式不同：
 *   <UnlockGate variant="raw" layer="free"
 *     locked={<div className="card opacity-80">🔒 注册查看</div>}
 *     membershipHref={...} registerHref={...}>
 *     <div className="card">{supplier.employees}</div>
 *   </UnlockGate>
 *
 * 传 children={null} 即为"解锁后什么都不显示"（例如已登录就不再显示注册引导条）。
 */
type RawProps = BaseProps & {
  variant: "raw";
  locked: ReactNode;
  children: ReactNode;
};

/**
 * 判断当前用户能否看到该层级。
 */
function useUnlocked(layer: AccessLayer): { unlocked: boolean; loading: boolean; authed: boolean } {
  const { me, loading } = useAuth();
  // CS-05b：Guest 的「5 家不同 supplier」额度（客户端记账）
  const guest = useGuestAccess();
  if (me.isAdmin) return { unlocked: true, loading, authed: true };

  const tierRank: Record<string, number> = {
    visitor: 0,
    free: 1,
    founding_buyer: 2,
  };
  const layerRank: Record<AccessLayer, number> = { public: 0, free: 1, paid: 2 };
  const rank = tierRank[me.tier] ?? 0;

  // 档位够（Free Buyer 及以上）→ 直接放行
  if (rank >= layerRank[layer]) {
    return { unlocked: true, loading, authed: me.authenticated };
  }

  // 档位不够时，只有 **free（basic）层** 能靠 Guest 额度放行。
  // paid 层永远只看服务端档位 —— localStorage 不是安全边界，也绝不可能打开付费情报。
  if (layer === "free") {
    return {
      unlocked: guest.status === "allowed",
      // pending 期间按"未解锁"渲染（安全默认，也保证 SSR 首帧与水合一致）
      loading: loading || guest.status === "pending",
      authed: me.authenticated,
    };
  }

  return { unlocked: false, loading, authed: me.authenticated };
}

/** 根据登录状态给出正确的引导链接与文案 */
function useCta(labels: Labels, registerHref: string, membershipHref: string) {
  const { me } = useAuth();
  const authed = me.authenticated;
  return {
    href: authed ? membershipHref : registerHref,
    text: authed ? labels.upgradeCta : labels.signupCta,
  };
}

/**
 * 行内软锁：用于"某个字段值"。
 *
 * 用法：
 *   <UnlockGate layer="free" locked={<span>🔒</span>} registerHref={p("/register")} membershipHref={p("/pricing#founding-buyer")}>
 *     <span>{supplier.established}</span>
 *   </UnlockGate>
 */
export function UnlockGate(props: InlineProps | BlockProps | RawProps) {
  const { layer, labels: labelOverrides, registerHref, membershipHref, className } = props;
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const { unlocked, loading } = useUnlocked(layer);

  // loading 与未授权都渲染 locked —— 这是安全的默认行为
  if (loading || !unlocked) {
    if (props.variant === "block") {
      return (
        <BlockLocked
          title={props.title}
          lead={props.lead}
          labels={labels}
          registerHref={registerHref}
          membershipHref={membershipHref}
          className={className}
          layer={layer}
        />
      );
    }
    if (props.variant === "raw") return <>{props.locked}</>;
    return (
      <span className={className} aria-label={!unlocked && !loading ? labels.lockedLabel : undefined}>
        {props.locked}
      </span>
    );
  }

  if (props.variant === "block") {
    return <div className={className}>{props.children}</div>;
  }
  if (props.variant === "raw") return <>{props.children}</>;
  return <span className={className}>{props.children}</span>;
}

/** 区块模式的锁定态：标题 + 说明 + CTA */
function BlockLocked({
  title,
  lead,
  labels,
  registerHref,
  membershipHref,
  className,
  layer,
}: {
  title: string;
  lead: string;
  labels: Labels;
  registerHref: string;
  membershipHref: string;
  className?: string;
  layer: AccessLayer;
}) {
  const cta = useCta(labels, registerHref, membershipHref);
  return (
    <div className={className}>
      <div className="text-sm text-[#475569]">
        <span className="font-semibold text-[#0f172a]">{title}</span> {lead}
      </div>
      <Link
        href={cta.href}
        className="btn btn-primary mt-3 inline-block text-sm"
        data-track={ANALYTICS_EVENTS.unlockGateCta}
        data-track-value={layer}
      >
        {cta.text}
      </Link>
    </div>
  );
}

/**
 * 只渲染锁定图标的小组件（用于表格/列表里的占位）。
 * 与 UnlockGate 的区别：不包 children，纯装饰用。
 */
export function LockIcon({ label = "Locked" }: { label?: string }) {
  return (
    <span className="text-[#94a3b8]" role="img" aria-label={label}>
      🔒
    </span>
  );
}
