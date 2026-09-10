"use client";

// components/admin/SupplierEvidencePanel.tsx —— 后台「文件与认证」面板
//
// 职责（spec §4/§6/§11/§12/§19）：
//   - 文件上传（PDF/JPG/PNG，≤10MB）→ 私有 bucket
//   - 证书结构化录入与审核（Approve / Reject）
//   - 审核事件录入与审核
//   - 平台核验等级设置
//
// 设计原则：
//   1. 后台是单人使用的工具，界面朴素、错误可见，不做花哨交互。
//   2. 本组件不做任何权限判断 —— 权限一律在服务端（requireAdmin）。
//   3. 所有写操作走 /api/admin/*，服务端白名单校验。
//   4. AI 抽取结果一律以 PENDING 进入，必须人工 Approve（spec §5/§6）。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeVariant } from "@/components/Badge";
import { certificateExpiryState, daysUntilDate } from "@/lib/verification";
import type {
  AdminDocumentRow,
  AdminCertificationRow,
  AdminAuditRow,
} from "@/lib/adminData";

export type DocRow = AdminDocumentRow & { previewUrl?: string | null };

export type EvidencePanelDict = {
  adminTitle: string;
  adminUpload: string;
  adminChooseFile: string;
  adminFileHint: string;
  adminUploading: string;
  adminUploadBtn: string;
  adminDelete: string;
  adminDeleteConfirm: string;
  adminApprove: string;
  adminReject: string;
  adminSave: string;
  adminSaving: string;
  adminSaved: string;
  adminDocsEmpty: string;
  adminCertsEmpty: string;
  adminAuditsEmpty: string;
  sectionVerification: string;
  sectionCertifications: string;
  sectionAudits: string;
  sectionEvidence: string;
  issuer: string;
  certificateNo: string;
  validUntil: string;
  statusValid: string;
  statusExpiringSoon: string;
  statusExpired: string;
  statusPending: string;
  statusRejected: string;
  daysRemaining: string;
  expiredAgo: string;
  auditDate: string;
  auditBy: string;
  auditResult: string;
  resultPass: string;
  resultPassWithFindings: string;
  resultFail: string;
  resultPending: string;
  levelUnverified: string;
  levelSelf: string;
  levelPlatform: string;
  levelOnsite: string;
  levelThirdParty: string;
};

type Props = {
  slug: string;
  locale: string;
  dict: EvidencePanelDict;
  verificationLevel: string;
  programs: { code: string; label: string }[];
  /** 初始选中的标签页。三个子页面共用本组件，各自定位到自己的页签。 */
  initialTab?: "docs" | "certs" | "audits";
};

const inputClass =
  "w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none";

const LEVELS = [
  "unverified",
  "self_assessment",
  "platform_assessment",
  "on_site_audit",
  "third_party_audit",
] as const;

function fmt(tpl: string, n: number): string {
  return tpl.replace("{n}", String(n));
}

/** 审核状态 → 徽章变体 */
function docBadge(status: string, d: EvidencePanelDict): { v: BadgeVariant; t: string } {
  switch (status) {
    case "VERIFIED":
      return { v: "verified", t: d.statusValid };
    case "PENDING":
      return { v: "pending", t: d.statusPending };
    case "REJECTED":
      return { v: "rejected", t: d.statusRejected };
    case "EXPIRED":
      return { v: "expired", t: d.statusExpired };
    default:
      return { v: "neutral", t: status };
  }
}

