// components/portal/ProgressRing.tsx —— 圆形进度环（参照 Sedex 后台的完成度指示）
//
// 纯服务端组件（无 "use client"）：只是几何计算 + SVG 渲染，不需要交互。
// 用法：<ProgressRing value={25} />  → 显示 25% 的圆环
//
// 视觉规范（对齐 Sedex 后台）：
//   · 底环浅灰、进度弧品牌橙、端点圆角、从 12 点方向顺时针
//   · 环心显示百分比数字（大字、深色）
//   · 尺寸默认 76px，可按需传 size

export default function ProgressRing({
  value,
  size = 76,
  label,
}: {
  /** 0–100；null 表示未知（渲染空环 + 破折号） */
  value: number | null;
  size?: number;
  /** 环心文字（默认显示 "xx%"，传 label 则覆盖） */
  label?: string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const stroke = 7;
  const r = 42; // viewBox 100 坐标系内的半径
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  const centerText = label ?? (value === null ? "—" : `${pct}%`);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={value === null ? "not available" : `${pct}%`}
      className="shrink-0"
    >
      {/* 底环 */}
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#ece8e1"
        strokeWidth={stroke}
      />
      {/* 进度弧（从 12 点顺时针） */}
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#e07a49"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 50 50)"
      />
      {/* 环心文字 */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="22"
        fontWeight="700"
        fill="#171717"
      >
        {centerText}
      </text>
    </svg>
  );
}
