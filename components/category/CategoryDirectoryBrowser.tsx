"use client";

// components/category/CategoryDirectoryBrowser.tsx
// 严格按 aguato provider 目录样式：左侧筛选栏（国家/行业/技术，带真实计数）
// + 右侧结果区（计数 + 排序下拉 + 卡片列表）。
//
// 🔴 所有筛选项都是真实可用的（对预渲染的全量公开数据做客户端过滤/排序），不是死控件。
// 🔴 数据全部是公开层字段（公司名/国家/规模/成立年份/简介/产品标签/风险分），不碰 PII。
// 🔴 站内 href 在服务端已用 localePath 加好语种前缀，这里直接用。
// 🔴 文案全部复用既有字典键，零新增翻译叶子（守住 9 语 3351 不变量）。

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { StaticSupplier } from "@/lib/staticData";
import CategorySupplierCard from "./CategorySupplierCard";

export type CategorySupplierLite = {
  supplier: StaticSupplier;
  displayName: string;
  countryName: string;
  href: string;
};

export type CategoryLinkLite = {
  slug: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
};

type Props = {
  locale: Locale;
  title: string;
  subtitle: string;
  suppliers: CategorySupplierLite[];
  categories: CategoryLinkLite[];
  backHref: string;
  backLabel: string;
  labels: {
    filterCountry: string;
    filterIndustry: string;
    filterProduct: string;
    scoredOnly: string;
    countLabel: string; // "{n} suppliers listed"
    sortByScore: string;
    sortByName: string;
    employeesLabel: string;
    establishedTemplate: string;
    selfReported: string;
    viewAllCategories: string;
  };
};

const INITIAL_VISIBLE = 5;

function FacetList({
  items,
  selected,
  onToggle,
  expandLabel,
}: {
  items: { key: string; label: string; count: number }[];
  selected: string | null;
  onToggle: (key: string) => void;
  expandLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {shown.map((it) => (
        <label
          key={it.key}
          className="flex items-center justify-between gap-2 cursor-pointer text-sm text-[#3f4650] hover:text-[#171717]"
        >
          <span className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              className="accent-[#e07a49]"
              checked={selected === it.key}
              onChange={() => onToggle(it.key)}
            />
            <span className="truncate">{it.label}</span>
          </span>
          <span className="shrink-0 text-xs text-[#8c8982] tabular-nums">{it.count}</span>
        </label>
      ))}
      {items.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm text-[#e07a49] hover:underline pt-0.5"
        >
          {expanded ? "−" : "+"} {expandLabel}
        </button>
      )}
    </div>
  );
}

export default function CategoryDirectoryBrowser({
  locale,
  title,
  subtitle,
  suppliers,
  categories,
  backHref,
  backLabel,
  labels,
}: Props) {
  const [country, setCountry] = useState<string | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [scoredOnly, setScoredOnly] = useState(false);
  const [sort, setSort] = useState<"score" | "name">("score");

  // 真实聚合：国家与技术标签的计数直接来自当前品类的全量公开数据。
  const countryFacets = useMemo(() => {
    const m = new Map<string, { key: string; label: string; count: number }>();
    for (const x of suppliers) {
      const key = x.supplier.countryCode || x.countryName;
      if (!key) continue;
      const cur = m.get(key);
      if (cur) cur.count += 1;
      else m.set(key, { key, label: x.countryName || key, count: 1 });
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [suppliers]);

  const productFacets = useMemo(() => {
    const m = new Map<string, { key: string; label: string; count: number }>();
    for (const x of suppliers) {
      for (const tag of x.supplier.mainProducts ?? []) {
        const cur = m.get(tag);
        if (cur) cur.count += 1;
        else m.set(tag, { key: tag, label: tag, count: 1 });
      }
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [suppliers]);

  const scoredCount = useMemo(
    () => suppliers.filter((x) => typeof x.supplier.riskScore === "number").length,
    [suppliers]
  );

  const filtered = useMemo(() => {
    const out = suppliers.filter((x) => {
      if (country && (x.supplier.countryCode || x.countryName) !== country) return false;
      if (product && !(x.supplier.mainProducts ?? []).includes(product)) return false;
      if (scoredOnly && typeof x.supplier.riskScore !== "number") return false;
      return true;
    });
    if (sort === "name") {
      out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else {
      // 分数越高风险越低（项目语义）：降序，未评分（null）排最后。
      out.sort((a, b) => (b.supplier.riskScore ?? -1) - (a.supplier.riskScore ?? -1));
    }
    return out;
  }, [suppliers, country, product, scoredOnly, sort]);

  const toggleCountry = (key: string) => setCountry((c) => (c === key ? null : key));
  const toggleProduct = (key: string) => setProduct((p) => (p === key ? null : key));

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-8">
      {/* 左侧筛选栏 */}
      <aside className="md:sticky md:top-6 self-start">
        <div className="border border-[#e8e6de] rounded-lg p-4 bg-white">
          <label className="flex items-center justify-between gap-2 cursor-pointer pb-3 border-b border-[#e8e6de] text-sm font-medium text-[#171717]">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-[#e07a49]"
                checked={scoredOnly}
                onChange={(e) => setScoredOnly(e.target.checked)}
              />
              {labels.scoredOnly}
            </span>
            <span className="text-xs text-[#8c8982] tabular-nums">{scoredCount}</span>
          </label>

          <div className="pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#171717] mb-2">
              {labels.filterCountry}
            </h3>
            <FacetList
              items={countryFacets}
              selected={country}
              onToggle={toggleCountry}
              expandLabel={labels.viewAllCategories}
            />
          </div>

          <div className="pt-4 mt-4 border-t border-[#e8e6de]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#171717] mb-2">
              {labels.filterIndustry}
            </h3>
            <div className="space-y-1.5">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={c.href}
                  className={`flex items-center justify-between gap-2 text-sm ${
                    c.active
                      ? "font-semibold text-[#e07a49]"
                      : "text-[#3f4650] hover:text-[#171717]"
                  }`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className="shrink-0 text-xs text-[#8c8982] tabular-nums">{c.count}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#e8e6de]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#171717] mb-2">
              {labels.filterProduct}
            </h3>
            <FacetList
              items={productFacets}
              selected={product}
              onToggle={toggleProduct}
              expandLabel={labels.viewAllCategories}
            />
          </div>
        </div>
      </aside>

      {/* 右侧结果区 */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-[#6d6b66]">
            {labels.countLabel.replaceAll("{n}", String(filtered.length))}
          </span>
          <label className="flex items-center gap-2 text-sm text-[#6d6b66]">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "score" | "name")}
              className="border border-[#d3d1c7] rounded-md px-3 py-1.5 text-sm text-[#3f4650] bg-white"
            >
              <option value="score">{labels.sortByScore}</option>
              <option value="name">{labels.sortByName}</option>
            </select>
          </label>
        </div>

        <h1 className="text-2xl font-bold text-[#171717] mt-5">{title}</h1>
        <p className="text-sm text-[#6d6b66] mt-1">{subtitle}</p>

        <ul className="mt-4 border-t border-[#e8e6de]">
          {filtered.map((x) => (
            <CategorySupplierCard
              key={x.supplier.slug}
              supplier={x.supplier}
              locale={locale}
              href={x.href}
              countryName={x.countryName}
              labels={{
                employeesLabel: labels.employeesLabel,
                establishedTemplate: labels.establishedTemplate,
                selfReported: labels.selfReported,
              }}
            />
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="text-sm text-[#6d6b66] py-10 text-center border-t border-[#e8e6de]">—</p>
        )}
      </div>
    </div>
  );
}
