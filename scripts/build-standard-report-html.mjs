// 从 lib/standardReport.ts（单一事实来源）生成可预览的 HTML 样张
// 用法: node scripts/build-standard-report-html.mjs
// 输出: .workbuddy/artifacts/standard-report-specimen.html（仅本地预览，不进 public/，不部署）
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const tmp = join(tmpdir(), `std-report-${Date.now()}.mjs`);
await build({
  entryPoints: [join(ROOT, "lib/standardReport.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmp,
  logLevel: "warning",
});
const R = await import(pathToFileURL(tmp).href);

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// 双语节点：data-en / data-zh + 初始显示中文
const bi = (b) => `<span class="bi" data-en="${esc(b.en)}" data-zh="${esc(b.zh)}">${esc(b.zh)}</span>`;

const levelTag = {
  verified: { text: R.EVIDENCE_MARK.verified, cls: "ok" },
  reported: { text: R.EVIDENCE_MARK.reported, cls: "warn" },
  none: { text: R.EVIDENCE_MARK.none, cls: "mut" },
};
const statusBadge = (s) =>
  s === "valid"
    ? { text: { en: "Valid", zh: "有效" }, cls: "ok" }
    : s === "expired"
      ? { text: { en: "Expired", zh: "已过期" }, cls: "bad" }
      : { text: { en: "Not on file", zh: "无记录" }, cls: "mut" };

function sectionHtml(s) {
  let body = "";
  if (s.intro) body += `<p class="note">${bi(s.intro)}</p>`;

  if (s.kind === "fields" && s.fields) {
    body += `<dl>${s.fields
      .map(
        (f) => `<div class="row"><dt>${bi(f.label)}</dt><dd>${esc(f.value)}${
          f.level ? ` <span class="tag ${levelTag[f.level].cls}">${bi(levelTag[f.level].text)}</span>` : ""
        }${f.note ? `<span class="fnote">${bi(f.note)}</span>` : ""}</dd></div>`
      )
      .join("")}</dl>`;
  }

  if (s.kind === "table" && s.table) {
    body += `<div class="tw"><table><thead><tr>${s.table.headers
      .map((h) => `<th>${bi(h)}</th>`)
      .join("")}</tr></thead><tbody>${s.table.rows
      .map(
        (row) =>
          `<tr>${row
            .map((c, ci) => {
              if (s.table.statusCol === ci) {
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
          `<li><div class="tlhead">${it.meta ? `<span class="tlmeta">${esc(it.meta)}</span>` : ""}<span class="tag ${
            it.level === "med" ? "warn" : "ok"
          }">${it.level === "med" ? "关注 / Watch" : "正常 / Low impact"}</span></div><div class="tltitle">${bi(
            it.title
          )}</div>${it.desc ? `<div class="tldesc">${bi(it.desc)}</div>` : ""}</li>`
      )
      .join("")}</ol>`;
  }

  if (s.bullets) {
    body += `<ul class="bl">${s.bullets.map((b) => `<li>${bi(b)}</li>`).join("")}</ul>`;
  }

  return `<section><h2><span class="num">${esc(s.no)}</span>${bi(s.title)}</h2>${body}</section>`;
}

const dims = R.SCORE.dims
  .map(
    (d) => `<div class="dim"><div class="dimtop"><span>${bi(d.label)}</span><b>${d.score}</b></div>
    <div class="bar"><i style="width:${d.score}%"></i></div></div>`
  )
  .join("");

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Standard Supplier Due Diligence Report · 标准版报告样张</title>
<style>
  :root { --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --blue:#0f4c81; }
  * { box-sizing: border-box; }
  body { margin:0; background:#f7f9fc; color:var(--ink);
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
  .wrap { max-width:900px; margin:0 auto; padding:24px 16px 64px; }
  .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
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
  select { padding:8px 10px; border:1px solid var(--line); border-radius:8px; }
  .print-hint { font-size:12px; color:var(--mut); }
  @media print {
    body { background:#fff; } .toolbar, .buyerbox, .print-hint { display:none !important; }
    .paper { border:0; box-shadow:none; padding:0; } .wrap { max-width:none; padding:0; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="toolbar">
    <h1>标准版报告样张 · Standard Report Specimen</h1>
    <div>
      <button class="btn ghost" id="langBtn" type="button">EN / 中文</button>
      <button class="btn" type="button" onclick="window.print()">打印 / 另存为 PDF</button>
    </div>
  </div>

  <div class="specimen">${bi(R.SPECIMEN_BANNER)}</div>

  <div class="paper">
    <div class="rhead">
      <div class="t">${bi(R.REPORT_HEADER.title)}</div>
      <div class="m">${esc(R.REPORT_HEADER.ref)}</div>
      <div class="m">${esc(R.REPORT_HEADER.date)}</div>
      <div class="m">${bi(R.REPORT_HEADER.preparedFor)}</div>
      <div class="m">${bi(R.REPORT_HEADER.pageOf)}</div>
    </div>

    <div class="scorebox">
      <div class="v">${R.SCORE.value}<small>/${R.SCORE.max}</small></div>
      <div><div class="b">${bi(R.SCORE.band)}</div><p class="note">${bi(R.SCORE.note)}</p></div>
    </div>
    ${dims}

    ${R.SECTIONS.map(sectionHtml).join("")}

    <section>
      <h2><span class="num">14</span><span class="bi" data-en="Recommended actions" data-zh="建议行动">建议行动</span></h2>
      <ol style="margin-top:10px;padding-left:20px;color:#475569;font-size:14px;">
        ${R.RECOMMENDED_ACTIONS.map((a) => `<li style="margin-bottom:8px;">${bi(a)}</li>`).join("")}
      </ol>
    </section>

    <p class="disclaimer">${bi(R.DISCLAIMER)}</p>
  </div>

  <div class="buyerbox">
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="badge">ADMIN PREVIEW</span>
      <strong>${bi(R.BUYER_DOWNLOAD.title)}</strong>
    </div>
    <p class="note" style="margin-top:6px;">${bi(R.BUYER_DOWNLOAD.note)}</p>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px;">
      <label><b>${bi(R.BUYER_DOWNLOAD.langLabel)}</b></label>
      <select>${R.REPORT_LANGUAGES.map((l) => `<option>${l}</option>`).join("")}</select>
      <button class="btn" type="button" disabled>${bi(R.BUYER_DOWNLOAD.cta)}</button>
    </div>
    <p style="color:#941b1b;font-size:12px;margin-top:8px;">${bi(R.BUYER_DOWNLOAD.priceNote)}</p>
  </div>

  <p class="print-hint">提示：点「打印 / 另存为 PDF」可导出为 PDF（浏览器打印）。此文件为本地预览，不随站点部署。</p>
</div>
<script>
  var lang = "zh";
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

const outDir = join(ROOT, ".workbuddy", "artifacts");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "standard-report-specimen.html");
writeFileSync(outFile, html, "utf8");
console.log("✅ 生成:", outFile, "(" + html.length + " bytes)");
console.log("   章节数:", R.SECTIONS.length, "| 维度数:", R.SCORE.dims.length);
