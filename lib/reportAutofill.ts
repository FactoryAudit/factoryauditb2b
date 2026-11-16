// lib/reportAutofill.ts —— 报告正文「从档案预填」+「一键生成」
//
// 目标（2026-11-16 用户明确）：供应商填表 → 平台审核 → **导出报告直接可用**。
//
// 现实约束：13 章报告共 40 个字段，而自评基础档案只有 14 题，且股权穿透/涉诉/
// 税务评级/现场核验这些**平台没有数据源**。所以本模块的策略是「三分法」：
//   ① 有数据源 → 填值，证据分级记「企业自报」(reported)
//   ② 平台核验产出（涉诉/税务/现场核验）→ 不猜，标「无记录」(none)
//   ③ 供应商本该填但题库还没覆盖的 → 同样标「无记录」，等题库扩展后自动补上
//
// 🔴 绝不编造：没有数据源的字段一律 none，绝不写「无异常」「合规」这类结论。
// 🔴 只填空字段：已有值（人工录入）绝不覆盖。

import { SECTIONS } from "./standardReport";

export type AutofillSource =
  | "supplier" // suppliers 表
  | "SP03"
  | "SP04"
  | "SP05"
  | "SP06"
  | "SP07"
  | "SP08"
  | "SP09"
  | "SP10"
  | "SP11"
  | "SP12"
  | "SP13"
  | "SP14"
  | "authorized" // 档案展示授权（布尔）
  | "none"; // 无数据源 ⇒ 渲染为「无记录」

export type AutofillCandidate = {
  sectionNo: string;
  /** 字段中文标签（与 standardReport.ts 的 label.zh 一致，用作匹配键） */
  labelZh: string;
  /** 有则填，无则空串 */
  value: string;
  source: AutofillSource;
};

export type AutofillSupplier = {
  legal_name?: string | null;
  established?: number | null;
  business_type?: string | null;
  export_markets?: string[] | null;
  employees?: string | null;
  contact_email?: string | null;
  main_products?: string[] | null;
  certifications?: string[] | null;
  profile_authorized?: boolean | null;
};

/** 企业类型枚举 → 报告里的中文表述 */
const BUSINESS_TYPE_ZH: Record<string, string> = {
  factory: "自产制造",
  trading: "贸易",
  both: "自产 + 贸易",
  other: "其他",
};

function str(v: unknown): string {
  if (Array.isArray(v)) return v.filter(Boolean).join("、");
  if (v == null) return "";
  return String(v).trim();
}

/** 取值器：键 = `${章节号}|${中文字段标签}` */
type Provider = (s: AutofillSupplier, r: Record<string, unknown>) => AutofillCandidate["value"];
type SourceOf = Exclude<AutofillSource, "none">;

const RULES: Array<{ key: string; source: SourceOf; get: Provider }> = [
  // ── 02 主体档案 ──
  { key: "02|企业名称", source: "supplier", get: (s) => str(s.legal_name) },
  { key: "02|统一社会信用代码", source: "SP03", get: (_s, r) => str(r.SP03) },
  { key: "02|成立年份", source: "SP05", get: (s, r) => str(s.established) || str(r.SP05) },
  {
    key: "02|企业类型",
    source: "SP04",
    get: (s, r) => {
      const raw = str(s.business_type) || str(r.SP04);
      return BUSINESS_TYPE_ZH[raw] ?? raw;
    },
  },
  { key: "02|注册地址", source: "SP06", get: (_s, r) => str(r.SP06) },

  // ── 06 税务与进出口（只有出口市场有源）──
  { key: "06|主要出口市场", source: "SP12", get: (s, r) => str(s.export_markets) || str(r.SP12) },

  // ── 09 生产能力 ──
  { key: "09|员工总数", source: "SP08", get: (s, r) => str(s.employees) || str(r.SP08) },
  { key: "09|厂房面积", source: "SP09", get: (_s, r) => str(r.SP09) },
  { key: "09|生产线数量", source: "SP10", get: (_s, r) => str(r.SP10) },

  // ── 11 出口与市场 ──
  { key: "11|主要出口市场", source: "SP12", get: (s, r) => str(r.SP12) || str(s.export_markets) },

  // ── 12 联系方式与授权 ──
  { key: "12|邮箱", source: "supplier", get: (s) => str(s.contact_email) },
  {
    key: "12|资料展示授权",
    source: "authorized",
    get: (s) =>
      s.profile_authorized === true ? "已授权 / Authorised" : "",
  },
];

/**
 * 生成**全部 40 个字段**的预填状态（含无数据源的 none）。
 * 返回顺序与 doc.sections 的字段顺序一致，方便 UI 展示「40 项中 N 项可填」。
 */
export function buildReportAutofill(
  supplier: AutofillSupplier,
  responses: Record<string, unknown> | null | undefined
): AutofillCandidate[] {
  const r = responses ?? {};
  const ruleByKey = new Map(RULES.map((x) => [x.key, x]));
  const out: AutofillCandidate[] = [];

  for (const sec of SECTIONS) {
    const fields = (sec as unknown as { fields?: Array<{ label: { zh: string } }> }).fields ?? [];
    for (const f of fields) {
      const labelZh = f.label.zh;
      const rule = ruleByKey.get(`${sec.no}|${labelZh}`);
      const value = rule ? String(rule.get(supplier, r) ?? "").trim() : "";
      out.push({
        sectionNo: sec.no,
        labelZh,
        value,
        source: value ? rule!.source : "none",
      });
    }
  }
  return out;
}

/** 统计：可填 / 无数据源 */
export function autofillStats(list: AutofillCandidate[]): { fillable: number; empty: number; total: number } {
  const fillable = list.filter((x) => x.value).length;
  return { fillable, empty: list.length - fillable, total: list.length };
}

/** 来源的展示文案（中/英） */
export const AUTOFILL_SOURCE_LABEL: Record<AutofillSource, { zh: string; en: string }> = {
  supplier: { zh: "供应商档案", en: "Supplier record" },
  SP03: { zh: "自评 SP03", en: "SAQ SP03" },
  SP04: { zh: "自评 SP04", en: "SAQ SP04" },
  SP05: { zh: "自评 SP05", en: "SAQ SP05" },
  SP06: { zh: "自评 SP06", en: "SAQ SP06" },
  SP07: { zh: "自评 SP07", en: "SAQ SP07" },
  SP08: { zh: "自评 SP08", en: "SAQ SP08" },
  SP09: { zh: "自评 SP09", en: "SAQ SP09" },
  SP10: { zh: "自评 SP10", en: "SAQ SP10" },
  SP11: { zh: "自评 SP11", en: "SAQ SP11" },
  SP12: { zh: "自评 SP12", en: "SAQ SP12" },
  SP13: { zh: "自评 SP13", en: "SAQ SP13" },
  SP14: { zh: "自评 SP14", en: "SAQ SP14" },
  authorized: { zh: "档案授权状态", en: "Profile authorisation" },
  none: { zh: "无数据源", en: "No data source" },
};

/** 目前**没有数据源**的字段清单（用于后台提示「还需人工/核验补哪些」） */
export function fieldsWithoutSource(list: AutofillCandidate[]): AutofillCandidate[] {
  return list.filter((x) => !x.value);
}
