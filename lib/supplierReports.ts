// lib/supplierReports.ts —— CS-20 每工厂「报告正文」的类型、常量与净化器
//
// ─────────────────────────────────────────────────────────────────────────────
// 设计纪律（对齐 lib/standardReport.ts 与 lib/supplierReportHtml.ts）
// ─────────────────────────────────────────────────────────────────────────────
//   1. **纯模块**：零 import、零副作用。客户端编辑器与服务端 API 都 import 它，
//      所以绝不能在这里拉 supabase / next-headers / standardReport 进去。
//      （模板骨架在 lib/supplierReportTemplate.ts，只在服务端用。）
//   2. 沿用样张的存储模型：**标签双语、值单语**。只有标题/引言/条目正文是双语。
//   3. 🔴 缺失就是缺失：`overall_score` 的 `null` 表示「未评分」，**永远不等于 0**。
//      渲染方必须显示「—」，颜色也不得借用最差分档。
//   4. 🔴 反伪造：每个「字段 / 条目」都带 `level` 来源分级
//      （verified 已核验 / reported 企业自报 / none 无记录），`null` 表示**未标注**，
//      渲染时按「未标注」呈现，**绝不默认成已核验**。
//   5. 白名单净化：未知键一律丢弃；超长一律截断；数组长度上限见 REPORT_LIMITS。

// ---------- 基础类型 ----------

export type Bi = { en: string; zh: string };

/** 证据来源分级（贯穿全报告）。null = 未标注，绝不默认成 verified。 */
export const EVIDENCE_LEVELS = ["verified", "reported", "none"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/** 章节内容形态 */
export const SECTION_KINDS = ["fields", "table", "timeline", "list"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** 报告状态：仅人工标记内容是否定稿，**不等于签发**（签发走 CS-18 的 audit_reports） */
export const REPORT_STATUSES = ["draft", "final"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** 观察项级别（时间轴用） */
export const ITEM_LEVELS = ["low", "med"] as const;
export type ItemLevel = (typeof ITEM_LEVELS)[number];

// ---------- 章节数据形状 ----------

/** 键值行：label 双语、value 单语 */
export type ReportField = {
  lEn: string;
  lZh: string;
  v: string;
  level: EvidenceLevel | null;
};

/** 表格：表头双语、单元格单语 */
export type ReportTableColumn = { en: string; zh: string };
export type ReportTable = {
  headers: ReportTableColumn[];
  rows: string[][];
  /** 从 0 开始的状态列下标；null = 无状态列 */
  statusCol: number | null;
};

/** 时间轴条目 */
export type ReportItem = {
  titleEn: string;
  titleZh: string;
  meta: string;
  descEn: string;
  descZh: string;
  level: ItemLevel | null;
};

/** 列表/项目符号条目（双语正文） */
export type ReportBullet = { en: string; zh: string };

export type ReportSection = {
  no: string;
  titleEn: string;
  titleZh: string;
  introEn: string;
  introZh: string;
  kind: SectionKind;
  fields: ReportField[];
  table: ReportTable | null;
  items: ReportItem[];
  bullets: ReportBullet[];
};

export type ReportAction = { en: string; zh: string };

/** 一份报告正文的完整可编辑内容 */
export type SupplierReportDoc = {
  reportNumber: string;
  /** YYYY-MM-DD；空串 = 不渲染 */
  reportDate: string;
  preparedFor: string;
  /** 🔴 null = 未评分（渲染「—」）。0 是一个真实分数，二者语义不同。 */
  overallScore: number | null;
  scoreNote: string;
  sections: ReportSection[];
  actions: ReportAction[];
  disclaimerEn: string;
  disclaimerZh: string;
  status: ReportStatus;
};

// ---------- 上限（净化用） ----------

export const REPORT_LIMITS = {
  reportNumber: 64,
  preparedFor: 300,
  scoreNote: 2000,
  sectionNo: 8,
  sectionTitle: 200,
  sectionIntro: 3000,
  /** 整份文档序列化后的字符上限（jsonb 保护） */
  docChars: 400_000,
  fieldLabel: 120,
  fieldValue: 800,
  fields: 80,
  tableHeaders: 12,
  tableHeaderLabel: 120,
  tableRows: 300,
  tableCell: 300,
  items: 100,
  itemTitle: 300,
  itemMeta: 64,
  itemDesc: 1500,
  bullets: 100,
  bullet: 2500,
  actions: 50,
  action: 1500,
  disclaimer: 2500,
  sections: 40,
} as const;

// ---------- 默认免责声明 ----------
// 与 lib/standardReport.ts 的 DISCLAIMER 保持同一措辞（同一平台标准话术）。
// 库中 disclaimer_en/zh 留空时，渲染方用这份兜底 —— 绝不留空免责声明。

export const DEFAULT_DISCLAIMER: Bi = {
  en: "This report is an informational due-diligence dossier. It is not a certification, accreditation, or guarantee of supplier performance. Items marked 'Self-reported' have not been independently verified.",
  zh: "本报告为信息性尽职调查档案，不构成认证、认可或对供应商履约能力的保证。标注为「企业自报」的项目未经独立核验。",
};

/** 空的章节骨架（模板生成器用） */
export function emptySection(no: string): ReportSection {
  return {
    no,
    titleEn: "",
    titleZh: "",
    introEn: "",
    introZh: "",
    kind: "fields",
    fields: [],
    table: null,
    items: [],
    bullets: [],
  };
}

// ---------- 净化器（白名单 + 截断） ----------

function str(v: unknown, max: number): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max) : s;
}

function arr(v: unknown, max: number): unknown[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  const s = typeof v === "string" ? v : "";
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

function sanitizeField(raw: unknown): ReportField {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    lEn: str(o.lEn, REPORT_LIMITS.fieldLabel),
    lZh: str(o.lZh, REPORT_LIMITS.fieldLabel),
    v: str(o.v, REPORT_LIMITS.fieldValue),
    level: oneOf(o.level, EVIDENCE_LEVELS),
  };
}

function sanitizeTable(raw: unknown): ReportTable | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const headers = arr(o.headers, REPORT_LIMITS.tableHeaders).map((h) => {
    const c = (h ?? {}) as Record<string, unknown>;
    return {
      en: str(c.en, REPORT_LIMITS.tableHeaderLabel),
      zh: str(c.zh, REPORT_LIMITS.tableHeaderLabel),
    };
  });
  if (headers.length === 0) return null;

  const rows = arr(o.rows, REPORT_LIMITS.tableRows).map((r) => {
    const cells = Array.isArray(r) ? r : [];
    // 列数严格对齐表头：多截、少补空串（避免渲染出歪表格）
    return headers.map((_, i) => str(cells[i], REPORT_LIMITS.tableCell));
  });

  // 🔴 必须显式处理 null：`Number(null) === 0`，直接转换会把「无状态列」变成「第 1 列」
  let statusCol: number | null = null;
  const scRaw = o.statusCol;
  if (scRaw !== null && scRaw !== undefined && String(scRaw).trim() !== "") {
    const sc = Number(scRaw);
    if (Number.isInteger(sc) && sc >= 0 && sc < headers.length) statusCol = sc;
  }

  return { headers, rows, statusCol };
}

