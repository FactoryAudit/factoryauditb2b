// scripts/apply-r66-signin-entry-i18n.cjs —— R66「恢复登录入口」字典注入 + 叶子数常量同步
//
// 背景：2026-10-08「顶栏控件统一」把 AccountMenu 游客态从 Sign in 换成了 WhatsApp 胶囊，
//   注释写明「不再渲染 /login 入口」⇒ 全站顶栏 + 移动抽屉同时失去登录入口，而 /login 页
//   与 /api/auth/* 后端都还在（线上 200）。accountMenu.signIn 因此变成死键。
//   本次恢复：顶栏游客态 = Sign in（复用 auth.accountMenu.signIn）+ WhatsApp 图标胶囊；
//   /register 页补「已有账号 → 去登录」回链。
//
// 字典改动：**只新增 1 个键** register.haveAccount（字符串叶）× 9 语
//   ⇒ en 叶子数 3292 → 3293（3286 字符串 → 3287 字符串 + 4 boolean）。
//   链接文案复用既有 auth.accountMenu.signIn（9 语齐全），故不新增第二个键。
//
// 铁律：
//   · 只增不删、幂等（已存在的键不覆盖）；
//   · 字典一律保持「纯 CRLF + 末尾 CRLF」（cs13 F1d 门禁）；
//   · 叶子数常量按 RELEASE-RULES 规则 3 的 8 处同源同步（实为 11 个脚本 + RELEASE-RULES.md）。
// 跑法：node scripts/apply-r66-signin-entry-i18n.cjs

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DICT_DIR = path.join(ROOT, "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

// 文案口径严格对齐各语既有 login.noAccount 的语气（见 i18n/dictionaries/*.json）：
//   en "Don't have an account?" / ja "アカウントをお持ちでない場合" / de "Noch kein Konto?" …
const HAVE_ACCOUNT = {
  en: "Already have an account?",
  zh: "已有账号？",
  "zh-TW": "已有帳號？",
  ja: "すでにアカウントをお持ちの場合",
  es: "¿Ya tienes cuenta?",
  de: "Bereits ein Konto?",
  fr: "Vous avez déjà un compte ?",
  pt: "Já tem uma conta?",
  ar: "لديك حساب بالفعل؟",
};

function leaves(o) {
  let n = 0;
  const walk = (x) => {
    if (x !== null && typeof x === "object") {
      if (Array.isArray(x)) x.forEach(walk);
      else Object.values(x).forEach(walk);
    } else n++;
  };
  walk(o);
  return n;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** 保持原文件行尾：CRLF → CRLF + 末尾 CRLF；LF → LF + 末尾 LF */
function writeKeepEol(file, obj) {
  const original = fs.readFileSync(file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const text =
    JSON.stringify(obj, null, 2).replace(/\r\n/g, "\n").replace(/\n/g, eol) + eol;
  fs.writeFileSync(file, text, "utf8");
}

// ============================================================================
// 1. 注入 register.haveAccount（插在 membershipLink 之后，保持人读顺序）
// ============================================================================
console.log("=== 1. 字典注入 ===");
let added = 0;
for (const loc of LOCALES) {
  const file = path.join(DICT_DIR, `${loc}.json`);
  if (!fs.existsSync(file)) throw new Error(`字典不存在：${file}`);
  const dict = readJson(file);
  if (!dict.register || typeof dict.register !== "object") {
    throw new Error(`${loc}.json 缺 register 命名空间`);
  }
  const existed = dict.register.haveAccount !== undefined;
  if (!existed) {
    const next = {};
    for (const [k, v] of Object.entries(dict.register)) {
      next[k] = v;
      if (k === "membershipLink") next.haveAccount = HAVE_ACCOUNT[loc];
    }
    if (next.haveAccount === undefined) next.haveAccount = HAVE_ACCOUNT[loc]; // 兜底
    dict.register = next;
    writeKeepEol(file, dict);
    added++;
  }
  console.log(
    `${loc.padEnd(6)} ${existed ? "SKIP(已存在)" : "+1"}  leaves=${leaves(dict)}  "${dict.register.haveAccount}"`
  );
}
console.log(`新增键：${added} 个语种（其余为幂等跳过）`);

// ============================================================================
// 2. 自检：九语键集一致 + 无空值 + 叶子数一致 + 行尾仍为纯 CRLF
// ============================================================================
console.log("\n=== 2. 自检 ===");
const dicts = Object.fromEntries(
  LOCALES.map((l) => [l, readJson(path.join(DICT_DIR, `${l}.json`))])
);
const enKeys = Object.keys(dicts.en.register).sort().join("|");
let problems = [];
for (const loc of LOCALES) {
  const f = path.join(DICT_DIR, `${loc}.json`);
  const raw = fs.readFileSync(f, "utf8");
  const crlf = (raw.match(/\r\n/g) || []).length;
  const lf = (raw.match(/\n/g) || []).length;
  if (lf - crlf !== 0) problems.push(`${loc}: 存在裸 LF ${lf - crlf} 处`);
  if (!raw.endsWith("\r\n")) problems.push(`${loc}: 末尾不是 CRLF`);
  if (Object.keys(dicts[loc].register).sort().join("|") !== enKeys) {
    problems.push(`${loc}: register 键集与 en 不一致`);
  }
  for (const [k, v] of Object.entries(dicts[loc].register)) {
    if (typeof v === "string" && v.trim() === "") problems.push(`${loc}.register.${k}: 空值`);
  }
}
const leafList = LOCALES.map((l) => leaves(dicts[l]));
if (new Set(leafList).size !== 1) problems.push(`九语叶子数不一致：${leafList.join("/")}`);
console.log(`en 叶子数 = ${leaves(dicts.en)}`);
console.log(`九语叶子数 = ${leafList.join(" / ")}`);
console.log(`register 键集（en）= ${enKeys}`);
if (problems.length) {
  console.error("SELF-CHECK FAILED:");
  problems.forEach((p) => console.error("  - " + p));
  process.exit(1);
}
console.log("SELF-CHECK OK（键集一致 / 无空值 / 叶子数一致 / 纯 CRLF + 末尾 CRLF）");

// ============================================================================
// 3. 叶子数常量同步：3292 → 3293
// ============================================================================
const FROM = "3292";
const TO = "3293";
const NEW_LEAVES = leaves(dicts.en);
if (String(NEW_LEAVES) !== TO) {
  throw new Error(`实际 en 叶子数 ${NEW_LEAVES} ≠ 预期 ${TO}，中止常量同步（请先核对改动）`);
}

console.log("\n=== 3. 常量同步 ===");

// 3a. PLAIN：这些文件里 FROM 只作为断言常量/描述出现，全局替换
const PLAIN = [
  "scripts/verify-opennext-bundle.mjs",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
  "scripts/cs22a-public-profile-regression.ts",
  "scripts/cs22b-self-assessment-regression.ts",
  "scripts/cs13b-cluster-directory-regression.ts",
];
let total = 0;
for (const rel of PLAIN) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${rel}（不存在）`);
    continue;
  }
  const src = fs.readFileSync(file, "utf8");
  const hits = src.split(FROM).length - 1;
  if (hits === 0) {
    console.log(`SKIP  ${rel}（无 ${FROM}）`);
    continue;
  }
  fs.writeFileSync(file, src.split(FROM).join(TO), "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处`);
}

// 3b. cs06a：常量替换 + 修正 C7 里的字符串数 + 追加一条变更日志（历史条目不动）
{
  const rel = "scripts/cs06a-directory-regression.ts";
  const file = path.join(ROOT, rel);
  let out = fs.readFileSync(file, "utf8");

  out = out
    .split("= 3286 字符串 + 4 boolean")
    .join("= 3287 字符串 + 4 boolean");

  const hits = out.split(FROM).length - 1;
  out = out.split(FROM).join(TO);

  const anchor =
    "  //              （脚本：scripts/_apply_contact_i18n.cjs，幂等 + 九语键集自检）";
  const entry =
    anchor +
    "\n  // 3292 → 3293：/register 页补「已有账号 → 去登录」回链，" +
    "新增 register.haveAccount 1 键 × 9 语（链接文案复用 auth.accountMenu.signIn）\n" +
    "  //              （脚本：scripts/apply-r66-signin-entry-i18n.cjs，幂等 + 九语键集自检）";
  if (out.includes(anchor) && !out.includes("3292 → 3293")) {
    out = out.replace(anchor, entry);
  } else if (!out.includes("3292 → 3293")) {
    console.log(`WARN  ${rel} 未找到追加锚点，请人工补一条变更日志`);
  }

  fs.writeFileSync(file, out, "utf8");
  total += hits;
  console.log(`OK    ${rel}  替换 ${hits} 处 + 字符串数 + 变更日志`);
}

// 3c. RELEASE-RULES.md：当前基线降格为历史，新值置为基线（保留历史，不篡改既成事实）
{
  const rel = "RELEASE-RULES.md";
  const file = path.join(ROOT, rel);
  let out = fs.readFileSync(file, "utf8");
  const before = out.split(FROM).length - 1;
  // 只改「当前基线」那一行：把末尾那个 **3292** 降格为 `3292 → **3293**`
  out = out.replace("3291 → **3292**", "3291 → 3292 → **3293**");
  out = out.replace("当前基线：**3292**", "当前基线：**3293**");
  fs.writeFileSync(file, out, "utf8");
  const after = out.split(FROM).length - 1;
  console.log(`OK    ${rel}  ${before} 处 → 基线改为 **${TO}**（旧值保留为历史），残留 ${FROM} ${after} 处`);
}

console.log(`\n完成：常量共替换 ${total} 处 ${FROM} → ${TO}`);
console.log(
  "提示：跑 cs06a C8 / cs08 G4+G5 / cs12 E4+E5 / cs13 F1d / cs13b A1–A5 回归验证后再发布"
);
