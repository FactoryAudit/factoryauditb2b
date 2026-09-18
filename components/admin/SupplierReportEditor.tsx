"use client";

import { useCallback, useMemo, useState } from "react";
import {
  EVIDENCE_LEVELS,
  ITEM_LEVELS,
  REPORT_LIMITS,
  SECTION_KINDS,
  reportProgress,
  sectionHasContent,
  type EvidenceLevel,
  type ItemLevel,
  type ReportBullet,
  type ReportField,
  type ReportItem,
  type ReportSection,
  type SectionKind,
  type SupplierReportDoc,
} from "@/lib/supplierReports";
import { buildReportDocHtml, reportDocFileName } from "@/lib/supplierReportDocHtml";

// components/admin/SupplierReportEditor.tsx —— CS-20 报告正文编辑器
//
// 定位：后台「每工厂一份报告」的人工录入界面。**不做任何自动生成**，
//       打开时若库中无记录，服务端下发的是一份**空模板**（13 章骨架 + 方法引言）。
//
// 反伪造纪律（本组件的全部约束）：
//   1. 每个字段/条目都带「来源分级」下拉。默认「未标注」，
//      **绝不预选成「已核验」** —— 这是本组件最重要的一个默认值。
//   2. 总分留空 = 未评分。UI 明确显示「未评分」，**不显示 0**。
//   3. 空章节在导出件里整章不出现（见 lib/supplierReportDocHtml.ts）。
//   4. 章节形态切换会清空该章内容（避免切换后残留异形数据），切换前有确认。

type Props = {
  slug: string;
  supplierName: string;
  initial: SupplierReportDoc;
  isNew: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
};

/* -------------------------------------------------------------------------- */
/* 小组件                                                                      */
/* -------------------------------------------------------------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-[#64748b]">{children}</span>;
}

function Box({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#0f172a]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function IconBtn({
  onClick,
  children,
  danger,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded border px-2 py-0.5 text-xs ${
        danger
          ? "border-[#f09595] text-[#a32d2d] hover:bg-[#fcebeb]"
          : "border-[#b5d4f4] text-[#185fa5] hover:bg-[#e6f1fb]"
      }`}
    >
      {children}
    </button>
  );
}

/** 来源分级下拉。默认空字符串 = 未标注（绝不预选已核验） */
function LevelSelect({
  value,
  onChange,
  allow,
}: {
  value: EvidenceLevel | null;
  onChange: (v: EvidenceLevel | null) => void;
  allow?: readonly EvidenceLevel[];
}) {
  const options = allow ?? EVIDENCE_LEVELS;
  return (
    <select
      className="input"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : (raw as EvidenceLevel));
      }}
    >
      <option value="">未标注</option>
      {options.map((l) => (
        <option key={l} value={l}>
          {l === "verified" ? "已核验" : l === "reported" ? "企业自报" : "无记录"}
        </option>
      ))}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/* 主组件                                                                      */
/* -------------------------------------------------------------------------- */

