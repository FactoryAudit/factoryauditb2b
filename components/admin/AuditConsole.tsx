"use client";

// components/admin/AuditConsole.tsx —— 审核工作流后台操作台（CS-18 / §47/§29/§30/§25-28）
//
// 所有写操作都经 /api/admin/audits/[auditId]/*（服务端状态机 + 字段校验 + requireAdmin）。
// 成功后 router.refresh() 让 Server Component 用最新 getAuditWorkflow 重渲染。
// 后台是单人工具、noindex，标签用英文即可，不补 9 语字典。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AuditWorkflowView } from "@/lib/auditWorkflow";

const SEVERITIES = ["critical", "major", "minor", "observation"] as const;
const SOURCES = [
  "supplier_provided",
  "public_website",
  "gov_registry",
  "cert_body",
  "audit_report",
  "factory_visit",
  "third_party",
  "other",
] as const;

type Props = {
  auditId: string;
  supplierId: string | null;
  currentStatus: string;
  allowedNext: string[];
  initialView: AuditWorkflowView;
};

export default function AuditConsole({ auditId, supplierId, currentStatus, allowedNext, initialView }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: unknown): Promise<boolean> {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) {
        setMsg("saved");
        startTransition(() => router.refresh());
        return true;
      }
      setErr(data.error ?? "error");
      return false;
    } catch {
      setErr("network_error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const [next, setNext] = useState(allowedNext[0] ?? "");
  const [sev, setSev] = useState<string>("minor");
  const [fdesc, setFdesc] = useState("");
  const [src, setSrc] = useState<string>("cert_body");
  const [fname, setFname] = useState("");
  const [edesc, setEdesc] = useState("");
  const [capDesc, setCapDesc] = useState<Record<string, string>>({});

  return (
    <div className="space-y-6">
      {msg && !err && <p className="text-sm text-[#166534]">✓ {msg}</p>}
      {err && <p className="text-sm text-[#d4232a]">⚠ {err}</p>}

      {/* §47 状态机推进 */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-[#0f172a]">Status · {currentStatus}</h3>
        {allowedNext.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs text-[#64748b]">
              Advance to
              <select className="select mt-1 block" value={next} onChange={(e) => setNext(e.target.value)}>
                {allowedNext.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || pending}
              onClick={() => post(`/api/admin/audits/${encodeURIComponent(auditId)}/advance`, { next })}
              className="btn btn-primary"
            >
              Advance
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-[#64748b]">No transitions available (terminal state).</p>
        )}
      </div>

      {/* §29 发现项 + §30 整改 */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-[#0f172a]">Findings ({initialView.findings.length})</h3>
        <div className="mt-3 space-y-3">
          {initialView.findings.map((f) => (
            <div key={f.id} className="rounded-md border border-[#e2e8f0] p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-[#fef3c7] px-2 py-0.5 font-semibold text-[#92400e]">{f.severity}</span>
                <span className="text-[#64748b]">{f.status}</span>
              </div>
              <p className="mt-1 text-sm text-[#0f172a]">{f.description}</p>
              {f.correctiveActions.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {f.correctiveActions.map((c) => (
                    <li key={c.id} className="text-xs text-[#475569]">
                      ↳ CAP [{c.status}]: {c.description}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <input
                  className="input flex-1"
                  placeholder="Corrective action description"
                  value={capDesc[f.id] ?? ""}
                  onChange={(e) => setCapDesc((p) => ({ ...p, [f.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={busy || pending || !(capDesc[f.id] ?? "").trim()}
                  onClick={() =>
                    post(`/api/admin/audits/${encodeURIComponent(auditId)}/cap`, {
                      findingId: f.id,
                      description: capDesc[f.id],
                    }).then((ok) => ok && setCapDesc((p) => ({ ...p, [f.id]: "" })))
                  }
                  className="btn btn-primary"
                >
                  Add CAP
                </button>
              </div>
            </div>
          ))}
          {initialView.findings.length === 0 && (
            <p className="text-xs text-[#64748b]">No findings yet.</p>
          )}
        </div>

        <div className="mt-4 border-t border-[#e2e8f0] pt-3">
          <h4 className="text-xs font-semibold text-[#475569]">Add finding</h4>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-[#64748b]">
              Severity
              <select className="select mt-1 block" value={sev} onChange={(e) => setSev(e.target.value)}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              className="textarea flex-1"
              rows={2}
              placeholder="Finding description"
              value={fdesc}
              onChange={(e) => setFdesc(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || pending || !fdesc.trim()}
              onClick={() =>
                post(`/api/admin/audits/${encodeURIComponent(auditId)}/finding`, {
                  severity: sev,
                  description: fdesc,
                }).then((ok) => ok && setFdesc(""))
              }
              className="btn btn-primary"
            >
              Add finding
            </button>
          </div>
        </div>
      </div>

      {/* §25-§28 证据 */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-[#0f172a]">Evidence ({initialView.evidence.length})</h3>
        <div className="mt-3 space-y-2">
          {initialView.evidence.map((e) => (
            <div key={e.id} className="text-xs text-[#475569]">
              {e.filename ? <span className="font-medium">{e.filename}</span> : <span className="italic">untitled</span>}
              {e.source && <span className="ml-2 rounded bg-[#eef2ff] px-2 py-0.5 text-[#3730a3]">{e.source}</span>}
              {e.verificationStatus && <span className="ml-2 text-[#64748b]">{e.verificationStatus}</span>}
            </div>
          ))}
          {initialView.evidence.length === 0 && <p className="text-xs text-[#64748b]">No evidence yet.</p>}
        </div>

        <div className="mt-4 border-t border-[#e2e8f0] pt-3">
          <h4 className="text-xs font-semibold text-[#475569]">Add evidence</h4>
          {supplierId ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-[#64748b]">
                  Source
                  <select className="select mt-1 block" value={src} onChange={(e) => setSrc(e.target.value)}>
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  className="input flex-1"
                  placeholder="Filename"
                  value={fname}
                  onChange={(e) => setFname(e.target.value)}
                />
              </div>
              <textarea
                className="textarea w-full"
                rows={2}
                placeholder="Description / storage path / external link"
                value={edesc}
                onChange={(e) => setEdesc(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || pending}
                onClick={() =>
                  post(`/api/admin/audits/${encodeURIComponent(auditId)}/evidence`, {
                    supplierId,
                    source: src,
                    filename: fname || null,
                    description: edesc || null,
                  }).then((ok) => ok && (setFname(""), setEdesc("")))
                }
                className="btn btn-primary"
              >
                Add evidence
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#d4232a]">Missing supplier_id — cannot attach evidence.</p>
          )}
        </div>
      </div>
    </div>
  );
}
