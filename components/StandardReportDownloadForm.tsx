"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";
import { buildStandardReportHtml, standardReportFileName } from "@/lib/standardReportHtml";
import type { Lang } from "@/lib/standardReport";

/**
 * 文案键名与字典 standardReport 命名空间的键名**逐字一致**（formName/formEmail/…），
 * 不做任何映射 —— 映射层是「硬编码文案」最容易悄悄溜回来的地方。
 */
export type StandardReportFormLabels = {
  formName: string;
  formEmail: string;
  formCompany: string;
  formCountry: string;
  formSourcing: string;
  formLang: string;
  langEn: string;
  langZh: string;
  formCta: string;
  formPrivacy: string;
  formError: string;
  unlockedTitle: string;
  unlockedNote: string;
  downloadCta: string;
};

type Props = {
  labels: StandardReportFormLabels;
  /** 页面语言 → 决定表单默认的语言选项（zh / zh-TW 默认中文，其余英文） */
  defaultLang: Lang;
};

/**
 * 公开页 /standard-report 的「下载门禁」表单。
 *
 * 需求口径（用户 2026-09-11）：
 *   - 报告全文**免注册可读**（正文在服务端渲染，不经过本组件）
 *   - 想要**下载**才需要填写注册信息
 *   - 提交后后台自动发邮件 → 留下销售线索
 *
 * 实现取舍：
 *   - 提交走既有 /api/lead（tool=standard-report-specimen）：复用它的限流、
 *     管理员通知与客户端回执通道，不再新开一个端点。
 *     ⚠️ notifyAdminNewLead() 不接收 sourcing / country 之外的自定义字段，
 *        故把「报告语言」等结构化信息拼进 message，与 RfqForm 的做法一致。
 *   - 下载件在**客户端**由 lib/standardReportHtml.ts 现场生成（Blob）。
 *     这样门禁是真的：不存在一个可以直接分享、绕过留资的静态下载 URL。
 *     代价是 lib/standardReport* 会进这一页的客户端包（约 10KB 源文本），可接受。
 *   - 解锁态存 sessionStorage：刷新页面不必重复填表。它只是体验优化，
 *     **不是安全边界** —— 报告样文本来就是公开内容。
 */

const TOOL = "standard-report-specimen";
const UNLOCK_KEY = "fab_std_report_unlocked";

export default function StandardReportDownloadForm({ labels, defaultLang }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [sourcing, setSourcing] = useState("");
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [unlocked, setUnlocked] = useState(false);

  // 刷新后恢复解锁态（只在客户端读，避免 SSR/CSR 首帧不一致）
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(UNLOCK_KEY) === "1") setUnlocked(true);
    } catch {
      // sessionStorage 不可用（隐私模式等）→ 保持锁定，不影响主流程
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead: {
            tool: TOOL,
            firstName: name.trim(),
            email: email.trim().toLowerCase(),
            company: company.trim(),
            country: country.trim(),
            sourcing: sourcing.trim(),
            // notifyAdminNewLead 只透传固定字段，语言与来源页拼进 message 保证不丢
            message: [`Report language: ${lang}`, "Page: /standard-report"].join("\n"),
          },
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      trackEvent(ANALYTICS_EVENTS.standardReportSubmit, { tool: TOOL, page: "standard_report" });
      try {
        window.sessionStorage.setItem(UNLOCK_KEY, "1");
      } catch {
        /* 忽略 */
      }
      setUnlocked(true);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function download() {
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
  }

  // ---------- 已解锁：直接给下载 ----------
  if (unlocked) {
    return (
      <div className="rounded-md border border-[#1f7a36] bg-[#e8f5ea] p-5">
        <p className="text-sm font-semibold text-[#1f7a36]">{labels.unlockedTitle}</p>
        <p className="mt-1 text-sm text-[#475569]">{labels.unlockedNote}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-[#0f172a]" htmlFor="std-report-lang">
            {labels.formLang}
          </label>
          <select
            id="std-report-lang"
            className="input max-w-[200px]"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="en">{labels.langEn}</option>
            <option value="zh">{labels.langZh}</option>
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={download}
            data-track={ANALYTICS_EVENTS.standardReportCtaClick}
          >
            {labels.downloadCta}
          </button>
        </div>
      </div>
    );
  }

  // ---------- 未解锁：留资 ----------
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-[#0f172a]" htmlFor="std-name">
          {labels.formName}
        </label>
        <input
          id="std-name"
          className="input w-full"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#0f172a]" htmlFor="std-email">
          {labels.formEmail}
        </label>
        <input
          id="std-email"
          type="email"
          className="input w-full"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#0f172a]" htmlFor="std-company">
          {labels.formCompany}
        </label>
        <input
          id="std-company"
          className="input w-full"
          required
          maxLength={200}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#0f172a]" htmlFor="std-country">
          {labels.formCountry}
        </label>
        <input
          id="std-country"
          className="input w-full"
          maxLength={120}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-[#0f172a]" htmlFor="std-sourcing">
          {labels.formSourcing}
        </label>
        <input
          id="std-sourcing"
          className="input w-full"
          maxLength={300}
          value={sourcing}
          onChange={(e) => setSourcing(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[#0f172a]" htmlFor="std-form-lang">
          {labels.formLang}
        </label>
        <select
          id="std-form-lang"
          className="input w-full"
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          <option value="en">{labels.langEn}</option>
          <option value="zh">{labels.langZh}</option>
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={status === "loading"}
          className="btn btn-primary w-full disabled:opacity-60"
          data-track={ANALYTICS_EVENTS.standardReportCtaClick}
        >
          {status === "loading" ? "…" : labels.formCta}
        </button>
      </div>
      <p className="text-xs text-[#64748b] sm:col-span-2">{labels.formPrivacy}</p>
      {status === "error" && (
        <p className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#c0392b] sm:col-span-2">
          {labels.formError}
        </p>
      )}
    </form>
  );
}
