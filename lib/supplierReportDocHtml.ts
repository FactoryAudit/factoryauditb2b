// lib/supplierReportDocHtml.ts —— CS-20 每工厂「报告正文」独立 HTML 生成器
//
// 与另两个报告生成器的分工：
//   · lib/supplierReportHtml.ts     —— 自动取 DB 真值的「核验记录汇总」（只读，无需人工编辑）
//   · lib/standardReport.ts         —— 全局虚构样张（模板评审用）
//   · 本文件                        —— **人工录入**的报告正文（CS-20 报告编辑器产出）
//
// 设计约束（与前两者一致）：
//   · 自包含：内联 CSS + 内联脚本，可离线打开、可打印为 PDF。
//   · 双语：标签/标题/引言写进 data-en / data-zh，初始显示 lang；保留一键切换。
//   · 纯函数、零服务端依赖，可被客户端组件直接 import 生成 Blob 下载。
//
// 🔴 反伪造铁律（本渲染器的全部判断）：
//   1. 空章节整章不渲染 —— 不用占位文本、不用 0、不用「待补充」充数。
//   2. 每个字段的来源分级只在**人工明确标注**时才显示；
//      未标注（level === null）显示「未标注」，**绝不默认成「已核验」**。
//   3. overallScore === null 时显示「—」+ 中性档位文案，
//      **绝不显示 0**，也绝不借用最差分档的颜色（项目铁律：NULL ≠ 0）。
//   4. 报告编号 / 日期 / 报告对象留空即不渲染，系统不代填。

import {
  DEFAULT_DISCLAIMER,
  fieldHasContent,
  sectionHasContent,
  type Bi,
  type EvidenceLevel,
  type ReportSection,
  type ReportTable,
  type SupplierReportDoc,
} from "@/lib/supplierReports";
import { overallLevel, type RiskLevel } from "@/lib/riskEngine";

export type ReportLang = "en" | "zh";

/* -------------------------------------------------------------------------- */
/* 基础工具                                                                    */
/* -------------------------------------------------------------------------- */

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const UI = {
  title: { en: "Supplier Due Diligence Report", zh: "供应商尽职调查报告" } as Bi,
  issuedBy: { en: "Issued by", zh: "出具方" } as Bi,
  generatedOn: { en: "Generated on", zh: "生成时间" } as Bi,
  reportNo: { en: "Report no.", zh: "报告编号" } as Bi,
  reportDate: { en: "Report date", zh: "报告日期" } as Bi,
  preparedFor: { en: "Prepared for", zh: "报告对象" } as Bi,
  overallScore: { en: "Overall score", zh: "总分" } as Bi,
  notScored: { en: "Not scored", zh: "未评分" } as Bi,
  notScoredNote: {
    en: "No score has been assigned to this report.",
    zh: "本报告尚未评分。",
  } as Bi,
  scoreHint: {
    en: "Higher score means lower risk. Score is built only from evidence on record; missing evidence lowers the score rather than being assumed.",
    zh: "分数越高风险越低。评分只基于在案证据构建；证据缺失会降低分数，而不会被默认补全。",
  } as Bi,
  actions: { en: "Recommended actions", zh: "建议行动" } as Bi,
  source: { en: "Source", zh: "来源" } as Bi,
  unmarked: { en: "Unmarked", zh: "未标注" } as Bi,
  watch: { en: "Watch item", zh: "观察项" } as Bi,
  langToggle: { en: "EN / 中文", zh: "EN / 中文" } as Bi,
  print: { en: "Print / Save as PDF", zh: "打印 / 另存为 PDF" } as Bi,
  draftNote: {
    en: "DRAFT — content not yet finalised.",
    zh: "草稿 —— 内容尚未定稿。",
  } as Bi,
};

const LEVEL_LABELS: Record<EvidenceLevel, Bi> = {
  verified: { en: "Verified", zh: "已核验" },
  reported: { en: "Self-reported", zh: "企业自报" },
  none: { en: "Not on file", zh: "无记录" },
};

/**
 * 风险档位文案（en/zh）。
 * 措辞与 i18n 字典 `risk.levelLabels` 的 en/zh 保持一致，避免同一概念两套说法。
 * 本文件是自包含离线文档，只支持 en/zh ⇒ 内联而不是读字典。
 */
const LEVEL_LABELS_BIZ: Record<RiskLevel, Bi> = {
  LOW: { en: "Low risk", zh: "低风险" },
  MODERATE: { en: "Moderate risk", zh: "中等风险" },
  ELEVATED: { en: "Elevated risk", zh: "偏高风险" },
  HIGH: { en: "High risk", zh: "高风险" },
  CRITICAL: { en: "Critical risk", zh: "极高风险" },
};

