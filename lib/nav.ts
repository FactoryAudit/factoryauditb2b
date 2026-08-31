// 主导航「Services」下拉菜单的单一事实来源。
// 组件、页脚、站点地图、llms.txt 都从这里取，避免各处硬编码 href 造成死链。

export interface ServiceMenuItem {
  key:
    | "verification"
    | "factoryAudit"
    | "inspection"
    | "sourcing"
    | "improvement";
  href: string;
  descKey:
    | "verificationDesc"
    | "factoryAuditDesc"
    | "inspectionDesc"
    | "sourcingDesc"
    | "improvementDesc";
}

export const SERVICE_MENU: ServiceMenuItem[] = [
  { key: "verification", href: "/services/supplier-verification", descKey: "verificationDesc" },
  { key: "factoryAudit", href: "/factory-audit/request", descKey: "factoryAuditDesc" },
  { key: "inspection", href: "/services/inspection", descKey: "inspectionDesc" },
  { key: "sourcing", href: "/rfq", descKey: "sourcingDesc" },
  { key: "improvement", href: "/services/supplier-improvement", descKey: "improvementDesc" },
];

export type ServiceMenuDict = {
  verification: string;
  verificationDesc: string;
  factoryAudit: string;
  factoryAuditDesc: string;
  inspection: string;
  inspectionDesc: string;
  sourcing: string;
  sourcingDesc: string;
  improvement: string;
  improvementDesc: string;
};

/** 工具排序（PRD §10）：风险计算器为旗舰，其后按商业价值排列。
 *  Logistics 的装柜计算器不在此列 —— 它不是供应商评估工具。 */
export interface ToolEntry {
  cardKey:
    | "riskCalculator"
    | "verificationChecklist"
    | "riskAssessment"
    | "supplierScorecard"
    | "auditChecklist"
    | "documentChecker"
    | "auditReportAnalyzer";
  href: string;
}

export const TOOL_ORDER: ToolEntry[] = [
  { cardKey: "riskCalculator", href: "/tools/supplier-risk-calculator" },
  { cardKey: "verificationChecklist", href: "/tools/supplier-verification-checklist" },
  { cardKey: "riskAssessment", href: "/tools/supplier-risk-assessment" },
  { cardKey: "supplierScorecard", href: "/tools/supplier-scorecard" },
  { cardKey: "auditChecklist", href: "/tools/audit-checklist" },
  { cardKey: "documentChecker", href: "/tools/supplier-document-checker" },
  { cardKey: "auditReportAnalyzer", href: "/tools/audit-report-analyzer" },
];
