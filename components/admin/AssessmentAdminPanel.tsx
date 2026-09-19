"use client";

import { useCallback, useEffect, useState } from "react";
import type { AssessmentType } from "@/lib/supplierAssessments";

type Labels = Record<AssessmentType, { en: string; zh: string }>;

type Row = {
  assessment_type: AssessmentType;
  status: string;
  sla_due_at: string | null;
  report_number: string | null;
  report_summary: string | null;
  overall_grade: string | null;
  risk_level: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  report_file_path: string | null;
  report_file_name: string | null;
  report_file_size: number | null;
};

const ORDER: AssessmentType[] = ["self_assessment", "platform_assessment", "on_site_audit"];
const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  under_review: "审核中",
  published: "已发布",
  rejected: "已拒绝",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-[#e2e8f0] text-[#475569]",
  submitted: "bg-[#dbeafe] text-[#1d4ed8]",
  under_review: "bg-[#fef3c7] text-[#b45309]",
  published: "bg-[#dcfce7] text-[#16a34a]",
  rejected: "bg-[#fee2e2] text-[#b91c1c]",
};
const RISK_OPTIONS = ["low", "moderate", "elevated", "high", "critical"];
const GRADE_OPTIONS = ["A", "B", "C", "D", "Pending"];

type Props = { supplierId: string; labels: Labels };

