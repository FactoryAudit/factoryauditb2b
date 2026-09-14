"use client";

import { useState } from "react";
import {
  buildSupplierReportHtml,
  supplierReportFileName,
  type SupplierReportInput,
  type ReportLang,
} from "@/lib/supplierReportHtml";

// 后台供应商详情页的「下载核验报告」按钮。
//
// 为什么不需要留资门禁：此按钮只出现在 /admin/suppliers/[slug]，该路由由
// requireAdmin() 在 layout 层已拦截（非管理员直接 404）。下载的是该供应商的
// 真实核验记录汇总（自包含 HTML），不是公开样张，也不产生销售线索。
//
// 下载件在客户端由 lib/supplierReportHtml.ts 现场生成（Blob），无服务端端点。

type Props = {
  reportData: SupplierReportInput;
  defaultLang: ReportLang;
};

export default function SupplierReportDownloadButton({
  reportData,
  defaultLang,
}: Props) {
  const [lang, setLang] = useState<ReportLang>(defaultLang);
  const [busy, setBusy] = useState(false);

  function download() {
    if (busy) return;
    setBusy(true);
    try {
      const html = buildSupplierReportHtml(reportData, lang);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = supplierReportFileName(reportData.slug, lang);
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
    <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
      <h2 className="text-base font-bold text-[#0f172a]">
        供应商核验报告 · Supplier Verification Report
      </h2>
      <p className="mt-1 text-xs text-[#64748b]">
        基于数据库中的真实核验记录生成（自包含 HTML，可离线打开 / 打印为 PDF）。
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[#0f172a]" htmlFor="sup-report-lang">
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
          {busy ? "…" : "下载报告 · Download"}
        </button>
      </div>
    </div>
  );
}