export default function SupplierReportEditor({
  slug,
  supplierName,
  initial,
  isNew,
  updatedBy,
  updatedAt,
}: Props) {
  const [doc, setDoc] = useState<SupplierReportDoc>(initial);
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ by: string | null; at: string | null }>({
    by: updatedBy,
    at: updatedAt,
  });

  const progress = useMemo(() => reportProgress(doc), [doc]);

  /* ---- 顶层字段 ---- */
  const patch = useCallback((p: Partial<SupplierReportDoc>) => {
    setDoc((d) => ({ ...d, ...p }));
  }, []);

  /* ---- 章节字段 ---- */
  const patchSection = useCallback((i: number, p: Partial<ReportSection>) => {
    setDoc((d) => {
      const sections = d.sections.slice();
      sections[i] = { ...sections[i], ...p };
      return { ...d, sections };
    });
  }, []);

  const changeKind = useCallback(
    (i: number, next: SectionKind) => {
      const s = doc.sections[i];
      if (!s || s.kind === next) return;
      const hasContent =
        s.fields.length > 0 || s.items.length > 0 || s.bullets.length > 0 || Boolean(s.table?.rows.length);
      if (hasContent && !window.confirm("切换章节形态会清空该章当前内容，继续？")) return;
      patchSection(i, { kind: next, fields: [], items: [], bullets: [], table: null });
    },
    [doc.sections, patchSection]
  );

  /* ---- 保存 ---- */
  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/suppliers/${encodeURIComponent(slug)}/report`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        sections?: number;
      };
      if (!r.ok || !j.ok) {
        setErr(
          j.error === "invalid_score"
            ? "总分必须是 0–100 的整数，或留空表示未评分。"
            : j.error === "too_large"
              ? "内容总量超出上限，请精简后再保存。"
              : `保存失败（${j.error ?? r.status}）。`
        );
        return;
      }
      setMsg(`已保存（${j.sections ?? doc.sections.length} 章）。`);
      setMeta({ by: meta.by, at: new Date().toISOString() });
    } catch {
      setErr("网络异常，未保存。");
    } finally {
      setBusy(false);
    }
  }

  /* ---- 导出自包含 HTML ---- */
  function download(lang: "en" | "zh") {
    try {
      const html = buildReportDocHtml(doc, lang, {
        supplierName,
        slug,
        generatedAt: new Date().toISOString(),
      });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reportDocFileName(slug, lang, doc.reportDate);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr("导出失败。");
    }
  }

  return (
    <div className="space-y-5">
      {/* ===== 动作条 ===== */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0f172a]">
              报告正文 · Report body
            </h2>
            <p className="mt-1 text-xs text-[#64748b]">
              {isNew
                ? "该工厂尚无报告记录，已下发空白模板（13 章骨架，内容全空）。"
                : `已填 ${progress.filled} / ${progress.total} 章。`}
              {meta.at ? `　最后保存：${String(meta.at).slice(0, 16).replace("T", " ")}` : ""}
              {meta.by ? `（${meta.by}）` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-outline" onClick={() => download("zh")}>
              导出中文
            </button>
            <button type="button" className="btn btn-outline" onClick={() => download("en")}>
              导出 English
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? "…" : "保存"}
            </button>
          </div>
        </div>

        {msg && <p className="mt-2 text-sm text-[#1f7a36]">{msg}</p>}
        {err && <p className="mt-2 text-sm text-[#941b1b]">{err}</p>}

        <p className="mt-3 rounded border border-[#f0d5a0] bg-[#fdf6e7] px-3 py-2 text-xs text-[#854f0b]">
          未填的章节在导出件里<strong>整章不会出现</strong>；来源分级留「未标注」时，导出件也如实显示「未标注」，
          不会显示成「已核验」。
        </p>
      </div>

      {/* ===== 报告头 ===== */}
      <Box title="报告头">
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <Label>报告编号</Label>
            <input
              className="input"
              maxLength={REPORT_LIMITS.reportNumber}
              placeholder="留空则不显示"
              value={doc.reportNumber}
              onChange={(e) => patch({ reportNumber: e.target.value })}
            />
          </label>
          <label>
            <Label>报告日期</Label>
            <input
              className="input"
              type="date"
              value={doc.reportDate}
              onChange={(e) => patch({ reportDate: e.target.value })}
            />
          </label>
          <label>
            <Label>报告对象（如具体采购商）</Label>
            <input
              className="input"
              maxLength={REPORT_LIMITS.preparedFor}
              placeholder="留空则用中性文案"
              value={doc.preparedFor}
              onChange={(e) => patch({ preparedFor: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
          <label>
            <Label>总分（0–100，留空 = 未评分）</Label>
            <input
              className="input"
              inputMode="numeric"
              placeholder="未评分"
              value={doc.overallScore === null ? "" : String(doc.overallScore)}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") return patch({ overallScore: null });
                const n = Number(raw);
                if (!Number.isInteger(n) || n < 0 || n > 100) return;
                patch({ overallScore: n });
              }}
            />
            <span className="mt-1 block text-xs text-[#94a3b8]">
              {doc.overallScore === null ? "当前：未评分（导出显示「—」）" : "当前：已评分"}
            </span>
          </label>
          <label>
            <Label>评分说明（留空则用标准说明 / 未评分说明）</Label>
            <textarea
              className="input min-h-[72px]"
              maxLength={REPORT_LIMITS.scoreNote}
              value={doc.scoreNote}
              onChange={(e) => patch({ scoreNote: e.target.value })}
            />
          </label>
        </div>
      </Box>

      {/* ===== 章节 ===== */}
      <Box
        title={`正文章节（${doc.sections.length}）`}
        right={
          <span className="text-xs text-[#64748b]">
            已填 {progress.filled} / {progress.total}
          </span>
        }
      >
        <div className="space-y-3">
          {doc.sections.map((s, i) => {
            const filled = sectionHasContent(s);
            const open = openNo === s.no;
            return (
              <div key={`${s.no}-${i}`} className="rounded-md border border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setOpenNo(open ? null : s.no)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#94a3b8]">{s.no}</span>
                    <span className="text-sm font-medium text-[#0f172a]">
                      {s.titleZh || s.titleEn || "（未命名章节）"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        filled ? "bg-[#e8f5ea] text-[#1f7a36]" : "bg-[#eef2f7] text-[#5b6b7e]"
                      }`}
                    >
                      {filled ? "有内容" : "空"}
                    </span>
                    <span className="rounded bg-[#eef2f7] px-2 py-0.5 text-[10px] text-[#5b6b7e]">
                      {s.kind}
                    </span>
                  </span>
                  <span className="text-xs text-[#64748b]">{open ? "收起 ▲" : "展开 ▼"}</span>
                </button>

                {open && (
                  <div className="space-y-4 border-t border-[#e2e8f0] px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>
                        <Label>章节标题（中文）</Label>
                        <input
                          className="input"
                          maxLength={REPORT_LIMITS.sectionTitle}
                          value={s.titleZh}
                          onChange={(e) => patchSection(i, { titleZh: e.target.value })}
                        />
                      </label>
                      <label>
                        <Label>章节标题（English）</Label>
                        <input
                          className="input"
                          maxLength={REPORT_LIMITS.sectionTitle}
                          value={s.titleEn}
                          onChange={(e) => patchSection(i, { titleEn: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>
                        <Label>引言（中文）</Label>
                        <textarea
                          className="input min-h-[64px]"
                          maxLength={REPORT_LIMITS.sectionIntro}
                          value={s.introZh}
                          onChange={(e) => patchSection(i, { introZh: e.target.value })}
                        />
                      </label>
                      <label>
                        <Label>引言（English）</Label>
                        <textarea
                          className="input min-h-[64px]"
                          maxLength={REPORT_LIMITS.sectionIntro}
                          value={s.introEn}
                          onChange={(e) => patchSection(i, { introEn: e.target.value })}
                        />
                      </label>
                    </div>

                    <label className="block max-w-[240px]">
                      <Label>内容形态</Label>
                      <select
                        className="input"
                        value={s.kind}
                        onChange={(e) => changeKind(i, e.target.value as SectionKind)}
                      >
                        {SECTION_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k === "fields"
                              ? "键值行（标签 + 值）"
                              : k === "table"
                                ? "表格"
                                : k === "timeline"
                                  ? "时间轴"
                                  : "列表 / 段落条目"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <SectionBody section={s} index={i} patchSection={patchSection} />
                  </div>
                )}
              </div>
            );
          })}
          {doc.sections.length === 0 && (
            <p className="text-sm text-[#64748b]">无章节（模板未下发）。</p>
          )}
        </div>
      </Box>

      {/* ===== 建议行动 ===== */}
      <Box
        title="建议行动"
        right={
          <IconBtn
            onClick={() =>
              patch({ actions: [...doc.actions, { en: "", zh: "" }].slice(0, REPORT_LIMITS.actions) })
            }
          >
            + 添加一条
          </IconBtn>
        }
      >
        <div className="space-y-3">
          {doc.actions.map((a, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-2">
              <label>
                <Label>中文</Label>
                <textarea
                  className="input min-h-[56px]"
                  maxLength={REPORT_LIMITS.action}
                  value={a.zh}
                  onChange={(e) => {
                    const actions = doc.actions.slice();
                    actions[i] = { ...actions[i], zh: e.target.value };
                    patch({ actions });
                  }}
                />
              </label>
              <label>
                <Label>English</Label>
                <textarea
                  className="input min-h-[56px]"
                  maxLength={REPORT_LIMITS.action}
                  value={a.en}
                  onChange={(e) => {
                    const actions = doc.actions.slice();
                    actions[i] = { ...actions[i], en: e.target.value };
                    patch({ actions });
                  }}
                />
                <span className="mt-1 block text-right">
                  <IconBtn
                    danger
                    onClick={() => patch({ actions: doc.actions.filter((_, k) => k !== i) })}
                  >
                    删除
                  </IconBtn>
                </span>
              </label>
            </div>
          ))}
          {doc.actions.length === 0 && (
            <p className="text-sm text-[#64748b]">暂无。留空则导出件不出现该区块。</p>
          )}
        </div>
      </Box>

      {/* ===== 免责声明 + 状态 ===== */}
      <Box title="免责声明与状态">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <Label>免责声明（中文）</Label>
            <textarea
              className="input min-h-[80px]"
              maxLength={REPORT_LIMITS.disclaimer}
              value={doc.disclaimerZh}
              onChange={(e) => patch({ disclaimerZh: e.target.value })}
            />
          </label>
          <label>
            <Label>免责声明（English）</Label>
            <textarea
              className="input min-h-[80px]"
              maxLength={REPORT_LIMITS.disclaimer}
              value={doc.disclaimerEn}
              onChange={(e) => patch({ disclaimerEn: e.target.value })}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-[#94a3b8]">
          留空时导出件使用平台标准免责声明，绝不留空。
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[#0f172a]">
            <input
              type="radio"
              name="report-status"
              checked={doc.status === "draft"}
              onChange={() => patch({ status: "draft" })}
            />
            草稿
          </label>
          <label className="flex items-center gap-2 text-sm text-[#0f172a]">
            <input
              type="radio"
              name="report-status"
              checked={doc.status === "final"}
              onChange={() => patch({ status: "final" })}
            />
            定稿
          </label>
          <span className="text-xs text-[#94a3b8]">
            「定稿」仅标记内容已定，<strong>不等于签发</strong>，也不对采购商构成承诺。
          </span>
        </div>
      </Box>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "…" : "保存报告"}
        </button>
        {msg && <span className="text-sm text-[#1f7a36]">{msg}</span>}
        {err && <span className="text-sm text-[#941b1b]">{err}</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 章节内容体（按 kind 分派）                                                  */
/* -------------------------------------------------------------------------- */

function SectionBody({
  section,
  index,
  patchSection,
}: {
  section: ReportSection;
  index: number;
  patchSection: (i: number, p: Partial<ReportSection>) => void;
}) {
  if (section.kind === "fields") {
    const rows = section.fields;
    const set = (k: number, p: Partial<ReportField>) => {
      const fields = rows.slice();
      fields[k] = { ...fields[k], ...p };
      patchSection(index, { fields });
    };
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#64748b]">
            键值行（只填「值」的行才会出现在导出件里）
          </span>
          <IconBtn
            onClick={() =>
              patchSection(index, {
                fields: [...rows, { lEn: "", lZh: "", v: "", level: null }].slice(
                  0,
                  REPORT_LIMITS.fields
                ),
              })
            }
          >
            + 添加一行
          </IconBtn>
        </div>
        <div className="space-y-2">
          {rows.map((f, k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_130px_auto]">
              <input
                className="input"
                placeholder="标签（中）"
                maxLength={REPORT_LIMITS.fieldLabel}
                value={f.lZh}
                onChange={(e) => set(k, { lZh: e.target.value })}
              />
              <input
                className="input"
                placeholder="Label (EN)"
                maxLength={REPORT_LIMITS.fieldLabel}
                value={f.lEn}
                onChange={(e) => set(k, { lEn: e.target.value })}
              />
              <input
                className="input"
                placeholder="值（留空 = 导出显示 —）"
                maxLength={REPORT_LIMITS.fieldValue}
                value={f.v}
                onChange={(e) => set(k, { v: e.target.value })}
              />
              <LevelSelect value={f.level} onChange={(lv) => set(k, { level: lv })} />
              <IconBtn
                danger
                onClick={() => patchSection(index, { fields: rows.filter((_, x) => x !== k) })}
              >
                删
              </IconBtn>
            </div>
          ))}
          {rows.length === 0 && <p className="text-xs text-[#94a3b8]">暂无行。</p>}
        </div>
      </div>
    );
  }

  if (section.kind === "table") {
    const t = section.table ?? { headers: [{ en: "", zh: "" }], rows: [], statusCol: null };
    const setT = (p: Partial<typeof t>) => patchSection(index, { table: { ...t, ...p } });

    const addCol = () => {
      if (t.headers.length >= REPORT_LIMITS.tableHeaders) return;
      setT({
        headers: [...t.headers, { en: "", zh: "" }],
        rows: t.rows.map((r) => [...r, ""]),
      });
    };
    const delCol = () => {
      if (t.headers.length <= 1) return;
      setT({
        headers: t.headers.slice(0, -1),
        rows: t.rows.map((r) => r.slice(0, -1)),
        statusCol: t.statusCol !== null && t.statusCol >= t.headers.length - 1 ? null : t.statusCol,
      });
    };
    const addRow = () => {
      if (t.rows.length >= REPORT_LIMITS.tableRows) return;
      setT({ rows: [...t.rows, t.headers.map(() => "")] });
    };
    const delRow = (k: number) => setT({ rows: t.rows.filter((_, x) => x !== k) });
    const setCell = (k: number, c: number, val: string) => {
      const rows = t.rows.slice();
      const row = rows[k].slice();
      row[c] = val;
      rows[k] = row;
      setT({ rows });
    };

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#64748b]">
            列 {t.headers.length} · 行 {t.rows.length}
          </span>
          <IconBtn onClick={addCol}>+ 列</IconBtn>
          <IconBtn danger onClick={delCol}>
            − 列
          </IconBtn>
          <IconBtn onClick={addRow}>+ 行</IconBtn>
          <label className="flex items-center gap-2 text-xs text-[#64748b]">
            状态列
            <select
              className="input max-w-[180px]"
              value={t.statusCol === null ? "" : String(t.statusCol)}
              onChange={(e) =>
                setT({ statusCol: e.target.value === "" ? null : Number(e.target.value) })
              }
            >
              <option value="">无</option>
              {t.headers.map((_, c) => (
                <option key={c} value={c}>
                  第 {c + 1} 列
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {t.headers.map((h, c) => (
            <div key={`h${c}`} className="grid gap-2 sm:grid-cols-2">
              <input
                className="input"
                placeholder={`列 ${c + 1} 表头（中）`}
                maxLength={REPORT_LIMITS.tableHeaderLabel}
                value={h.zh}
                onChange={(e) => {
                  const headers = t.headers.slice();
                  headers[c] = { ...headers[c], zh: e.target.value };
                  setT({ headers });
                }}
              />
              <input
                className="input"
                placeholder={`Column ${c + 1} (EN)`}
                maxLength={REPORT_LIMITS.tableHeaderLabel}
                value={h.en}
                onChange={(e) => {
                  const headers = t.headers.slice();
                  headers[c] = { ...headers[c], en: e.target.value };
                  setT({ headers });
                }}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {t.rows.map((row, k) => (
            <div
              key={`r${k}`}
              className="grid items-start gap-2"
              style={{ gridTemplateColumns: `repeat(${t.headers.length}, minmax(0,1fr)) auto` }}
            >
              {row.map((cell, c) => (
                <input
                  key={c}
                  className="input"
                  placeholder={`行 ${k + 1} · 列 ${c + 1}`}
                  maxLength={REPORT_LIMITS.tableCell}
                  value={cell}
                  onChange={(e) => setCell(k, c, e.target.value)}
                />
              ))}
              <IconBtn danger onClick={() => delRow(k)}>
                删
              </IconBtn>
            </div>
          ))}
          {t.rows.length === 0 && (
            <p className="text-xs text-[#94a3b8]">暂无数据行 —— 空表格不会出现在导出件里。</p>
          )}
        </div>
      </div>
    );
  }

  if (section.kind === "timeline") {
    const items = section.items;
    const set = (k: number, p: Partial<ReportItem>) => {
      const next = items.slice();
      next[k] = { ...next[k], ...p };
      patchSection(index, { items: next });
    };
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#64748b]">时间轴条目</span>
          <IconBtn
            onClick={() =>
              patchSection(index, {
                items: [
                  ...items,
                  { titleEn: "", titleZh: "", meta: "", descEn: "", descZh: "", level: null },
                ].slice(0, REPORT_LIMITS.items),
              })
            }
          >
            + 添加一条
          </IconBtn>
        </div>
        <div className="space-y-3">
          {items.map((it, k) => (
            <div key={k} className="rounded border border-[#eef2f7] p-3">
              <div className="grid gap-2 sm:grid-cols-[90px_1fr_1fr_130px_auto]">
                <input
                  className="input"
                  placeholder="时间"
                  maxLength={REPORT_LIMITS.itemMeta}
                  value={it.meta}
                  onChange={(e) => set(k, { meta: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="标题（中）"
                  maxLength={REPORT_LIMITS.itemTitle}
                  value={it.titleZh}
                  onChange={(e) => set(k, { titleZh: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Title (EN)"
                  maxLength={REPORT_LIMITS.itemTitle}
                  value={it.titleEn}
                  onChange={(e) => set(k, { titleEn: e.target.value })}
                />
                <select
                  className="input"
                  value={it.level ?? ""}
                  onChange={(e) =>
                    set(k, {
                      level: e.target.value === "" ? null : (e.target.value as ItemLevel),
                    })
                  }
                >
                  <option value="">普通</option>
                  {ITEM_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv === "med" ? "观察项" : "事项"}
                    </option>
                  ))}
                </select>
                <IconBtn danger onClick={() => patchSection(index, { items: items.filter((_, x) => x !== k) })}>
                  删
                </IconBtn>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <textarea
                  className="input min-h-[52px]"
                  placeholder="说明（中）"
                  maxLength={REPORT_LIMITS.itemDesc}
                  value={it.descZh}
                  onChange={(e) => set(k, { descZh: e.target.value })}
                />
                <textarea
                  className="input min-h-[52px]"
                  placeholder="Description (EN)"
                  maxLength={REPORT_LIMITS.itemDesc}
                  value={it.descEn}
                  onChange={(e) => set(k, { descEn: e.target.value })}
                />
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-[#94a3b8]">暂无条目。</p>}
        </div>
      </div>
    );
  }

  // list
  const bullets = section.bullets;
  const set = (k: number, p: Partial<ReportBullet>) => {
    const next = bullets.slice();
    next[k] = { ...next[k], ...p };
    patchSection(index, { bullets: next });
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[#64748b]">列表条目</span>
        <IconBtn
          onClick={() =>
            patchSection(index, {
              bullets: [...bullets, { en: "", zh: "" }].slice(0, REPORT_LIMITS.bullets),
            })
          }
        >
          + 添加一条
        </IconBtn>
      </div>
      <div className="space-y-3">
        {bullets.map((b, k) => (
          <div key={k} className="grid gap-2 sm:grid-cols-2">
            <textarea
              className="input min-h-[56px]"
              placeholder="中文"
              maxLength={REPORT_LIMITS.bullet}
              value={b.zh}
              onChange={(e) => set(k, { zh: e.target.value })}
            />
            <textarea
              className="input min-h-[56px]"
              placeholder="English"
              maxLength={REPORT_LIMITS.bullet}
              value={b.en}
              onChange={(e) => set(k, { en: e.target.value })}
            />
            <span className="sm:col-span-2">
              <IconBtn danger onClick={() => patchSection(index, { bullets: bullets.filter((_, x) => x !== k) })}>
                删除该条
              </IconBtn>
            </span>
          </div>
        ))}
        {bullets.length === 0 && <p className="text-xs text-[#94a3b8]">暂无条目。</p>}
      </div>
    </div>
  );
}