function sanitizeItem(raw: unknown): ReportItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    titleEn: str(o.titleEn, REPORT_LIMITS.itemTitle),
    titleZh: str(o.titleZh, REPORT_LIMITS.itemTitle),
    meta: str(o.meta, REPORT_LIMITS.itemMeta),
    descEn: str(o.descEn, REPORT_LIMITS.itemDesc),
    descZh: str(o.descZh, REPORT_LIMITS.itemDesc),
    level: oneOf(o.level, ITEM_LEVELS),
  };
}

function sanitizeBullet(raw: unknown): ReportBullet {
  const o = (raw ?? {}) as Record<string, unknown>;
  return { en: str(o.en, REPORT_LIMITS.bullet), zh: str(o.zh, REPORT_LIMITS.bullet) };
}

function sanitizeSection(raw: unknown): ReportSection {
  const o = (raw ?? {}) as Record<string, unknown>;
  const kind = oneOf(o.kind, SECTION_KINDS) ?? "fields";
  return {
    no: str(o.no, REPORT_LIMITS.sectionNo),
    titleEn: str(o.titleEn, REPORT_LIMITS.sectionTitle),
    titleZh: str(o.titleZh, REPORT_LIMITS.sectionTitle),
    introEn: str(o.introEn, REPORT_LIMITS.sectionIntro),
    introZh: str(o.introZh, REPORT_LIMITS.sectionIntro),
    kind,
    // 只保留与 kind 匹配的内容体，其余清空 —— 防止切换形态后残留脏数据
    fields: kind === "fields" ? arr(o.fields, REPORT_LIMITS.fields).map(sanitizeField) : [],
    table: kind === "table" ? sanitizeTable(o.table) : null,
    items: kind === "timeline" ? arr(o.items, REPORT_LIMITS.items).map(sanitizeItem) : [],
    bullets: kind === "list" ? arr(o.bullets, REPORT_LIMITS.bullets).map(sanitizeBullet) : [],
  };
}

function isDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export type SanitizeResult =
  | { ok: true; doc: SupplierReportDoc }
  | { ok: false; error: "invalid_body" | "invalid_score" | "too_large" };

/**
 * 白名单净化。任何未知键丢弃，任何超长截断。
 *
 * 🔴 分数语义铁律：`null` / `""` / `undefined` ⇒ `null`（未评分）；
 *    只有真正给了 0..100 的整数才落库。**绝不把空值补成 0。**
 */
export function sanitizeReportDoc(raw: unknown): SanitizeResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_body" };
  }
  const o = raw as Record<string, unknown>;

  let overallScore: number | null = null;
  const rawScore = o.overallScore;
  if (rawScore !== null && rawScore !== undefined && String(rawScore).trim() !== "") {
    const n = Number(rawScore);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) {
      return { ok: false, error: "invalid_score" };
    }
    overallScore = n;
  }

  const rawDate = str(o.reportDate, 32);
  const doc: SupplierReportDoc = {
    reportNumber: str(o.reportNumber, REPORT_LIMITS.reportNumber),
    reportDate: isDate(rawDate) ? rawDate : "",
    preparedFor: str(o.preparedFor, REPORT_LIMITS.preparedFor),
    overallScore,
    scoreNote: str(o.scoreNote, REPORT_LIMITS.scoreNote),
    sections: arr(o.sections, REPORT_LIMITS.sections).map(sanitizeSection),
    actions: arr(o.actions, REPORT_LIMITS.actions).map((a) => {
      const x = (a ?? {}) as Record<string, unknown>;
      return { en: str(x.en, REPORT_LIMITS.action), zh: str(x.zh, REPORT_LIMITS.action) };
    }),
    disclaimerEn: str(o.disclaimerEn, REPORT_LIMITS.disclaimer),
    disclaimerZh: str(o.disclaimerZh, REPORT_LIMITS.disclaimer),
    status: oneOf(o.status, REPORT_STATUSES) ?? "draft",
  };

  if (JSON.stringify(doc).length > REPORT_LIMITS.docChars) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true, doc };
}

// ---------- 渲染判定辅助（编辑器与服务端共用） ----------

/**
 * 章节是否有**可渲染的正文内容**。
 *
 * 🔴 判定只看正文，**不看标题** —— 因为模板给 13 章都预置了标题，
 *    若把「有标题」算作有内容，则空模板会被判成 13/13 已填，进度条永远满格；
 *    更糟的是导出件会给每个空章节渲染一个光秃秃的标题，看着像报告缺页。
 *
 * 各类形态的判定：
 *   · fields   —— 有任意一行「填了值」或「标了来源分级」才算（只填了标签不算）
 *   · table    —— 有数据行才算（只有表头不算）
 *   · timeline —— 有任意条目带标题才算
 *   · list     —— 有任意条目带正文才算
 */
export function sectionHasContent(s: ReportSection): boolean {
  switch (s.kind) {
    case "fields":
      return s.fields.some((f) => f.v.trim() !== "" || f.level !== null);
    case "table":
      return Boolean(s.table && s.table.rows.length > 0);
    case "timeline":
      return s.items.some((i) => i.titleEn.trim() !== "" || i.titleZh.trim() !== "");
    case "list":
      return s.bullets.some((b) => b.en.trim() !== "" || b.zh.trim() !== "");
    default:
      return false;
  }
}

/**
 * 字段行是否有可渲染内容。
 * 🔴 只填了标签、值与来源分级都空 ⇒ 那是模板留下的空位，不是结论 ⇒ 不渲染。
 *    （只有标了来源分级、值留空是有意义的：表示「已查，无记录」。）
 */
export function fieldHasContent(f: ReportField): boolean {
  return f.v.trim() !== "" || f.level !== null;
}

/** 已填章节数 / 总章节数 —— 编辑器进度提示用 */
export function reportProgress(doc: SupplierReportDoc): { filled: number; total: number } {
  const list = doc.sections ?? [];
  return { filled: list.filter(sectionHasContent).length, total: list.length };
}

/** 文档是否完全空白（用来决定「首次打开自动铺模板」还是直接回读库中内容） */
export function reportDocIsEmpty(doc: SupplierReportDoc): boolean {
  return (
    doc.sections.length === 0 &&
    doc.actions.length === 0 &&
    !doc.reportNumber &&
    !doc.preparedFor &&
    doc.overallScore === null
  );
}
