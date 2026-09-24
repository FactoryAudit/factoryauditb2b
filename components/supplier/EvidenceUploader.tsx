"use client";

import { useRef, useState } from "react";
import type { EvidenceMeta } from "@/lib/supplierEvidence";

type SA = Record<string, string>;

type Props = {
  itemKey: string;
  supplierId: string;
  email: string;
  value: EvidenceMeta[];
  onChange: (metas: EvidenceMeta[]) => void;
  dict: SA;
  maxPerItem?: number;
};

const STATUS_KEY: Record<string, string> = {
  UPLOADED: "status_uploaded",
  PENDING_REVIEW: "status_pending",
  APPROVED: "status_approved",
  NEEDS_MORE_INFO: "status_needs_more",
  REJECTED: "status_rejected",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function EvidenceUploader({ itemKey, supplierId, email, value, onChange, dict, maxPerItem = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const t = (k: string) => dict[k] ?? k;

  async function fetchSigned(meta: EvidenceMeta) {
    if (meta.type !== "image" || previews[meta.id]) return;
    try {
      const r = await fetch(`/api/supplier-evidence-signed?supplierId=${encodeURIComponent(supplierId)}&id=${meta.id}`);
      const d = await r.json();
      if (r.ok && d.url) setPreviews((p) => ({ ...p, [meta.id]: d.url }));
    } catch {
      /* 预览失败不阻断 */
    }
  }

  async function handleFile(file: File) {
    setErr(null);
    if (value.length >= maxPerItem) {
      setErr(t("evidenceLimit"));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("supplierId", supplierId);
      if (email) fd.append("email", email);
      fd.append("itemKey", itemKey);
      fd.append("file", file);
      const res = await fetch("/api/supplier-evidence", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(t(data.error === "file_too_large" ? "tooLarge" : data.error === "duplicate_file" ? "duplicateFile" : "wrongType"));
        return;
      }
      const meta: EvidenceMeta = data.evidence;
      onChange([...value, meta]);
      if (meta.type === "image" && file.type.startsWith("image/")) {
        setPreviews((p) => ({ ...p, [meta.id]: URL.createObjectURL(file) }));
      }
    } catch {
      setErr(t("uploadFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    setErr(null);
    try {
      const r = await fetch(`/api/supplier-evidence?id=${id}&supplierId=${encodeURIComponent(supplierId)}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErr(t(d.error === "locked" ? "evidenceLocked" : "deleteFailed"));
        return;
      }
      onChange(value.filter((m) => m.id !== id));
    } catch {
      setErr(t("deleteFailed"));
    }
  }

  return (
    <div className="mt-2 border-t border-dashed border-[#e2e8f0] pt-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={busy || value.length >= maxPerItem}
          onClick={() => inputRef.current?.click()}
          className="text-xs px-3 py-1.5 rounded-md bg-[#0f4c81] text-white disabled:opacity-50"
          data-track="self_assessment_evidence_upload_click"
        >
          {busy ? t("uploading") : `${t("uploadEvidence")} (${value.length}/${maxPerItem})`}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {err && <span className="text-xs text-[#b45309]">{err}</span>}
      </div>

      {value.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {value.map((m) => {
            void fetchSigned(m);
            return (
              <li key={m.id} className="flex items-center gap-3 text-xs bg-[#f8fafc] rounded p-2">
                {m.type === "image" && previews[m.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[m.id]} alt={m.fileName} className="w-10 h-10 object-cover rounded" loading="lazy" />
                ) : (
                  <span className="w-10 h-10 flex items-center justify-center rounded bg-[#e2e8f0] text-[#64748b]">
                    {m.type === "document" ? "PDF" : "IMG"}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[#0f172a]">{m.fileName}</p>
                  <p className="text-[#94a3b8]">
                    {formatBytes(m.fileSize)} · {t(STATUS_KEY[m.status] ?? "status_uploaded")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  className="text-[#b45309] hover:underline"
                  data-track="self_assessment_evidence_delete_click"
                >
                  {t("deleteEvidence")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
