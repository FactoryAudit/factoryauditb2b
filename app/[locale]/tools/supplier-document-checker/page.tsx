"use client";
import { useState } from "react";

interface Field { name: string; status: string; note?: string; }
export default function DocumentCheckerPage() {
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<Field[] | null>(null);

  function check() {
    const t = text.toLowerCase();
    const ids: Field[] = [
      { name: "Company Name", status: t.includes("company") || t.includes("co.,") || t.includes("ltd") ? "FOUND" : "MISSING" },
      { name: "Address", status: t.includes("address") ? "FOUND" : "MISSING" },
      { name: "Legal Entity", status: t.includes("legal") || t.includes("registered") ? "FOUND" : "MISSING" },
      { name: "Certificate No.", status: t.includes("certificate no") || t.includes("cert no") ? "FOUND" : "MISSING" },
      { name: "Issue Date", status: /\d{4}/.test(t) ? "FOUND" : "MISSING" },
      { name: "Expiry Date", status: t.includes("expiry") || t.includes("valid") || t.includes("expire") ? "FOUND" : "MISSING" },
      { name: "Scope", status: t.includes("scope") ? "FOUND" : "NEED REVIEW" }
    ];
    const found = ids.filter((i) => i.status === "FOUND").length;
    const score = Math.round((found / ids.length) * 100);
    setChecks([{ name: `Consistency Score: ${score}/100`, status: "", note: "" }, ...ids]);
  }

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold text-[#0f172a]">Supplier Document Checker</h1>
      <p className="text-[#64748b] mt-2 mb-6">Checks document information consistency and validity fields. It verifies internal consistency only — it does NOT confirm certification by any official body.</p>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6 space-y-3">
          <label className="text-sm font-medium">Paste ISO certificate + Business License text</label>
          <textarea className="textarea h-64" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary w-full" onClick={check}>Check Consistency</button>
        </div>
        <div className="card p-6">
          {!checks ? <div className="text-[#94a3b8] text-sm">Paste documents and run the check.</div> : (
            <div className="space-y-2">
              {checks.map((c, i) => (
                <div key={i} className="flex justify-between border-b border-[#e2e8f0] py-2 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className={c.status === "MISSING" ? "text-[#c0392b]" : c.status === "NEED REVIEW" ? "text-[#a86a13]" : "text-[#1f7a36]"}>{c.status || c.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
