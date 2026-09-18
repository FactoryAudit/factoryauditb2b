// lib/supplierReportTemplate.ts —— CS-20 报告模板骨架（服务端专用）
//
// 从「标准样张」lib/standardReport.ts 派生出一份 **空报告**：
//   携带：章节编号、章节标题（中/英）、章节引言（中/英）、表格列名、字段标签
//   清空：所有字段值、表格数据行、时间轴条目、列表条目、建议行动
//
// 🔴 为什么必须清空内容：
//   样张里的内容是**虚构演示数据**（"Shenzhen XX Electronics Co., Ltd."、"CNY 8,000,000"、
//   "4 起案件"…）。把它当成新报告的默认值，等于把假数据写进真实报告 —— 直接违反
//   项目的反伪造铁律。所以模板只承载**结构与方法说明**，任何结论性内容一律空白。
//
// 为什么引言（intro）可以保留：
//   引言描述的是**平台的数据来源与核验方法**（GSXT / 裁判文书网 / 发证机构登记库 /
//   卫星影像），对每份报告都相同，不是针对某个工厂的结论。编辑器会明确提示
//   「请确认与本工厂实际核验所用来源一致」。
//
// 本文件 import 了 standardReport（15KB 样张数据），**只能被服务端使用**：
//   只有 app/api/admin/suppliers/[slug]/report/route.ts 会调它。
//   客户端编辑器不得 import 本文件（否则样张数据进 client bundle）。

import { SECTIONS } from "@/lib/standardReport";
import {
  DEFAULT_DISCLAIMER,
  type ReportSection,
  type SectionKind,
  type SupplierReportDoc,
} from "@/lib/supplierReports";

/** 样张的 kind → 编辑器 kind（样张的 "bullets" 在编辑器里统一叫 "list"） */
function toKind(kind: string): SectionKind {
  switch (kind) {
    case "table":
      return "table";
    case "timeline":
      return "timeline";
    case "list":
    case "bullets":
      return "list";
    default:
      return "fields";
  }
}

/**
 * 引言可否带入模板。
 *
 * 🔴 判据：**含数字的引言一律丢弃**。
 *    引言本应只描述数据来源与核验方法（对每份报告都相同）。一旦里面出现数字，
 *    说明它引用的是**某个具体工厂的数据**——例如样张「执行摘要」的
 *    "总分 82/100 由下列八个维度加权得出"，带上就是假数据。
 *    这条规则同时排除了「股权与控制」引言里的 "Stable since 2019"（结论性陈述）。
 */
function reusableIntro(intro: string): boolean {
  return intro.trim() !== "" && !/\d/.test(intro);
}

/**
 * 生成一份空白报告骨架（13 章）。
 *
 * 🔴 overall_score = null（未评分），reportNumber / reportDate / preparedFor 全空：
 *    编号与日期必须人工填，系统绝不自动编造。
 */
export function emptyReportTemplate(): SupplierReportDoc {
  const sections: ReportSection[] = SECTIONS.map((s) => {
    const kind = toKind(s.kind);

    return {
      no: s.no,
      titleEn: s.title.en,
      titleZh: s.title.zh,
      // 引言 = 平台方法说明，且必须**不含数字**才可带入（见 reusableIntro）
      introEn: reusableIntro(s.intro?.en ?? "") ? (s.intro?.en ?? "") : "",
      introZh: reusableIntro(s.intro?.zh ?? "") ? (s.intro?.zh ?? "") : "",
      kind,
      // 字段只带标签，值留空、来源分级留空（null ⇒ 渲染为「未标注」）
      fields:
        kind === "fields"
          ? (s.fields ?? []).map((f) => ({
              lEn: f.label.en,
              lZh: f.label.zh,
              v: "",
              level: null,
            }))
          : [],
      // 表格只带列名，不带任何数据行
      table:
        kind === "table" && s.table
          ? {
              headers: s.table.headers.map((h) => ({ en: h.en, zh: h.zh })),
              rows: [],
              statusCol:
                typeof s.table.statusCol === "number" ? s.table.statusCol : null,
            }
          : null,
      items: [],
      bullets: [],
    };
  });

  return {
    reportNumber: "",
    reportDate: "",
    preparedFor: "",
    overallScore: null,
    scoreNote: "",
    sections,
    actions: [],
    disclaimerEn: DEFAULT_DISCLAIMER.en,
    disclaimerZh: DEFAULT_DISCLAIMER.zh,
    status: "draft",
  };
}
