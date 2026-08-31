"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";

// client component 不能 import i18n/config 里的 server util（localePath），
// 否则会在浏览器里抛异常。链接用 locale 前缀手动拼。
const linkToVerification = (locale: Locale, path: string) =>
  locale === "en" ? path : `/${locale}${path}`;

const STORAGE_KEY = "fab_svc_checklist_v1";

export type ChecklistStage = {
  key: string;
  title: string;
  desc: string;
  items: Record<string, string>;
};

export type ChecklistUiDict = {
  progressTitle: string;
  complete: string;
  criticalOpen: string;
  criticalOpenPlural: string;
  criticalCleared: string;
  print: string;
  reset: string;
  criticalTag: string;
  verdictOpenTitle: string;
  verdictOpenTitlePlural: string;
  verdictOpenBody: string;
  verdictAllTitle: string;
  verdictAllBody: string;
  verdictCriticalDoneTitle: string;
  verdictCriticalDoneBody: string;
  ctaOutsource: string;
  disclaimer: string;
  // V2：连续自评 → 提交 → 出结果
  submitReport: string;
  reportTitle: string;
  reportIntro: string;
  completionLine: string;
  criticalStatus: string;
  criticalStatusAllDone: string;
  missingItemsTitle: string;
  recommendationTitle: string;
  recPass: string;
  recConditional: string;
  recFail: string;
  ctaOutsourceTitle: string;
  ctaOutsourceBody: string;
};

type Props = {
  stages: ChecklistStage[];
  criticalItems: string[];
  ui: ChecklistUiDict;
  locale: Locale;
};