/* -------------------------------------------------------------------------- */
/* 片段渲染                                                                    */
/* -------------------------------------------------------------------------- */

type Ctx = { lang: ReportLang };

/** 双语片段 —— 初始显示 lang，其余语言写进 data-* 供切换 */
function bi(ctx: Ctx, b: Bi): string {
  return `<span class="bi" data-en="${esc(b.en)}" data-zh="${esc(b.zh)}">${esc(
    ctx.lang === "zh" ? b.zh : b.en
  )}</span>`;
}

/** 单语值（作者录入的内容，不翻译） */
function v(text: string): string {
  return esc(text);
}

/** 来源分级标记。level === null ⇒ 「未标注」，绝不绿。 */
function levelTag(ctx: Ctx, level: EvidenceLevel | null): string {
  if (!level) return `<span class="tag mut">${bi(ctx, UI.unmarked)}</span>`;
  const cls = level === "verified" ? "ok" : level === "reported" ? "warn" : "mut";
  return `<span class="tag ${cls}">${bi(ctx, LEVEL_LABELS[level])}</span>`;
}

function fieldsHtml(ctx: Ctx, s: ReportSection): string {
  const rows = s.fields
    // 🔴 只填了标签的行不渲染（那是模板空位，不是结论）；
    //    「标了来源分级、值留空」要渲染 —— 表示「已查，无记录」。
    .filter(fieldHasContent)
    .map((f) => {
      const label = bi(ctx, { en: f.lEn, zh: f.lZh });
      const right = f.v.trim()
        ? `<span class="v">${v(f.v)}</span>`
        : `<span class="v miss">—</span>`;
      return `<div class="kv"><span class="k">${label}</span>${right}${levelTag(
        ctx,
        f.level
      )}</div>`;
    })
    .join("");
  return rows ? `<div class="kvs">${rows}</div>` : "";
}

