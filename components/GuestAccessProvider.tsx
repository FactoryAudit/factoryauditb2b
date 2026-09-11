"use client";

// components/GuestAccessProvider.tsx —— 单个 Supplier Profile 页的 Guest 访问闸门（CS-05b）
//
// 为什么是一个 Provider：
//   一页里有十几个 UnlockGate / UnlockedValue 都要问同一个问题
//   「这位游客还能不能看这家供应商的 basic 字段」，而答案必须**完全一致** ——
//   各自去读 localStorage 会出现「字段 A 解锁、字段 B 锁着」的撕裂状态。
//   所以判定只做一次（本组件 mount 时），结果通过 context 广播给全页。
//
// 为什么不放在 AuthProvider 里：
//   AuthProvider 是**全站**、与 supplier 无关的状态；Guest 额度是**按 supplier** 的，
//   作用域不同。混在一起会让"用户升级成 Free Buyer"与"换一家供应商"两种变化
//   挤在同一个 effect 里，难以推理。
//
// SSG / 水合安全：
//   初始状态固定为 pending（等价于「还没决定」）→ 与服务端渲染出的锁态一致，
//   不会出现水合不匹配。真正的判定在 mount 后的 effect 里做（localStorage 只有浏览器有）。
//
// 页面必须给它传 key：
//   <GuestAccessProvider key={s.id} supplierId={s.id}>
//   客户端跳转两家供应商时，没有 key 会复用同一个组件实例、沿用上一家的判定结果。

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { hasUnlimitedBasicAccess } from "@/lib/access";
import { GUEST_PROFILE_LIMIT } from "@/lib/suppliers";
import { commitGuestVisit, emitGuestLimitReachedOnce } from "@/lib/guestAccess";
import type { GuestVisitReason } from "@/lib/guestAccess";

export type GuestAccessStatus = "pending" | "allowed" | "blocked";

export type GuestAccessState = {
  /** pending = 还没判定（SSR 首帧 / /api/me 在路上）→ 一律按"未解锁"渲染 */
  status: GuestAccessStatus;
  reason: GuestVisitReason | "unlimited" | null;
  /** 已访问过的不同 supplier 数量 */
  uniqueSeen: number;
  /** 本次额度上限 */
  limit: number;
};

const DEFAULT_STATE: GuestAccessState = {
  status: "pending",
  reason: null,
  uniqueSeen: 0,
  limit: GUEST_PROFILE_LIMIT,
};

const GuestAccessContext = createContext<GuestAccessState>(DEFAULT_STATE);

/** 读取当前 supplier 的 Guest 访问判定。未包 Provider 时返回 pending（= 不解锁，安全默认）。 */
export function useGuestAccess(): GuestAccessState {
  return useContext(GuestAccessContext);
}

/**
 * basic 档案（free 层）对当前访客是否可见。
 *
 * 只有 **free 层**能靠 Guest 额度放行；paid 层永远只看服务端档位，
 * 与本组件无关 —— 那是唯一的安全边界。
 */
export function useGuestBasicAccess(): { allowed: boolean; pending: boolean } {
  const s = useGuestAccess();
  return { allowed: s.status === "allowed", pending: s.status === "pending" };
}

export function GuestAccessProvider({
  supplierId,
  children,
}: {
  supplierId: string;
  children: ReactNode;
}) {
  const { me, loading } = useAuth();
  const [state, setState] = useState<GuestAccessState>(DEFAULT_STATE);

  // Free Buyer / Founder Buyer / admin = basic 无限浏览，**没有 guest 额度这个概念**。
  // 注册完成后用户从 visitor 变成 free，这里会自动翻转，无需刷新页面。
  const unlimited = me.isAdmin || hasUnlimitedBasicAccess(me.tier);

  useEffect(() => {
    // /api/me 还没回来时不要判定 —— 否则已登录用户也会被当成游客扣一次额度
    if (loading) return;

    if (unlimited) {
      setState({
        status: "allowed",
        reason: "unlimited",
        uniqueSeen: 0,
        limit: GUEST_PROFILE_LIMIT,
      });
      return;
    }

    if (!supplierId) {
      setState(DEFAULT_STATE);
      return;
    }

    // ★ 唯一一次判定：commitGuestVisit 内部严格按
    //   ① 已访问 → 放行不扣 ② 未访问且 <5 → 记录放行 ③ 未访问且 >=5 → 拦截
    const decision = commitGuestVisit(supplierId);
    setState({
      status: decision.status,
      reason: decision.reason,
      uniqueSeen: decision.uniqueSeen,
      limit: decision.limit,
    });

    // 第 6 家被拦下 → 注册门信号。同一家只发一次（刷新/重渲都不重复）。
    if (decision.status === "blocked") {
      emitGuestLimitReachedOnce(supplierId, { uniqueSeen: decision.uniqueSeen });
    }
  }, [loading, unlimited, supplierId]);

  return (
    <GuestAccessContext.Provider value={state}>
      {children}
    </GuestAccessContext.Provider>
  );
}
