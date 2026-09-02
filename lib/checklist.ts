export interface AuditQuestion {
  /** 稳定标识符，供 i18n 按 key 查字典；en 值即英文文案 */
  key: string;
  category: string;
  question: string;
  evidenceRequired: string;
  riskLevel: "Low" | "Medium" | "High";
}

const BASE: AuditQuestion[] = [
  { key: "q_biz_license", category: "Legal", question: "Business license valid and matches registered address?", evidenceRequired: "Business Registration", riskLevel: "High" },
  { key: "q_ownership", category: "Legal", question: "Ownership and legal representative verified?", evidenceRequired: "Legal Entity Docs", riskLevel: "Medium" },
  { key: "q_qm_org", category: "Management", question: "Quality manual and organizational chart available?", evidenceRequired: "Organization Chart", riskLevel: "Medium" },
  { key: "q_capacity_output", category: "Production", question: "Production capacity matches stated output?", evidenceRequired: "Capacity Records", riskLevel: "Medium" },
  { key: "q_incoming_qc", category: "QC", question: "Incoming material inspection process defined?", evidenceRequired: "QC Records", riskLevel: "High" },
  { key: "q_final_qc", category: "QC", question: "Final inspection and defect rate tracked?", evidenceRequired: "Inspection Reports", riskLevel: "High" }
];

const INDUSTRY_EXTRA: Record<string, AuditQuestion[]> = {
  Electronics: [
    { key: "q_esd", category: "Technical", question: "ESD protection and soldering process control?", evidenceRequired: "Process Docs", riskLevel: "High" },
    { key: "q_rohs", category: "Compliance", question: "RoHS / REACH documentation for exports?", evidenceRequired: "Test Reports", riskLevel: "High" }
  ],
  Textiles: [
    { key: "q_oekotex", category: "Compliance", question: "OEKO-TEX / restricted substance compliance?", evidenceRequired: "Test Reports", riskLevel: "High" },
    { key: "q_labor_hr", category: "Social", question: "Working hours and wage records reviewed?", evidenceRequired: "HR Records", riskLevel: "Medium" }
  ],
  Chemicals: [
    { key: "q_msds", category: "Environmental", question: "MSDS and chemical handling procedures?", evidenceRequired: "MSDS", riskLevel: "High" },
    { key: "q_ppe", category: "Safety", question: "Emergency response and PPE compliance?", evidenceRequired: "Safety Records", riskLevel: "High" }
  ],
  Plastics: [
    { key: "q_waste", category: "Environmental", question: "Waste and emission control documented?", evidenceRequired: "Environmental Permit", riskLevel: "Medium" }
  ],
  Food: [
    { key: "q_haccp", category: "Food Safety", question: "HACCP / ISO 22000 implemented?", evidenceRequired: "Certificates", riskLevel: "High" }
  ]
};

const TYPE_EXTRA: Record<string, AuditQuestion[]> = {
  "Social Compliance Audit": [
    { key: "q_child_labor", category: "Labor", question: "No child / forced labor indicators?", evidenceRequired: "Worker Interviews", riskLevel: "High" },
    { key: "q_ohs", category: "Health", question: "Occupational health & safety measures?", evidenceRequired: "Site Observation", riskLevel: "High" }
  ],
  "Environmental Audit": [
    { key: "q_wastewater", category: "Environmental", question: "Wastewater and emissions monitored?", evidenceRequired: "Permits", riskLevel: "High" }
  ],
  "Production Capacity Audit": [
    { key: "q_equip_util", category: "Capacity", question: "Equipment list and utilization rate?", evidenceRequired: "Equipment Log", riskLevel: "Medium" }
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
