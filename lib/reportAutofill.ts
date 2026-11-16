// lib/reportAutofill.ts —— 报告正文「从档案预填」
//
// 为什么需要：13 章报告里有一批字段其实**平台已经有数据**（供应商档案 + 自评问卷），
// 但编辑器从空白模板起步，运营只能手工再抄一遍。这里把「能确定的」自动带过去，
// 「必须人工判断的」（股权穿透、涉诉、工商变更、税务评级、现场核验结论）**一律不填** ——
// 系统没有数据源，填了就是编造，直接违反反伪造铁律。
//
// 🔴 纯函数、无服务端依赖，供编辑器客户端直接调用。
// 🔴 只填**空字段**：已有值绝不覆盖（人工录入优先于自动预填）。

export type AutofillSource =
  | "supplier" // 来自 suppliers 表
  | "SP03"
  | "SP04"
  | "SP05"
  | "SP06"
  | "SP08"
  | "SP09"
  | "SP10"
  | "SP12";

export type AutofillCandidate = {
  /** 章节号，如 "02" */
  sectionNo: string;
  /** 字段中文标签（与 standardReport.ts 的 label.zh 一致，用作匹配键） */
  labelZh: string;
  value: string;
  /** 来源标识，UI 里显示「来自自评 SP03」之类 */
  source: AutofillSource;
};

export type AutofillSupplier = {
  legal_name?: string | null;
  established?: number | null;
  business_type?: string | null;
  export_markets?: string[] | null;
  employees?: string | null;
  contact_email?: string | null;
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

/**
 * 生成预填候选。**只返回有值的项**，空值不返回（避免把「无数据」写成「空字符串」占位）。
 */
export function buildReportAutofill(
  supplier: AutofillSupplier,
  responses: Record<string, unknown> | null | undefined
): AutofillCandidate[] {
  const r = responses ?? {};
  const out: AutofillCandidate[] = [];

  const push = (sectionNo: string, labelZh: string, value: string, source: AutofillSource) => {
    const v = value.trim();
    if (v) out.push({ sectionNo, labelZh, value: v, source });
  };

  // ── 02 主体档案 ──
  push("02", "企业名称", str(supplier.legal_name), "supplier");
  push("02", "统一社会信用代码", str(r.SP03), "SP03");
  push("02", "成立年份", str(supplier.established) || str(r.SP05), "SP05");
  const btRaw = str(supplier.business_type) || str(r.SP04);
  push("02", "企业类型", BUSINESS_TYPE_ZH[btRaw] ?? btRaw, "SP04");
  push("02", "注册地址", str(r.SP06), "SP06");

  // ── 06 税务与进出口（只带出口市场；纳税评级/海关编码必须人工核） ──
  push("06", "主要出口市场", str(supplier.export_markets) || str(r.SP12), "SP12");

  // ── 09 生产能力（只带可量化字段；月产量/年产能/产能核验必须人工核） ──
  push("09", "员工总数", str(supplier.employees) || str(r.SP08), "SP08");
  push("09", "厂房面积", str(r.SP09), "SP09");
  push("09", "生产线数量", str(r.SP10), "SP10");

  // ── 11 出口与市场 ──
  push("11", "主要出口市场", str(r.SP12) || str(supplier.export_markets), "SP12");

  // ── 12 联系方式与授权 ──
  // ⚠️ 只带平台已有的联系邮箱；联系人姓名/电话平台没有，不猜。
  push("12", "邮箱", str(supplier.contact_email), "supplier");

  return out;
}

/** 来源的展示文案（中/英） */
export const AUTOFILL_SOURCE_LABEL: Record<AutofillSource, { zh: string; en: string }> = {
  supplier: { zh: "供应商档案", en: "Supplier record" },
  SP03: { zh: "自评 SP03 信用代码", en: "SAQ SP03 credit code" },
  SP04: { zh: "自评 SP04 企业类型", en: "SAQ SP04 company type" },
  SP05: { zh: "自评 SP05 成立年份", en: "SAQ SP05 year established" },
  SP06: { zh: "自评 SP06 工厂地址", en: "SAQ SP06 site address" },
  SP08: { zh: "自评 SP08 员工人数", en: "SAQ SP08 headcount" },
  SP09: { zh: "自评 SP09 建筑面积", en: "SAQ SP09 floor area" },
  SP10: { zh: "自评 SP10 产线数量", en: "SAQ SP10 production lines" },
  SP12: { zh: "自评 SP12 出口市场", en: "SAQ SP12 export markets" },
};
