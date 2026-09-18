// 部署前产物验证：确认 CS-08 / CS-11 / CS-12 真的进了 Worker 产物，且无密钥明文；
// 并确认 CS-19 的预渲染产物真的落进了 Workers 静态资源目录（见文件末尾「闸门」段）。
import fs from "node:fs";
import path from "node:path";

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
  console.log("=== 产物内 en 字典叶子数 = " + cnt + " (期望 2824) ===");
  if (cnt !== 2824) fail++;
} else {
  console.log("FAIL  产物内缺失 en 字典");
  fail++;
}

// ── 闸门：CS-19 预渲染产物是否真的落进 Workers 静态资源 ────────────────────
//
// 为什么需要这道闸门（2026-09-18 事故）：
//   `open-next.config.ts` 选 `staticAssetsIncrementalCache` 后，预渲染产物必须由
//   `opennextjs-cloudflare populateCache` 复制进 `assets/cdn-cgi/_next_cache/`。
//   但该命令**不在 `build` 流程里** —— 它只挂在 `deploy` 子命令下
//   （见 @opennextjs/cloudflare/dist/cli/commands/deploy.js）。
//   本仓库走的是「opennext build → wrangler deploy」手工链路，
//   于是 1454 个 `.cache`（151.6 MB）被整批丢弃、**零报错**，
//   线上因此退化为每请求现场 SSR；CF 免费版 CPU 上限 10 ms ⇒ Error 1102 复发。
//   事故的根因不是配置错，而是**没有任何断言检查这步是否发生过**。
//
// 判定依据：worker 运行时用 `process.env.OPEN_NEXT_BUILD_ID ?? "no-build-id"`
//   拼 `cdn-cgi/_next_cache/<buildId>/<key>.cache`，而该变量由
//   `@opennextjs/aws/dist/adapters/config/index.js` 在运行时从
//   `NextConfig.deploymentId ?? BuildId` 赋值。本仓库未设 deploymentId
//   ⇒ buildId 必须与 `.next/BUILD_ID` 完全一致，否则 404。
const BUILD_ID_FILE = ".next/BUILD_ID";
const CACHE_SRC = ".open-next/cache";
const CACHE_DST = path.join(".open-next", "assets", "cdn-cgi", "_next_cache");

/** 递归统计目录下的文件（返回 相对路径 -> 字节数） */
function walkFiles(dir) {
  const out = new Map();
  if (!fs.existsSync(dir)) return out;
  (function rec(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) rec(p);
      else out.set(path.relative(dir, p).split(path.sep).join("/"), st.size);
    }
  })(dir);
  return out;
}

console.log("=== 闸门：预渲染产物落地 ===");

if (!fs.existsSync(BUILD_ID_FILE)) {
  console.log("FAIL  缺失 " + BUILD_ID_FILE);
  fail++;
} else {
  const buildId = fs.readFileSync(BUILD_ID_FILE, "utf8").trim();
  console.log("buildId = " + buildId);

  // 1) 编译后的 OpenNext 配置必须仍是静态资源增量缓存（防有人改回 dummy）
  const compiled = ".open-next/.build/open-next.config.edge.mjs";
  const cfgOk =
    fs.existsSync(compiled) &&
    fs.readFileSync(compiled, "utf8").includes("cf-static-assets-incremental-cache");
  console.log((cfgOk ? "PASS " : "FAIL ") + "编译后配置含 cf-static-assets-incremental-cache");
  if (!cfgOk) fail++;

  // 2) 源与目标逐项对齐（分 cache 与 __fetch 两支）
  for (const [label, sub] of [
    ["页面缓存", buildId],
    ["fetch 缓存", path.join("__fetch", buildId)],
  ]) {
    const srcMap = walkFiles(path.join(CACHE_SRC, sub));
    const dstMap = walkFiles(path.join(CACHE_DST, sub));
    const same =
      srcMap.size > 0 &&
      srcMap.size === dstMap.size &&
      [...srcMap].every(([k, v]) => dstMap.get(k) === v);
    console.log(
      (same ? "PASS " : "FAIL ") +
        label +
        " -> 源 " +
        srcMap.size +
        " / 目标 " +
        dstMap.size +
        "（大小逐项一致）"
    );
    if (!same) fail++;
  }

  // 3) 路径契约：非 __fetch 的缓存文件必须以 .cache 结尾
  //    （getAssetUrl 对 cacheType!="fetch" 恒追加 .cache，否则永不命中）
  const badExt = [...walkFiles(path.join(CACHE_DST, buildId)).keys()].filter(
    (k) => !k.endsWith(".cache")
  );
  console.log((badExt.length === 0 ? "PASS " : "FAIL ") + "全部以 .cache 结尾");
  if (badExt.length > 0) fail++;

  // 4) CF 免费版静态资源硬限制：文件数 20,000 / 单文件 25 MiB
  const all = walkFiles(".open-next/assets");
  const maxBytes = Math.max(0, ...all.values());
  const countOk = all.size <= 20000;
  const sizeOk = maxBytes <= 25 * 1024 * 1024;
  console.log(
    (countOk ? "PASS " : "FAIL ") +
      "assets 文件数 " +
      all.size +
      " <= 20000（CF Free）"
  );
  console.log(
    (sizeOk ? "PASS " : "FAIL ") +
      "单文件最大 " +
      (maxBytes / 1048576).toFixed(2) +
      " MiB <= 25 MiB（CF Free）"
  );
  if (!countOk) fail++;
  if (!sizeOk) fail++;
}

console.log(fail === 0 ? "\nALL PASS" : "\nFAIL 数 " + fail);
process.exit(fail === 0 ? 0 : 1);
