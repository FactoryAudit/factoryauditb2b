"use client";
import { useState } from "react";
import type { DocumentCheckerUi } from "@/lib/toolUiTypes";

interface Field { name: string; status: string; note?: string; }

export default function SupplierDocumentCheckerTool({ ui }: { ui: DocumentCheckerUi }) {
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<Field[] | null>(null);

  const FOUND = ui.statusFound;
  const MISSING = ui.statusMissing;
  const REVIEW = ui.statusReview;

  function check() {
    const t = text.toLowerCase();
    const ids: Field[] = [
      { name: ui.companyName, status: t.includes("company") || t.includes("co.,") || t.includes("ltd") ? FOUND : MISSING },
      { name: ui.address, status: t.includes("address") ? FOUND : MISSING },
      { name: ui.legalEntity, status: t.includes("legal") || t.includes("registered") ? FOUND : MISSING },
      { name: ui.certificateNo, status: t.includes("certificate no") || t.includes("cert no") ? FOUND : MISSING },
      { name: ui.issueDate, status: /\d{4}/.test(t) ? FOUND : MISSING },
      { name: ui.expiryDate, status: t.includes("expiry") || t.includes("valid") || t.includes("expire") ? FOUND : MISSING },
      { name: ui.scope, status: t.includes("scope") ? FOUND : REVIEW }
    ];
    const found = ids.filter((i) => i.status === FOUND).length;
    const score = Math.round((found / ids.length) * 100);
    setChecks([{ name: ui.scoreRow.replace("{score}", String(score)), status: "", note: "" }, ...ids]);
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="card p-6 space-y-3">
        <label className="text-sm font-medium">{ui.inputLabel}</label>
        <textarea className="textarea h-64" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary w-full" onClick={check}>{ui.cta}</button>
      </div>
      <div className="card p-6">
        {!checks ? <div className="text-[#94a3b8] text-sm">{ui.empty}</div> : (
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={i} className="flex justify-between border-b border-[#e2e8f0] py-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className={c.status === MISSING ? "text-[#c0392b]" : c.status === REVIEW ? "text-[#8a5410]" : "text-[#1f7a36]"}>{c.status || c.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
