"use client";

// components/AuthProvider.tsx —— 客户端会员状态提供者
//
// 为什么需要它（本方案的架构核心）：
//   /suppliers 与 /suppliers/[slug] 必须是 ● SSG 静态预渲染（SEO 红线），
//   所以服务端**不能**读 cookies 判断登录 —— 一读就退化成 ƒ Dynamic，
//   而且 Cloudflare CDN 会把已登录用户的 HTML 缓存后发给游客（串号事故）。
//
//   因此：服务端直出 public 内容（人人一样的静态 HTML），
//        会员状态由本组件在 hydration 后拉 /api/me 获得，
//        再由 UnlockGate 决定付费区块是否解锁。
//
// Hydration 安全：
//   初始状态固定为 visitor + loading=true，与服务端渲染出的 HTML 完全一致，
//   不会出现"服务端说未登录、客户端说已登录"的水合不匹配报错。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MeResponse, MembershipTier } from "@/lib/access";
import { buildMeResponse } from "@/lib/access";

/** 未登录的初始状态（也是 SSR 期间的状态） */
const VISITOR: MeResponse = buildMeResponse({
  tier: "visitor",
  planTier: "visitor",
  profilesUsed: 0,
  currentPeriodEnd: null,
  email: null,
  isAdmin: false,
});

type AuthState = {
  /** 首次 /api/me 是否还在路上。为 true 时 UnlockGate 显示锁定态。 */
  loading: boolean;
  me: MeResponse;
  /** 重新拉取（登录后、升级后调用） */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  me: VISITOR,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse>(VISITOR);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", {
        // 必须绕过一切缓存，否则会拿到别人的会员状态
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MeResponse;
      setMe(data);
    } catch {
      // 拉取失败 = 不解锁。这是最安全的默认行为。
      setMe(VISITOR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({ loading, me, refresh }),
    [loading, me, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 读取会员状态 */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * 判断某层级内容是否可见。
 * 页面/组件里一律用这个，不要自己写 `if (me.tier === ...)`。
 */
export function useCanAccess(layer: "public" | "free" | "paid"): boolean {
  const { me } = useAuth();
  if (me.isAdmin) return true;
  const rank: Record<MembershipTier, number> = {
    visitor: 0,
    free: 1,
    founding_buyer: 2,
  };
  const layerRank: Record<"public" | "free" | "paid", number> = {
    public: 0,
    free: 1,
    paid: 2,
  };
  return rank[me.tier] >= layerRank[layer];
}
