// lib/standardReportHtml.ts —— 标准版报告样张的**独立 HTML**生成器（单一事实来源）
//
// 为什么单独抽一个文件：
//   「同一份标准报告」现在有 4 个消费方，必须共用同一个渲染器，否则必然走样：
//     1) scripts/build-standard-report-html.mjs —— 本地预览件（含 ADMIN PREVIEW 框）
//     2) /standard-report 公开页的「下载」按钮 —— 客户端 Blob 下载（无 ADMIN 框）
//     3) 未来 CS-09 的正式报告导出
//   渲染规则（证据分级、状态徽章、时间线）只在**本文件**里定义一次。
//
// 设计约束：
//   - 生成的 HTML **自包含**（内联 CSS + 内联脚本），不依赖站点资源，可离线打开、可直接打印为 PDF。
//   - 双语（en/zh）同时写进 `data-en` / `data-zh`，初始显示 `lang` 对应的一边；
//     下载件保留语言切换按钮，用户可在一份文件里来回切换。
//   - 反伪造铁律：样张声明（SPECIMEN_BANNER）必须出现在文件顶部，且打印时不隐藏。
//
// ⚠️ 这里用相对路径 import 而不是 "@/lib/standardReport"：
//    scripts/build-standard-report-html.mjs 用 esbuild 直接打包本文件，
//    相对路径在 esbuild 与 Next 两侧都无需额外配置，避免 tsconfig paths 解析差异。

import {
  SPECIMEN_BANNER,
  REPORT_HEADER,
  SCORE,
  SECTIONS,
  RECOMMENDED_ACTIONS,
  DISCLAIMER,
  EVIDENCE_MARK,
  BUYER_DOWNLOAD,
  REPORT_LANGUAGES,
  type Lang,
  type Bi,
  type Field,
  type Section,
} from "./standardReport";

// 生成件内自有的界面文案（不属于站点 UI，只出现在下载文件里，故按 Bi 双语内联）
const DOC_UI = {
  title: {
    en: "Standard Supplier Due Diligence Report — Specimen",
    zh: "标准版供应商尽职调查报告 — 样张",
  } as Bi,
  langToggle: { en: "EN / 中文", zh: "EN / 中文" } as Bi,
  print: { en: "Print / Save as PDF", zh: "打印 / 另存为 PDF" } as Bi,
  actions: { en: "Recommended actions", zh: "建议行动" } as Bi,
  watch: { en: "Watch", zh: "关注" } as Bi,
  lowImpact: { en: "Low impact", zh: "正常" } as Bi,
  footnote: {
    en: "Specimen issued by FactoryAuditB2B · factoryauditb2b.com · Fictional data, not a real supplier assessment.",
    zh: "由 FactoryAuditB2B 出具的样张 · factoryauditb2b.com · 虚构数据，不构成对任何真实供应商的评估结论。",
  } as Bi,
};

export type StandardReportHtmlOptions = {
  /**
   * 内部后台预览模式：额外渲染「采购商下载（工厂不可见）」演示框。
   * 公开页与下载件**必须**保持 false —— 工厂侧的入驻页面绝不能出现这段。
   */
  adminPreview?: boolean;
};

