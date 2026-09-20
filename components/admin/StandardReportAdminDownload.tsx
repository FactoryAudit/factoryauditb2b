"use client";

import { useState } from "react";
import {
  buildStandardReportHtml,
  standardReportFileName,
} from "@/lib/standardReportHtml";
import type { Lang } from "@/lib/standardReport";

type Props = {
  labels: {
    langLabel: string;
    downloadCta: string;
  };
  defaultLang: Lang;
};

// 后台样张页 /admin/report-standard 的下载按钮。
// 为什么可以直接下载：本路由由 requireAdmin() 闸门拦截（非管理员 404），
// 下载的是「标准样张」（虚构演示数据，文件内自带 SPECIMEN 声明），不产生销售线索。
// 下载件在客户端由 lib/standardReportHtml.ts 现场生成（Blob），无服务端端点。
// 买家侧的付费/手动解锁流程在公开页 /standard-report 的门禁表单，不受本组件影响。

export default function StandardReportAdminDownload({ labels, defaultLang }: Props) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [busy, setBusy] = useState(false);

  function download() {
    if (busy) return;
    setBusy(true);
    try {
      const html = buildStandardReportHtml(lang);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = standardReportFileName(lang);
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
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label className="text-sm font-medium text-[#0f172a]" htmlFor="report-lang">
        {labels.langLabel}
      </label>
      <select
        id="report-lang"
        className="input max-w-[220px]"
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
      >
        {/* 生成器当前支持 en/zh 两种排版；其余语言待 CS-09 多语言报告正式化后开放 */}
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
      <button type="button" className="btn btn-primary" onClick={download} disabled={busy}>
        {busy ? "…" : labels.downloadCta}
      </button>
    </div>
  );
}
