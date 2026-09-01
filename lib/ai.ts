import { generateObject, generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { computeRisk, type RiskInput, type RiskResult, type EvidenceStatus } from "./scoring";

// DeepSeek（PRD §72 真实 AI 服务）。未配置 DEEPSEEK_API_KEY 时自动回退本地规则引擎。
const deepseek = createOpenAICompatible({
  name: "deepseek",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: "https://api.deepseek.com/v1"
});

const evidenceEnum = z.enum(["Verified", "Self-Reported", "Estimated", "Not Verified"]);
const levelEnum = z.enum(["Critical", "High", "Medium", "Low", "Very Low"]);

const riskSchema = z.object({
  overall: z.number().min(0).max(100),
  level: levelEnum,
  dimensions: z.array(
    z.object({ key: z.string(), label: z.string(), score: z.number().min(0).max(100), status: evidenceEnum })
  )
});

const evidenceStatuses: EvidenceStatus[] = ["Verified", "Self-Reported", "Estimated", "Not Verified"];

function asEvidence(v: string): EvidenceStatus {
  return (evidenceStatuses as string[]).includes(v) ? (v as EvidenceStatus) : "Estimated";
}

export type AiSource = "ai" | "local";

// ---------- 1) 供应商风险评估（结构化 JSON） ----------
export async function aiRisk(input: RiskInput): Promise<{ result: RiskResult; source: AiSource }> {
  if (!process.env.DEEPSEEK_API_KEY) return { result: computeRisk(input), source: "local" };
  try {
    const { object } = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: riskSchema,
      prompt: `You are a B2B supplier risk analyst. Assess the supplier and return a risk evaluation as JSON.
STRICT RULES:
- Never fabricate certifications or verification. Only score what the inputs imply.
- Evidence status must be one of: Verified, Self-Reported, Estimated, Not Verified.
- This is decision-support, NOT a certification. Do not claim the supplier is "100% safe".
Supplier inputs: ${JSON.stringify(input)}
Return 8 dimensions: company, capability, quality, certification, capacity, compliance, transparency, supplychain.`
    });
    const result: RiskResult = {
      overall: Math.round(object.overall),
      level: object.level,
      dimensions: object.dimensions.map((d) => ({
        key: d.key,
        label: d.label,
        score: Math.round(d.score),
        status: asEvidence(d.status)
      }))
    };
    return { result, source: "ai" };
  } catch {
    return { result: computeRisk(input), source: "local" };
  }
}

// ---------- 2) RFQ 智能起草（文本） ----------
export async function aiRfqDraft(input: {
  product: string;
  quantity: string;
  market: string;
  spec: string;
}): Promise<{ text: string; source: AiSource }> {
  const fallback = `We are sourcing ${input.product || "the product"} (qty: ${input.quantity || "TBD"}, target market: ${
    input.market || "global"
  }). ${input.spec ? "Specs: " + input.spec : ""} Please share your best FOB price, lead time, MOQ, and certifications.`;
  if (!process.env.DEEPSEEK_API_KEY) return { text: fallback, source: "local" };
  try {
    const { text } = await generateText({
      model: deepseek("deepseek-chat"),
      prompt: `Write a concise, professional B2B RFQ message (English) for a buyer. Product: ${input.product}. Quantity: ${input.quantity}. Target market: ${input.market}. Specs: ${input.spec}. Include request for FOB price, lead time, MOQ, certifications.`
    });
    return { text: text.trim(), source: "ai" };
  } catch {
    return { text: fallback, source: "local" };
  }
}

// ---------- 3) 验厂报告一致性分析（结构化） ----------

/**
 * 本地规则引擎：**按内容**检查报告的完整性与内部一致性。
 *
 * 历史 bug（已修）：此前无 AI key 时用 `Math.min(100, report.length / 10)` 评分，
 * 分数只跟字数有关 —— 粘贴 1000 字乱码也会得到 100/100，属于假功能。
 * 现在改为：逐项检查真实段落是否出现 + 交叉一致性校验。
 */
