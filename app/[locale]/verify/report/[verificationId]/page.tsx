// app/[locale]/verify/report/[verificationId]/page.tsx —— 公共报告验真页（指令 §36-§38）
//
//  · 默认 noindex（指令 §40：验真页不应被索引，避免通过 sitemap 泄露报告清单）。
//  · 只展示白名单字段（lib/audits 已施加可见性闸门）。
//  · 不可公开的报告统一渲染「不可验真」提示，不暴露具体原因（防枚举）。

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getReportByVerificationId } from "@/lib/audits";
import { auditVerifyPhrases, auditTypeLabel, type AuditLocale } from "@/lib/auditI18n";
import { CopyButton } from "@/components/verify/CopyButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; verificationId: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const p = auditVerifyPhrases(locale);
  return {
    title: `FactoryAuditB2B · ${p.title}`,
    description: p.note,
    robots: { index: false, follow: false },
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="break-words text-sm text-slate-800">{children}</span>
    </div>
  );
}

export default async function VerifyReportPage({
  params,
}: {
  params: Promise<{ locale: string; verificationId: string }>;
}) {
  const { locale, verificationId } = await params;
  const p = auditVerifyPhrases(locale);
  const result = await getReportByVerificationId(verificationId);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://factoryauditb2b.com";
  const verifyUrl = `${siteUrl}/verify/report/${encodeURIComponent(verificationId)}`;

  if (!result.viewable) {
    // ★ 工单 SEO-20260918-FAB 任务 1.2 —— 不存在的验真 ID 必须返回**真 404**。
    // 此前一律 200 + 「不可验真」页 ⇒ 爬虫记为 soft 404
    // （实测 2026-09-18：/verify/report/NOTEXIST → 200 + 44 KB 页面）。
    //
    // 只对 not_found 这样做，其余三种原因保持不变：
    //   · not_issued / visibility_restricted / revoked 对应**真实存在**的报告，
    //     返回 200 是其正确语义（revoked 还必须展示「已撤销」状态）；
    //   · 页面本身已 robots:{index:false, follow:false}，无索引风险。
    if (result.reason === "not_found") notFound();
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
          🔍
        </div>
        <h1 className="text-xl font-semibold text-slate-800">{p.notVerifiable}</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{p.notVerifiableHint}</p>
      </main>
    );
  }

  const v = result.view;
  const statusBadge =
    v.publicStatus === "revoked"
      ? { text: p.revoked, cls: "bg-red-50 text-red-700 border-red-200" }
      : v.publicStatus === "superseded"
        ? { text: p.superseded, cls: "bg-amber-50 text-amber-700 border-amber-200" }
        : { text: p.valid, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-lg text-white">
              ✓
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">{p.verified}</h1>
              <p className="text-xs text-slate-500">{p.issuedBy}</p>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge.cls}`}>
            {statusBadge.text}
          </span>
        </div>

        <div className="px-6 py-2">
          <Field label={p.reportNumber}>{v.reportNumber}</Field>
          <Field label={p.supplier}>{v.supplierName || "—"}</Field>
          <Field label={p.auditType}>{auditTypeLabel(v.auditType, p)}</Field>
          <Field label={p.version}>{String(v.version)}</Field>
          <Field label={p.issued}>{fmtDate(v.issuedAt, locale)}</Field>
          <Field label={p.verificationId}>
            <span className="font-mono text-[13px]">{v.verificationId}</span>
          </Field>
          <Field label={p.sha256}>
            <div className="flex flex-wrap items-center gap-2">
              <code className="block break-all rounded bg-slate-50 px-2 py-1 font-mono text-[12px] text-slate-700">
                {v.sha256 || "—"}
              </code>
              <CopyButton value={v.sha256 ?? ""} label={p.copy} copiedLabel={p.copied} />
            </div>
          </Field>
          <Field label={p.verifyUrl}>
            <div className="flex flex-wrap items-center gap-2">
              <code className="block break-all rounded bg-slate-50 px-2 py-1 font-mono text-[12px] text-slate-700">
                {verifyUrl}
              </code>
              <CopyButton value={verifyUrl} label={p.copy} copiedLabel={p.copied} />
            </div>
          </Field>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <p className="text-xs leading-relaxed text-slate-500">{p.note}</p>
        </div>
      </div>
    </main>
  );
}
