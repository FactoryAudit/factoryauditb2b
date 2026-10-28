// lib/assessmentAdopt.ts —— 自评问卷基础档案（SP01..SP14）→ suppliers 表字段的采纳映射
//
// 背景（2026-10-28）：
//   供应商填完 14 项基础档案后，答案只落在 supplier_assessments.responses_json，
//   档案页（suppliers 表）仍然是空的 ⇒ 后台必须逐字手抄。本模块把能映射的字段算成
//   「当前值 vs 问卷值」对照表，后台勾选后一次性写入。
//
// 🔴 五条红线：
//   1. **问卷空值绝不覆盖档案现值**。缺失值不进 rows —— 绝不用空串/0 顶替（NULL ≠ 0）。
//   2. **证书（SP13）不自动采纳**。资质涉及证据核验，自动写库等同于凭空生成资质；
//      只在面板里展示供人工判断。
//   3. SP07 厂房权属 / SP10 产线数 **在 suppliers 表没有对应列**，同样只展示不写入。
//   4. business_type 必须映射成库里既有的英文标签（Manufacturer / Manufacturer & Trading
//      Company …），不能直接把 factory/trading 枚举写进去 —— 否则同一列出现两套词表。
//   5. 本文件是纯函数，不 import 任何服务端模块（后台 server component 与客户端面板共用）。

export type AdoptKind = "text" | "number" | "list";

export type AdoptRow = {
  /** 问卷题号，如 SP01 */
  code: string;
  /** suppliers 列名（提交给 /api/admin/suppliers 的 key） */
  field: "legal_name" | "english_name" | "registration_number" | "business_type" | "established" | "address" | "employees" | "factory_size" | "main_products" | "export_markets" | "website";
  labelZh: string;
  labelEn: string;
  kind: AdoptKind;
  /** 档案现值（展示用，已格式化为字符串） */
  current: string;
  /** 问卷填写值（展示用，已格式化为字符串） */
  incoming: string;
  /** 真正提交给 API 的值 */
  payload: string | number | string[];
  /** 问卷值与档案现值完全相同 ⇒ 无需采纳，仅提示 */
  identical: boolean;
};

export type ManualItem = {
  code: string;
  labelZh: string;
  labelEn: string;
  incoming: string;
  /** 为什么不能自动写入 */
  reasonZh: string;
};

/** 问卷里 SP04 的四个选项 → suppliers.business_type 既有词表 */
const BUSINESS_TYPE_MAP: Record<string, string> = {
  factory: "Manufacturer",
  trading: "Trading Company",
  both: "Manufacturer & Trading Company",
  other: "Other",
};

const SPLIT_RE = /[,，、;；\n]/;

function asText(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(", ");
  return "";
}

function asInt(v: unknown): number | null {
  const s = asText(v);
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = asText(v);
  if (!s) return [];
  return s.split(SPLIT_RE).map((x) => x.trim()).filter(Boolean);
}

/** 档案现值 → 展示字符串 */
function show(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v).trim();
}

export type AdoptInput = {
  responses: Record<string, unknown> | null;
  supplier: {
    legal_name?: string | null;
    english_name?: string | null;
    registration_number?: string | null;
    business_type?: string | null;
    established?: number | null;
    address?: string | null;
    employees?: string | null;
    factory_size?: string | null;
    main_products?: string[] | null;
    export_markets?: string[] | null;
    website?: string | null;
    contact_person?: string | null;
    contact_email?: string | null;
  } | null;
};

