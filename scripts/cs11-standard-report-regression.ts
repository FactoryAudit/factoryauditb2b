/**
 * CS-11 回归验证：公开标准报告样板页（/standard-report）+ 下载留资门禁
 *
 * 纯只读校验（除进程内调用 HTML 生成器外不写任何数据、不发任何网络请求）。
 * 运行方式：node scripts/run-regression.mjs cs11-standard-report-regression CS11_ROOT
 *
 * 守护的四件事：
 *   ① 报告全文**免注册可读** —— 正文必须在门禁之前渲染，且页面级没有任何 admin 闸门；
 *   ② **下载才留资** —— 提交走 /api/lead（tool=standard-report-specimen），
 *      且下载件在客户端生成（不存在可绕过留资的静态下载 URL）；
 *   ③ **单一事实源** —— 公开页 / 后台页 / 下载件共用同一个渲染器与同一份数据；
 *   ④ 埋点三桶 —— 点击与提交分属两个桶，不污染转化率。
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { buildStandardReportHtml, standardReportFileName } from "../lib/standardReportHtml";
import { SECTIONS } from "../lib/standardReport";
import {
  ANALYTICS_EVENTS,
  CLICK_LEVEL_EVENTS,
  CONVERSION_EVENTS,
  UNWIRED_EVENTS,
} from "../lib/analytics";

// 注意：本脚本会被 esbuild 打包后执行，__dirname 不可靠。
const ROOT = process.env.CS11_ROOT
  ? path.resolve(process.env.CS11_ROOT)
  : process.cwd();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

const read = (rel: string): string => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
};

const PAGE = "app/[locale]/standard-report/page.tsx";
const FORM = "components/StandardReportDownloadForm.tsx";
const DOC = "components/StandardReportDocument.tsx";
const HTML_LIB = "lib/standardReportHtml.ts";
const ADMIN = "app/[locale]/admin/report-standard/page.tsx";
const GEN_SCRIPT = "scripts/build-standard-report-html.mjs";

// ---------------------------------------------------------------------------
// A. 公开页结构（免注册全文可读）
// ---------------------------------------------------------------------------
section("A. 公开页 /standard-report 结构");
{
  const page = read(PAGE);
  check("A1 页面文件存在", page.length > 0, PAGE);
  check("A2 复用共享渲染器 StandardReportDocument", page.includes("StandardReportDocument"));
  check("A3 挂载下载门禁组件 StandardReportDownloadForm", page.includes("StandardReportDownloadForm"));
  check("A4 用 buildPageMetadata 生成 canonical / hreflang", page.includes("buildPageMetadata"));
  check("A5 有 JSON-LD 结构化数据", page.includes("JsonLd"));
  check("A6 有独立页面浏览埋点标识", page.includes('data-track-page="standard_report"'));
  check("A7 目录锚点覆盖全部章节", page.includes('href={`#s${sec.no}`}'));
  check(
    "A8 🔴 页面级没有任何 admin 闸门（免注册的硬保证）",
    !page.includes("requireAdmin") && !page.includes("isAdmin")
  );
  check(
    "A9 🔴 报告正文渲染在下载门禁之前（先给内容，再要留资）",
    page.indexOf("StandardReportDocument") < page.indexOf("StandardReportDownloadForm"),
    `doc@${page.indexOf("StandardReportDocument")} form@${page.indexOf("StandardReportDownloadForm")}`
  );
}

// ---------------------------------------------------------------------------
// B. 下载门禁语义
// ---------------------------------------------------------------------------
section("B. 下载留资门禁（components/StandardReportDownloadForm.tsx）");
{
  const form = read(FORM);
  check("B1 表单组件存在", form.length > 0, FORM);
  check("B2 🔴 提交走既有 /api/lead 通道（复用限流 + 管理员邮件）", form.includes('"/api/lead"'));
  check("B3 tool 标识为 standard-report-specimen", form.includes('standard-report-specimen'));
  check(
    "B4 🔴 下载件在客户端现场生成（不存在可分享的静态下载 URL）",
    form.includes("buildStandardReportHtml") && form.includes("Blob")
  );
  check("B5 下载文件名来自统一函数", form.includes("standardReportFileName"));
  check(
    "B6 点击层埋点用 *_cta_click（不是转化事件）",
    form.includes("ANALYTICS_EVENTS.standardReportCtaClick")
  );
  check("B7 提交成功才发转化事件", form.includes("ANALYTICS_EVENTS.standardReportSubmit"));
  check(
    "B8 🔴 未解锁时不渲染下载按钮（downloadCta 只在 unlocked 分支）",
    form.indexOf("if (unlocked)") > 0 &&
      form.indexOf("if (unlocked)") < form.lastIndexOf("labels.downloadCta"),
    `unlocked@${form.indexOf("if (unlocked)")} cta@${form.lastIndexOf("labels.downloadCta")}`
  );
  check("B9 解锁态只存 sessionStorage（体验优化，非安全边界）", form.includes("sessionStorage"));
  check("B10 收集姓名/邮箱/公司三项必填", /required/.test(form) && form.includes("std-company"));
  check(
    "B11 语言等结构化信息拼进 message（绕开 notifyAdminNewLead 字段丢失问题）",
    form.includes("Report language:")
  );
}

// ---------------------------------------------------------------------------
// C. 单一事实源（四处消费方共用一个渲染器）
// ---------------------------------------------------------------------------
section("C. 单一事实源");
{
  const lib = read(HTML_LIB);
  const admin = read(ADMIN);
  const doc = read(DOC);
  const gen = read(GEN_SCRIPT);

  check("C1 HTML 生成器存在并导出两个函数", lib.includes("export function buildStandardReportHtml") && lib.includes("export function standardReportFileName"));
  check(
    "C2 🔴 生成器用相对路径 import（esbuild 脚本与 Next 两侧都能解析）",
    lib.includes('from "./standardReport"')
  );
  check(
    "C3 🔴 本地预览脚本不再自己拼 HTML（改为调用生成器）",
    gen.includes("buildStandardReportHtml") && !gen.includes("<!DOCTYPE html>")
  );
  check("C4 本地预览脚本仍保留后台演示框（adminPreview: true）", gen.includes("adminPreview: true"));
  check("C5 🔴 后台页改用共享渲染器", admin.includes("StandardReportDocument"));
  check(
    "C6 🔴 后台页 admin 闸门未丢（requireAdmin + notFound）",
    admin.includes("requireAdmin") && admin.includes("notFound()")
  );
  check("C7 后台页保留 noindex", admin.includes("index: false"));
  check(
    "C8 🔴 生成器默认不含 ADMIN PREVIEW 框（公开下载件不能出现）",
    /const adminPreview = opts\.adminPreview === true/.test(lib) && lib.includes("adminPreview\n    ? `<div class=\"buyerbox\">")
  );
  check("C9 报告正文渲染器与章节数一致", doc.includes("SECTIONS.map") && SECTIONS.length === 13);
  check("C10 章节带锚点 id（供公开页目录跳转）", doc.includes("id={`s${s.no}`}"));
}

// ---------------------------------------------------------------------------
// D. 生成器运行时行为
// ---------------------------------------------------------------------------
section("D. HTML 生成器运行时行为");
{
  const enHtml = buildStandardReportHtml("en");
  const zhHtml = buildStandardReportHtml("zh");
  const adminHtml = buildStandardReportHtml("en", { adminPreview: true });

  check("D1 en 版初始显示英文（执行摘要）", enHtml.includes(">Executive summary<"));
  check("D2 zh 版初始显示中文（执行摘要）", zhHtml.includes(">执行摘要<"));
  check("D3 双语都在 DOM 里（可一键切换）", enHtml.includes('data-zh="执行摘要"'));
  check("D4 🔴 默认（公开）版本不含 ADMIN PREVIEW", !enHtml.includes("ADMIN PREVIEW"));
  check("D5 后台预览版本含 ADMIN PREVIEW", adminHtml.includes("ADMIN PREVIEW"));
  check("D6 下载件自带 noindex（不进搜索引擎）", enHtml.includes('name="robots" content="noindex"'));
  check("D7 样张声明存在（反伪造铁律）", enHtml.includes("STANDARD SPECIMEN"));
  // 13 个章节 + 末尾「建议行动」一段，共 14 个带序号的小标题
  check(
    "D8 13 个章节 + 建议行动共 14 段全部渲染",
    (enHtml.match(/class="num"/g) ?? []).length === 14,
    String((enHtml.match(/class="num"/g) ?? []).length)
  );
  check("D9 自包含（内联样式，可离线打开）", enHtml.includes("<style>") && !/<link[^>]+stylesheet/.test(enHtml));
  check("D10 文件名带语言后缀", standardReportFileName("zh").endsWith("-zh.html"));
}

// ---------------------------------------------------------------------------
// E. 埋点三桶
// ---------------------------------------------------------------------------
section("E. 埋点三桶（CS-04 口径）");
{
  const conv = new Set<string>(CONVERSION_EVENTS as readonly string[]);
  const click = new Set<string>(CLICK_LEVEL_EVENTS as readonly string[]);
  const unwired = new Set<string>(UNWIRED_EVENTS as readonly string[]);

  check("E1 standardReportSubmit 在转化桶", conv.has(ANALYTICS_EVENTS.standardReportSubmit));
  check("E2 standardReportCtaClick 在点击桶", click.has(ANALYTICS_EVENTS.standardReportCtaClick));
  check("E3 点击桶事件不在转化桶", !conv.has(ANALYTICS_EVENTS.standardReportCtaClick));
  check("E4 转化事件不在点击桶", !click.has(ANALYTICS_EVENTS.standardReportSubmit));
  check("E5 两者都不在未接线桶", !unwired.has(ANALYTICS_EVENTS.standardReportSubmit) && !unwired.has(ANALYTICS_EVENTS.standardReportCtaClick));
  check("E6 点击事件名以 _cta_click 结尾（命名公约）", ANALYTICS_EVENTS.standardReportCtaClick.endsWith("_cta_click"));
}

// ---------------------------------------------------------------------------
// F. 站点入口（可发现性）
// ---------------------------------------------------------------------------
section("F. 站点入口");
{
  check("F1 sitemap 收录 /standard-report", read("app/sitemap.ts").includes('"/standard-report"'));
  check("F2 llms.txt 收录 /standard-report", read("app/llms.txt/route.ts").includes("${BASE}/standard-report"));
  const footer = read("components/SiteFooter.tsx");
  check("F3 页脚有链接", footer.includes('p("/standard-report")'));
  check("F4 FooterDict 类型声明含 standardReport", footer.includes("standardReport: string;"));
}

// ---------------------------------------------------------------------------
// G. 九语字典
// ---------------------------------------------------------------------------
section("G. 九语字典");
{
  const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
  const en = JSON.parse(read("i18n/dictionaries/en.json"));
  const KEYS = Object.keys(en.standardReport ?? {});
  check("G1 standardReport 命名空间存在", KEYS.length > 0);
  check("G2 en 键数 = 27", KEYS.length === 27, `实际 ${KEYS.length}`);

  for (const loc of LOCALES) {
    const dict = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
    const ns = dict?.standardReport ?? {};
    const missing = KEYS.filter((k) => typeof ns[k] !== "string" || ns[k].trim() === "");
    check(`G3 ${loc} 的 standardReport 27 键齐备且非空`, missing.length === 0, missing.join(","));
    check(`G4 ${loc} footer.standardReport 非空`, typeof dict?.footer?.standardReport === "string" && dict.footer.standardReport.trim() !== "");
  }

  // 门禁表单的每个 label 都必须来自字典（禁止硬编码文案）
  const form = read(FORM);
  const labelProps = (form.match(/labels\.[a-zA-Z]+/g) ?? []).map((m) => m.replace("labels.", ""));
  const hardCoded = [...new Set(labelProps)].filter((k) => !KEYS.includes(k));
  check("G5 表单所有文案都来自字典（无硬编码）", hardCoded.length === 0, hardCoded.join(","));
}

console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-11 公开标准报告回归：${pass} PASS / 0 FAIL   （ROOT=${ROOT}）`);
} else {
  console.log(`CS-11 公开标准报告回归：${pass} PASS / ${fail} FAIL`);
  failures.forEach((f) => console.log(`  - ${f}`));
}
console.log("============================================================");
process.exit(fail === 0 ? 0 : 1);
