// components/StandardReportDocument.tsx —— 标准版报告正文渲染器（单一事实来源）
//
// 消费方：
//   - /{locale}/standard-report  公开样板页（免注册全文可读）
//   - /{locale}/admin/report-standard  后台标准样张（requireAdmin 闸门）
// 两处必须长得一模一样 —— 「标准版」之所以叫标准版，就是因为它只有一种样子。
//
// 性质：服务端组件（无 "use client"）。报告是静态演示数据，不需要交互，
//       也不需要把 13 个章节的数据结构打进 RSC payload 之外的任何地方。
//
// 语言：仅 en / zh 双语内联（lib/standardReport.ts 的 Bi 类型）。
//       9 语正式化在 CS-09 —— 届时标签迁入 i18n 命名空间，本组件改为接收字典。

import {
  SPECIMEN_BANNER,
  REPORT_HEADER,
  SCORE,
  SECTIONS,
  RECOMMENDED_ACTIONS,
  DISCLAIMER,
  EVIDENCE_MARK,
  type Lang,
  type Bi,
  type Field,
  type Section,
} from "@/lib/standardReport";

export default function StandardReportDocument({ lang }: { lang: Lang }) {
  const tr = (b: Bi) => b[lang];

  const levelTag: Record<NonNullable<Field["level"]>, { text: Bi; cls: string }> = {
    verified: { text: EVIDENCE_MARK.verified, cls: "bg-[#e8f5ea] text-[#1f7a36]" },
    reported: { text: EVIDENCE_MARK.reported, cls: "bg-[#fff4e0] text-[#8a5410]" },
    none: { text: EVIDENCE_MARK.none, cls: "bg-[#eef2f7] text-[#5b6b7e]" },
  };

  const statusBadge = (status: string): { text: Bi; cls: string } => {
    switch (status) {
      case "valid":
        return { text: { en: "Valid", zh: "有效" }, cls: "bg-[#e8f5ea] text-[#1f7a36]" };
      case "expired":
        return { text: { en: "Expired", zh: "已过期" }, cls: "bg-[#fdecea] text-[#b42318]" };
      default:
        return { text: { en: "Not on file", zh: "无记录" }, cls: "bg-[#eef2f7] text-[#5b6b7e]" };
    }
  };

  // 章节 id 供公开页目录锚点使用（#s01 … #s13）；scroll-mt 让锚点跳转不被吸顶导航遮住
  const SectionTitle = ({ s }: { s: Section }) => (
    <h2
      id={`s${s.no}`}
      className="mt-8 mb-2 flex scroll-mt-20 items-center gap-2 text-lg font-bold text-[#0f172a]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-xs font-bold text-white">
        {s.no}
      </span>
      {tr(s.title)}
    </h2>
  );

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm md:p-8">
      {/* 样张声明（反伪造铁律：必须显著，打印时也不隐藏） */}
      <div className="rounded-md border border-[#d4232a] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#991b1b]">
        {tr(SPECIMEN_BANNER)}
      </div>

      {/* 报告头 */}
      <div className="mt-5 border-b border-[#e2e8f0] pb-4">
        <div className="text-xl font-bold text-[#0f172a]">{tr(REPORT_HEADER.title)}</div>
        <div className="mt-2 space-y-0.5 text-xs text-[#64748b]">
          <div>{REPORT_HEADER.ref}</div>
          <div>{REPORT_HEADER.date}</div>
          <div>{tr(REPORT_HEADER.preparedFor)}</div>
          <div>{tr(REPORT_HEADER.pageOf)}</div>
        </div>
      </div>

      {/* 评分总览 */}
      <div className="mt-6 flex items-center gap-5 rounded-lg bg-[#f1f5f9] p-5">
        <div className="text-5xl font-extrabold text-[#0f4c81]">
          {SCORE.value}
          <span className="text-2xl text-[#94a3b8]">/{SCORE.max}</span>
        </div>
        <div>
          <div className="font-semibold text-[#0f172a]">{tr(SCORE.band)}</div>
          <p className="mt-1 text-sm text-[#64748b]">{tr(SCORE.note)}</p>
        </div>
      </div>

      {/* 8 维 */}
      <div className="mt-4 space-y-2">
        {SCORE.dims.map((d) => (
          <div key={d.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-[#475569]">{tr(d.label)}</span>
              <span className="font-semibold text-[#0f172a]">{d.score}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
              <div className="h-full rounded-full bg-[#0f4c81]" style={{ width: `${d.score}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 13 个章节 */}
      {SECTIONS.map((s) => (
        <div key={s.no}>
          <SectionTitle s={s} />
          {s.intro && <p className="text-xs text-[#64748b]">{tr(s.intro)}</p>}

          {s.kind === "fields" && s.fields && (
            <dl className="mt-3">
              {s.fields.map((f, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eef2f7] py-2 last:border-0"
                >
                  <dt className="text-[#64748b]">{tr(f.label)}</dt>
                  <dd className="flex flex-wrap items-center gap-2 text-right font-medium text-[#0f172a]">
                    <span>{f.value}</span>
                    {f.level && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${levelTag[f.level].cls}`}
                      >
                        {tr(levelTag[f.level].text)}
                      </span>
                    )}
                    {f.note && (
                      <span className="w-full text-right text-xs font-normal text-[#94a3b8]">
                        {tr(f.note)}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {s.kind === "table" && s.table && (
            <div className="mt-3 overflow-x-auto rounded-md border border-[#e2e8f0]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase tracking-wide text-[#64748b]">
                  <tr>
                    {s.table.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 font-semibold">
                        {tr(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f7] text-[#475569]">
                  {s.table.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2">
                          {s.table!.statusCol === ci ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(cell).cls}`}
                            >
                              {tr(statusBadge(cell).text)}
                            </span>
                          ) : cell === "verified" || cell === "reported" || cell === "none" ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${levelTag[cell].cls}`}
                            >
                              {tr(levelTag[cell].text)}
                            </span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {s.kind === "timeline" && s.items && (
            <ol className="mt-4 space-y-4 border-l-2 border-[#e2e8f0] pl-4">
              {s.items.map((it, i) => (
                <li key={i}>
                  <div className="flex flex-wrap items-center gap-2">
                    {it.meta && (
                      <span className="text-sm font-semibold text-[#0f4c81]">{it.meta}</span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        it.level === "med"
                          ? "bg-[#fff4e0] text-[#8a5410]"
                          : "bg-[#e8f5ea] text-[#1f7a36]"
                      }`}
                    >
                      {it.level === "med" ? tr({ en: "Watch", zh: "关注" }) : tr({ en: "Low impact", zh: "正常" })}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#0f172a]">{tr(it.title)}</div>
                  {it.desc && <div className="text-sm text-[#64748b]">{tr(it.desc)}</div>}
                </li>
              ))}
            </ol>
          )}

          {s.bullets && (
            <ul className="mt-3 space-y-2 text-sm text-[#475569]">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[#0f4c81]">•</span>
                  <span>{tr(b)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* 建议行动 */}
      <h2 className="mt-8 mb-2 text-lg font-bold text-[#0f172a]">
        {lang === "zh" ? "建议行动" : "Recommended actions"}
      </h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[#475569]">
        {RECOMMENDED_ACTIONS.map((a, i) => (
          <li key={i}>{tr(a)}</li>
        ))}
      </ol>

      <p className="mt-6 border-t border-[#e2e8f0] pt-4 text-xs text-[#64748b]">{tr(DISCLAIMER)}</p>
    </div>
  );
}
