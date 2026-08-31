export type EvidenceStatus = "Verified" | "Self-Reported" | "Estimated" | "Not Verified";

export interface RiskInput {
  supplierName: string;
  website: string;
  country: string;
  city: string;
  productCategory: string;
  businessType: string; // "Factory" | "Trading Company"
  yearsInBusiness: number; // 0 if unknown
  employeeRange: string; // e.g. "101-500"
  exportMarkets: string; // comma separated
  hasBusinessLicense: boolean;
  hasIso: boolean;
  hasAuditReport: boolean;
  hasCatalog: boolean;
  hasProductCert: boolean;
}

export interface RiskDimension {
  key: string;
  label: string;
  score: number;
  status: EvidenceStatus;
}

export interface RiskResult {
  overall: number;
  level: "Critical" | "High" | "Medium" | "Low" | "Very Low";
  dimensions: RiskDimension[];
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function empScore(range: string): number {
  const map: Record<string, number> = {
    "1-50": 55, "51-100": 65, "101-200": 75, "201-500": 82, "501-1000": 88, "1000+": 92
  };
  return map[range] ?? 50;
}

export function computeRisk(input: RiskInput): RiskResult {
  // Transparent, evidence-based heuristics — NOT a substitute for official verification.
  const hasName = !!input.supplierName.trim();
  const hasWeb = !!input.website.trim();
  const hasYears = input.yearsInBusiness > 0;
  const hasMarket = !!input.exportMarkets.trim();

  const companyVerification = clamp(
    (hasName ? 30 : 0) + (hasWeb ? 35 : 0) + (hasYears ? Math.min(input.yearsInBusiness, 30) : 0) + (input.hasBusinessLicense ? 20 : 0)
  );
  const factoryCapability = clamp(
    (input.businessType === "Factory" ? 70 : 45) + (input.hasCatalog ? 20 : 0) + (empScore(input.employeeRange) - 50) * 0.5
  );
  const qualitySystem = input.hasIso ? 82 : 40;
  const certification = input.hasProductCert ? 71 : 45;
  const productionCapacity = empScore(input.employeeRange);
  const compliance = clamp((hasMarket ? 35 : 0) + (hasYears ? 25 : 0) + (input.hasAuditReport ? 20 : 0));
  const transparency = clamp(
    [hasName, hasWeb, hasYears, hasMarket, input.hasBusinessLicense, input.hasIso, input.hasAuditReport, input.hasCatalog, input.hasProductCert]
      .filter(Boolean).length * 11
  );
  const supplyChainRisk = clamp((input.country ? 70 : 0) + (hasMarket ? 10 : -20) + (input.hasAuditReport ? 13 : 0));

  const dimensions: RiskDimension[] = [
    { key: "company", label: "Company Verification", score: companyVerification, status: input.hasBusinessLicense ? "Verified" : hasWeb ? "Self-Reported" : "Not Verified" },
    { key: "capability", label: "Factory Capability", score: factoryCapability, status: input.businessType === "Factory" ? "Self-Reported" : "Not Verified" },
    { key: "quality", label: "Quality System", score: qualitySystem, status: input.hasIso ? "Self-Reported" : "Not Verified" },
    { key: "certification", label: "Certification", score: certification, status: input.hasProductCert ? "Self-Reported" : "Not Verified" },
    { key: "capacity", label: "Production Capacity", score: productionCapacity, status: input.employeeRange ? "Self-Reported" : "Not Verified" },
    { key: "compliance", label: "Compliance", score: compliance, status: input.hasAuditReport ? "Verified" : "Estimated" },
    { key: "transparency", label: "Transparency", score: transparency, status: "Self-Reported" },
    { key: "supplychain", label: "Supply Chain Risk", score: supplyChainRisk, status: "Estimated" }
  ];

  const overall = clamp(dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length);
  let level: RiskResult["level"];
  if (overall < 40) level = "Critical";
  else if (overall < 60) level = "High";
  else if (overall < 75) level = "Medium";
  else if (overall < 90) level = "Low";
  else level = "Very Low";

  return { overall, level, dimensions };
}
