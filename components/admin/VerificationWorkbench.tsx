"use client";

// components/admin/VerificationWorkbench.tsx —— CS-22 CHANGE SET C 后台「供应商核验工作台」
//
// 职责（与用户 10 项需求一一对应）：
//   1. 列出待核验自评（本组件挂载在选定供应商的工作台；队列由列表页提供）
//   2. Assessment Review：渲染 72 项题面 + 供应商答案
//   3. Evidence Review：逐项展示供应商上传的证据（私有文件走 admin 签名短链预览）
//   4. Item-level Approve / Reject / Need More Info（+ Reviewer Note）
//   5. Review Progress：已审 / 总数 / 被标记项
//   6. Online Verification Approval（Approve Online）
//   7. On-site Verification Approval（Approve On-site）
//   8. Verification ID / verified_at / expires_at（来自 verification_records）
//   9. Admin Audit Log（服务端写，这里只展示历史）
//
// 铁律：本组件不做任何权限判断；所有写操作走 /api/admin/*（服务端 requireAdmin）。
//       后台是内部 noindex 工具，文案用双语常量，不补 9 语字典键。

import { useCallback, useEffect, useMemo, useState } from "react";

type ReviewStatus = "APPROVED" | "REJECTED" | "NEED_MORE_INFO" | "PENDING";

type Question = {
  code: string;
  title: string;
  titleZh?: string;
  requirement?: string | null;
  responseType?: string;
  mandatory?: boolean;
};
type Section = { code: string; title: string; titleZh?: string; questions: Question[] };
type Template = { code: string; name: string; nameZh?: string; sections: Section[] };

type EvidenceFile = {
  id: string;
  item_key: string | null;
  file_name: string | null;
  mime_type: string | null;
  status: string | null;
  file_size: number | null;
  reviewed_by: string | null;
};

type VerificationRecord = {
  id: string;
  verification_id: string;
  verification_type: "ONLINE" | "ON_SITE";
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  verified_at: string;
  expires_at: string | null;
  verified_by: string | null;
  scope: unknown;
  notes: string | null;
};

type Decision = { status: ReviewStatus | null; note: string };

const ZH = false; // 后台固定双语展示（标题优先英文，附中文）

