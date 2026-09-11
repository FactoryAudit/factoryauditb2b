"use client";

import { useRef, useState } from "react";
import {
  DIMENSION_STRUCTURE,
  LEVEL_SCORE,
  overallLevel,
  type RiskLevel,
} from "@/lib/riskEngine";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
// CS-05c：上限改为单一事实来源。此前这里硬编码 MAX_SUPPLIERS=5，
// 而注册页权益文案的 {n} 用的是另一个常量 —— 数值碰巧相等，语义并不相同。
import { COMPARE_MAX_SUPPLIERS } from "@/lib/suppliers";

// 对比工具的档位：沿用风险引擎的等级锚点（LEVEL_SCORE）与权重（DIMENSION_STRUCTURE），
// 不在这里重复定义任何分数或阈值，避免与引擎脱节。
export type CompareLevel = "strong" | "adequate" | "weak" | "unknown";

const LEVEL_KEYS: CompareLevel[] = ["strong", "adequate", "weak", "unknown"];

const RISK_OF_LEVEL: Record<CompareLevel, RiskLevel> = {
  strong: "LOW",
  adequate: "MODERATE",
  weak: "HIGH",
  unknown: "ELEVATED",
};

export interface CompareDict {
  [key: string]: string;
}

export interface CompareDimension {
  key: string;
  label: string;
  weight: number;
  description: string;
}

interface Supplier {
  id: number;
  name: string;
  ratings: Record<string, CompareLevel>;
}

const MAX_SUPPLIERS = COMPARE_MAX_SUPPLIERS;

function scoreOf(ratings: Record<string, CompareLevel>): number {
  let total = 0;
  for (const d of DIMENSION_STRUCTURE) {
    const level = ratings[d.key] ?? "unknown";
    total += LEVEL_SCORE[RISK_OF_LEVEL[level]] * d.weight;
  }
  return Math.round(total / 100);
}

export default function SupplierComparison({
  dict,
  dimensions,
  defaultNames,
  verificationHref,
}: {
  dict: CompareDict;
  dimensions: CompareDimension[];
  defaultNames: string[];
  verificationHref: string;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() =>
    defaultNames.map((name, i) => ({ id: i + 1, name, ratings: {} }))
  );
  const [nextId, setNextId] = useState(defaultNames.length + 1);
  // 埋点：首次实际比较动作（改评分 / 添加供应商）= 开始比较，每个会话只发一次
  const startedRef = useRef(false);

  const markStarted = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent(ANALYTICS_EVENTS.profileCompare);
    }
  };

  const setName = (id: number, name: string) =>
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));

  const setRating = (id: number, dimKey: string, level: CompareLevel) => {
    markStarted();
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ratings: { ...s.ratings, [dimKey]: level } } : s
      )
    );
  };

  const remove = (id: number) =>
    setSuppliers((prev) => (prev.length > 2 ? prev.filter((s) => s.id !== id) : prev));

  const add = () => {
    if (suppliers.length >= MAX_SUPPLIERS) return;
    markStarted();
    setSuppliers((prev) => [
      ...prev,
      { id: nextId, name: `${dict.supplierLabel} ${String.fromCharCode(65 + prev.length)}`, ratings: {} },
    ]);
    setNextId((n) => n + 1);
  };

  const reset = () =>
    setSuppliers(
      defaultNames.map((name, i) => ({ id: i + 1, name, ratings: {} }))
    );

  const scored = suppliers.map((s) => ({ ...s, score: scoreOf(s.ratings) }));
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a), scored[0]);

  // 差异最大的维度：各维度在最高分与最低分之间跨度最大的那个
  const gap = dimensions
    .map((d) => {
      const scores = suppliers.map(
        (s) => LEVEL_SCORE[RISK_OF_LEVEL[s.ratings[d.key] ?? "unknown"]]
      );
      return { ...d, spread: Math.max(...scores) - Math.min(...scores) };
    })
    .sort((a, b) => b.spread - a.spread)[0];

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scored.map((s, i) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={s.name}
                onChange={(e) => setName(s.id, e.target.value)}
                placeholder={dict.namePlaceholder}
                aria-label={`${dict.supplierLabel} ${i + 1}`}
                className="w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm font-semibold text-[#0f172a]"
              />
              {suppliers.length > 2 && (
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="shrink-0 text-xs text-[#64748b] hover:text-[#d4232a]"
                >
                  {dict.remove}
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {dimensions.map((d) => (
                <div key={d.key}>
                  <label className="block text-xs text-[#64748b]" htmlFor={`${s.id}-${d.key}`}>
                    {d.label}
                  </label>
                  <select
                    id={`${s.id}-${d.key}`}
                    value={s.ratings[d.key] ?? "unknown"}
                    onChange={(e) => setRating(s.id, d.key, e.target.value as CompareLevel)}
                    className="mt-1 w-full rounded-md border border-[#e2e8f0] px-2 py-1.5 text-sm text-[#0f172a]"
                  >
                    {LEVEL_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {dict[k]} — {dict[`${k}Hint`]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-[#e2e8f0] pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wide text-[#64748b]">
                  {dict.scoreCol}
                </span>
                <span className="text-2xl font-extrabold text-[#0f4c81]">{s.score}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full bg-[#0f4c81]"
                  style={{ width: `${s.score}%` }}
                />
              </div>
              <div className="mt-1 text-xs font-semibold text-[#0f172a]">
                {overallLevel(s.score)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={suppliers.length >= MAX_SUPPLIERS}
          className="btn btn-outline"
        >
          {dict.addSupplier}
        </button>
        <button type="button" onClick={reset} className="text-sm text-[#64748b] underline">
          {dict.reset}
        </button>
        <span className="text-xs text-[#64748b]">
          {suppliers.length >= MAX_SUPPLIERS ? dict.maxNote : `${suppliers.length}/${MAX_SUPPLIERS}`}
        </span>
      </div>

      <section className="mt-10 rounded-lg bg-[#f1f5f9] p-6">
        <h2 className="text-xl font-bold text-[#0f172a]">{dict.summaryTitle}</h2>
        <div className="mt-3 space-y-2 text-sm text-[#475569]">
          <p>
            <span className="font-semibold text-[#0f172a]">{best?.name}</span> · {best?.score}
            {" · "}
            {best ? overallLevel(best.score) : ""} — {dict.bestNote}
          </p>
          <p>
            <span className="font-semibold text-[#0f172a]">{dict.biggestGapTitle}: </span>
            {gap && gap.spread > 0 ? `${gap.label} — ${dict.biggestGapNote}` : dict.noGapNote}
          </p>
        </div>
        <p className="mt-4 text-xs text-[#64748b]">{dict.disclaimer}</p>
      </section>

      <section className="mt-8 card p-8 bg-[#0f4c81]">
        <h2 className="text-xl font-bold text-white">{dict.ctaTitle}</h2>
        <p className="mt-2 text-white/80">{dict.ctaLead}</p>
        <a href={verificationHref} className="btn btn-accent mt-5 inline-block">
          {dict.ctaPrimary}
        </a>
      </section>
    </div>
  );
}
