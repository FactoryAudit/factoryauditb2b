"use client";

// 供应商端证书申报：列出 / 新增 / 修改 / 删除自己的证书记录，并上传扫描件。
//
// 🔴 三条约束（与 lib/supplierCertifications.ts 对应）：
//   1. 界面上**没有**核验状态开关 —— 供应商只能声明，Verified 由后台核发证机构登记库后给出。
//   2. 已核验（VERIFIED）的证书在 UI 上锁定：不能改、不能删（接口层也会拒）。
//   3. 文件先上传拿 evidence.id，再随证书一起保存；未上传则 claim_status = SELF_DECLARED。

import { useCallback, useEffect, useMemo, useState } from "react";

export type CertProgram = { code: string; label: string };

type CertRow = {
  id: string;
  programCode: string;
  displayName: string | null;
  certificateNo: string | null;
  issuingBody: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  scope: string | null;
  claimStatus: string;
  evidenceStatus: string;
  verificationStatus: string;
  evidenceDocId: string | null;
  lastCheckedAt: string | null;
};

type Props = {
  supplierId: string;
  email: string;
  locale: string;
  programs: CertProgram[];
};

type Draft = {
  id: string | null;
  programCode: string;
  certificateNo: string;
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
  scope: string;
  evidenceDocId: string | null;
  evidenceName: string | null;
};

const EMPTY: Draft = {
  id: null,
  programCode: "",
  certificateNo: "",
  issuingBody: "",
  issueDate: "",
  expiryDate: "",
  scope: "",
  evidenceDocId: null,
  evidenceName: null,
};

