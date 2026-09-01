export const COUNTRIES = [
  { code: "china", name: "China", cn: "中国" },
  { code: "vietnam", name: "Vietnam" },
  { code: "thailand", name: "Thailand" },
  { code: "india", name: "India" },
  { code: "indonesia", name: "Indonesia" },
  { code: "bangladesh", name: "Bangladesh" },
  { code: "malaysia", name: "Malaysia" },
  { code: "turkey", name: "Turkey" },
  { code: "mexico", name: "Mexico" }
];

export const INDUSTRIES = [
  "Electronics", "Textiles", "Garments", "Furniture", "Chemicals",
  "Plastics", "Automotive", "Machinery", "Medical Devices", "Food", "Packaging", "Jewelry"
];

export const STANDARDS = [
  { code: "iso-9001", name: "ISO 9001 — Quality Management" },
  { code: "iso-14001", name: "ISO 14001 — Environmental" },
  { code: "iso-45001", name: "ISO 45001 — Occupational Health & Safety" },
  { code: "smeta", name: "SMETA (Sedex) — Note: performed by Sedex-approved audit companies" },
  { code: "sa8000", name: "SA8000 — Social Accountability" },
  { code: "rba", name: "RBA — Responsible Business Alliance" },
  { code: "grs", name: "GRS — Global Recycled Standard" }
];

export type EvidenceStatus = "Verified" | "Self-Reported" | "Estimated" | "Not Verified";

// MOCK_SUPPLIERS / getSupplier 已于 2026-09-01 移除：无人引用，且其 riskScore 仍是 V1.1 之前的旧语义（低分=低风险），
// 与现行「分数越高=风险越低」冲突。供应商数据唯一来源是 lib/staticData.ts 的 STATIC_SUPPLIERS。
