"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AUDIT_TYPES,
  recommendAuditScope,
  type OrderValueBand,
  type ProductRisk,
  type ScopeModuleKey,
  type ScopeReasonCode,
} from "@/lib/auditScope";
import type { RiskLevel } from "@/lib/riskEngine";

export type AuditScopeDict = {
  title: string;
  lead: string;
  scoreLabel: string;
  scoreHint: string;
  scoreCta: string;
  relationshipLabel: string;
  relationshipFirst: string;
  relationshipRepeat: string;
  orderValueLabel: string;
  orderValues: string[];
  productRiskLabel: string;
  productRiskLow: string;
  productRiskMedium: string;
  productRiskHigh: string;
  weakLabel: string;
  weakHint: string;
  resultTitle: string;
  auditTypeLabel: string;
  manDaysLabel: string;
  manDaysUnit: string;
  modulesLabel: string;
  reasonsLabel: string;
  reasons: Record<ScopeReasonCode, string>;
  modules: Record<ScopeModuleKey, string>;
  apply: string;
  applied: string;
  disclaimer: string;
  noteIntro: string;
  noteBand: string;
  noteType: string;
  noteDays: string;
  noteModules: string;
  ruleBadge: string;
  aiBadge: string;
};

export type AppliedScope = { auditTypeIndex: number; note: string };

type Props = {
  t: AuditScopeDict;
  locale: string;
  calculatorHref: string;
  levelLabels: Record<RiskLevel, string>;
  dimensionOptions: { key: string; label: string }[];
  auditTypeLabels: string[];
  onApply: (scope: AppliedScope) => void;
};

const ORDER_VALUES: OrderValueBand[] = ["lt10k", "10to50k", "50to200k", "gt200k"];
const PRODUCT_RISKS: ProductRisk[] = ["low", "medium", "high"];