export default function CertificateManager({ supplierId, email, locale, programs }: Props) {
  const zh = locale === "zh" || locale === "zh-TW";
  const L = (en: string, cn: string) => (zh ? cn : en);

  const [rows, setRows] = useState<CertRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const listUrl = useMemo(() => {
    const qs = new URLSearchParams({ supplier: supplierId, email });
    return `/api/supplier-certifications?${qs.toString()}`;
  }, [supplierId, email]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(listUrl, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      setRows(Array.isArray(d?.rows) ? d.rows : []);
    } catch {
      setRows([]);
    }
  }, [listUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  function badgeOf(r: CertRow) {
    const expired = !!r.expiryDate && r.expiryDate < today;
    if (r.verificationStatus === "REJECTED") {
      return { text: L("Rejected", "已驳回"), cls: "bg-red-50 text-red-700" };
    }
    if (r.verificationStatus === "VERIFIED") {
      return expired
        ? { text: L("Verified · expired", "已核验 · 已过期"), cls: "bg-[#f5f3ee] text-[#6d6b66]" }
        : { text: L("Verified", "已核验"), cls: "bg-green-50 text-green-700" };
    }
    if (expired) return { text: L("Expired", "已过期"), cls: "bg-[#f5f3ee] text-[#6d6b66]" };
    return { text: L("Pending review", "待核验"), cls: "bg-amber-50 text-amber-800" };
  }

  async function upload(file: File) {
    if (!draft) return;
    setUploading(true);
    setMsg(null);
    try {
      const key = draft.id ? `cert:${draft.id}` : `cert:new:${Date.now()}`;
      const fd = new FormData();
      fd.append("supplierId", supplierId);
      fd.append("email", email);
      fd.append("itemKey", key);
      fd.append("file", file);
      const r = await fetch("/api/supplier-evidence", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok && d?.evidence?.id) {
        setDraft({ ...draft, evidenceDocId: String(d.evidence.id), evidenceName: file.name });
        setMsg({ kind: "ok", text: L("File uploaded. Remember to save.", "文件已上传，记得点保存。") });
      } else {
        setMsg({ kind: "err", text: `${L("Upload failed", "上传失败")}: ${d?.error ?? r.status}` });
      }
    } catch {
      setMsg({ kind: "err", text: L("Network error while uploading.", "上传时网络错误。") });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (!draft.programCode) {
      setMsg({ kind: "err", text: L("Select a certification first.", "请先选择认证项目。") });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/supplier-certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          email,
          action: "save",
          id: draft.id,
          programCode: draft.programCode,
          certificateNo: draft.certificateNo,
          issuingBody: draft.issuingBody,
          issueDate: draft.issueDate,
          expiryDate: draft.expiryDate,
          scope: draft.scope,
          evidenceDocId: draft.evidenceDocId,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        setMsg({ kind: "ok", text: L("Saved.", "已保存。") });
        setDraft(null);
        await load();
      } else {
        const map: Record<string, string> = {
          expiry_before_issue: L("Expiry date cannot be before the issue date.", "有效期不能早于签发日期。"),
          verified_locked: L("This certificate is already verified — contact us to change it.", "该证书已核验，如需修改请联系平台。"),
          program_required: L("Select a certification first.", "请先选择认证项目。"),
        };
        setMsg({ kind: "err", text: map[String(d?.error)] ?? `${L("Save failed", "保存失败")}: ${d?.error ?? r.status}` });
      }
    } catch {
      setMsg({ kind: "err", text: L("Network error while saving.", "保存时网络错误。") });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/supplier-certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, email, action: "delete", id }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok) {
        await load();
      } else if (d?.error === "verified_locked") {
        setMsg({ kind: "err", text: L("Verified certificates cannot be deleted.", "已核验的证书不能删除。") });
      } else {
        setMsg({ kind: "err", text: `${L("Delete failed", "删除失败")}: ${d?.error ?? r.status}` });
      }
    } catch {
      setMsg({ kind: "err", text: L("Network error.", "网络错误。") });
    } finally {
      setBusy(false);
    }
  }

  function edit(r: CertRow) {
    setMsg(null);
    setDraft({
      id: r.id,
      programCode: r.programCode,
      certificateNo: r.certificateNo ?? "",
      issuingBody: r.issuingBody ?? "",
      issueDate: r.issueDate ?? "",
      expiryDate: r.expiryDate ?? "",
      scope: r.scope ?? "",
      evidenceDocId: r.evidenceDocId,
      evidenceName: r.evidenceDocId ? L("attached", "已附") : null,
    });
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`p-3 rounded-lg text-sm ${
            msg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 列表 */}
      <section className="card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-[#171717]">{L("Your certificates", "你的证书")}</h2>
            <p className="text-sm text-[#6d6b66] mt-1">
              {L(
                "Only what is declared here appears in your report. Nothing is marked Verified until we check the issuer's registry.",
                "只有在这里申报的证书才会出现在报告中。平台核对发证机构登记库之前，不会标为已核验。"
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            onClick={() => {
              setMsg(null);
              setDraft({ ...EMPTY });
            }}
          >
            {L("Add certificate", "新增证书")}
          </button>
        </div>

        {rows === null ? (
          <p className="mt-4 text-sm text-[#8c8982]">{L("Loading…", "加载中…")}</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-[#8c8982]">
            {L(
              "No certificates declared yet. Buyers see an empty certificate section in your report.",
              "尚未申报任何证书。买家在你的报告里看到的是一段空的证书说明。"
            )}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#6d6b66] border-b">
                  <th className="py-2">{L("Certification", "认证项目")}</th>
                  <th className="py-2">{L("Certificate no.", "证书编号")}</th>
                  <th className="py-2">{L("Issuer", "发证机构")}</th>
                  <th className="py-2">{L("Expires", "有效期至")}</th>
                  <th className="py-2">{L("Status", "状态")}</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = badgeOf(r);
                  const locked = r.verificationStatus === "VERIFIED";
                  return (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="py-2 font-medium text-[#171717]">{r.displayName || r.programCode}</td>
                      <td className="py-2">{r.certificateNo || <span className="text-[#b45309]">—</span>}</td>
                      <td className="py-2">{r.issuingBody || <span className="text-[#b45309]">—</span>}</td>
                      <td className="py-2">{r.expiryDate || <span className="text-[#b45309]">—</span>}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${b.cls}`}>{b.text}</span>
                        {r.evidenceStatus === "NONE" && (
                          <span className="block text-xs text-[#b45309] mt-1">
                            {L("No document", "未附扫描件")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {locked ? (
                          <span className="text-xs text-[#8c8982]">{L("locked", "已锁定")}</span>
                        ) : (
                          <>
                            <button type="button" className="text-xs underline mr-3" onClick={() => edit(r)}>
                              {L("Edit", "编辑")}
                            </button>
                            <button
                              type="button"
                              className="text-xs underline text-[#b45309]"
                              disabled={busy}
                              onClick={() => void remove(r.id)}
                            >
                              {L("Delete", "删除")}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 表单 */}
      {draft && (
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-[#171717]">
            {draft.id ? L("Edit certificate", "编辑证书") : L("New certificate", "新增证书")}
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-[#3f4650]">{L("Certification", "认证项目")} *</span>
              <select
                className="mt-1 w-full border rounded-lg p-2 text-sm"
                value={draft.programCode}
                onChange={(e) => setDraft({ ...draft, programCode: e.target.value })}
              >
                <option value="">{L("Select…", "请选择…")}</option>
                {programs.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-[#3f4650]">{L("Certificate no.", "证书编号")}</span>
              <input
                className="mt-1 w-full border rounded-lg p-2 text-sm"
                value={draft.certificateNo}
                onChange={(e) => setDraft({ ...draft, certificateNo: e.target.value })}
                placeholder={L("As printed on the certificate", "与证书上一致")}
              />
            </label>

            <label className="block">
              <span className="text-sm text-[#3f4650]">{L("Issuing body", "发证机构")}</span>
              <input
                className="mt-1 w-full border rounded-lg p-2 text-sm"
                value={draft.issuingBody}
                onChange={(e) => setDraft({ ...draft, issuingBody: e.target.value })}
                placeholder={L("e.g. SGS, TÜV, CQC", "例如 SGS、TÜV、CQC")}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-[#3f4650]">{L("Issued", "签发日期")}</span>
                <input
                  type="date"
                  className="mt-1 w-full border rounded-lg p-2 text-sm"
                  value={draft.issueDate}
                  onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm text-[#3f4650]">{L("Expires", "有效期至")}</span>
                <input
                  type="date"
                  className="mt-1 w-full border rounded-lg p-2 text-sm"
                  value={draft.expiryDate}
                  onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })}
                />
              </label>
            </div>

            <label className="block md:col-span-2">
              <span className="text-sm text-[#3f4650]">{L("Scope (optional)", "覆盖范围（选填）")}</span>
              <textarea
                rows={2}
                className="mt-1 w-full border rounded-lg p-2 text-sm"
                value={draft.scope}
                onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                placeholder={L(
                  "What the certificate covers — products, processes, site",
                  "证书覆盖的产品、工艺或厂址"
                )}
              />
            </label>

            <div className="md:col-span-2">
              <span className="text-sm text-[#3f4650]">{L("Certificate copy", "证书扫描件")}</span>
              <div className="mt-1 flex items-center gap-3 flex-wrap">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                  }}
                  className="text-sm"
                />
                {uploading && <span className="text-sm text-[#6d6b66]">{L("Uploading…", "上传中…")}</span>}
                {!uploading && draft.evidenceDocId && (
                  <span className="text-sm text-green-700">
                    ✓ {draft.evidenceName ?? L("attached", "已附")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-[#8c8982]">
                {L(
                  "PDF or image. Unchecked declarations are marked as self-declared in your report.",
                  "PDF 或图片。未核验的声明在报告中会标注为企业自述。"
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button type="button" className="btn-primary px-5 py-2.5 text-sm" disabled={busy} onClick={() => void save()}>
              {busy ? L("Saving…", "保存中…") : L("Save", "保存")}
            </button>
            <button
              type="button"
              className="px-5 py-2.5 text-sm rounded-lg border border-[#ebe8e1]"
              onClick={() => {
                setDraft(null);
                setMsg(null);
              }}
            >
              {L("Cancel", "取消")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
