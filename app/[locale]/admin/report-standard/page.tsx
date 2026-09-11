import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { requireAdmin } from "@/lib/adminData";
import {
  SPECIMEN_BANNER,
  REPORT_HEADER,
  SCORE,
  SECTIONS,
  RECOMMENDED_ACTIONS,
  DISCLAIMER,
  EVIDENCE_MARK,
  BUYER_DOWNLOAD,
  REPORT_LANGUAGES,
  type Lang,
  type Bi,
  type Field,
  type Section,
} from "@/lib/standardReport";

// 标准版工厂尽调报告 —— 内部样张（后台 requireAdmin 闸门，工厂不可见）。
// 全部为虚构演示数据；页面显著标注 SAMPLE。
// 标签为双语内联（后台单人内部工具，noindex）；采购商侧 9 语报告在 CS-09 正式化。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function ReportStandardPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const admin = await requireAdmin();
  if (!admin) notFound();

  const lang: Lang = locale === "zh" || locale === "zh-TW" ? "zh" : "en";
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

  const SectionTitle = ({ s }: { s: Section }) => (
    <h2 className="mt-8 mb-2 flex items-center gap-2 text-lg font-bold text-[#0f172a]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-xs font-bold text-white">
        {s.no}
      </span>
      {tr(s.title)}
    </h2>
  );

  return (
    <div className="max-w-4xl">
      {/* 顶部动作条 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[#0f172a]">{tr(REPORT_HEADER.title)}</h1>
        <span className="rounded-full bg-[#e6eef6] px-3 py-1 text-xs font-semibold text-[#0f4c81]">
          {tr(REPORT_HEADER.subtitle)}
        </span>
      </div>

      {/* 样张声明（反伪造铁律：必须显著） */}
      <div className="rounded-md border border-[#d4232a] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#991b1b]">
        {tr(SPECIMEN_BANNER)}
      </div>

      {/* ===== 报告正文（打印友好） ===== */}
      <div className="mt-5 rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-sm md:p-8">
        {/* 报告头 */}
        <div className="border-b border-[#e2e8f0] pb-4">
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

        {/* 各章节 */}
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
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${levelTag[f.level].cls}`}>
                          {tr(levelTag[f.level].text)}
                        </span>
                      )}
                      {f.note && <span className="w-full text-right text-xs font-normal text-[#94a3b8]">{tr(f.note)}</span>}
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
                        <th key={i} className="px-3 py-2 font-semibold">{tr(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef2f7] text-[#475569]">
                    {s.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2">
                            {s.table!.statusCol === ci ? (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(cell).cls}`}>
                                {tr(statusBadge(cell).text)}
                              </span>
                            ) : cell === "verified" || cell === "reported" || cell === "none" ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${levelTag[cell].cls}`}>
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
                      {it.meta && <span className="text-sm font-semibold text-[#0f4c81]">{it.meta}</span>}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          it.level === "med" ? "bg-[#fff4e0] text-[#8a5410]" : "bg-[#e8f5ea] text-[#1f7a36]"
                        }`}
                      >
                        {it.level === "med" ? (lang === "zh" ? "关注" : "Watch") : lang === "zh" ? "正常" : "Low impact"}
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

      {/* ===== 买家侧下载（工厂不可见） ===== */}
      <div className="mt-6 rounded-lg border-2 border-dashed border-[#0f4c81] bg-[#f7f9fc] p-5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#0f4c81] px-2 py-0.5 text-xs font-semibold text-white">ADMIN PREVIEW</span>
          <h2 className="text-base font-bold text-[#0f172a]">{tr(BUYER_DOWNLOAD.title)}</h2>
        </div>
        <p className="mt-1 text-xs text-[#64748b]">{tr(BUYER_DOWNLOAD.note)}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[#0f172a]" htmlFor="report-lang">
            {tr(BUYER_DOWNLOAD.langLabel)}
          </label>
          <select id="report-lang" className="input max-w-[220px]" defaultValue="en">
            {REPORT_LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" disabled>
            {tr(BUYER_DOWNLOAD.cta)}
          </button>
        </div>
        <p className="mt-2 text-xs text-[#941b1b]">{tr(BUYER_DOWNLOAD.priceNote)}</p>
      </div>
    </div>
  );
}
