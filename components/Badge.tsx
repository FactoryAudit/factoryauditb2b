// components/Badge.tsx —— 状态徽章（验证与证据中心共用）
//
// 设计说明：
//   1. 这是**新增**的共享组件，不改动任何现有页面的徽章实现（现有页面继续用
//      globals.css 的 .badge-* 类）。新模块统一走这里，便于后续收敛。
//   2. 全部配色已用 WCAG 2.2 AA 校验（正文 ≥4.5:1）：
//        verified   #17602b on #e7f5ec = 6.80:1
//        pending    #8a5410 on #fff4e0 = 5.74:1
//        expiring   #8a5410 on #fff4e0 = 5.74:1
//        rejected   #9b1c1c on #fdeaea = 7.04:1
//        expired    #475569 on #f1f5f9 = 6.92:1
//        neutral    #0f4c81 on #e6eef6 = 7.56:1
//   3. 语义与实际数据绑定：没有记录不得渲染 verified 徽章（调用方负责判断）。

import type { ReactNode } from "react";

export type BadgeVariant =
  | "verified"
  | "pending"
  | "expiring"
  | "rejected"
  | "expired"
  | "neutral";

const STYLES: Record<BadgeVariant, string> = {
  verified: "bg-[#e7f5ec] text-[#17602b]",
  pending: "bg-[#fff4e0] text-[#8a5410]",
  expiring: "bg-[#fff4e0] text-[#8a5410]",
  rejected: "bg-[#fdeaea] text-[#9b1c1c]",
  expired: "bg-[#f1f5f9] text-[#475569]",
  neutral: "bg-[#e6eef6] text-[#0f4c81]",
};

export function Badge({
  variant,
  children,
  title,
}: {
  variant: BadgeVariant;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[variant]}`}
    >
      {children}
    </span>
  );
}
