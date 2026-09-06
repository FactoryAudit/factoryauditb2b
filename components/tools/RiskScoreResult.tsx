"use client";
// RiskScore™ 结果区（P0-5）
// 职责：把 RiskEngineResult 渲染成可解释的结果卡：
//   总分 + 等级徽章 + 自述声明 + 得分刻度 + Key Findings（亮点/风险信号/未知缺口）
//   + 8 维明细 + 建议 + 分级 CTA。
// 文案全部来自 ui 字典；等级阈值/颜色来自 lib/riskEngine.ts（单一事实来源）。
import { LEVEL_BANDS, LEVEL_COLOR, type RiskEngineResult } from "@/lib/riskEngine";
import { localePath, type Locale } from "@/i18n/config";
import type { RiskUiDict } from "./SupplierRiskCalculator";

type Props = {
  result: RiskEngineResult;
  ui: RiskUiDict;
  locale: Locale;
  onEdit: () => void;
  onReset: () => void;
  onLeadRequest: () => void;
};

export default function RiskScoreResult({
  result,
  ui,
  locale,
  onEdit,
  onReset,
  onLeadRequest,
}: Props) {
  const p = (href: string) => localePath(locale, href);
  const color = LEVEL_COLOR[result.level];

  // 低/中风险主按钮给报告（留邮箱），偏高/高/极高主按钮给验证服务
  const primaryIsReport = result.level === "LOW" || result.level === "MODERATE";
  const secondaryIsChecklist = result.level === "MODERATE";

  // 刻度条：各等级区间宽度按分数跨度占比（LOW/MODERATE/ELEVATED/HIGH 各 15 分，CRITICAL 40 分）
  const bandWidth = (min: number, idx: number) => {
    const next = idx === 0 ? 100 : LEVEL_BANDS[idx - 1].min;
    return ((next - min) / 100) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div
            className="w-32 h-32 rounded-full flex flex-col items-center justify-center text-white shrink-0"
            style={{ background: color }}
          >
            <span className="text-4xl font-extrabold leading-none">{result.overall}</span>
            <span className="text-xs opacity-90">/ 100</span>
          </div>
          <div className="flex-1">
            <div className="text-sm uppercase tracking-wide text-[#64748b]">
              {ui.scoreSuffix}
            </div>
            <div className="text-2xl font-bold mt-1" style={{ color }}>
              {result.levelLabel}
            </div>
            <p className="text-xs text-[#b45309] bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3 inline-block">
              {ui.selfReported}
            </p>
            <p className="text-sm text-[#64748b] mt-2">{ui.disclaimer}</p>
          </div>
        </div>

        {/* 得分刻度：分数 → 等级 的可解释映射 */}
        <div className="mt-8">
          <div className="text-sm font-semibold text-[#0f172a] mb-2">
            {ui.scoreScaleTitle}
          </div>
          <div className="flex w-full h-3 rounded-full overflow-hidden">
            {LEVEL_BANDS.map((b, i) => (
              <div
                key={b.level}
                className="h-full"
                style={{
                  width: `${bandWidth(b.min, i)}%`,
                  background: LEVEL_COLOR[b.level],
                  opacity: result.level === b.level ? 1 : 0.35,
                }}
              />
            ))}
          </div>
          <div className="flex w-full mt-1 text-[11px] text-[#64748b]">
            {LEVEL_BANDS.map((b, i) => (
              <span key={b.level} style={{ width: `${bandWidth(b.min, i)}%` }}>
                {b.min}
                {i === 0 ? "+" : ""}
              </span>
            ))}
          </div>
        </div>

        {/* Key Findings：亮点 / 风险信号 / 未知缺口 */}
        <h3 className="font-semibold text-[#0f172a] mt-8 mb-3">{ui.findingsTitle}</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {result.strengths.length > 0 && (
            <div className="rounded-lg border border-[#d1e7d8] bg-[#f3faf5] p-3">
              <div className="text-sm font-semibold text-[#1f7a36] mb-1">
                {ui.strengthsTitle}
              </div>
              <ul className="space-y-1 text-sm text-[#475569]">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[#1f7a36] shrink-0">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.keyRiskFactors.length > 0 && (
            <div className="rounded-lg border border-[#f0c4c4] bg-[#fdf5f5] p-3">
              <div className="text-sm font-semibold text-[#d4232a] mb-1">{ui.risksTitle}</div>
              <ul className="space-y-1 text-sm text-[#475569]">
                {result.keyRiskFactors.map((f, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[#d4232a] shrink-0">▲</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.dataGaps.length > 0 && (
            <div className="rounded-lg border border-[#f0e0b8] bg-[#fdf9ef] p-3">
              <div className="text-sm font-semibold text-[#8a5410] mb-1">{ui.gapsTitle}</div>
              <ul className="space-y-1 text-sm text-[#475569]">
                {result.dataGaps.map((g, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-[#8a5410] shrink-0">?</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#8a5410] mt-2">{ui.gapsNote}</p>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-[#0f172a] mt-8 mb-3">{ui.breakdownTitle}</h3>
        <div className="space-y-3">
          {result.dimensions.map((d) => (
            <div key={d.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-[#0f172a]">
                  {d.label}{" "}
                  <span className="text-[#94a3b8] font-normal">
                    {ui.weightNote.replace("{weight}", String(d.weight))}
                  </span>
                </span>
                <span className="font-semibold" style={{ color: LEVEL_COLOR[d.level] }}>
                  {d.score} · {d.levelLabel}
                </span>
              </div>
              <div className="h-2.5 bg-[#eef2f7] rounded-full">
                <div
                  className="h-2.5 rounded-full"
                  style={{ width: `${d.score}%`, background: LEVEL_COLOR[d.level] }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-[#0f172a] mb-2">{ui.actionsTitle}</h3>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-[#475569]">
            {result.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </div>

        {/* 动态 CTA：按风险等级切换主次按钮 */}
        <div
          className="mt-6 rounded-xl p-5 border"
          style={{ background: "#f7f9fc", borderColor: color }}
        >
          <p className="font-semibold text-[#0f172a] mb-3">{result.cta.headline}</p>
          <div className="flex flex-wrap gap-3">
            {primaryIsReport ? (
              <button className="btn btn-primary" onClick={onLeadRequest}>
                {result.cta.primary}
              </button>
            ) : (
              <a className="btn btn-primary" href={p("/services/supplier-verification")}>
                {result.cta.primary}
              </a>
            )}
            {result.cta.secondary &&
              (secondaryIsChecklist ? (
                <a className="btn btn-outline" href={p("/tools/supplier-verification-checklist")}>
                  {result.cta.secondary}
                </a>
              ) : (
                <button className="btn btn-outline" onClick={onLeadRequest}>
                  {result.cta.secondary}
                </button>
              ))}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button className="btn btn-outline" onClick={onEdit}>
            {ui.editAnswers}
          </button>
          <button className="btn btn-outline" onClick={onReset}>
            {ui.startOver}
          </button>
        </div>
      </div>
    </div>
  );
}
