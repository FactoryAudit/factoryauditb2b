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

/** 客户端 canvas 重编码：主图 ≤1600px、缩略图 ≤480px，EXIF 清理，优先 WebP。
 *  服务端不再 sharp（Workers 10ms CPU），只做安全复检。
 *
 *  ── 2026-10-28：为什么一次产出两个尺寸 ──────────────────────────────────
 *  此前只产出一张 1600px JPEG（客户端 q0.85），服务端把 display 与 thumbnail
 *  指向同一个对象 ⇒ 档案页缩略图条下的是 258 KB 原图，缩略图完全没省带宽。
 *  现在同一次解码里画两张 canvas：
 *    · display 1600px WebP q0.82 —— 实测 258 KB → 147 KB
 *    · thumb    480px WebP q0.78 —— 实测 258 KB → 20 KB（省 92%）
 *  优先 WebP：不支持 WebP 的老浏览器 canvas.toBlob 会**静默回落 PNG**（体积反而
 *  更大），所以必须检查返回的 blob.type，回落时改用 JPEG。 */
type Encoded = {
  bytes: ArrayBuffer;
  width: number;
  height: number;
  mime: string;
  thumbBytes: ArrayBuffer;
  thumbMime: string;
};

/** 画到指定长边上限的 canvas 上（不放大）。 */
function drawScaled(img: HTMLImageElement, maxDim: number) {
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
  return { canvas, w, h };
}

/** WebP 优先，返回实际编码出的类型（可能是 webp / jpeg / png）。 */
async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!jpeg) throw new Error("encode_failed");
  return jpeg;
}

async function reencode(file: File): Promise<Encoded> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode_failed"));
      el.src = url;
    });

    const d = drawScaled(img, 1600);
    const dBlob = await encodeCanvas(d.canvas, 0.82);

    const t = drawScaled(img, 480);
    const tBlob = await encodeCanvas(t.canvas, 0.78);

    return {
      bytes: await dBlob.arrayBuffer(),
      width: d.w,
      height: d.h,
      mime: dBlob.type,
      thumbBytes: await tBlob.arrayBuffer(),
      thumbMime: tBlob.type,
    };
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
      const ext = enc.mime === "image/webp" ? "webp" : enc.mime === "image/png" ? "png" : "jpg";
      fd.append("file", new File([enc.bytes], file.name || `photo.${ext}`, { type: enc.mime }));
      // 缩略图另存一份：服务端校验不过会自动退回「与主图同源」，不会让上传失败。
      fd.append("thumb", new File([enc.thumbBytes], `thumb.${ext}`, { type: enc.thumbMime }));
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
        <span className="font-medium text-[#171717]">{t("factoryPhotosTitle")}</span>
        <span className="text-[#6d6b66]">
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
              <p className="text-xs font-medium text-[#2b2b2b] mb-1">{humanize(cat)}</p>
              {photo ? (
                <div className="relative">
                  {previews[photo.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[photo.id]} alt={cat} className="w-full h-24 object-cover rounded" loading="lazy" />
                  ) : (
                    <div className="w-full h-24 bg-[#ebe8e1] rounded flex items-center justify-center text-[#6d6b66] text-xs">
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
                  className="w-full h-24 rounded border border-dashed border-[#ddd9d0] text-[#6d6b66] text-xs hover:border-[#171717] hover:text-[#171717]"
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
