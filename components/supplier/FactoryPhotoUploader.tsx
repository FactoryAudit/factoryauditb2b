"use client";

import { useRef, useState } from "react";
import { IMAGE_CATEGORIES, MAX_FACTORY_PHOTOS } from "@/lib/imageConstants";
import type { FactoryPhotoMeta } from "@/lib/supplierImages";

type SA = Record<string, string>;

type Props = {
  supplierId: string;
  value: FactoryPhotoMeta[];
  onChange: (photos: FactoryPhotoMeta[]) => void;
  dict: SA;
};

function humanize(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** 客户端 canvas 重编码：降采样到 ≤1600px、EXIF 清理、输出 JPEG/WebP。
 *  服务端不再 sharp（Workers 10ms CPU），只做安全复检。 */
async function reencode(file: File): Promise<{ bytes: ArrayBuffer; width: number; height: number; mime: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode_failed"));
      el.src = url;
    });
    const maxDim = 1600;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_ctx");
    ctx.drawImage(img, 0, 0, w, h);
    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, mime, 0.85));
    if (!blob) throw new Error("encode_failed");
    const bytes = await blob.arrayBuffer();
    return { bytes, width: w, height: h, mime };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FactoryPhotoUploader({ supplierId, value, onChange, dict }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [pendingCat, setPendingCat] = useState<string | null>(null);

  const t = (k: string) => dict[k] ?? k;
  const usedCount = value.length;

  function pickCategory(cat: string) {
    setPendingCat(cat);
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    if (!pendingCat) return;
    setErr(null);
    if (usedCount >= MAX_FACTORY_PHOTOS) {
      setErr(t("photoLimit"));
      setPendingCat(null);
      return;
    }
    setBusy(true);
    try {
      const enc = await reencode(file);
      const fd = new FormData();
      fd.append("supplierId", supplierId);
      fd.append("category", pendingCat);
      fd.append("width", String(enc.width));
      fd.append("height", String(enc.height));
      fd.append("file", new File([enc.bytes], file.name || "photo.jpg", { type: enc.mime }));
      const res = await fetch("/api/supplier-factory-photo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(
          t(
            data.error === "file_too_large"
              ? "tooLarge"
              : data.error === "resolution_too_low"
              ? "resolutionLow"
              : data.error === "photo_limit_reached"
              ? "photoLimit"
              : "wrongType"
          )
        );
        return;
      }
      const meta: FactoryPhotoMeta = data.photo;
      onChange([...value, meta]);
      if (file.type.startsWith("image/")) {
        setPreviews((p) => ({ ...p, [meta.id]: URL.createObjectURL(file) }));
      }
    } catch {
      setErr(t("uploadFailed"));
    } finally {
      setBusy(false);
      setPendingCat(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    setErr(null);
    try {
      const r = await fetch(`/api/supplier-factory-photo?id=${id}&supplierId=${encodeURIComponent(supplierId)}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErr(t(d.error === "locked" ? "photoLocked" : "deleteFailed"));
        return;
      }
      onChange(value.filter((m) => m.id !== id));
    } catch {
      setErr(t("deleteFailed"));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#0f172a]">{t("factoryPhotosTitle")}</span>
        <span className="text-[#64748b]">
          {usedCount} / {MAX_FACTORY_PHOTOS}
        </span>
      </div>
      {err && <p className="text-xs text-[#b45309]">{err}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {IMAGE_CATEGORIES.map((cat) => {
          const photo = value.find((p) => p.category === cat);
          return (
            <div key={cat} className="border rounded-lg p-2 bg-white">
              <p className="text-xs font-medium text-[#334155] mb-1">{humanize(cat)}</p>
              {photo ? (
                <div className="relative">
                  {previews[photo.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[photo.id]} alt={cat} className="w-full h-24 object-cover rounded" loading="lazy" />
                  ) : (
                    <div className="w-full h-24 bg-[#e2e8f0] rounded flex items-center justify-center text-[#64748b] text-xs">
                      {photo.status === "APPROVED" ? t("status_approved") : t("status_pending")}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(photo.id)}
                    className="absolute top-1 right-1 text-[11px] bg-white/90 text-[#b45309] px-1.5 rounded"
                    data-track="self_assessment_photo_delete_click"
                  >
                    {t("deletePhoto")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => pickCategory(cat)}
                  className="w-full h-24 rounded border border-dashed border-[#cbd5e1] text-[#64748b] text-xs hover:border-[#0f4c81] hover:text-[#0f4c81]"
                  data-track="self_assessment_photo_upload_click"
                >
                  + {t("uploadPhoto")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
