// 供应商风险引擎（PRD §9–19）
// 六维 0–100 风险模型，权重可配置、可解释、可追踪。
//
// 本文件只保留「结构与评分逻辑」，所有展示文案由字典提供（i18n/dictionaries/*.json）。
// 这是项目的单一事实来源约定：文案改一处（字典）即全站生效，多语言只需换字典。

export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "CRITICAL";

export const LEVEL_SCORE: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 25,
  ELEVATED: 50,
  HIGH: 75,
  CRITICAL: 100,
};

// 总体分桶（§10）
export function overallLevel(score: number): RiskLevel {
  if (score <= 20) return "LOW";
  if (score <= 40) return "MODERATE";
  if (score <= 60) return "ELEVATED";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

/** 结构层：只有题目与选项的风险等级，没有任何展示文案 */
export interface StructOption {
  value: string;
  risk: RiskLevel;
}

export interface StructQuestion {
  id: string;
  options: StructOption[];
}

export interface StructDimension {
  key: string;
  weight: number; // 占总分百分比，六维合计 100
  questions: StructQuestion[];
}

export const DIMENSION_STRUCTURE: StructDimension[] = [
  {
    key: "company",
    weight: 15,
    questions: [
      {
        id: "company_years",
        options: [
          { value: "10plus", risk: "LOW" },
          { value: "5to10", risk: "LOW" },
          { value: "3to5", risk: "MODERATE" },
          { value: "1to2", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "company_address",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "company_type",
        options: [
          { value: "manufacturer", risk: "LOW" },
          { value: "both", risk: "MODERATE" },
          { value: "trading", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "company_ownership",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
    ],
  },
  {
    key: "quality",
    weight: 20,
    questions: [
      {
        id: "quality_qms",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "quality_audit",
        options: [
          { value: "within12", risk: "LOW" },
          { value: "within3y", risk: "MODERATE" },
          { value: "older", risk: "ELEVATED" },
          { value: "never", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "quality_incoming",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "quality_records",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
    ],
  },
  {
    key: "compliance",
    weight: 20,
    questions: [
      {
        id: "comp_social",
        options: [
          { value: "comprehensive", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "none", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "comp_env",
        options: [
          { value: "comprehensive", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "none", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "comp_product",
        options: [
          { value: "inplace", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "missing", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "comp_ethics",
        options: [
          { value: "documented", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "none", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
    ],
  },
  {
    key: "production",
    weight: 15,
    questions: [
      {
        id: "prod_capacity",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "prod_subcontract",
        options: [
          { value: "no", risk: "LOW" },
          { value: "partial", risk: "HIGH" },
          { value: "yes", risk: "CRITICAL" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "prod_experience",
        options: [
          { value: "strong", risk: "LOW" },
          { value: "moderate", risk: "MODERATE" },
          { value: "limited", risk: "HIGH" },
          { value: "none", risk: "CRITICAL" },
        ],
      },
    ],
  },
  {
    key: "supplychain",
    weight: 15,
    questions: [
      {
        id: "sc_material",
        options: [
          { value: "stable", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "unstable", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "sc_single",
        options: [
          { value: "low", risk: "LOW" },
          { value: "moderate", risk: "MODERATE" },
          { value: "high", risk: "HIGH" },
        ],
      },
      {
        id: "sc_leadtime",
        options: [
          { value: "low", risk: "LOW" },
          { value: "moderate", risk: "MODERATE" },
          { value: "high", risk: "HIGH" },
        ],
      },
    ],
  },
  {
    key: "documentation",
    weight: 15,
    questions: [
      {
        id: "doc_registration",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "doc_address",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "doc_certificates",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
      {
        id: "doc_test",
        options: [
          { value: "yes", risk: "LOW" },
          { value: "partial", risk: "MODERATE" },
          { value: "no", risk: "HIGH" },
          { value: "unknown", risk: "ELEVATED" },
        ],
      },
    ],
  },
];

export const TOTAL_WEIGHT = DIMENSION_STRUCTURE.reduce((a, d) => a + d.weight, 0); // 100

export const ALL_QUESTIONS = DIMENSION_STRUCTURE.flatMap((d) => d.questions);
export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;

// ---------- 本地化内容（由字典提供） ----------

export interface RiskContent {
  dimensions: Record<string, { label: string; short: string; description: string }>;
  questions: Record<string, string>;
  options: Record<string, Record<string, string>>;
  factors: Record<string, string>;
  recommendations: Record<RiskLevel, string[]>;
  ctas: Record<RiskLevel, { headline: string; primary: string; secondary?: string }>;
  levelLabels: Record<RiskLevel, string>;
}

// ---------- 组合后的结果类型 ----------

export interface LocalizedOption {
  value: string;
  label: string;
  risk: RiskLevel;
}

export interface LocalizedQuestion {
  id: string;
  text: string;
  options: LocalizedOption[];
}

export interface LocalizedDimension {
  key: string;
  weight: number;
  label: string;
  short: string;
  description: string;
  questions: LocalizedQuestion[];
}

export interface DimensionResult {
  key: string;
  label: string;
  short: string;
  weight: number;
  score: number;
  level: RiskLevel;
  levelLabel: string;
  answers: { questionId: string; text: string; optionLabel: string; risk: RiskLevel }[];
}

export interface RiskEngineResult {
  overall: number;
  level: RiskLevel;
  levelLabel: string;
  dimensions: DimensionResult[];
  keyRiskFactors: string[];
  recommendations: string[];
  cta: { headline: string; primary: string; secondary?: string };
}

/** 结构 + 字典文案 → 供 UI 渲染的维度列表 */
export function buildDimensions(content: RiskContent): LocalizedDimension[] {
  return DIMENSION_STRUCTURE.map((dim) => ({
    key: dim.key,
    weight: dim.weight,
    label: content.dimensions[dim.key]?.label ?? dim.key,
    short: content.dimensions[dim.key]?.short ?? dim.key,
    description: content.dimensions[dim.key]?.description ?? "",
    questions: dim.questions.map((q) => ({
      id: q.id,
      text: content.questions[q.id] ?? q.id,
      options: q.options.map((o) => ({
        value: o.value,
        risk: o.risk,
        label: content.options[q.id]?.[o.value] ?? o.value,
      })),
    })),
  }));
}

/** 计算风险结果；文案全部取自传入的 content */
export function computeRisk(
  answers: Record<string, string>,
  content: RiskContent
): RiskEngineResult {
  const dims = buildDimensions(content);

  const dimensions: DimensionResult[] = dims.map((dim) => {
    const ans = dim.questions.map((q) => {
      const chosen = answers[q.id];
      const opt = q.options.find((o) => o.value === chosen);
      return {
        questionId: q.id,
        text: q.text,
        optionLabel: opt?.label ?? "—",
        risk: opt?.risk ?? ("ELEVATED" as RiskLevel),
      };
    });
    const avg =
      ans.reduce((a, x) => a + LEVEL_SCORE[x.risk], 0) / Math.max(1, dim.questions.length);
    const score = Math.round(avg);
    const level = overallLevel(score);
    return {
      key: dim.key,
      label: dim.label,
      short: dim.short,
      weight: dim.weight,
      score,
      level,
      levelLabel: content.levelLabels[level],
      answers: ans,
    };
  });

  const overall = Math.round(
    dimensions.reduce((a, d) => a + d.score * d.weight, 0) / TOTAL_WEIGHT
  );
  const level = overallLevel(overall);

  // 关键风险因子：选中的选项为 HIGH/CRITICAL，且该题在字典里配了 factor 文案
  const keyRiskFactors: string[] = [];
  for (const q of ALL_QUESTIONS) {
    const chosen = answers[q.id];
    if (!chosen) continue;
    const opt = q.options.find((o) => o.value === chosen);
    if (opt && (opt.risk === "HIGH" || opt.risk === "CRITICAL") && content.factors[q.id]) {
      keyRiskFactors.push(content.factors[q.id]);
    }
  }

  return {
    overall,
    level,
    levelLabel: content.levelLabels[level],
    dimensions,
    keyRiskFactors,
    recommendations: content.recommendations[level] ?? [],
    cta: content.ctas[level],
  };
}

// 风险等级统一视觉（§65）
export const LEVEL_COLOR: Record<RiskLevel, string> = {
  LOW: "#1f7a36",
  MODERATE: "#a86a13",
  ELEVATED: "#c0772b",
  HIGH: "#d4232a",
  CRITICAL: "#9b1c1c",
};