export default function SupplierVerificationChecklist({ stages, criticalItems, ui, locale }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  // V2：是否已点击"生成评估报告"（连续自评 → 提交 → 出结果 的提交动作）
  const [submitted, setSubmitted] = useState(false);

  const allItems = useMemo(
    () => stages.flatMap((s) => Object.entries(s.items).map(([id, text]) => ({ id, text, stage: s.key }))),
    [stages]
  );
  const TOTAL = allItems.length;
  // 仅 critical 的 id 集合，用于报告里筛"未完成的关键项"
  const CRITICAL_IDS = useMemo(() => new Set(criticalItems), [criticalItems]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {}
  }, [checked, ready]);

  const doneCount = useMemo(() => allItems.filter((i) => checked[i.id]).length, [allItems, checked]);
  const criticalOpen = useMemo(
    () => criticalItems.filter((id) => !checked[id]).length,
    [criticalItems, checked]
  );
  const pct = TOTAL ? Math.round((doneCount / TOTAL) * 100) : 0;

  function toggle(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  function reset() {
    setChecked({});
    setSubmitted(false);
  }

  const allDone = doneCount === TOTAL && TOTAL > 0;
  const verdictTitle =
    criticalOpen > 0
      ? criticalOpen === 1
        ? ui.verdictOpenTitle.replace("{n}", "1")
        : ui.verdictOpenTitlePlural.replace("{n}", String(criticalOpen))
      : allDone
        ? ui.verdictAllTitle
        : ui.verdictCriticalDoneTitle;
  const verdictBody =
    criticalOpen > 0 ? ui.verdictOpenBody : allDone ? ui.verdictAllBody : ui.verdictCriticalDoneBody;

  const toneClass =
    criticalOpen > 0
      ? "border-[#d4232a] bg-[#fdf2f2]"
      : allDone
        ? "border-[#1f7a36] bg-[#f1f9f3]"
        : "border-[#a86a13] bg-[#fff9ef]";

  // 综合建议：critical 全勾完 + 全部勾完 → PASS；critical 仍有未勾 → CONDITIONAL；critical 已全勾但
  // 还有非关键项未勾且比例较低（< 60%）→ CONDITIONAL；其他（critical 全勾但非关键缺失较多）→ FAIL
  const completionPct = TOTAL ? Math.round((doneCount / TOTAL) * 100) : 0;
  const recommendation =
    criticalOpen > 0
      ? ui.recConditional
      : allDone
        ? ui.recPass
        : completionPct >= 80
          ? ui.recConditional
          : ui.recFail;
  const recommendationTone =
    criticalOpen > 0 || completionPct < 80
      ? "border-[#d4232a] bg-[#fdf2f2]"
      : completionPct < 100
        ? "border-[#a86a13] bg-[#fff9ef]"
        : "border-[#1f7a36] bg-[#f1f9f3]";
  // 未完成的关键项（id + 文本），用于报告
  const missingCriticalItems = useMemo(
    () => allItems.filter((i) => CRITICAL_IDS.has(i.id) && !checked[i.id]),
    [allItems, checked, CRITICAL_IDS]
  );

  return (
    <div id="checklist" className="max-w-4xl mx-auto">
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-[#0f172a]">{ui.progressTitle}</span>
          <span className="text-sm text-[#64748b]">
            {ui.complete.replace("{done}", String(doneCount)).replace("{total}", String(TOTAL))}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
          <div className="h-full rounded-full bg-[#0f4c81] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
              criticalOpen > 0 ? "bg-[#fde8e8] text-[#9b1c1c]" : "bg-[#e6f4ea] text-[#1f7a36]"
            }`}
          >
            {criticalOpen > 0
              ? criticalOpen === 1
                ? ui.criticalOpen.replace("{n}", "1")
                : ui.criticalOpenPlural.replace("{n}", String(criticalOpen))
              : ui.criticalCleared}
          </span>
          <button type="button" onClick={() => window.print()} className="btn btn-outline">
            {ui.print}
          </button>
          <button type="button" onClick={reset} className="btn btn-outline">
            {ui.reset}
          </button>
          {/* V2：连续自评 → 提交出结果。任意勾选后即可点（不必全勾完）。
              点击后下方报告区展开，包含完成度/关键项状态/未完成清单/建议。 */}
          <button
            type="button"
            onClick={() => {
              setSubmitted(true);
              // 滚到报告区
              setTimeout(() => {
                document.getElementById("checklist-report")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
            className="btn btn-primary"
            disabled={doneCount === 0}
            title={doneCount === 0 ? "" : ""}
          >
            {ui.submitReport}
          </button>
        </div>
      </div>

      {/* 评估报告：仅在点击"生成评估报告"后展开。
          报告含完成度/关键项状态/缺失项清单/综合建议/外包 CTA。
          报告内容实时随勾选状态更新（不锁定），所以用户继续勾选时报告也会变。 */}
      {submitted && (
        <section
          id="checklist-report"
          className={`card p-6 mb-6 border ${recommendationTone}`}
          aria-label={ui.reportTitle}
        >
          <h2 className="text-2xl font-bold text-[#0f172a]">{ui.reportTitle}</h2>
          <p className="text-sm text-[#475569] mt-2">{ui.reportIntro}</p>

          <dl className="mt-5 grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[#64748b]">
                {ui.completionLine
                  .replace("{done}", String(doneCount))
                  .replace("{total}", String(TOTAL))
                  .replace("{pct}", String(completionPct))}
              </dt>
            </div>
            <div>
              <dt className="text-[#64748b]">
                {criticalOpen > 0
                  ? ui.criticalStatus
                      .replace("{open}", String(criticalOpen))
                      .replace("{total}", String(criticalItems.length))
                  : ui.criticalStatusAllDone}
              </dt>
            </div>
          </dl>

          {missingCriticalItems.length > 0 && (
            <div className="mt-5">
              <div className="font-semibold text-[#0f172a]">
                {ui.missingItemsTitle}（{missingCriticalItems.length}）
              </div>
              <ul className="mt-2 space-y-1 text-sm text-[#475569] list-disc pl-5">
                {missingCriticalItems.map((i) => (
                  <li key={i.id}>
                    <span className="text-[#9b1c1c] font-medium">{"\u25CF"}</span>{" "}
                    {i.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 p-4 rounded-md border border-[#e2e8f0] bg-white">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              {ui.recommendationTitle}
            </div>
            <p className="text-sm text-[#0f172a] mt-1.5">{recommendation}</p>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between p-4 rounded-md border border-[#cbd5e1] bg-[#f7f9fc]">
            <div>
              <div className="font-semibold text-[#0f172a]">{ui.ctaOutsourceTitle}</div>
              <p className="text-sm text-[#475569] mt-1">{ui.ctaOutsourceBody}</p>
            </div>
            <a
              href={linkToVerification(locale, "/services/supplier-verification")}
              className="btn btn-primary whitespace-nowrap"
            >
              {ui.ctaOutsource}
            </a>
          </div>
        </section>
      )}

      <div className={`card p-5 mb-6 border ${toneClass}`}>
        <div className="font-semibold text-[#0f172a]">{verdictTitle}</div>
        <p className="text-sm text-[#475569] mt-1">{verdictBody}</p>
        {criticalOpen > 0 && !submitted && (
          <a
            href={linkToVerification(locale, "/services/supplier-verification")}
            className="btn btn-primary mt-4 inline-flex"
          >
            {ui.ctaOutsource}
          </a>
        )}
      </div>

      <div className="space-y-5">
        {stages.map((stage) => {
          const entries = Object.entries(stage.items);
          const stageDone = entries.filter(([id]) => checked[id]).length;
          return (
            <section key={stage.key} className="card p-5">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="font-semibold text-[#0f172a]">{stage.title}</h2>
                <span className="text-xs text-[#94a3b8] whitespace-nowrap">
                  {stageDone}/{entries.length}
                </span>
              </div>
              <p className="text-sm text-[#64748b] mb-3">{stage.desc}</p>
              <ul className="space-y-2">
                {entries.map(([id, text]) => (
                  <li key={id}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[#0f4c81]"
                        checked={!!checked[id]}
                        onChange={() => toggle(id)}
                      />
                      <span className="text-sm text-[#334155]">
                        {text}
                        {criticalItems.includes(id) && (
                          <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[#fde8e8] text-[#9b1c1c]">
                            {ui.criticalTag}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-[#94a3b8] mt-8 text-center">{ui.disclaimer}</p>
    </div>
  );
}
