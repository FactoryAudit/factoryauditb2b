export interface AuditQuestion {
  category: string;
  question: string;
  evidenceRequired: string;
  riskLevel: "Low" | "Medium" | "High";
}

const BASE: AuditQuestion[] = [
  { category: "Legal", question: "Business license valid and matches registered address?", evidenceRequired: "Business Registration", riskLevel: "High" },
  { category: "Legal", question: "Ownership and legal representative verified?", evidenceRequired: "Legal Entity Docs", riskLevel: "Medium" },
  { category: "Management", question: "Quality manual and organizational chart available?", evidenceRequired: "Organization Chart", riskLevel: "Medium" },
  { category: "Production", question: "Production capacity matches stated output?", evidenceRequired: "Capacity Records", riskLevel: "Medium" },
  { category: "QC", question: "Incoming material inspection process defined?", evidenceRequired: "QC Records", riskLevel: "High" },
  { category: "QC", question: "Final inspection and defect rate tracked?", evidenceRequired: "Inspection Reports", riskLevel: "High" }
];

const INDUSTRY_EXTRA: Record<string, AuditQuestion[]> = {
  Electronics: [
    { category: "Technical", question: "ESD protection and soldering process control?", evidenceRequired: "Process Docs", riskLevel: "High" },
    { category: "Compliance", question: "RoHS / REACH documentation for exports?", evidenceRequired: "Test Reports", riskLevel: "High" }
  ],
  Textiles: [
    { category: "Compliance", question: "OEKO-TEX / restricted substance compliance?", evidenceRequired: "Test Reports", riskLevel: "High" },
    { category: "Social", question: "Working hours and wage records reviewed?", evidenceRequired: "HR Records", riskLevel: "Medium" }
  ],
  Chemicals: [
    { category: "Environmental", question: "MSDS and chemical handling procedures?", evidenceRequired: "MSDS", riskLevel: "High" },
    { category: "Safety", question: "Emergency response and PPE compliance?", evidenceRequired: "Safety Records", riskLevel: "High" }
  ],
  Plastics: [
    { category: "Environmental", question: "Waste and emission control documented?", evidenceRequired: "Environmental Permit", riskLevel: "Medium" }
  ],
  Food: [
    { category: "Food Safety", question: "HACCP / ISO 22000 implemented?", evidenceRequired: "Certificates", riskLevel: "High" }
  ]
};

const TYPE_EXTRA: Record<string, AuditQuestion[]> = {
  "Social Compliance Audit": [
    { category: "Labor", question: "No child / forced labor indicators?", evidenceRequired: "Worker Interviews", riskLevel: "High" },
    { category: "Health", question: "Occupational health & safety measures?", evidenceRequired: "Site Observation", riskLevel: "High" }
  ],
  "Environmental Audit": [
    { category: "Environmental", question: "Wastewater and emissions monitored?", evidenceRequired: "Permits", riskLevel: "High" }
  ],
  "Production Capacity Audit": [
    { category: "Capacity", question: "Equipment list and utilization rate?", evidenceRequired: "Equipment Log", riskLevel: "Medium" }
  ]
};

export function generateChecklist(industry: string, auditType: string): AuditQuestion[] {
  const list = [...BASE];
  if (INDUSTRY_MAP[industry]) list.push(...INDUSTRY_MAP[industry]);
  if (TYPE_EXTRA[auditType]) list.push(...TYPE_EXTRA[auditType]);
  return list;
}

const INDUSTRY_MAP = INDUSTRY_EXTRA;

export const AUDIT_TYPES = [
  "Factory Verification", "Factory Audit", "Supplier Quality Audit", "Production Capacity Audit",
  "Social Compliance Audit", "Environmental Audit", "Technical Audit", "Custom Buyer Audit"
];
