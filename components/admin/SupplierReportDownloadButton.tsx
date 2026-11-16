"use client";

import { useState } from "react";
import { buildReportDocHtml, reportDocFileName, type ReportLang } from "@/lib/supplierReportDocHtml";
import type { SupplierReportDoc } from "@/lib/supplierReports";

// 后台供应商详情页的「下载完整报告」按钮。
//
// 🔴 2026-11-16 修：原先这里用的是 buildSupplierReportHtml（**2 个区块**的简化核验摘要：
//    风险评分 + 档案键值对 + 审核记录表），而页面下方「报告正文」编辑器用的是
//    buildReportDocHtml（**13 章**完整档案）。两个出口内容天差地别，用户下载后
//    发现"和平台上的完整报告不相符"（实际投诉）。
//    现在统一走 buildReportDocHtml —— 与编辑器**同源同一份 doc**，下载件就是平台内容。
//
// 无留资门禁：只出现在 /admin/suppliers/[slug]，layout 层 requireAdmin 已拦截。
// 客户端生成 Blob，无服务端端点。

type Props = {
  doc: SupplierReportDoc;
  slug: string;
  supplierName: string;
  defaultLang: ReportLang;
  /** doc 是否已在库里保存过（false = 还没录入，下载出来是空白骨架） */
  hasContent: boolean;
};

export default function SupplierReportDownloadButton({
  doc,
  slug,
  supplierName,
  defaultLang,
  hasContent,
}: Props) {
  const [lang, setLang] = useState<ReportLang>(defaultLang);
  const [busy, setBusy] = useState(false);

  function download() {
    if (busy) return;
    setBusy(true);
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
      /* 生成失败不影响页面 */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#ebe8e1] bg-white p-5">
      <h2 className="text-base font-bold text-[#171717]">
        供应商尽职调查报告 · Supplier Due Diligence Report
      </h2>
      <p className="mt-1 text-xs text-[#6d6b66]">
        与页面下方「报告正文」编辑器同一份内容（13 章完整档案，自包含 HTML，可离线打开 / 打印为 PDF）。
      </p>
      {!hasContent ? (
        <p className="mt-2 rounded-md bg-[#fdf3e7] px-3 py-2 text-xs text-[#b45309]">
          还没有录入报告正文 —— 现在下载得到的是空白骨架。请先在下方编辑器填写并保存。
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[#171717]" htmlFor="sup-report-lang">
          语言
        </label>
        <select
          id="sup-report-lang"
          className="input max-w-[160px]"
          value={lang}
          onChange={(e) => setLang(e.target.value as ReportLang)}
        >
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
        <button
          type="button"
          className="btn btn-primary"
          onClick={download}
          disabled={busy}
        >
          {busy ? "…" : "下载完整报告 · Download"}
        </button>
      </div>
    </div>
  );
}
