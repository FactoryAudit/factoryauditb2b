"use client";

// Phase 1：后台手动建单表单
//
// 两种审核对象：
//   · platform —— 平台目录内供应商（下拉，取已建档的）
//   · external —— 客户指定、平台未建档的工厂（客户自述，未核验）
// 这两条路径与客户侧 /factory-audit/request 完全一致（同一个 createAuditRequest），
// 差别只在「谁在填」。
//
// 后台单人使用、noindex，标签用英文即可（与 AuditConsole 同一约定，不补 9 语字典）。

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SupplierOption = {
  id: string;
  name: string;
  meta: string;
};

type Props = {
  locale: string;
  suppliers: SupplierOption[];
};

const AUDIT_TYPES = [
  { value: "announced", label: "Announced" },
  { value: "semi-announced", label: "Semi-announced" },
  { value: "unannounced", label: "Unannounced" },
];

export default function AuditCreateForm({ locale, suppliers }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [source, setSource] = useState<"platform" | "external">(
    suppliers.length > 0 ? "platform" : "external"
  );

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [extName, setExtName] = useState("");
  const [extContact, setExtContact] = useState("");
  const [extEmail, setExtEmail] = useState("");
  const [extPhone, setExtPhone] = useState("");
  const [extAddress, setExtAddress] = useState("");

  const [buyerCompany, setBuyerCompany] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerCountry, setBuyerCountry] = useState("");

  const [auditType, setAuditType] = useState("announced");
  const [standard, setStandard] = useState("");
  const [product, setProduct] = useState("");
  const [date, setDate] = useState("");
  const [window, setWindow] = useState("");
  const [special, setSpecial] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (source === "platform" && !supplierId) {
      setErr("Select a supplier, or switch to a buyer-specified factory.");
      return;
    }
    if (source === "external" && !extName.trim()) {
      setErr("Factory name is required.");
      return;
    }
    if (source === "external" && !extEmail.trim() && !extPhone.trim()) {
      setErr("Provide at least one contact channel (email or phone) for the factory.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierSource: source,
          supplierId: source === "platform" ? supplierId : null,
          externalSupplier:
            source === "external"
              ? {
                  name: extName,
                  contact: extContact,
                  email: extEmail,
                  phone: extPhone,
                  address: extAddress,
                }
              : null,
          buyerCompany,
          buyerEmail,
          buyerCountry,
          auditType,
          standardProtocol: standard,
          product,
          preferredDate: date,
          preferredWindow: window,
          specialRequirements: special,
        }),
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string | null;
        auditCode?: string;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "create_failed");
        return;
      }
      if (j.id) {
        router.push(`/${locale}/admin/audits/${j.id}`);
        router.refresh();
        return;
      }
      // 极端情况：写库成功但没回 id（理论上不会发生）。回列表页，让运营自己找单。
      router.push(`/${locale}/admin/audits`);
      router.refresh();
    } catch {
      setErr("network_error");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded border border-[#ddd9d0] bg-white px-3 py-2 text-sm text-[#171717]";
  const label = "text-sm font-medium text-[#2b2b2b]";

  return (
    <form onSubmit={submit} className="space-y-6">
      {err && <p className="rounded border border-[#f3c6c8] bg-[#fdf2f2] p-3 text-sm text-[#d4232a]">⚠ {err}</p>}

      {/* 审核对象 */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-[#171717]">Audit subject</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="source"
              checked={source === "platform"}
              onChange={() => setSource("platform")}
              disabled={suppliers.length === 0}
            />
            Platform supplier
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="source"
              checked={source === "external"}
              onChange={() => setSource("external")}
            />
            Buyer-specified factory (not in directory)
          </label>
        </div>

        {source === "platform" ? (
          <label className={`${label} mt-4 block`}>
            Supplier
            <select className={field} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.meta}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={label}>
              Factory name *
              <input className={field} value={extName} onChange={(e) => setExtName(e.target.value)} />
            </label>
            <label className={label}>
              Contact person
              <input className={field} value={extContact} onChange={(e) => setExtContact(e.target.value)} />
            </label>
            <label className={label}>
              Email
              <input className={field} value={extEmail} onChange={(e) => setExtEmail(e.target.value)} />
            </label>
            <label className={label}>
              Phone / WhatsApp
              <input className={field} value={extPhone} onChange={(e) => setExtPhone(e.target.value)} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              Factory address
              <input className={field} value={extAddress} onChange={(e) => setExtAddress(e.target.value)} />
            </label>
            <p className="text-xs text-[#6d6b66] sm:col-span-2">
              Buyer-provided information, not verified by us. Email or phone is required — without a
              contact channel the audit cannot be arranged.
            </p>
          </div>
        )}
      </div>

      {/* 审核要求 */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-[#171717]">Audit scope</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            Audit type
            <select className={field} value={auditType} onChange={(e) => setAuditType(e.target.value)}>
              {AUDIT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Standard / protocol
            <input
              className={field}
              placeholder="e.g. SMETA 4P, ISO 9001, client checklist"
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
            />
          </label>
          <label className={label}>
            Product / scope
            <input className={field} value={product} onChange={(e) => setProduct(e.target.value)} />
          </label>
          <label className={label}>
            Preferred date
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className={label}>
            Preferred window (if no fixed date)
            <input
              className={field}
              placeholder="e.g. week of 24 Nov"
              value={window}
              onChange={(e) => setWindow(e.target.value)}
            />
          </label>
          <label className={label}>
            Buyer company
            <input className={field} value={buyerCompany} onChange={(e) => setBuyerCompany(e.target.value)} />
          </label>
          <label className={label}>
            Buyer email
            <input className={field} value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
          </label>
          <label className={label}>
            Buyer country
            <input className={field} value={buyerCountry} onChange={(e) => setBuyerCountry(e.target.value)} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Special requirements
            <textarea
              className={`${field} textarea`}
              rows={3}
              value={special}
              onChange={(e) => setSpecial(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Creating…" : "Create audit"}
        </button>
        <span className="text-xs text-[#6d6b66]">
          Created as <code>requested</code>. No email is sent to the buyer — this is an internal entry.
        </span>
      </div>
    </form>
  );
}