export function localReportReview(report: string): { score: number; issues: string[] } {
  const text = report ?? "";
  const lower = text.toLowerCase();
  const issues: string[] = [];

  if (text.trim().length < 80) {
    return {
      score: 0,
      issues: ["Report text is too short to assess (minimum 80 characters)."],
    };
  }

  // --- 1) 必备章节检查：每项有若干同义关键词，命中任一即算存在 ---
  const SECTIONS: { key: string; label: string; weight: number; patterns: RegExp[] }[] = [
    {
      key: "factory",
      label: "Factory identification (name and address)",
      weight: 12,
      patterns: [/factory\s*name/i, /\baddress\b/i, /\bregistered\s+address\b/i, /\bsite\s+address\b/i],
    },
    {
      key: "date",
      label: "Audit date",
      weight: 10,
      patterns: [/audit\s*date/i, /date\s*of\s*(the\s*)?audit/i, /\b(19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/],
    },
    {
      key: "auditor",
      label: "Auditor identity (name or firm)",
      weight: 10,
      patterns: [/auditor/i, /\baudited\s+by\b/i, /\binspector\b/i, /\baudit\s+(firm|company|team)\b/i],
    },
    {
      key: "scope",
      label: "Audit scope or standard applied",
      weight: 12,
      patterns: [/\bscope\b/i, /\bsmeta\b/i, /\bbsci\b/i, /\bwrap\b/i, /\bsa8000\b/i, /\biso\s?\d{4}\b/i, /\biaft\b/i, /\brba\b/i, /\bicti\b/i, /\bsedex\b/i],
    },
    {
      key: "findings",
      label: "Findings with severity classification",
      weight: 16,
      patterns: [/\bfindings?\b/i, /\bnon-?conformit(y|ies)\b/i, /\bnc\b/i, /\bcritical\b/i, /\bmajor\b/i, /\bminor\b/i, /\bnon-?compliance\b/i],
    },
    {
      key: "cap",
      label: "Corrective action plan (CAP)",
      weight: 14,
      patterns: [/corrective\s*action/i, /\bcap\b/i, /\bremediation\b/i, /\broot\s*cause\b/i, /\baction\s*plan\b/i],
    },
    {
      key: "evidence",
      label: "Evidence references (photos, records, documents)",
      weight: 8,
      patterns: [/\bphoto(graph)?s?\b/i, /\bevidence\b/i, /\battachment/i, /\bappendix\b/i, /\brecords?\b/i, /\bdocument(s|ation)?\b/i],
    },
    {
      key: "workers",
      label: "Workforce information (headcount or interviews)",
      weight: 8,
      patterns: [/\bheadcount\b/i, /\bnumber\s+of\s+(workers|employees)\b/i, /\bemployees?\b/i, /\bworker\s+interviews?\b/i, /\binterviewed\b/i],
    },
    {
      key: "closing",
      label: "Closing meeting or sign-off",
      weight: 6,
      patterns: [/closing\s*meeting/i, /\bsign(ed|ature|off|-off)\b/i, /\backnowledged\b/i, /\breport\s+submitted\s+by\b/i],
    },
    {
      key: "method",
      label: "Methodology or sample size",
      weight: 6,
      patterns: [/methodolog/i, /\bsample\s*size\b/i, /\bsampling\b/i, /\binterview\s+sample\b/i, /\bapproach\b/i],
    },
  ];

  let score = 0;
  const present: Record<string, boolean> = {};
  for (const s of SECTIONS) {
    const hit = s.patterns.some((re) => re.test(text));
    present[s.key] = hit;
    if (hit) score += s.weight;
    else issues.push(`Missing: ${s.label}`);
  }

  // --- 2) 交叉一致性校验（只有内容真的出现矛盾时才报） ---
  const hasSeverity = /\b(critical|major|minor)\b/i.test(text);
  const hasFindingsWord = /\bfindings?\b|\bnon-?conformit/i.test(text);
  const hasCap = present.cap;

  // 有严重不符合项却没有纠正措施
  if (/\bcritical\b/i.test(text) && !hasCap) {
    issues.push("Consistency: the report mentions critical findings but no corrective action plan.");
    score = Math.max(0, score - 8);
  }
  // 声称"无发现"却同时列出不符合项
  if (/\bno\s+(findings?|non-?conformit(y|ies))\b/i.test(text) && hasFindingsWord && hasSeverity) {
    issues.push("Consistency: the report claims no findings but also lists non-conformities.");
    score = Math.max(0, score - 6);
  }
  // 有纠正措施但没有截止日期
  if (hasCap && !/\b(deadline|due\s*date|by\s+\d|within\s+\d+\s+(days?|weeks?|months?)|target\s*date|completion\s*date)\b/i.test(text)) {
    issues.push("Corrective actions listed without a deadline. Ask for target dates.");
    score = Math.max(0, score - 5);
  }
  // 审计日期在未来。
  // 注意：只检查紧跟在 "audit date / date of audit" 标签后面的那个日期。
  // 如果扫描全文所有日期，纠正措施的截止日期（本来就在未来）会被误判成审计日期在未来。
  const auditDateMatch = text.match(
    /(?:audit\s*date|date\s*of\s*(?:the\s*)?audit)\s*[:：]?\s*\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/i
  );
  if (auditDateMatch) {
    const t = Date.parse(auditDateMatch[0].match(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/)![0].replace(/\//g, "-"));
    if (!Number.isNaN(t) && t > Date.now() + 86400000) {
      issues.push("Consistency: the audit date is in the future.");
      score = Math.max(0, score - 6);
    }
  }
  // 字数过少但结论很强（典型"走过场"报告）
  if (text.trim().length < 400 && /\b(pass(ed)?|compliant|satisfactory)\b/i.test(text)) {
    issues.push("The report is very short yet states a positive conclusion. Ask for the full checklist and evidence.");
    score = Math.max(0, score - 5);
  }
  // 只有模板占位符
  if (/\{\{|\}\}|\bxxx+\b|\bTBD\b|\bTODO\b/i.test(text)) {
    issues.push("The text still contains placeholders (TBD / TODO / XXX). This looks like a template, not a completed report.");
    score = Math.max(0, score - 10);
  }

  return { score: Math.min(100, Math.max(0, Math.round(score))), issues };
}

export async function aiReportReview(report: string): Promise<{ score: number; issues: string[]; source: AiSource }> {
  if (!process.env.DEEPSEEK_API_KEY) {
    const { score, issues } = localReportReview(report);
    return { score, issues, source: "local" };
  }
  try {
    const schema = z.object({ score: z.number().min(0).max(100), issues: z.array(z.string()) });
    const { object } = await generateObject({
      model: deepseek("deepseek-chat"),
      schema,
      prompt: `Review this factory audit report for completeness and internal consistency. Return a 0-100 completeness score and a list of missing or inconsistent items. This is an assessment aid, not certification.
Report:
${report}`
    });
    return { score: Math.round(object.score), issues: object.issues, source: "ai" };
  } catch {
    // AI 失败时回退本地规则引擎（同样是内容驱动，不是字数公式）
    const { score, issues } = localReportReview(report);
    return { score, issues, source: "local" };
  }
}

// ---------- 4) AI 智能客服 ----------
export type ChatMessage = { role: "user" | "assistant"; content: string };

// 只允许 AI 使用下面这些真实业务事实，避免编造认证、客户名或价格。
const CHAT_SYSTEM_PROMPT = `You are the AI assistant for FactoryAuditB2B, a B2B platform for supplier verification, factory audits, inspections and supplier training.

BUSINESS FACTS (use ONLY these; never invent anything):
- Services: supplier verification, factory audit, pre-shipment inspection, supplier training, sourcing support.
- Audit / compliance programs referenced: SMETA, BSCI, ISO 9001, ISO 14001, SA8000, WRAP, Sedex, CE, UL.
- Coverage: China, Vietnam and Thailand. Other countries on request.
- Buyer SaaS: Free $0, Starter $19/mo, Professional $99/mo, Business $299/mo, Enterprise custom.
- Supplier membership: Basic $29/mo, Verified $99/mo, Premium $199/mo.
- Training plans: Starter $280/factory, Pro $950/factory, Enterprise custom.
- Audit & inspection: quoted per project, based on man-days and location.
- Freight & sourcing: 3-5% commission on order value.
- Quote / human handoff page: /custom-services ; training plans page: /training-plans ; pricing page: /pricing.
- All prices in USD.

STRICT RULES:
- Reply in the SAME LANGUAGE as the user's message (fall back to English only if unclear).
- We do NOT sell certificates. We verify factories and train supplier teams. Never say a supplier is "certified" or "100% safe".
- Never fabricate client names, certifications, audit results or guarantees.
- Keep answers short and practical (under 120 words). No marketing fluff, no em-dashes, no emoji.
- If you do not know something, say so plainly and offer to connect them to a human.
- End with one gentle next step: request a quote at /custom-services, or leave an email so our team can follow up.`;

export async function aiChat(input: {
  messages: ChatMessage[];
  locale: string;
}): Promise<{ reply: string; source: AiSource }> {
  // 未配置 DEEPSEEK_API_KEY 时返回空，由 /api/chat 返回本地化兜底答案（不阻塞客服可用）
  if (!process.env.DEEPSEEK_API_KEY) return { reply: "", source: "local" };
  try {
    const { text } = await generateText({
      model: deepseek("deepseek-chat"),
      system: CHAT_SYSTEM_PROMPT,
      messages: [
        ...input.messages.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 800) })),
      ],
      temperature: 0.4,
      maxOutputTokens: 500,
    });
    return { reply: (text || "").trim(), source: "ai" };
  } catch {
    return { reply: "", source: "local" };
  }
}