export function buildAdoptRows(input: AdoptInput): { rows: AdoptRow[]; manual: ManualItem[]; hasAny: boolean } {
  const resp = input.responses ?? {};
  const s = input.supplier ?? {};
  const rows: AdoptRow[] = [];

  function pushText(
    code: string,
    field: AdoptRow["field"],
    labelZh: string,
    labelEn: string,
    currentValue: unknown,
    transform?: (raw: string) => string | null
  ) {
    const raw = asText(resp[code]);
    if (!raw) return; // 🔴 空值不覆盖：直接不进表
    const value = transform ? transform(raw) : raw;
    if (value == null || !String(value).trim()) return;
    const current = show(currentValue);
    rows.push({
      code,
      field,
      labelZh,
      labelEn,
      kind: "text",
      current,
      incoming: value,
      payload: value,
      identical: current === value,
    });
  }

  pushText("SP01", "legal_name", "企业法定名称", "Legal name", s.legal_name);
  pushText("SP02", "english_name", "企业英文名称", "English name", s.english_name);
  pushText("SP03", "registration_number", "统一社会信用代码", "Credit code", s.registration_number);
  pushText("SP04", "business_type", "企业类型", "Business type", s.business_type, (raw) => {
    const key = raw.trim().toLowerCase();
    return BUSINESS_TYPE_MAP[key] ?? null; // 未知选项不写库
  });

  // SP05 成立年份（number）
  const est = asInt(resp["SP05"]);
  if (est != null && est > 1800 && est <= 2100) {
    const current = s.established == null ? "" : String(s.established);
    rows.push({
      code: "SP05",
      field: "established",
      labelZh: "成立年份",
      labelEn: "Year established",
      kind: "number",
      current,
      incoming: String(est),
      payload: est,
      identical: current === String(est),
    });
  }

  pushText("SP06", "address", "工厂实际地址", "Factory address", s.address);

  const emp = asInt(resp["SP08"]);
  if (emp != null && emp > 0) {
    const current = show(s.employees);
    rows.push({
      code: "SP08",
      field: "employees",
      labelZh: "员工总人数",
      labelEn: "Employees",
      kind: "number",
      current,
      incoming: String(emp),
      payload: String(emp),
      identical: current === String(emp),
    });
  }

  const area = asInt(resp["SP09"]);
  if (area != null && area > 0) {
    const current = show(s.factory_size);
    rows.push({
      code: "SP09",
      field: "factory_size",
      labelZh: "厂房面积（㎡）",
      labelEn: "Floor area (m²)",
      kind: "number",
      current,
      incoming: String(area),
      payload: String(area),
      identical: current === String(area),
    });
  }

  // SP11 主营产品（列表，🔴 档案页要求英文）
  const products = asList(resp["SP11"]);
  if (products.length > 0) {
    const currentArr = Array.isArray(s.main_products) ? s.main_products : [];
    const current = currentArr.join(", ");
    rows.push({
      code: "SP11",
      field: "main_products",
      labelZh: "主营产品类别",
      labelEn: "Main products",
      kind: "list",
      current,
      incoming: products.join(", "),
      payload: products,
      identical: current === products.join(", "),
    });
  }

  // SP12 出口市场（列表）
  const markets = asList(resp["SP12"]);
  if (markets.length > 0) {
    const currentArr = Array.isArray(s.export_markets) ? s.export_markets : [];
    const current = currentArr.join(", ");
    rows.push({
      code: "SP12",
      field: "export_markets",
      labelZh: "主要出口市场",
      labelEn: "Export markets",
      kind: "list",
      current,
      incoming: markets.join(", "),
      payload: markets,
      identical: current === markets.join(", "),
    });
  }

  pushText("SP14", "website", "公司官网", "Website", s.website);

  // ---- 只展示、不写入的三项 ----
  const manual: ManualItem[] = [];

  const ownership = asText(resp["SP07"]);
  if (ownership) {
    manual.push({
      code: "SP07",
      labelZh: "厂房权属",
      labelEn: "Site ownership",
      incoming: ownership,
      reasonZh: "suppliers 表无对应列，需人工判断后写入描述或备注",
    });
  }

  const lines = asText(resp["SP10"]);
  if (lines) {
    manual.push({
      code: "SP10",
      labelZh: "主要生产线数量",
      labelEn: "Production lines",
      incoming: lines,
      reasonZh: "suppliers 表无对应列，需人工判断后写入 description",
    });
  }

  const certs = asText(resp["SP13"]);
  if (certs) {
    manual.push({
      code: "SP13",
      labelZh: "管理体系证书（自述）",
      labelEn: "Certificates (self-reported)",
      incoming: certs,
      reasonZh: "资质不得凭自评自动写库，需先索取证书扫描件并核验证书主体与有效期",
    });
  }

  return { rows, manual, hasAny: rows.length > 0 || manual.length > 0 };
}

/** 问卷是否包含任何基础档案答案（决定后台要不要渲染采纳面板） */
export function hasBasicProfileAnswers(responses: Record<string, unknown> | null): boolean {
  if (!responses) return false;
  return ["SP01", "SP02", "SP03", "SP04", "SP05", "SP06", "SP08", "SP09", "SP11", "SP12", "SP14"].some(
    (k) => asText(responses[k]).length > 0
  );
}