function tableHtml(ctx: Ctx, t: ReportTable): string {
  const head = t.headers
    .map((h) => `<th>${bi(ctx, { en: h.en, zh: h.zh })}</th>`)
    .join("");
  const body = t.rows
    .map(
      (cells) =>
        `<tr>${cells
          .map((c, i) => {
            const inner = c.trim() ? v(c) : `<span class="miss">—</span>`;
            // 状态列只做视觉区分，**不解析文案**（避免把自撰文字误判成「有效」）
            return i === t.statusCol
              ? `<td><span class="tag mut">${inner}</span></td>`
              : `<td>${inner}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");
  return `<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function timelineHtml(ctx: Ctx, s: ReportSection): string {
  const items = s.items
    .filter((i) => i.titleEn.trim() || i.titleZh.trim())
    .map((i) => {
      const title = bi(ctx, { en: i.titleEn, zh: i.titleZh });
      const meta = i.meta.trim() ? `<span class="meta">${v(i.meta)}</span>` : "";
      const descEn = i.descEn.trim();
      const descZh = i.descZh.trim();
      const desc =
        descEn || descZh
          ? `<div class="desc">${bi(ctx, { en: descEn, zh: descZh })}</div>`
          : "";
      const badge =
        i.level === "med" ? `<span class="tag warn">${bi(ctx, UI.watch)}</span>` : "";
      return `<li class="ti"><div class="thead">${meta}${title}${badge}</div>${desc}</li>`;
    })
    .join("");
  return items ? `<ul class="timeline">${items}</ul>` : "";
}

function listHtml(ctx: Ctx, s: ReportSection): string {
  const items = s.bullets
    .filter((b) => b.en.trim() || b.zh.trim())
    .map((b) => `<li>${bi(ctx, { en: b.en, zh: b.zh })}</li>`)
    .join("");
  return items ? `<ul class="bullets">${items}</ul>` : "";
}

/** 一个章节（调用方已确认 sectionHasContent） */
function sectionHtml(ctx: Ctx, s: ReportSection): string {
  const title = bi(ctx, { en: s.titleEn, zh: s.titleZh });
  const intro =
    s.introEn.trim() || s.introZh.trim()
      ? `<p class="intro">${bi(ctx, { en: s.introEn, zh: s.introZh })}</p>`
      : "";

  let body = "";
  switch (s.kind) {
    case "fields":
      body = fieldsHtml(ctx, s);
      break;
    case "table":
      body = s.table ? tableHtml(ctx, s.table) : "";
      break;
    case "timeline":
      body = timelineHtml(ctx, s);
      break;
    case "list":
      body = listHtml(ctx, s);
      break;
  }

  const no = s.no.trim() ? `<span class="no">${v(s.no)}</span>` : "";
  return `<section>${no}<h2>${title}</h2>${intro}${body}</section>`;
}

/* -------------------------------------------------------------------------- */
/* 主函数                                                                      */
/* -------------------------------------------------------------------------- */

export type BuildReportDocOptions = {
  /** 供应商展示名（真实企业名，来自 DB，不由客户端编造） */
  supplierName: string;
  slug: string;
  /** 生成时间（调用方传入，便于测试确定性） */
  generatedAt: string;
};

export function buildReportDocHtml(
  doc: SupplierReportDoc,
  lang: ReportLang,
  opts: BuildReportDocOptions
): string {
  const ctx: Ctx = { lang };

  // ---- 报告头（留空即不渲染，不代填）----
  const metaRows: string[] = [];
  if (doc.reportNumber.trim())
    metaRows.push(`<div class="m">${bi(ctx, UI.reportNo)}: ${v(doc.reportNumber)}</div>`);
  if (doc.reportDate.trim())
    metaRows.push(`<div class="m">${bi(ctx, UI.reportDate)}: ${v(doc.reportDate)}</div>`);
  if (doc.preparedFor.trim())
    metaRows.push(`<div class="m">${bi(ctx, UI.preparedFor)}: ${v(doc.preparedFor)}</div>`);
  metaRows.push(`<div class="m">${bi(ctx, UI.issuedBy)}: FactoryAuditB2B</div>`);
  metaRows.push(`<div class="m">${bi(ctx, UI.generatedOn)}: ${v(opts.generatedAt.slice(0, 10))}</div>`);

  // ---- 总分（null ⇒ 「—」，绝不算作 0，也不借用最差分档）----
  const scored = doc.overallScore !== null;
  const scoreValue = scored ? String(doc.overallScore) : "—";
  const band = scored ? LEVEL_LABELS_BIZ[overallLevel(doc.overallScore as number)] : null;
  const scoreNote = doc.scoreNote.trim()
    ? `<p class="snote">${v(doc.scoreNote)}</p>`
    : scored
      ? `<p class="snote">${bi(ctx, UI.scoreHint)}</p>`
      : `<p class="snote">${bi(ctx, UI.notScoredNote)}</p>`;
  const scoreHtml = `<div class="scorebox${scored ? "" : " unscored"}">
    <div class="sv">${esc(scoreValue)}<small>/100</small></div>
    <div>
      <div class="slabel">${bi(ctx, UI.overallScore)}</div>
      <div class="sband">${band ? bi(ctx, band) : bi(ctx, UI.notScored)}</div>
    </div>
  </div>${scoreNote}`;

  // ---- 正文（空章节整章不出现）----
  const sections = doc.sections.filter(sectionHasContent).map((s) => sectionHtml(ctx, s)).join("");

  // ---- 建议行动 ----
  const actions = doc.actions.filter((a) => a.en.trim() || a.zh.trim());
  const actionsHtml = actions.length
    ? `<section><h2>${bi(ctx, UI.actions)}</h2><ul class="bullets">${actions
        .map((a) => `<li>${bi(ctx, { en: a.en, zh: a.zh })}</li>`)
        .join("")}</ul></section>`
    : "";

  // ---- 免责声明（留空 ⇒ 平台标准文本兜底，绝不留空）----
  const disclaimer =
    doc.disclaimerEn.trim() || doc.disclaimerZh.trim()
      ? bi(ctx, { en: doc.disclaimerEn, zh: doc.disclaimerZh })
      : bi(ctx, DEFAULT_DISCLAIMER);

  const draftBanner =
    doc.status === "draft" ? `<div class="draft">${bi(ctx, UI.draftNote)}</div>` : "";

  const htmlLang: ReportLang = lang === "zh" ? "zh" : "en";

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(opts.supplierName)} — ${esc(UI.title[lang])}</title>
<style>
  :root { --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --blue:#0f4c81; }
  * { box-sizing:border-box; }
  body { margin:0; background:#f7f9fc; color:var(--ink);
    font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
  .wrap { max-width:900px; margin:0 auto; padding:24px 16px 64px; }
  .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
  .toolbar h1 { font-size:20px; margin:0; }
  .btn { border:1px solid var(--blue); background:var(--blue); color:#fff; border-radius:8px; padding:8px 14px; font-size:14px; cursor:pointer; }
  .btn.ghost { background:#fff; color:var(--blue); }
  .paper { background:#fff; border:1px solid var(--line); border-radius:12px; padding:32px; margin-top:16px; }
  .rhead { border-bottom:1px solid var(--line); padding-bottom:16px; }
  .rhead .t { font-size:24px; font-weight:800; }
  .rhead .m { margin-top:6px; font-size:12px; color:var(--mut); }
  .draft { margin-top:14px; background:#fef3c7; color:#92400e; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; display:inline-block; }
  .scorebox { display:flex; gap:20px; align-items:center; background:#f1f5f9; border-radius:10px; padding:20px; margin-top:24px; }
  .scorebox.unscored { background:#f8fafc; border:1px dashed var(--line); }
  .scorebox .sv { font-size:44px; font-weight:800; line-height:1; }
  .scorebox .sv small { font-size:18px; color:#94a3b8; font-weight:600; }
  .scorebox .slabel { color:var(--mut); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .scorebox .sband { font-size:17px; font-weight:600; }
  .snote { margin:12px 0 0; font-size:13px; color:var(--mut); }
  section h2 { font-size:17px; margin:32px 0 6px; }
  .no { display:block; font-size:11px; color:#94a3b8; letter-spacing:.06em; margin-top:26px; }
  .no + h2 { margin-top:2px; }
  .intro { margin:0 0 8px; font-size:13px; color:var(--mut); }
  .kvs { margin-top:8px; }
  .kv { display:flex; justify-content:space-between; gap:16px; align-items:baseline; border-bottom:1px solid #eef2f7; padding:8px 0; }
  .kv .k { color:var(--mut); }
  .kv .v { text-align:right; font-weight:600; }
  .miss { color:#94a3b8; font-weight:400; }
  .tw { overflow-x:auto; border:1px solid var(--line); border-radius:8px; margin-top:10px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  thead { background:#f8fafc; color:var(--mut); }
  th { text-align:left; padding:8px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.03em; }
  td { padding:8px 12px; border-top:1px solid #eef2f7; color:#475569; }
  .tag { display:inline-block; border-radius:999px; padding:2px 8px; font-size:10px; font-weight:600; white-space:nowrap; }
  .tag.ok { background:#e8f5ea; color:#1f7a36; }
  .tag.warn { background:#fef3c7; color:#92400e; }
  .tag.mut { background:#eef2f7; color:#5b6b7e; }
  .timeline { list-style:none; margin:10px 0 0; padding:0; }
  .ti { border-left:2px solid var(--line); padding:0 0 14px 14px; }
  .ti .thead { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; font-weight:600; }
  .ti .meta { font-size:12px; color:var(--mut); font-weight:500; }
  .ti .desc { font-size:13px; color:var(--mut); margin-top:2px; }
  .bullets { margin:8px 0 0; padding-left:20px; }
  .bullets li { margin-bottom:6px; }
  .disclaimer { margin-top:28px; border-top:1px solid var(--line); padding-top:16px; font-size:12px; color:var(--mut); }
  @media print { body { background:#fff; } .toolbar { display:none !important; } .paper { border:0; padding:0; } .wrap { max-width:none; padding:0; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="toolbar">
    <h1>${esc(UI.title[lang])}</h1>
    <div>
      <button class="btn ghost" id="langBtn" type="button">${esc(UI.langToggle[lang])}</button>
      <button class="btn" type="button" onclick="window.print()">${esc(UI.print[lang])}</button>
    </div>
  </div>

  <div class="paper">
    <div class="rhead">
      <div class="t">${v(opts.supplierName)}</div>
      ${metaRows.join("")}
      <div class="m">slug: ${v(opts.slug)}</div>
    </div>
    ${draftBanner}

    ${scoreHtml}

    ${sections}
    ${actionsHtml}

    <p class="disclaimer">${disclaimer}</p>
  </div>
</div>
<script>
  var lang = "${htmlLang}";
  document.getElementById("langBtn").addEventListener("click", function () {
    lang = lang === "zh" ? "en" : "zh";
    document.querySelectorAll(".bi").forEach(function (el) {
      el.textContent = el.getAttribute("data-" + lang) || el.textContent;
    });
    document.documentElement.lang = lang;
  });
</script>
</body>
</html>`;
}

/** 下载文件名（与另两个报告生成器的命名风格一致） */
export function reportDocFileName(
  slug: string,
  lang: ReportLang,
  reportDate?: string
): string {
  const stamp = (reportDate || "").trim() || "undated";
  return `factoryauditb2b-${slug}-due-diligence-report-${stamp}-${lang}.html`;
}
