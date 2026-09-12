import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { requireAdmin } from "@/lib/adminData";
import {
  REPORT_HEADER,
  BUYER_DOWNLOAD,
  REPORT_LANGUAGES,
  type Lang,
  type Bi,
} from "@/lib/standardReport";
import StandardReportDocument from "@/components/StandardReportDocument";

// 标准版工厂尽调报告 —— 内部样张（后台 requireAdmin 闸门，工厂不可见）。
//
// 报告正文已收敛到 components/StandardReportDocument.tsx（与公开页 /standard-report
// 共用同一个渲染器）。本页只保留：
//   ① admin 闸门  ② 标题条  ③ 「采购商下载（工厂不可见）」演示框
// 全部为虚构演示数据；样张声明由 StandardReportDocument 渲染。

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

  return (
    <div className="max-w-4xl">
      {/* 顶部动作条 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[#0f172a]">{tr(REPORT_HEADER.title)}</h1>
        <span className="rounded-full bg-[#e6eef6] px-3 py-1 text-xs font-semibold text-[#0f4c81]">
          {tr(REPORT_HEADER.subtitle)}
        </span>
      </div>

      {/* 报告正文（与公开样板页同一个渲染器） */}
      <StandardReportDocument lang={lang} />

      {/* ===== 买家侧下载（工厂不可见） ===== */}
      <div className="mt-6 rounded-lg border-2 border-dashed border-[#0f4c81] bg-[#f7f9fc] p-5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#0f4c81] px-2 py-0.5 text-xs font-semibold text-white">
            ADMIN PREVIEW
          </span>
          <h2 className="text-base font-bold text-[#0f172a]">{tr(BUYER_DOWNLOAD.title)}</h2>
        </div>
        <p className="mt-1 text-xs text-[#64748b]">{tr(BUYER_DOWNLOAD.note)}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[#0f172a]" htmlFor="report-lang">
            {tr(BUYER_DOWNLOAD.langLabel)}
          </label>
          <select id="report-lang" className="input max-w-[220px]" defaultValue="en">
            {REPORT_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
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