export default function SupplierEvidencePanel({
  slug,
  locale,
  dict: d,
  verificationLevel,
  programs,
  initialTab = "docs",
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"docs" | "certs" | "audits">(initialTab);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [certs, setCerts] = useState<AdminCertificationRow[]>([]);
  const [audits, setAudits] = useState<AdminAuditRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [level, setLevel] = useState(verificationLevel);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const levelLabel: Record<string, string> = {
    unverified: d.levelUnverified,
    self_assessment: d.levelSelf,
    platform_assessment: d.levelPlatform,
    on_site_audit: d.levelOnsite,
    third_party_audit: d.levelThirdParty,
  };

  async function reload() {
    setBusy(true);
    try {
      // 每个请求各自兜底：网络异常 / 非 JSON 响应都退化成 null，
      // 绝不让 Promise.all 整体 reject —— 否则首屏加载标志永远不会置位，面板卡在空白。
      const get = async (u: string) => {
        try {
          const r = await fetch(u);
          return await r.json();
        } catch {
          return null;
        }
      };
      const [a, b, c] = await Promise.all([
        get(`/api/admin/suppliers/${slug}/documents`),
        get(`/api/admin/suppliers/${slug}/certifications`),
        get(`/api/admin/suppliers/${slug}/audits`),
      ]);
      if (a?.ok) setDocs(a.documents ?? []);
      if (b?.ok) setCerts(b.certifications ?? []);
      if (c?.ok) setAudits(c.audits ?? []);
    } finally {
      setBusy(false);
    }
  }

  // 首屏拉取。三个子页面共用本组件，数据一律走 /api/admin/*（服务端已 requireAdmin）。
  useEffect(() => {
    let alive = true;
    void (async () => {
      await reload();
      if (alive) setLoaded(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function saveLevel(next: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, verification_level: next }),
      });
      const j = await res.json();
      if (j?.ok) {
        setLevel(next);
        setMsg(d.adminSaved);
      } else {
        setMsg(`error: ${j?.error ?? "unknown"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  // ---------- 文件上传 ----------
  async function upload(form: HTMLFormElement) {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData(form);
      const res = await fetch(`/api/admin/suppliers/${slug}/documents`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (j?.ok) {
        form.reset();
        setMsg(d.adminSaved);
        await reload();
        router.refresh();
      } else {
        setMsg(`error: ${j?.error ?? "unknown"}`);
      }
    } catch {
      setMsg("error: network");
    } finally {
      setBusy(false);
    }
  }

  async function patchDoc(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${slug}/documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = await res.json();
      if (j?.ok) await reload();
      else setMsg(`error: ${j?.error ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id: string) {
    if (!confirm(d.adminDeleteConfirm)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/suppliers/${slug}/documents?id=${id}`, {
        method: "DELETE",
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  // ---------- 证书 ----------
  async function saveCert(form: HTMLFormElement) {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch(`/api/admin/suppliers/${slug}/certifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j?.ok) {
        form.reset();
        setMsg(d.adminSaved);
        await reload();
        router.refresh();
      } else {
        setMsg(`error: ${j?.error ?? "unknown"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reviewCert(id: string, status: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/suppliers/${slug}/certifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, verification_status: status }),
      });
      await reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeCert(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/suppliers/${slug}/certifications?id=${id}`, {
        method: "DELETE",
      });
      await reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ---------- 审核事件 ----------
  async function saveAudit(form: HTMLFormElement) {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      const res = await fetch(`/api/admin/suppliers/${slug}/audits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j?.ok) {
        form.reset();
        setMsg(d.adminSaved);
        await reload();
        router.refresh();
      } else {
        setMsg(`error: ${j?.error ?? "unknown"}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reviewAudit(id: string, status: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/suppliers/${slug}/audits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, verification_status: status }),
      });
      await reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        tab === key
          ? "bg-[#0f4c81] text-white"
          : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* 核验等级 */}
      <section className="card p-5">
        <h2 className="text-lg font-bold text-[#0f172a]">{d.sectionVerification}</h2>
        <p className="mt-2">
          <Badge variant="neutral">{levelLabel[level] ?? level}</Badge>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              disabled={busy}
              onClick={() => saveLevel(lv)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                level === lv
                  ? "border-[#0f4c81] bg-[#e6eef6] font-semibold text-[#0f4c81]"
                  : "border-[#e2e8f0] bg-white text-[#475569]"
              }`}
            >
              {levelLabel[lv] ?? lv}
            </button>
          ))}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabBtn("docs", d.sectionEvidence)}
        {tabBtn("certs", d.sectionCertifications)}
        {tabBtn("audits", d.sectionAudits)}
      </div>

      {msg ? (
        <p className="rounded-md bg-[#f1f5f9] px-3 py-2 text-sm text-[#0f172a]">{msg}</p>
      ) : null}

      {busy ? <p className="text-xs text-[#475569]">{d.adminSaving}</p> : null}

      {/* ---- 文件 ---- */}
      {tab === "docs" && loaded ? (
        <div className="space-y-4">
          <form
            className="card space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void upload(e.currentTarget);
            }}
          >
            <h3 className="font-semibold text-[#0f172a]">{d.adminUpload}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Type</span>
                <select name="documentType" className={`mt-1 ${inputClass}`} defaultValue="iso_certificate">
                  <option value="business_license">business_license</option>
                  <option value="factory_license">factory_license</option>
                  <option value="iso_certificate">iso_certificate</option>
                  <option value="social_audit_report">social_audit_report</option>
                  <option value="quality_audit_report">quality_audit_report</option>
                  <option value="product_test_report">product_test_report</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Name</span>
                <input name="documentName" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Program code</span>
                <input
                  name="programCode"
                  list="ec-programs"
                  className={`mt-1 ${inputClass}`}
                  placeholder="ISO9001"
                />
                <datalist id="ec-programs">
                  {programs.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.validUntil}</span>
                <input name="expiryDate" type="date" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Visibility</span>
                <select name="visibility" className={`mt-1 ${inputClass}`} defaultValue="admin">
                  <option value="admin">admin</option>
                  <option value="paid">paid</option>
                  <option value="public">public</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.adminChooseFile}</span>
                <input
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className={`mt-1 ${inputClass}`}
                  required
                />
                <span className="mt-1 block text-xs text-[#475569]">{d.adminFileHint}</span>
              </label>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
              {busy ? d.adminUploading : d.adminUploadBtn}
            </button>
          </form>

          {docs.length === 0 ? (
            <p className="text-sm text-[#475569]">{d.adminDocsEmpty}</p>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-[#f7f9fc] text-left text-xs text-[#475569]">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">{d.validUntil}</th>
                    <th className="px-3 py-2">Visibility</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {docs.map((r) => {
                    const b = docBadge(r.verification_status, d);
                    const dl = daysUntilDate(r.expiry_date);
                    return (
                      <tr key={r.id} className="border-t border-[#e2e8f0]">
                        <td className="px-3 py-2">
                          <div className="font-medium text-[#0f172a]">{r.document_name}</div>
                          <div className="text-xs text-[#475569]">
                            {Math.round(r.size_bytes / 1024)} KB
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#475569]">{r.document_type}</td>
                        <td className="px-3 py-2 text-xs text-[#475569]">
                          {r.expiry_date ?? "—"}
                          {dl !== null ? (
                            <div className="text-[#475569]">
                              {dl < 0 ? fmt(d.expiredAgo, -dl) : fmt(d.daysRemaining, dl)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#475569]">{r.visibility}</td>
                        <td className="px-3 py-2">
                          <Badge variant={b.v}>{b.t}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {r.previewUrl ? (
                              <a
                                href={r.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-[#0f4c81] hover:underline"
                              >
                                View
                              </a>
                            ) : null}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => patchDoc(r.id, { verification_status: "VERIFIED" })}
                              className="text-xs text-[#17602b] hover:underline"
                            >
                              {d.adminApprove}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => patchDoc(r.id, { verification_status: "REJECTED" })}
                              className="text-xs text-[#9b1c1c] hover:underline"
                            >
                              {d.adminReject}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeDoc(r.id)}
                              className="text-xs text-[#9b1c1c] hover:underline"
                            >
                              {d.adminDelete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* ---- 证书 ---- */}
      {tab === "certs" && loaded ? (
        <div className="space-y-4">
          <form
            className="card space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void saveCert(e.currentTarget);
            }}
          >
            <h3 className="font-semibold text-[#0f172a]">{d.sectionCertifications}</h3>
            <input type="hidden" name="id" />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Program code *</span>
                <input
                  name="programCode"
                  list="ec-programs2"
                  required
                  className={`mt-1 ${inputClass}`}
                  placeholder="ISO9001"
                />
                <datalist id="ec-programs2">
                  {programs.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.certificateNo}</span>
                <input name="certificateNo" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.issuer}</span>
                <input name="issuingBody" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.auditDate}</span>
                <input name="issueDate" type="date" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.validUntil}</span>
                <input name="expiryDate" type="date" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Evidence file</span>
                <select name="evidenceDocId" className={`mt-1 ${inputClass}`} defaultValue="">
                  <option value="">—</option>
                  {docs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.document_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-[#0f172a]">Scope</span>
                <input name="scope" className={`mt-1 ${inputClass}`} />
              </label>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
              {busy ? d.adminSaving : d.adminSave}
            </button>
          </form>

          {certs.length === 0 ? (
            <p className="text-sm text-[#475569]">{d.adminCertsEmpty}</p>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-[#f7f9fc] text-left text-xs text-[#475569]">
                  <tr>
                    <th className="px-3 py-2">Program</th>
                    <th className="px-3 py-2">{d.certificateNo}</th>
                    <th className="px-3 py-2">{d.issuer}</th>
                    <th className="px-3 py-2">{d.validUntil}</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => {
                    const state = certificateExpiryState({
                      verificationStatus: c.verification_status,
                      expiryDate: c.expiry_date,
                    });
                    const dl = daysUntilDate(c.expiry_date);
                    const b: { v: BadgeVariant; t: string } =
                      state === "VALID"
                        ? { v: "verified", t: d.statusValid }
                        : state === "EXPIRING_SOON"
                          ? { v: "expiring", t: d.statusExpiringSoon }
                          : state === "EXPIRED"
                            ? { v: "expired", t: d.statusExpired }
                            : state === "REJECTED"
                              ? { v: "rejected", t: d.statusRejected }
                              : { v: "pending", t: d.statusPending };
                    return (
                      <tr key={c.id} className="border-t border-[#e2e8f0]">
                        <td className="px-3 py-2 font-medium text-[#0f172a]">{c.program_code}</td>
                        <td className="px-3 py-2 text-xs text-[#475569]">
                          {c.certificate_no ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#475569]">
                          {c.issuing_body ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#475569]">
                          {c.expiry_date ?? "—"}
                          {dl !== null ? (
                            <div>{dl < 0 ? fmt(d.expiredAgo, -dl) : fmt(d.daysRemaining, dl)}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={b.v}>{b.t}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => reviewCert(c.id, "VERIFIED")}
                              className="text-xs text-[#17602b] hover:underline"
                            >
                              {d.adminApprove}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => reviewCert(c.id, "REJECTED")}
                              className="text-xs text-[#9b1c1c] hover:underline"
                            >
                              {d.adminReject}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeCert(c.id)}
                              className="text-xs text-[#9b1c1c] hover:underline"
                            >
                              {d.adminDelete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* ---- 审核事件 ---- */}
      {tab === "audits" && loaded ? (
        <div className="space-y-4">
          <form
            className="card space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void saveAudit(e.currentTarget);
            }}
          >
            <h3 className="font-semibold text-[#0f172a]">{d.sectionAudits}</h3>
            <input type="hidden" name="id" />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Audit type *</span>
                <select name="auditType" required className={`mt-1 ${inputClass}`} defaultValue="on_site_audit">
                  <option value="self_assessment">{d.levelSelf}</option>
                  <option value="platform_assessment">{d.levelPlatform}</option>
                  <option value="on_site_audit">{d.levelOnsite}</option>
                  <option value="third_party_audit">{d.levelThirdParty}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.auditDate} *</span>
                <input name="auditDate" type="date" required className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Standard code</span>
                <input name="standardCode" list="ec-programs3" className={`mt-1 ${inputClass}`} />
                <datalist id="ec-programs3">
                  {programs.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </datalist>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.auditBy} (name)</span>
                <input name="auditorName" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.auditBy} (org)</span>
                <input name="auditorOrg" className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">{d.auditResult}</span>
                <select name="result" className={`mt-1 ${inputClass}`} defaultValue="">
                  <option value="">—</option>
                  <option value="pass">{d.resultPass}</option>
                  <option value="pass_with_findings">{d.resultPassWithFindings}</option>
                  <option value="fail">{d.resultFail}</option>
                  <option value="pending">{d.resultPending}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Critical findings</span>
                <input name="findingsCritical" type="number" min={0} defaultValue={0} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Major findings</span>
                <input name="findingsMajor" type="number" min={0} defaultValue={0} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Minor findings</span>
                <input name="findingsMinor" type="number" min={0} defaultValue={0} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#0f172a]">Report file</span>
                <select name="reportDocId" className={`mt-1 ${inputClass}`} defaultValue="">
                  <option value="">—</option>
                  {docs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.document_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
              {busy ? d.adminSaving : d.adminSave}
            </button>
          </form>

          {audits.length === 0 ? (
            <p className="text-sm text-[#475569]">{d.adminAuditsEmpty}</p>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-[#f7f9fc] text-left text-xs text-[#475569]">
                  <tr>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">{d.auditDate}</th>
                    <th className="px-3 py-2">{d.auditBy}</th>
                    <th className="px-3 py-2">{d.auditResult}</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a) => {
                    const b = docBadge(a.verification_status, d);
                    return (
                      <tr key={a.id} className="border-t border-[#e2e8f0]">
                        <td className="px-3 py-2 font-medium text-[#0f172a]">{a.audit_type}</td>
                        <td className="px-3 py-2 text-xs text-[#475569]">{a.audit_date}</td>
                        <td className="px-3 py-2 text-xs text-[#475569]">
                          {[a.auditor_name, a.auditor_org].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#475569]">{a.result ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant={b.v}>{b.t}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => reviewAudit(a.id, "VERIFIED")}
                              className="text-xs text-[#17602b] hover:underline"
                            >
                              {d.adminApprove}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => reviewAudit(a.id, "REJECTED")}
                              className="text-xs text-[#9b1c1c] hover:underline"
                            >
                              {d.adminReject}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <p className="text-xs text-[#475569]">
        {locale.toUpperCase()} · {slug}
      </p>
    </div>
  );
}
