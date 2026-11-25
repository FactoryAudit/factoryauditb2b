"use client";

// components/category/CategorySupplierCard.tsx
// 行业品类目录卡片（对标 aguato 的 provider 卡片形态）。
// 🔴 完全公开：公司名、国家、城市、产品标签、核验等级、风险分、Claimed 状态全部可见。
//    深度证据（evidence / 验厂历史 / 联系方式）仍走登录墙，本卡片不读任何 PII。

import Link from "next/link";
import type { StaticSupplier } from "@/lib/staticData";
import { supplierDisplayName } from "@/lib/supplierDisplayName";
import type { Locale } from "@/i18n/config";

type Props = {
  supplier: StaticSupplier;
  locale: Locale;
  href: string;
  labels: {
    viewSupplier: string;
    riskLabel: string;
    employeesLabel: string;
    /** 风险等级文案，由页面从字典 risk.ui.level 取，卡片不碰原始 token */
    riskLevelText: string;
  };
};

export default function CategorySupplierCard({ supplier: s, locale, href, labels }: Props) {
  // 风险分 NULL ≠ 0：无分数显示「—」，绝不渲染成 0 分 + 最高风险色（诋毁性陈述）。
  const hasRisk = typeof s.riskScore === "number";
  const riskText = hasRisk ? `${s.riskScore} / 100` : "—";
  // 🔴 不显示 Claimed / 已核验徽章：profile_authorized 被刻意排除在公开查询层外，
  //    evidence/capabilities 在 rowToMatrix 被置空（付费层纪律），
  //    verification_status 是 legacy 字段（铁律禁采信）。宁可少显示，绝不虚构信任信号。

  // 产品标签：只取公开层 main_products，最多 6 个，超出不显示（不编造"更多"）。
  const tags = (s.mainProducts ?? []).slice(0, 6);

  return (
    <li className="card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="font-semibold text-[#171717] hover:underline">
          {supplierDisplayName(locale, s)}
        </Link>
      </div>

      <div className="text-xs text-[#6d6b66] mt-1">
        {[s.city, s.countryCode].filter(Boolean).join(" · ") || "—"}
        {s.employees ? ` · ${labels.employeesLabel}: ${s.employees}` : ""}
      </div>

      <div className="text-xs text-[#6d6b66] mt-1">
        {labels.riskLabel}: {riskText}
        {hasRisk ? ` · ${labels.riskLevelText}` : ""}
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#f5f3ee] px-2.5 py-0.5 text-xs text-[#3f4650]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <Link href={href} className="mt-4 text-sm text-[#e07a49] font-medium hover:underline">
        {labels.viewSupplier} →
      </Link>
    </li>
  );
}
