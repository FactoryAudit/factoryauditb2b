"use client";

// components/category/CategorySupplierCard.tsx
// 行业品类目录卡片 —— 严格按 aguato provider 列表样式：
//   左：Logo 方块（无公开 logo 数据 ⇒ 公司名首字占位，与截图文字占位一致）
//   右：公司名 → 元信息行（国家 · 规模 · 成立年份）→ 自述简介 → 技术/产品标签胶囊
//
// 🔴 数据纪律：
//   - 公司名/国家/规模/成立年份/产品标签/简介全部来自公开层真实字段，缺失显示「—」。
//   - 不显示 Claimed 徽章：profile_authorized 被刻意排除在公开查询层外，硬加即虚构信任信号。
//   - 不显示「参考案例数 / 数据表数 / 核验徽章」：无公开来源，宁可少显示，绝不编造。
//   - 简介是供应商自述（company_description），必须带 self-reported 标注，不冒充平台核验结论。
//   - 风险分 NULL ≠ 0：无分数显示「—」，不渲染成 0 分 + 最差档。

import Link from "next/link";
import type { StaticSupplier } from "@/lib/staticData";
import { supplierDisplayName } from "@/lib/supplierDisplayName";
import type { Locale } from "@/i18n/config";

type Props = {
  supplier: StaticSupplier;
  locale: Locale;
  href: string;
  /** 本地化的国名（由服务端 countryDisplayName 生成，卡片不碰国家字典） */
  countryName: string;
  labels: {
    employeesLabel: string;
    establishedTemplate: string; // "Established {year}"
    selfReported: string;
  };
};

/** 无 logo 时的文字占位：取公司显示名的首字（中文首字 / 英文首字母）。 */
function initialOf(name: string): string {
  const s = name.trim();
  if (!s) return "—";
  return Array.from(s)[0]?.toUpperCase() ?? "—";
}

export default function CategorySupplierCard({
  supplier: s,
  locale,
  href,
  countryName,
  labels,
}: Props) {
  const displayName = supplierDisplayName(locale, s);
  const initial = initialOf(displayName);

  // 元信息行：只放真实公开的字段，缺失的项直接不出现（不渲染空串/0）。
  const meta: string[] = [];
  if (countryName) meta.push(countryName);
  if (s.employees) meta.push(`${labels.employeesLabel}: ${s.employees}`);
  if (s.established > 0) meta.push(labels.establishedTemplate.replaceAll("{year}", String(s.established)));

  // 产品标签：只取公开层 main_products，最多 6 个（不编造"更多"）。
  const tags = (s.mainProducts ?? []).slice(0, 6);

  return (
    <li className="flex gap-4 py-6 border-b border-[#e8e6de] last:border-b-0">
      {/* Logo 占位方块 —— 无公开 logo 数据，用首字，与截图的文字占位一致 */}
      <div
        aria-hidden="true"
        className="shrink-0 w-12 h-12 rounded-lg border border-[#e8e6de] bg-[#faf9f6] flex items-center justify-center text-lg font-semibold text-[#9a978f] select-none"
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <Link href={href} className="text-base font-semibold text-[#171717] hover:underline">
          {displayName}
        </Link>

        {meta.length > 0 && (
          <div className="text-xs text-[#6d6b66] mt-1">
            {meta.join(" · ")}
          </div>
        )}

        {s.companyDescription && (
          <div className="mt-2">
            <p className="text-sm leading-relaxed text-[#3f4650] whitespace-pre-line line-clamp-3">
              {s.companyDescription}
            </p>
            <p className="text-[11px] text-[#8c8982] mt-1">{labels.selfReported}</p>
          </div>
        )}

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#d3d1c7] px-3 py-0.5 text-xs text-[#3f4650]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
