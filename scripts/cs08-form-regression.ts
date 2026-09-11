// scripts/cs08-form-regression.ts —— CS-08 入驻表优化回归（只读，fail 时退出码 1）
//
// 守护四件事：
//   1) 证书从「单个文本框」升级为「可重复结构化行」（名称/编号/签发日/有效期 + 增删）。
//   2) 「我要获得证书」咨询弹窗：独立表单（不嵌套主表单）→ POST kind="certification_request"。
//   3) /api/supplier-register 分流不破坏既有入驻契约（26 字段白名单逐条仍在、限流仍在最前）。
//   4) 九语字典同步（18 新键 × 9 语），叶子数仍与 cs06a C8 常量同源。
//
// 为什么不写浏览器测试：本 CS 零后端依赖（只发邮件），
// 而"表单是不是真的渲染成 date 控件 / 弹窗是不是独立表单"这类**结构**问题
// 不会让 tsc 报错、不会 500，只能靠源码级断言守住。
//
// 用法：
//   node scripts/run-regression.mjs cs08-form-regression CS08_ROOT

import * as fs from "node:fs";
import * as path from "node:path";
import {
  REGISTRATION_FIELDS,
  CERTIFICATE_ROW_FIELDS,
  CERTIFICATION_REQUEST_FIELDS,
  CERTIFICATE_MAX_ROWS,
  CERTIFICATION_REQUEST_KIND,
} from "../lib/supplierNetwork";

