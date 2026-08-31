// Lead Scoring —— 内部启发式评分（0–100）
// 明确声明：这是内部 heuristic，不是行业标准。
// 用途：帮助管理员按优先级跟进线索。

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "qq.com",
  "163.com",
  "126.com",
  "foxmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "msn.com",
]);

export type LeadScoreInput = {
  email?: string | null;
  company?: string | null;
  supplierWebsite?: string | null;
  riskLevel?: string | null;
  score?: number | null;
  tool?: string | null;
  sourcing?: string | null;
  product?: string | null;
  message?: string | null;
};

// 计算线索意向分 0–100
export function leadScore(input: LeadScoreInput): number {
  let score = 0;

  // +25 工作邮箱（非免费邮箱域名）
  const email = (input.email || "").trim().toLowerCase();
  if (email) {
    const domain = email.split("@")[1] || "";
    if (domain && !FREE_MAIL_DOMAINS.has(domain)) score += 25;
    else if (email) score += 8;
  }

  // +20 有公司名
  if ((input.company || "").trim().length >= 2) score += 20;

  // +15 有供应商网站
  if ((input.supplierWebsite || "").trim()) score += 15;

  // +15 高风险线索（工具结果 HIGH/CRITICAL）
  const risk = (input.riskLevel || "").toUpperCase();
  if (risk === "CRITICAL") score += 15;
  else if (risk === "HIGH") score += 12;
  else if (risk === "ELEVATED" || risk === "MODERATE") score += 6;

  // +15 高商业意图来源（申请了服务/审核）
  const tool = (input.tool || "").toLowerCase();
  if (
    tool.includes("audit") ||
    tool.includes("verification") ||
    tool.includes("custom") ||
    tool.includes("rfq") ||
    tool.includes("inspection")
  ) {
    score += 15;
  }

  // +10 提供了采购内容或详细需求
  const content = [
    input.sourcing,
    input.product,
    input.message,
  ]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .join(" ");
  if (content.length >= 10) score += 10;

  return Math.min(100, score);
}
