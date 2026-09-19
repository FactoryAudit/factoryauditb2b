"use client";

import { useState } from "react";

type Props = {
  supplierId: string;
  email: string;
  initial: { status: string; slaDueAt: string | null; submittedAt: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿 / Draft",
  submitted: "已申请，平台处理中 / Submitted",
  under_review: "平台审核中 / Under review",
  published: "已完成并发布 / Published",
  rejected: "未通过 / Rejected",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 供应商侧「申请平台现场审核」入口（标签③）。提交后写入 on_site_audit 行，
// SLA = 申请 + 7 工作日（由服务端计算并返回）。
export default function OnSiteAuditApply({ supplierId, email, initial }: Props) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function apply() {
    if (busy || !supplierId || !email) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/supplier-on-site-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ kind: "err", text: labelErr(data.error) });
        return;
      }
      setState({ status: "submitted", slaDueAt: data.slaDueAt ?? null, submittedAt: new Date().toISOString() });
      setMsg({ kind: "ok", text: `申请已提交。平台将在 ${fmtDate(data.slaDueAt)} 前（7 个工作日）完成现场审核并上传报告。` });
    } catch {
      setMsg({ kind: "err", text: "网络异常，请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  const done = state?.status === "published";

  return (
    <section className="max-w-4xl mx-auto mt-10 rounded-xl border border-[#e2e8f0] bg-[#f7f9fc] p-6">
      <h2 className="text-xl font-bold text-[#0f172a]">平台现场审核 / Platform On-site Audit</h2>
      <p className="mt-2 text-sm text-[#475569]">
        供应商可发起申请，由 FactoryAuditB2B 安排线下现场审核。平台承诺
        <span className="font-semibold text-[#b45309]"> 7 个工作日 </span>
        SLA 内完成并上传报告，发布后该供应商显示「平台现场审核」标签。
      </p>

      {state ? (
        <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-white p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-[#64748b]">当前状态</span>
            <span className="font-medium text-[#0f172a]">{STATUS_LABEL[state.status] ?? state.status}</span>
          </div>
          {state.slaDueAt ? (
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-[#64748b]">预计完成（SLA）</span>
              <span className="font-medium text-[#b45309]">{fmtDate(state.slaDueAt)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!done ? (
        <button
          type="button"
          className="btn btn-primary mt-4"
          onClick={apply}
          disabled={busy || !supplierId || !email}
        >
          {busy ? "提交中…" : state ? "重新申请现场审核 / Re-apply" : "申请平台现场审核 / Apply"}
        </button>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#16a34a]">现场审核已完成并发布，详情见供应商档案页。</p>
      )}

      {!supplierId || !email ? (
        <p className="mt-3 text-xs text-[#94a3b8]">
          需先通过「成为供应商」登记并携带 supplier / email 参数访问本页，方可发起申请。
        </p>
      ) : null}

      {msg ? (
        <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-[#16a34a]" : "text-[#b91c1c]"}`}>{msg.text}</p>
      ) : null}
    </section>
  );
}

function labelErr(error?: string): string {
  switch (error) {
    case "supplier_not_found":
      return "未找到该供应商记录。";
    case "ownership_mismatch":
      return "邮箱与供应商登记邮箱不一致，无法发起申请。";
    case "already_published":
      return "该供应商的现场审核已发布，无需重复申请。";
    case "rate_limited":
      return "操作过于频繁，请稍后再试。";
    default:
      return "提交失败，请稍后重试。";
  }
}