export default function AuditScopeAdvisor({
  t,
  locale,
  calculatorHref,
  levelLabels,
  dimensionOptions,
  auditTypeLabels,
  onApply,
}: Props) {
  const [score, setScore] = useState(70);
  const [firstOrder, setFirstOrder] = useState(true);
  const [orderValue, setOrderValue] = useState<OrderValueBand>("10to50k");
  const [productRisk, setProductRisk] = useState<ProductRisk>("low");
  const [weak, setWeak] = useState<string[]>([]);
  const [aiText, setAiText] = useState("");
  const [aiSource, setAiSource] = useState<"rule" | "ai">("rule");
  const [applied, setApplied] = useState(false);

  const orderValueLabels = t.orderValues as unknown as string[];
  const productRiskLabels: Record<ProductRisk, string> = {
    low: t.productRiskLow,
    medium: t.productRiskMedium,
    high: t.productRiskHigh,
  };

  // 规则引擎是纯函数，输入变就重算；推荐结果不依赖网络，没有 AI 也完全一致
  const rec = useMemo(
    () =>
      recommendAuditScope({
        riskScore: score,
        firstOrder,
        orderValue,
        productRisk,
        weakDimensions: weak,
      }),
    [score, firstOrder, orderValue, productRisk, weak],
  );

  // 叙述段走服务端（可选 AI）。防抖 700ms，避免拖滑块时连发请求。
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/audit-scope", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            riskScore: score,
            firstOrder,
            orderValue,
            productRisk,
            weakDimensions: weak,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data?.ok) {
          setAiText(typeof data.narrative === "string" ? data.narrative : "");
          setAiSource(data.source === "ai" ? "ai" : "rule");
        }
      } catch {
        // 叙述段是增强项，拿不到就只展示规则结果，不打扰用户
        if (!cancelled) setAiText("");
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locale, score, firstOrder, orderValue, productRisk, weak]);

  function toggleWeak(key: string) {
    setWeak((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    setApplied(false);
  }

  const auditTypeLabel =
    auditTypeLabels[rec.auditTypeIndex] ?? AUDIT_TYPES[rec.auditTypeIndex] ?? "";

  function buildNote(): string {
    const lines: string[] = [t.noteIntro];
    lines.push(`${t.noteBand}: ${levelLabels[rec.band]} (${score}/100)`);
    lines.push(`${t.noteType}: ${auditTypeLabel}`);
    lines.push(`${t.noteDays}: ${rec.manDays}`);
    lines.push(`${t.noteModules}:`);
    for (const m of rec.modules) lines.push(`- ${t.modules[m.key]}`);
    return lines.join("\n");
  }

  return (
    <section className="card p-6">
      <h2 className="text-xl font-bold text-[#0f172a]">{t.title}</h2>
      <p className="text-sm text-[#64748b] mt-1">{t.lead}</p>

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <div>
          <label className="text-sm font-medium" htmlFor="scope-score">
            {t.scoreLabel}: <span className="text-[#0f4c81] font-bold">{score}</span>
          </label>
          <input
            id="scope-score"
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => {
              setScore(Number(e.target.value));
              setApplied(false);
            }}
            className="w-full mt-2"
          />
          <p className="text-xs text-[#64748b] mt-1">{t.scoreHint}</p>
          <Link href={calculatorHref} className="text-xs text-[#0f4c81] font-medium hover:underline">
            {t.scoreCta} →
          </Link>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="scope-order-value">
            {t.orderValueLabel}
          </label>
          <select
            id="scope-order-value"
            className="select mt-2 w-full"
            value={orderValue}
            onChange={(e) => {
              setOrderValue(e.target.value as OrderValueBand);
              setApplied(false);
            }}
          >
            {ORDER_VALUES.map((v, i) => (
              <option key={v} value={v}>
                {orderValueLabels[i] ?? v}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium mt-4 block" htmlFor="scope-product-risk">
            {t.productRiskLabel}
          </label>
          <select
            id="scope-product-risk"
            className="select mt-2 w-full"
            value={productRisk}
            onChange={(e) => {
              setProductRisk(e.target.value as ProductRisk);
              setApplied(false);
            }}
          >
            {PRODUCT_RISKS.map((v) => (
              <option key={v} value={v}>
                {productRiskLabels[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">{t.relationshipLabel}</legend>
        <div className="flex gap-4 mt-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="scope-relationship"
              checked={firstOrder}
              onChange={() => {
                setFirstOrder(true);
                setApplied(false);
              }}
            />
            {t.relationshipFirst}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="scope-relationship"
              checked={!firstOrder}
              onChange={() => {
                setFirstOrder(false);
                setApplied(false);
              }}
            />
            {t.relationshipRepeat}
          </label>
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">{t.weakLabel}</legend>
        <p className="text-xs text-[#64748b] mt-1 mb-2">{t.weakHint}</p>
        <div className="flex flex-wrap gap-2">
          {dimensionOptions.map((d) => {
            const on = weak.includes(d.key);
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleWeak(d.key)}
                className={
                  on
                    ? "px-3 py-1.5 text-xs rounded-full border border-[#0f4c81] bg-[#0f4c81] text-white"
                    : "px-3 py-1.5 text-xs rounded-full border border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold text-[#0f172a]">{t.resultTitle}</h3>
          <span className="text-xs px-2 py-1 rounded-full border border-[#cbd5e1] text-[#475569]">
            {aiSource === "ai" ? t.aiBadge : t.ruleBadge}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-[#64748b]">{t.auditTypeLabel}</div>
            <div className="font-semibold text-[#0f4c81]">{auditTypeLabel}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[#64748b]">{t.manDaysLabel}</div>
            <div className="font-semibold text-[#0f172a]">
              {rec.manDays} {t.manDaysUnit}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-[#64748b]">{t.modulesLabel}</div>
          <ul className="mt-2 space-y-1.5">
            {rec.modules.map((m) => (
              <li key={m.key} className="text-sm text-[#0f172a]">
                • {t.modules[m.key]}
                {m.reasons.length > 0 && (
                  <span className="text-xs text-[#64748b]">
                    {" "}
                    ({m.reasons.map((r) => t.reasons[r]).join("; ")})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {aiText && <p className="mt-4 text-sm text-[#334155] whitespace-pre-line">{aiText}</p>}

        <button
          type="button"
          onClick={() => {
            onApply({ auditTypeIndex: rec.auditTypeIndex, note: buildNote() });
            setApplied(true);
          }}
          className="btn btn-secondary mt-5"
        >
          {applied ? t.applied : t.apply}
        </button>

        <p className="text-xs text-[#64748b] mt-3">{t.disclaimer}</p>
      </div>
    </section>
  );
}
