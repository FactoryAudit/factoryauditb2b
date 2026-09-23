import type { TrustStatus } from "@/lib/trustProfile";

/**
 * CS-D：验证徽章（唯一状态来源 = lib/trustProfile.ts）
 *
 * 铁律：
 *   1. **不在本组件里判断**谁能拿到 Verified —— 状态只能由服务端推导后当 prop 传进来。
 *      供应商上传材料永远只能落到 SELF_ASSESSED，绝不可能是 ONLINE / ON_SITE。
 *   2. **颜色不是唯一识别方式**：同一状态必须同时具备 icon + 文字 + 颜色三重信号，
 *      色觉障碍 / 黑白打印 / 深色模式下依然可读。
 *   3. EXPIRED 是独立显示态：它从"生效徽章"里退出，但历史记录保留在 VerificationDetails。
 */

export type TrustProfileDict = {
  statusNone: string;
  statusSelf: string;
  statusOnline: string;
  statusOnSite: string;
  statusExpired: string;
};

/** 显示态：把"已过期"从三态里单独拆出来，避免与"未核验"混淆 */
export type BadgeState = TrustStatus | "EXPIRED";

const BADGE: Record<
  BadgeState,
  { icon: string; text: string; className: string }
> = {
  // 未核验：中性灰 + 空心圆
  NONE: {
    icon: "○",
    text: "—",
    className: "border-[#cbd5e1] text-[#475569] bg-white",
  },
  // 工厂自评：中性灰 + 半实心（绝不用绿色，避免被读成"已核验"）
  SELF_ASSESSED: {
    icon: "◐",
    text: "—",
    className: "border-[#94a3b8] text-[#475569] bg-[#f8fafc]",
  },
  // 线上核验：绿色 + 单勾
  ONLINE_VERIFIED: {
    icon: "✓",
    text: "",
    className: "border-[#16a34a] text-[#15803d] bg-[#f0fdf4]",
  },
  // 现场核验：蓝色 + 双勾（与线上核验在图标层就不同，不只靠颜色区分）
  ON_SITE_VERIFIED: {
    icon: "✓✓",
    text: "",
    className: "border-[#0f4c81] text-[#0f4c81] bg-[#e6eef6]",
  },
  // 已过期：琥珀色 + 时钟 + 虚线边框
  EXPIRED: {
    icon: "⌛",
    text: "",
    className: "border-dashed border-[#b45309] text-[#b45309] bg-[#fffbeb]",
  },
};

function labelOf(state: BadgeState, d: TrustProfileDict): string {
  switch (state) {
    case "ON_SITE_VERIFIED":
      return d.statusOnSite;
    case "ONLINE_VERIFIED":
      return d.statusOnline;
    case "SELF_ASSESSED":
      return d.statusSelf;
    case "EXPIRED":
      return d.statusExpired;
    default:
      return d.statusNone;
  }
}

export default function VerificationBadge({
  state,
  dict,
  href,
  className = "",
}: {
  /** 服务端推导结果（getTrustSnapshot + 过期判定） */
  state: BadgeState;
  dict: TrustProfileDict;
  /**
   * 点击徽章跳转到的详情锚点（如 "#verification-details"）。
   * 只在"确实有详情可看"时由调用方传入 —— 未核验的徽章不给链接，
   * 点了跳到空区块比不给链接更糟。
   */
  href?: string;
  className?: string;
}) {
  const b = BADGE[state];
  const label = labelOf(state, dict);

  const cls = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${b.className} ${className}`;
  const inner = (
    <>
      <span aria-hidden="true" className="text-[13px] leading-none">
        {b.icon}
      </span>
      <span>{label}</span>
    </>
  );

  // 有详情锚点 ⇒ 渲染成链接，点击即可展开/跳到 Verification Details
  if (href) {
    return (
      <a
        href={href}
        className={`${cls} hover:underline`}
        // aria-label 带完整文字，屏幕阅读器不依赖颜色
        aria-label={label}
        data-verification-state={state}
      >
        {inner}
      </a>
    );
  }

  return (
    <span
      className={cls}
      // aria-label 带完整文字，屏幕阅读器不依赖颜色
      aria-label={label}
      data-verification-state={state}
    >
      {inner}
    </span>
  );
}