// admin 后台「三标签审核」管理块。读取某供应商全部 supplier_assessments，
// 每个标签提供审核动作（发布/拒绝/退回修改）。标签②平台在线评估支持录入报告字段后发布。
export default function AssessmentAdminPanel({ supplierId, labels }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // 标签②报告字段（局部编辑态）
  const [reportNumber, setReportNumber] = useState("");
  const [reportSummary, setReportSummary] = useState("");
  const [overallGrade, setOverallGrade] = useState("");
  const [riskLevel, setRiskLevel] = useState("");

  // 标签②③报告文件上传（局部编辑态）
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<AssessmentType | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/supplier-assessments/${supplierId}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRows(data.assessments ?? []);
        const pa = (data.assessments ?? []).find((r: Row) => r.assessment_type === "platform_assessment");
        if (pa) {
          setReportNumber(pa.report_number ?? "");
          setReportSummary(pa.report_summary ?? "");
          setOverallGrade(pa.overall_grade ?? "");
          setRiskLevel(pa.risk_level ?? "");
        }
      }
    } catch {
      /* 忽略 */
    }
  }, [supplierId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function rowOf(type: AssessmentType): Row | undefined {
    return rows?.find((r) => r.assessment_type === type);
  }

  async function act(type: AssessmentType, action: "publish" | "reject" | "request_changes" | "create", extra?: Record<string, unknown>) {
    setBusy(`${type}:${action}`);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/supplier-assessments/${supplierId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentType: type, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ kind: "err", text: `操作失败：${data.error ?? "unknown"}` });
        return;
      }
      setMsg({ kind: "ok", text: "已更新。" });
      await refresh();
    } catch {
      setMsg({ kind: "err", text: "网络异常。" });
    } finally {
      setBusy(null);
    }
  }

  // 上传审核报告文件（标签②③ 平台出具的报告 PDF 等）
  async function uploadReport(type: AssessmentType, file: File) {
    setBusy(`${type}:upload`);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("assessmentType", type);
      fd.append("file", file);
      const res = await fetch(`/api/admin/supplier-assessments/${supplierId}/report`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ kind: "err", text: `上传失败：${data.error ?? "unknown"}` });
        return;
      }
      setMsg({ kind: "ok", text: `报告已上传：${data.fileName ?? ""}` });
      setUploadFile(null);
      setUploadType(null);
      await refresh();
    } catch {
      setMsg({ kind: "err", text: "网络异常。" });
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) {
    return <div className="card p-4 text-sm text-[#64748b]">加载三标签审核状态…</div>;
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold text-[#0f172a]">三标签审核 · Three-Tag Assessment</h2>
      <p className="text-xs text-[#64748b] mt-1">
        标签①工厂自评估（供应商自填）②平台在线评估（平台背调出报告）③平台现场审核（供应商申请→7 工作日 SLA）。
      </p>

      <div className="mt-4 grid gap-4">
        {ORDER.map((type) => {
          const r = rowOf(type);
          const disabled = busy !== null;
          return (
            <div key={type} className="rounded-lg border border-[#e2e8f0] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[#0f172a]">{labels[type].zh}</div>
                  <div className="text-xs text-[#94a3b8]">{labels[type].en}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[r?.status ?? "draft"]}`}>
                  {STATUS_LABEL[r?.status ?? "draft"]}
                </span>
              </div>

              {type === "on_site_audit" && r?.sla_due_at ? (
                <p className="mt-2 text-xs text-[#b45309]">
                  预计完成（SLA）：{new Date(r.sla_due_at).toISOString().slice(0, 10)}
                </p>
              ) : null}

              {type === "platform_assessment" ? (
                <div className="mt-3 space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      className="input"
                      placeholder="报告编号 Report No."
                      value={reportNumber}
                      onChange={(e) => setReportNumber(e.target.value)}
                    />
                    <select className="input" value={overallGrade} onChange={(e) => setOverallGrade(e.target.value)}>
                      <option value="">综合评级 Grade（不选）</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <select className="input" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
                      <option value="">风险档 Risk（不选）</option>
                      {RISK_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="input min-h-[64px]"
                    placeholder="报告摘要 Report summary"
                    value={reportSummary}
                    onChange={(e) => setReportSummary(e.target.value)}
                  />
                </div>
              ) : null}

              {/* 标签②③：上传审核报告文件（PDF 等） */}
              <div className="mt-3 rounded-md border border-[#eef2f7] bg-[#f8fafc] p-3">
                <div className="text-xs font-semibold text-[#334155] mb-2">
                  审核报告文件 · Report file（PDF/JPG/PNG，≤10MB）
                </div>
                {r?.report_file_path ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#0f172a]">
                    <span className="rounded bg-[#dcfce7] px-2 py-0.5 font-medium text-[#16a34a]">
                      已上传
                    </span>
                    <span className="truncate max-w-[220px]">{r.report_file_name ?? r.report_file_path}</span>
                    {r.report_file_size ? (
                      <span className="text-[#94a3b8]">{Math.round(r.report_file_size / 1024)} KB</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-[#94a3b8]">尚未上传报告文件。</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="block text-xs text-[#475569] file:mr-2 file:rounded file:border-0 file:bg-[#0f4c81] file:px-2 file:py-1 file:text-white"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setUploadFile(f);
                      setUploadType(type);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={disabled || !uploadFile || uploadType !== type}
                    onClick={() => uploadFile && uploadReport(type, uploadFile)}
                  >
                    上传报告 / Upload
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!r ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={disabled}
                    onClick={() => act(type, "create")}
                  >
                    创建报告草稿
                  </button>
                ) : null}

                {r ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={disabled}
                      onClick={() =>
                        act(type, "publish", {
                          reportNumber: type === "platform_assessment" ? reportNumber : undefined,
                          reportSummary: type === "platform_assessment" ? reportSummary : undefined,
                          overallGrade: type === "platform_assessment" ? overallGrade : undefined,
                          riskLevel: type === "platform_assessment" ? riskLevel : undefined,
                        })
                      }
                    >
                      发布 / Publish
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={disabled}
                      onClick={() => act(type, "request_changes")}
                    >
                      退回修改
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm border border-[#fecaca] text-[#b91c1c]"
                      disabled={disabled}
                      onClick={() => act(type, "reject")}
                    >
                      拒绝
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {msg ? (
        <p className={`mt-3 text-sm ${msg.kind === "ok" ? "text-[#16a34a]" : "text-[#b91c1c]"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
