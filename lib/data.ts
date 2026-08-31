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

export const MOCK_SUPPLIERS = [
  {
    slug: "shenzhen-precision-electronics",
    legalName: "Shenzhen Precision Electronics Co., Ltd.",
    country: "china",
    city: "Shenzhen",
    businessType: "Manufacturer",
    established: 2009,
    employees: "201-500",
    mainProducts: ["Consumer Electronics", "PCB Assembly", "Smart Home Devices"],
    exportMarkets: ["USA", "Germany", "Japan"],
    verificationStatus: "Factory Verified",
    riskScore: 78,
    riskLevel: "Medium",
    certifications: ["ISO 9001", "ISO 14001", "CE"],
    auditStatus: "Audited 2026-06",
    inspectionHistory: 42
  },
  {
    slug: "guangzhou-textile-factory",
    legalName: "Guangzhou Sunrise Textile Co., Ltd.",
    country: "china",
    city: "Guangzhou",
    businessType: "Manufacturer",
    established: 2014,
    employees: "501-1000",
    mainProducts: ["Garments", "Fabrics", "Apparel"],
    exportMarkets: ["USA", "UK", "Australia"],
    verificationStatus: "Document Verified",
    riskScore: 72,
    riskLevel: "Medium",
    certifications: ["OEKO-TEX", "BSCI"],
    auditStatus: "Audited 2026-03",
    inspectionHistory: 28
  },
  {
    slug: "dongguan-plastic-molding",
    legalName: "Dongguan Hengda Plastics Co., Ltd.",
    country: "china",
    city: "Dongguan",
    businessType: "Manufacturer",
    established: 2017,
    employees: "101-200",
    mainProducts: ["Injection Molding", "Plastic Components"],
    exportMarkets: ["USA", "Vietnam"],
    verificationStatus: "Identity Verified",
    riskScore: 65,
    riskLevel: "Medium",
    certifications: ["ISO 9001"],
    auditStatus: "Not yet audited",
    inspectionHistory: 9
  }
];

export function getSupplier(slug: string) {
  return MOCK_SUPPLIERS.find((s) => s.slug === slug);
}