const ROOT = process.env.CS08_ROOT ?? process.cwd();

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ""}`);
  }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const FORM = "components/SupplierRegistrationForm.tsx";
const ROUTE = "app/api/supplier-register/route.ts";
const NOTIFY = "lib/notify.ts";
const NETWORK = "lib/supplierNetwork.ts";

// 纯 UI 文案键（新增 9 个；只存在于字典 supplierNetwork.form.labels）
const LABEL_ONLY_KEYS = [
  "certAdd",
  "certRemove",
  "certHelpOpen",
  "certHelpTitle",
  "certHelpLead",
  "certHelpSubmit",
  "certHelpSubmitting",
  "certHelpSuccess",
  "certHelpError",
];

console.log("\n=== A. 组件 —— 结构化证书子表单 ===");
const formSrc = read(FORM);
check("A1 组件可读且非空", formSrc.length > 1000);

// SECTION_FIELDS 里 certificates 必须已摘除（否则会渲染出一个无用的空文本框）
const sectionBlock = formSrc.slice(formSrc.indexOf("const SECTION_FIELDS"), formSrc.indexOf("const REQUIRED"));
check("A2 SECTION_FIELDS 不再包含 certificates（结构化子表单接管）", !/certificates\s*:/.test(sectionBlock));

check("A3 四个证书行字段全部由字典供给", CERTIFICATE_ROW_FIELDS.every((k) => formSrc.includes(`t.labels.${k}`)));
check("A4 certIssued 用 date 控件", /id=\{`cert-issued-\$\{i\}`\}[\s\S]{0,220}type="date"/.test(formSrc));
check("A5 certExpires 用 date 控件", /id=\{`cert-expires-\$\{i\}`\}[\s\S]{0,220}type="date"/.test(formSrc));
check("A6 受控输入：证书行绑定 value + onChange", /value=\{row\.name\}[\s\S]{0,120}onChange=\{\(e\) => setCert\(i, \{ name: e\.target\.value \}\)\}/.test(formSrc));
check("A7 有「添加更多」（addCert）且受上限保护", formSrc.includes("const addCert") && formSrc.includes("MAX_CERTS"));
check("A8 有「移除」（removeCert）", formSrc.includes("const removeCert"));
check("A9 至少保留 1 行（移除到 0 行时回到空行）", /removeCert[\s\S]{0,200}prev\.length <= 1 \? \[\{ \.\.\.EMPTY_CERT \}\]/.test(formSrc));

// 序列化：两个派生键
check("A10 人类可读 certificates（多行 + Valid until）", /fields\.certificates = certList[\s\S]{0,400}Valid until/.test(formSrc));
check("A11 结构化 certificatesJson（JSON.stringify）", /fields\.certificatesJson = JSON\.stringify\(certList\)/.test(formSrc));
check("A12 全空行被过滤（不产生空证书记录）", /\.filter\(\(c\) => c\.name \|\| c\.number \|\| c\.issued \|\| c\.expires\)/.test(formSrc));
check("A13 提交成功后证书行被重置", /setStatus\("ok"\)[\s\S]{0,200}setCerts\(\[\{ \.\.\.EMPTY_CERT \}\]\)/.test(formSrc));

console.log("\n=== B. 组件 —— 「我要获得证书」咨询弹窗 ===");
check("B1 入口按钮来自字典（certHelpOpen）", formSrc.includes("t.labels.certHelpOpen"));
check("B2 弹窗标题/说明来自字典", formSrc.includes("t.labels.certHelpTitle") && formSrc.includes("t.labels.certHelpLead"));
check("B3 5 个咨询字段全部来自字典", CERTIFICATION_REQUEST_FIELDS.every((k) => formSrc.includes(`t.labels.${k}`)));
check("B4 弹窗提交 kind: certification_request", formSrc.includes(`kind: "${CERTIFICATION_REQUEST_KIND}"`));
check("B5 按钮 type=button（不会误触主表单提交）", /onClick=\{\(\) => \{[\s\S]{0,80}setHelpOpen\(true\);[\s\S]{0,80}\}/.test(formSrc) && formSrc.includes('type="button"'));
// 结构断言：弹窗必须是主 <form> 的兄弟节点（嵌套 <form> 是非法 HTML）
const mainFormStart = formSrc.indexOf("<form onSubmit={handleSubmit}");
const mainFormEnd = formSrc.indexOf("</form>", mainFormStart);
const helpFormStart = formSrc.indexOf("<form onSubmit={handleHelpSubmit}");
check("B6 弹窗表单存在且在主表单之外（不嵌套）", helpFormStart > mainFormEnd);
check("B7 弹窗有成功态与错误态文案", formSrc.includes("t.labels.certHelpSuccess") && formSrc.includes("t.labels.certHelpError"));
check("B8 弹窗提交态文案（submitting）", formSrc.includes("t.labels.certHelpSubmitting"));

console.log("\n=== C. 组件 —— 未新增埋点（CS-04 三桶铁律） ===");
const eventRefs = [...formSrc.matchAll(/ANALYTICS_EVENTS\.(\w+)/g)].map((m) => m[1]);
const uniqEvents = [...new Set(eventRefs)].sort();
check(
  "C1 只引用既有事件 supplierNetworkStart / supplierNetworkSubmit",
  uniqEvents.length === 2 && uniqEvents[0] === "supplierNetworkStart" && uniqEvents[1] === "supplierNetworkSubmit",
  uniqEvents.join(",")
);
check("C2 咨询弹窗不发任何 GA4 事件", !/handleHelpSubmit[\s\S]*?trackEvent/.test(formSrc.split("async function handleHelpSubmit")[1]?.slice(0, 1200) ?? ""));

console.log("\n=== D. /api/supplier-register —— 分流不破坏既有契约 ===");
const routeSrc = read(ROUTE);
check("D1 路由可读", routeSrc.length > 500);
check("D2 导入咨询字段清单与 kind 常量", routeSrc.includes("CERTIFICATION_REQUEST_FIELDS") && routeSrc.includes("CERTIFICATION_REQUEST_KIND"));
check("D3 存在分流分支", new RegExp(`if \\(kind === CERTIFICATION_REQUEST_KIND\\)`).test(routeSrc));
check("D4 咨询分支校验必填（wanted + email）", /certification required/.test(routeSrc) && /email required/.test(routeSrc) && /invalid_email/.test(routeSrc));
check("D5 咨询分支只发 notifyAdminCertificationRequest", routeSrc.includes("notifyAdminCertificationRequest({ id: requestId, fields: cr })"));

// 咨询分支不得触发供应商回执/入驻邮件（否则污染 Supplier Master Sheet 语义）
const certBranch = routeSrc.slice(routeSrc.indexOf(`if (kind === CERTIFICATION_REQUEST_KIND)`), routeSrc.indexOf("—— 分支 B"));
check(
  "D6 咨询分支不调用入驻/回执邮件",
  !certBranch.includes("notifyAdminSupplierRegistration") && !certBranch.includes("notifySupplierReceived")
);
check("D7 咨询分支返回 requestId", /NextResponse\.json\(\{ ok: true, requestId \}\)/.test(routeSrc));

// 26 字段白名单逐条仍在
const missingFields = REGISTRATION_FIELDS.filter((k) => !new RegExp(`"${k}"`).test(routeSrc));
check(`D8 既有 ${REGISTRATION_FIELDS.length} 个入驻字段白名单逐条仍在`, missingFields.length === 0, missingFields.join(","));
check("D9 白名单新增 certificatesJson（结构化证书）", routeSrc.includes('"certificatesJson"'));
check("D10 入驻路径响应契约未变（仍返回 supplierId）", /NextResponse\.json\(\{ ok: true, supplierId: id \}\)/.test(routeSrc));

// 限流必须仍在解析 body 之前（fail-open 前置于一切 IO）
const rlIdx = routeSrc.indexOf("checkRateLimit(");
const jsonIdx = routeSrc.indexOf("await req.json()");
check("D11 限流仍在 body 解析之前", rlIdx > 0 && jsonIdx > 0 && rlIdx < jsonIdx);

// 长度上限
check("D12 certificates / certificatesJson 归入长文本（5000）", /LONG_TEXT_FIELDS = new Set<string>\(\["message", "certificates", "certificatesJson"\]\)/.test(routeSrc));
check("D13 certHelpWanted / certHelpNote 归入中文本（500）", /MEDIUM_TEXT_FIELDS = new Set<string>\(\["certHelpWanted", "certHelpNote"\]\)/.test(routeSrc));
// 泛型标注防 TS2345（曾多次踩坑）
check("D14 Set 显式泛型 Set<string>（防 TS2345）", routeSrc.includes("new Set<string>("));

console.log("\n=== E. lib/notify.ts —— 新增管理员通知 ===");
const notifySrc = read(NOTIFY);
check("E1 导出 notifyAdminCertificationRequest", notifySrc.includes("export async function notifyAdminCertificationRequest"));
const certNotify = notifySrc.slice(notifySrc.indexOf("export async function notifyAdminCertificationRequest"));
const certNotifyBody = certNotify.slice(0, certNotify.indexOf("\n// ----------"));
check("E2 未配置 NOTIFY_ADMIN_EMAIL 时降级返回（不抛错）", /NOTIFY_ADMIN_EMAIL 未配置，跳过认证辅导需求通知/.test(certNotifyBody));
check("E3 subject 含 Certification Consulting Request", /Certification Consulting Request \$\{data\.id\}/.test(certNotifyBody));
check("E4 正文覆盖 5 个咨询字段", CERTIFICATION_REQUEST_FIELDS.every((k) => certNotifyBody.includes(`f.${k}`)));
check("E5 走统一 sendMail 通道", certNotifyBody.includes("return sendMail({"));
check("E6 原 4 个通知函数未被破坏", [
  "export async function notifyAdminSupplierRegistration",
  "export async function notifySupplierReceived",
  "export async function notifyAdminBuyerRegister",
  "export async function notifyAdminNewLead",
].every((s) => notifySrc.includes(s)));

console.log("\n=== F. lib/supplierNetwork.ts —— 单一事实源 ===");
const netSrc = read(NETWORK);
check("F1 CERTIFICATE_ROW_FIELDS 四字段", CERTIFICATE_ROW_FIELDS.length === 4 && CERTIFICATE_ROW_FIELDS.join(",") === "certName,certNumber,certIssued,certExpires");
check("F2 CERTIFICATION_REQUEST_FIELDS 五字段", CERTIFICATION_REQUEST_FIELDS.length === 5);
check("F3 CERTIFICATE_MAX_ROWS = 10", CERTIFICATE_MAX_ROWS === 10);
check("F4 CERTIFICATION_REQUEST_KIND = certification_request", CERTIFICATION_REQUEST_KIND === "certification_request");
check("F5 REGISTRATION_FIELDS 26 字段未被增删", REGISTRATION_FIELDS.length === 26, `实际 ${REGISTRATION_FIELDS.length}`);
// 结构字段（9 个）必须在 lib/supplierNetwork.ts 声明；纯 UI 文案键（certAdd/certRemove/certHelp*，9 个）
// 只应存在于字典 —— 由 G2 逐语言守护。两处都断言，但各管各的。
const STRUCT_KEYS = [...CERTIFICATE_ROW_FIELDS, ...CERTIFICATION_REQUEST_FIELDS];
check("F6 9 个结构字段已在 lib/supplierNetwork.ts 声明", STRUCT_KEYS.every((k) => netSrc.includes(`"${k}"`)), STRUCT_KEYS.filter((k) => !netSrc.includes(`"${k}"`)).join(","));
check("F7 纯 UI 文案键不进结构文件（保持字典单一来源）", LABEL_ONLY_KEYS.every((k) => !netSrc.includes(`"${k}"`)), LABEL_ONLY_KEYS.filter((k) => netSrc.includes(`"${k}"`)).join(","));

// 18 个新键 = 9 结构 + 9 纯文案
function certHelpKeys(): string[] {
  return [...STRUCT_KEYS, ...LABEL_ONLY_KEYS];
}

console.log("\n=== G. 九语字典同步 ===");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
const NEW_KEYS = certHelpKeys();
let leafCounts: number[] = [];
function leaves(obj: unknown, prefix = "", out: string[] = []): string[] {
  if (obj === null || typeof obj !== "object") {
    out.push(prefix);
    return out;
  }
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    leaves((obj as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}
for (const loc of LOCALES) {
  const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  check(`G1 ${loc}.json 存在`, fs.existsSync(p));
  const dict = JSON.parse(fs.readFileSync(p, "utf8"));
  const labels = dict?.supplierNetwork?.form?.labels ?? {};
  const missing = NEW_KEYS.filter((k) => typeof labels[k] !== "string" || labels[k].trim() === "");
  check(`G2 ${loc} 的 ${NEW_KEYS.length} 个新键齐备且非空`, missing.length === 0, missing.join(","));
  const lv = leaves(dict);
  leafCounts.push(lv.length);
}
check("G3 九语叶子数完全一致", new Set(leafCounts).size === 1, leafCounts.join("/"));
check("G4 叶子数 = 2666（与 cs06a C8 常量同源；再改字典必须两处同改）", leafCounts[0] === 2666, `实际 ${leafCounts[0]}`);
check("G5 cs06a 回归里的 C8 常量已同步为 2666", read("scripts/cs06a-directory-regression.ts").includes("baseKeys.length === 2666"));

console.log("\n============================================================");
if (fail === 0) {
  console.log(`CS-08 入驻表回归：${pass} PASS / 0 FAIL   （ROOT=${ROOT}）`);
  console.log("全部通过 ✓");
} else {
  console.log(`CS-08 入驻表回归：${pass} PASS / ${fail} FAIL   （ROOT=${ROOT}）`);
  process.exit(1);
}