const esc = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildStandardReportHtml(
  lang: Lang,
  opts: StandardReportHtmlOptions = {}
): string {
  const adminPreview = opts.adminPreview === true;

  /** 双语节点：两侧都写进 DOM，初始显示 lang 对应的一边 */
  const bi = (b: Bi): string =>
    `<span class="bi" data-en="${esc(b.en)}" data-zh="${esc(b.zh)}">${esc(b[lang])}</span>`;

  const levelTag: Record<NonNullable<Field["level"]>, { text: Bi; cls: string }> = {
    verified: { text: EVIDENCE_MARK.verified, cls: "ok" },
    reported: { text: EVIDENCE_MARK.reported, cls: "warn" },
    none: { text: EVIDENCE_MARK.none, cls: "mut" },
  };

  const statusBadge = (s: string): { text: Bi; cls: string } => {
    if (s === "valid") return { text: { en: "Valid", zh: "有效" }, cls: "ok" };
    if (s === "expired") return { text: { en: "Expired", zh: "已过期" }, cls: "bad" };
    return { text: { en: "Not on file", zh: "无记录" }, cls: "mut" };
  };

  function sectionHtml(s: Section): string {
    let body = "";
    if (s.intro) body += `<p class="note">${bi(s.intro)}</p>`;

    if (s.kind === "fields" && s.fields) {
      body += `<dl>${s.fields
        .map(
          (f) =>
            `<div class="row"><dt>${bi(f.label)}</dt><dd>${esc(f.value)}${
              f.level
                ? ` <span class="tag ${levelTag[f.level].cls}">${bi(levelTag[f.level].text)}</span>`
                : ""
            }${f.note ? `<span class="fnote">${bi(f.note)}</span>` : ""}</dd></div>`
        )
        .join("")}</dl>`;
    }

    if (s.kind === "table" && s.table) {
      const table = s.table;
      body += `<div class="tw"><table><thead><tr>${table.headers
        .map((h) => `<th>${bi(h)}</th>`)
        .join("")}</tr></thead><tbody>${table.rows
        .map(
          (row) =>
            `<tr>${row
              .map((c, ci) => {
                if (table.statusCol === ci) {
                  const b = statusBadge(c);
                  return `<td><span class="tag ${b.cls}">${bi(b.text)}</span></td>`;
                }
                if (c === "verified" || c === "reported" || c === "none") {
                  return `<td><span class="tag ${levelTag[c].cls}">${bi(levelTag[c].text)}</span></td>`;
                }
                return `<td>${esc(c)}</td>`;
              })
              .join("")}</tr>`
        )
        .join("")}</tbody></table></div>`;
    }

    if (s.kind === "timeline" && s.items) {
      body += `<ol class="tl">${s.items
        .map(
          (it) =>
            `<li><div class="tlhead">${
              it.meta ? `<span class="tlmeta">${esc(it.meta)}</span>` : ""
            }<span class="tag ${it.level === "med" ? "warn" : "ok"}">${esc(
              it.level === "med" ? DOC_UI.watch[lang] : DOC_UI.lowImpact[lang]
            )}</span></div><div class="tltitle">${bi(it.title)}</div>${
              it.desc ? `<div class="tldesc">${bi(it.desc)}</div>` : ""
            }</li>`
        )
        .join("")}</ol>`;
    }

    if (s.bullets) {
      body += `<ul class="bl">${s.bullets.map((b) => `<li>${bi(b)}</li>`).join("")}</ul>`;
    }

    return `<section><h2><span class="num">${esc(s.no)}</span>${bi(s.title)}</h2>${body}</section>`;
  }

  const dims = SCORE.dims
    .map(
      (d) => `<div class="dim"><div class="dimtop"><span>${bi(d.label)}</span><b>${d.score}</b></div>
    <div class="bar"><i style="width:${d.score}%"></i></div></div>`
    )
    .join("");

  const buyerBox = adminPreview
    ? `<div class="buyerbox">
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="badge">ADMIN PREVIEW</span>
      <strong>${bi(BUYER_DOWNLOAD.title)}</strong>
    </div>
    <p class="note" style="margin-top:6px;">${bi(BUYER_DOWNLOAD.note)}</p>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px;">
      <label><b>${bi(BUYER_DOWNLOAD.langLabel)}</b></label>
      <select>${REPORT_LANGUAGES.map((l) => `<option>${l}</option>`).join("")}</select>
      <button class="btn" type="button" disabled>${bi(BUYER_DOWNLOAD.cta)}</button>
    </div>
    <p style="color:#941b1b;font-size:12px;margin-top:8px;">${bi(BUYER_DOWNLOAD.priceNote)}</p>
  </div>`
    : "";

  const htmlLang = lang === "zh" ? "zh" : "en";

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(DOC_UI.title[lang])}</title>
<style>
  :root { --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --blue:#0f4c81; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f7f9fc; color:var(--ink);
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
  .wrap { max-width:900px; margin:0 auto; padding:24px 16px 64px; }
  .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
  .toolbar h1 { font-size:20px; margin:0; }
  .btn { border:1px solid var(--blue); background:var(--blue); color:#fff; border-radius:8px;
    padding:8px 14px; font-size:14px; cursor:pointer; }
  .btn.ghost { background:#fff; color:var(--blue); }
  .btn[disabled] { opacity:.5; cursor:not-allowed; }
  .specimen { border:1px solid #d4232a; background:#fef2f2; color:#991b1b; font-weight:600;
    border-radius:8px; padding:12px 16px; font-size:14px; }
  .paper { background:#fff; border:1px solid var(--line); border-radius:12px; padding:32px; margin-top:16px;
    box-shadow:0 1px 3px rgba(15,23,42,.06); }
  .rhead { border-bottom:1px solid var(--line); padding-bottom:16px; }
  .rhead .t { font-size:22px; font-weight:800; }
  .rhead .m { margin-top:8px; font-size:12px; color:var(--mut); }
  .scorebox { display:flex; gap:20px; align-items:center; background:#f1f5f9; border-radius:10px;
    padding:20px; margin-top:24px; }
  .scorebox .v { font-size:44px; font-weight:800; color:var(--blue); }
  .scorebox .v small { font-size:20px; color:#94a3b8; }
  .scorebox .b { font-weight:700; }
  .dim { margin-top:8px; }
  .dimtop { display:flex; justify-content:space-between; font-size:14px; color:#475569; }
  .bar { height:8px; background:#e2e8f0; border-radius:999px; overflow:hidden; margin-top:4px; }
  .bar i { display:block; height:100%; background:var(--blue); }
  section h2 { display:flex; align-items:center; gap:8px; font-size:17px; margin:32px 0 6px; }
  .num { display:inline-flex; width:28px; height:28px; align-items:center; justify-content:center;
    border-radius:6px; background:linear-gradient(135deg,#0f4c81,#163a5f); color:#fff; font-size:12px; font-weight:700; }
  .note { font-size:12px; color:var(--mut); margin:0 0 8px; }
  dl { margin:10px 0 0; }
  .row { display:flex; justify-content:space-between; gap:16px; align-items:baseline;
    border-bottom:1px solid #eef2f7; padding:8px 0; }
  .row dt { color:var(--mut); }
  .row dd { margin:0; text-align:right; font-weight:600; }
  .fnote { display:block; width:100%; text-align:right; font-weight:400; font-size:12px; color:#94a3b8; }
  .tag { display:inline-block; border-radius:999px; padding:2px 8px; font-size:10px; font-weight:600; }
  .tag.ok { background:#e8f5ea; color:#1f7a36; }
  .tag.warn { background:#fff4e0; color:#8a5410; }
  .tag.bad { background:#fdecea; color:#b42318; }
  .tag.mut { background:#eef2f7; color:#5b6b7e; }
  .tw { overflow-x:auto; border:1px solid var(--line); border-radius:8px; margin-top:10px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  thead { background:#f8fafc; color:var(--mut); }
  th { text-align:left; padding:8px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.03em; }
  td { padding:8px 12px; border-top:1px solid #eef2f7; color:#475569; }
  .tl { list-style:none; margin:12px 0 0; padding:0 0 0 16px; border-left:2px solid var(--line); }
  .tl li { margin-bottom:16px; }
  .tlhead { display:flex; gap:8px; align-items:center; }
  .tlmeta { color:var(--blue); font-weight:700; font-size:14px; }
  .tltitle { font-weight:600; margin-top:4px; }
  .tldesc { font-size:14px; color:var(--mut); }
  .bl { margin:10px 0 0; padding-left:0; list-style:none; }
  .bl li { padding-left:16px; position:relative; margin-bottom:8px; color:#475569; }
  .bl li:before { content:"•"; position:absolute; left:0; color:var(--blue); }
  .disclaimer { margin-top:24px; border-top:1px solid var(--line); padding-top:16px; font-size:12px; color:var(--mut); }
  .buyerbox { margin-top:24px; border:2px dashed var(--blue); background:#f7f9fc; border-radius:12px; padding:20px; }
  .badge { background:var(--blue); color:#fff; border-radius:4px; padding:2px 8px; font-size:11px; font-weight:700; }
  select { padding:8px 10px; border:1px solid var(--line); border-radius:8px; }
  .foot { margin-top:16px; font-size:12px; color:var(--mut); text-align:center; }
  @media print {
    body { background:#fff; } .toolbar, .buyerbox { display:none !important; }
    .paper { border:0; box-shadow:none; padding:0; } .wrap { max-width:none; padding:0; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="toolbar">
    <h1>${esc(DOC_UI.title[lang])}</h1>
    <div>
      <button class="btn ghost" id="langBtn" type="button">${esc(DOC_UI.langToggle[lang])}</button>
      <button class="btn" type="button" onclick="window.print()">${esc(DOC_UI.print[lang])}</button>
    </div>
  </div>

  <div class="specimen">${bi(SPECIMEN_BANNER)}</div>

  <div class="paper">
    <div class="rhead">
      <div class="t">${bi(REPORT_HEADER.title)}</div>
      <div class="m">${esc(REPORT_HEADER.ref)}</div>
      <div class="m">${esc(REPORT_HEADER.date)}</div>
      <div class="m">${bi(REPORT_HEADER.preparedFor)}</div>
      <div class="m">${bi(REPORT_HEADER.pageOf)}</div>
    </div>

    <div class="scorebox">
      <div class="v">${SCORE.value}<small>/${SCORE.max}</small></div>
      <div><div class="b">${bi(SCORE.band)}</div><p class="note">${bi(SCORE.note)}</p></div>
    </div>
    ${dims}

    ${SECTIONS.map(sectionHtml).join("")}

    <section>
      <h2><span class="num">14</span>${bi(DOC_UI.actions)}</h2>
      <ol style="margin-top:10px;padding-left:20px;color:#475569;font-size:14px;">
        ${RECOMMENDED_ACTIONS.map((a) => `<li style="margin-bottom:8px;">${bi(a)}</li>`).join("")}
      </ol>
    </section>

    <p class="disclaimer">${bi(DISCLAIMER)}</p>
  </div>

  ${buyerBox}

  <p class="foot">${bi(DOC_UI.footnote)}</p>
</div>
<script>
  var lang = "${htmlLang}";
  document.getElementById("langBtn").addEventListener("click", function () {
    lang = lang === "zh" ? "en" : "zh";
    document.querySelectorAll(".bi").forEach(function (el) {
      el.textContent = el.getAttribute("data-" + lang) || el.textContent;
    });
    document.documentElement.lang = lang === "zh" ? "zh" : "en";
  });
</script>
</body>
</html>`;
}

/** 下载文件名（跨消费方统一，避免出现两个不同名字的同一种文件） */
export function standardReportFileName(lang: Lang): string {
  return `factoryauditb2b-standard-report-specimen-${lang}.html`;
}
