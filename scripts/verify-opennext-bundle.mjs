// 部署前产物验证：确认 CS-08 / CS-11 / CS-12 真的进了 Worker 产物，且无密钥明文
import fs from "node:fs";

// 页面/组件代码只在 server-functions 的 handler 里；middleware 只做密钥自检
const FILES = [
  ".open-next/server-functions/default/handler.mjs",
  ".open-next/middleware/handler.mjs",
];

// needle 必须能扛住压缩：优先选「字符串字面量」，而非会被重命名的标识符
const PAGE_PROBES = [
  ["CS11 转化事件 standard_report_submit", "standard_report_submit"],
  ["CS11 点击事件 standard_report_cta_click", "standard_report_cta_click"],
  ["CS11 下载文件名前缀", "factoryauditb2b-standard-report-specimen"],
  ["CS11 留资 tool 标识", "standard-report-specimen"],
  ["CS11 锁定态 DOM 分支 std-form-lang", "std-form-lang"],
  ["CS11 解锁态 DOM 分支 std-report-lang", "std-report-lang"],
  ["CS11 章节锚点（scroll-mt-20 类名）", "scroll-mt-20"],
  ["CS08 埋点 supplierNetworkSubmit", "supplierNetworkSubmit"],
  ["CS08 结构化证书字段 certStatus", "certStatus"],
  // CS-12：登记信息区块 / 自述证书区块的 DOM id（字面量，压缩后仍在）
  ["CS12 登记信息区块 id profile-registration", "profile-registration"],
  ["CS12 自述证书区块 id profile-self-certs", "profile-self-certs"],
  ["CS12 自述证书字段 selfReportedCertificates", "selfReportedCertificates"],
  ["CS12 产能字段 exportSince", "exportSince"],
];

const LEAKS = [
  "CLOUDFLARE_API_TOKEN=",
  'SUPABASE_SERVICE_ROLE_KEY="sb_secret',
  'MAIL_HTTP_KEY="re_',
  "STRIPE_SECRET_KEY=",
  // CS-12 新增：管理令牌（可改库结构）绝不允许随 Worker 上传。
  // 用变量名 + PAT 前缀做 needle，不把真 token 片段写进仓库。
  "SUPABASE_ACCESS_TOKEN",
  "sbp_",
];

let fail = 0;

for (const f of FILES) {
  if (!fs.existsSync(f)) {
    console.log("FAIL  缺失产物", f);
    fail++;
    continue;
  }
  const s = fs.readFileSync(f, "utf8");
  console.log("=== " + f + " (" + (Buffer.byteLength(s) / 1048576).toFixed(2) + " MB) ===");
  if (f.includes("server-functions")) {
    for (const [label, needle] of PAGE_PROBES) {
      const n = s.split(needle).length - 1;
      console.log((n > 0 ? "PASS " : "FAIL ") + label + " -> " + n);
      if (n === 0) fail++;
    }
  } else {
    console.log("(middleware 不含页面代码，仅做密钥自检)");
  }
  console.log("--- 密钥自检 ---");
  for (const k of LEAKS) {
    const bad = s.includes(k);
    console.log((bad ? "FAIL 泄漏 " : "PASS 干净 ") + k);
    if (bad) fail++;
  }
}

// 字典叶子数（en 为单一事实源）
const en = ".open-next/server-functions/default/i18n/dictionaries/en.json";
if (fs.existsSync(en)) {
  const obj = JSON.parse(fs.readFileSync(en, "utf8"));
  const cnt = (function c(o) {
    let n = 0;
    for (const v of Object.values(o)) n += v && typeof v === "object" ? c(v) : 1;
    return n;
  })(obj);
  console.log("=== 产物内 en 字典叶子数 = " + cnt + " (期望 2822) ===");
  if (cnt !== 2822) fail++;
} else {
  console.log("FAIL  产物内缺失 en 字典");
  fail++;
}

console.log(fail === 0 ? "\nALL PASS" : "\nFAIL 数 " + fail);
process.exit(fail === 0 ? 0 : 1);