export default function VerificationWorkbench({
  supplierId,
  supplierName,
}: {
  supplierId: string;
  supplierName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [responses, setResponses] = useState<Record<string, unknown> | null>(null);
  const [evidence, setEvidence] = useState<Record<string, EvidenceFile[]>>({});
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [assessmentStatus, setAssessmentStatus] = useState<string | null>(null);
  const [trustStatus, setTrustStatus] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showSigned, setShowSigned] = useState<Record<string, string>>({});

  const allQuestions = useMemo(() => {
    const out: Question[] = [];
    for (const t of templates) for (const s of t.sections) for (const q of s.questions) out.push(q);
    return out;
  }, [templates]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/supplier-assessment-review/${supplierId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "load_failed");
        return;
      }
      setTemplates(data.templates ?? []);
      setResponses(data.responses ?? null);
      setEvidence(data.evidence ?? {});
      setRecords(data.records ?? []);
      setAssessmentStatus(data.assessmentStatus ?? null);
      setTrustStatus(data.trustStatus ?? null);
      // 初始化逐项结论（服务端已存 itemReview 优先）
      const init: Record<string, Decision> = {};
      const saved = data.itemReview ?? {};
      for (const t of data.templates ?? []) {
        for (const s of t.sections ?? []) {
          for (const q of s.questions ?? []) {
            const r = saved[q.code];
            init[q.code] = r
              ? { status: r.status ?? null, note: r.note ?? "" }
              : { status: null, note: "" };
          }
        }
      }
      setDecisions(init);
    } catch {
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const progress = useMemo(() => {
    const total = allQuestions.length;
    let decided = 0;
    let flagged = 0;
    for (const q of allQuestions) {
      const d = decisions[q.code];
      if (d?.status) {
        decided += 1;
        if (d.status !== "APPROVED") flagged += 1;
      }
    }
    return { total, decided, flagged };
  }, [allQuestions, decisions]);

  function setDecision(code: string, status: ReviewStatus, note?: string) {
    setDecisions((prev) => ({
      ...prev,
      [code]: { status, note: note ?? prev[code]?.note ?? "" },
    }));
  }
  function setNote(code: string, note: string) {
    setDecisions((prev) => ({
      ...prev,
      [code]: { status: prev[code]?.status ?? null, note },
    }));
  }

  async function act(action: "save_review" | "request_more_info" | "approve_online" | "approve_onsite") {
    setBusy(action);
    setMsg(null);
    try {
      const review: Record<string, { status: string; note: string }> = {};
      for (const [code, d] of Object.entries(decisions)) {
        if (d.status) review[code] = { status: d.status, note: d.note };
      }
      const res = await fetch(`/api/admin/supplier-assessment-review/${supplierId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, review }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ kind: "err", text: `操作失败：${data.error ?? "unknown"}` });
        return;
      }
      setMsg({
        kind: "ok",
        text:
          action === "approve_online" || action === "approve_onsite"
            ? `已批准（${action === "approve_onsite" ? "现场" : "线上"}核验）Verification ID: ${data.verificationId}`
            : action === "request_more_info"
            ? "已要求供应商补充资料（状态=action_required）。"
            : "审核结论已保存。",
      });
      await refresh();
    } catch {
      setMsg({ kind: "err", text: "网络异常。" });
    } finally {
      setBusy(null);
    }
  }

  async function previewEvidence(id: string) {
    try {
      const res = await fetch(`/api/admin/supplier-evidence-signed?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowSigned((prev) => ({ ...prev, [id]: data.url }));
        window.open(data.url, "_blank", "noopener");
      }
    } catch {
      /* 忽略 */
    }
  }

  if (loading) return <div className="card p-4 text-sm text-[#64748b]">加载核验工作台…</div>;
  if (error) return <div className="card p-4 text-sm text-[#b91c1c]">加载失败：{error}</div>;

  const qLabel = (q: Question) => (ZH && q.titleZh ? q.titleZh : q.title) || q.code;

  return (
    <div className="space-y-6">
      {/* 顶部状态 + 进度 + 操作 */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0f172a]">供应商核验工作台 · Verification Workbench</h2>
            <p className="text-xs text-[#64748b] mt-1">
              {supplierName} · self-assessment status:{" "}
              <span className="font-mono">{assessmentStatus ?? "—"}</span> · trust:{" "}
              <span className="font-mono">{trustStatus ?? "NONE"}</span>
            </p>
          </div>
          <div className="text-right text-xs text-[#475569]">
            <div>Review progress</div>
            <div className="font-semibold text-[#0f172a]">
              {progress.decided}/{progress.total} 已审 · {progress.flagged} 标记
            </div>
          </div>
        </div>

        {/* 验证历史 */}
        {records.length > 0 ? (
          <div className="mt-4 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="text-xs font-semibold text-[#334155] mb-2">验证记录 · Verification History</div>
            <ul className="space-y-1 text-xs">
              {records.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-2 text-[#475569]">
                  <span className="font-mono font-semibold text-[#0f172a]">{r.verification_id}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      r.verification_type === "ON_SITE"
                        ? "bg-[#e6eef6] text-[#0f4c81]"
                        : "bg-[#f0fdf4] text-[#15803d]"
                    }`}
                  >
                    {r.verification_type}
                  </span>
                  <span>{r.status}</span>
                  <span>verified_at: {r.verified_at?.slice(0, 10)}</span>
                  <span>expires_at: {r.expires_at?.slice(0, 10) ?? "—"}</span>
                  <span>by {r.verified_by ?? "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy !== null}
            onClick={() => act("save_review")}
          >
            保存审核 / Save Review
          </button>
          <button
            type="button"
            className="btn btn-sm border border-[#fef3c7] text-[#b45309]"
            disabled={busy !== null}
            onClick={() => act("request_more_info")}
          >
            要求补充资料 / Request More Info
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy !== null}
            onClick={() => act("approve_online")}
          >
            批准线上核验 / Approve Online
          </button>
          <button
            type="button"
            className="btn btn-sm bg-[#0f4c81] text-white hover:bg-[#0c3f6b]"
            disabled={busy !== null}
            onClick={() => act("approve_onsite")}
          >
            批准现场核验 / Approve On-site
          </button>
        </div>
        {msg ? (
          <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-[#16a34a]" : "text-[#b91c1c]"}`}>
            {msg.text}
          </p>
        ) : null}
      </div>

      {/* 72 项评审 */}
      <div className="space-y-6">
        {templates.map((tpl) => (
          <div key={tpl.code}>
            <h3 className="text-lg font-bold text-[#0f172a]">{tpl.name || tpl.nameZh}</h3>
            {tpl.sections.map((sec) => (
              <div key={sec.code} className="mt-4">
                <h4 className="font-semibold text-[#334155]">
                  {sec.title || sec.titleZh}{" "}
                  <span className="text-xs text-[#94a3b8]">({sec.questions.length})</span>
                </h4>
                <div className="mt-2 space-y-2">
                  {sec.questions.map((q) => {
                    const d = decisions[q.code] ?? { status: null, note: "" };
                    const evs = evidence[q.code] ?? [];
                    const ans = responses?.[q.code];
                    return (
                      <div key={q.code} className="rounded-lg border border-[#e2e8f0] bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[#0f172a]">
                              {qLabel(q)}{" "}
                              <span className="font-mono text-[11px] text-[#94a3b8]">{q.code}</span>
                              {q.mandatory ? <span className="text-[#b91c1c]"> *</span> : null}
                            </div>
                            <div className="mt-1 text-sm text-[#334155]">
                              <span className="text-[#64748b]">答：</span>
                              {ans != null && ans !== "" ? String(ans) : "—"}
                            </div>
                            {evs.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {evs.map((e) => (
                                  <span
                                    key={e.id}
                                    className="inline-flex items-center gap-1 rounded bg-[#f1f5f9] px-2 py-0.5 text-xs text-[#475569]"
                                  >
                                    <button
                                      type="button"
                                      className="underline"
                                      onClick={() => previewEvidence(e.id)}
                                    >
                                      {e.file_name ?? "evidence"}
                                    </button>
                                    <span className="text-[#94a3b8]">
                                      {e.status ?? "—"}
                                      {e.file_size ? ` · ${Math.round(e.file_size / 1024)}KB` : ""}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {/* 逐项决策 */}
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <div className="flex gap-1">
                              {(
                                [
                                  ["APPROVED", "批准", "bg-[#f0fdf4] text-[#15803d] border-[#86efac]"],
                                  ["REJECTED", "拒绝", "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]"],
                                  ["NEED_MORE_INFO", "待补", "bg-[#fef3c7] text-[#b45309] border-[#fde68a]"],
                                ] as const
                              ).map(([st, label, cls]) => (
                                <button
                                  key={st}
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => setDecision(q.code, st as ReviewStatus)}
                                  className={`rounded border px-2 py-1 text-xs ${
                                    d.status === st ? `${cls} font-semibold ring-2 ring-offset-1 ring-[#0f4c81]` : "border-[#e2e8f0] bg-white text-[#475569]"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <textarea
                              className="w-48 rounded border border-[#e2e8f0] px-2 py-1 text-xs text-[#0f172a] focus:border-[#0f4c81] focus:outline-none"
                              placeholder="Reviewer note（可选）"
                              value={d.note}
                              onChange={(e) => setNote(q.code, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
        {templates.length === 0 ? (
          <p className="text-sm text-[#64748b]">尚未配置自评清单（audit_questions 为空）。</p>
        ) : null}
      </div>
    </div>
  );
}
