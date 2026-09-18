// scripts/cs05c-copy-regression.ts —— CS-05c 文案与死码收口回归（只读，fail 时退出码 1）
//
// 守护四件事：
//   1) 九语字典里**不存在**任何「免费账号按月计量」的残留说法（含死键）
//   2) 九语键集合与 en 完全一致（删键不能只删一种语言）
//   3) 退役口径的**代码出口**全部关闭（常量、组件、响应字段、硬编码兜底）
//   4) 顺带修掉的 {n} 语义错配不会回退（对比上限 = 单一事实来源）
//
// CS-05c-r2 追加（Pre-check 确认的 2 处残留）：
//   5) `/llms.txt` 不再有「up to 5 full profiles per month」
//      —— 它**不在 [locale] 前缀下**，所以躲过了 CS-05c 的 75 条 locale 烟雾。
//   6) 九语 `supplierProfile.freeLockLead` 不再把 paid 层的 certifications 许给免费账号
//   7) `/llms.txt` 路由骨架与 register {n} 绑定未被这次修复波及
//   8) 邮件模板的 Free / Paid 字段语义正确（付费邮件**应当**保留 Certification claims）
//
// 为什么还要单独一个回归：
//   文案问题不会让 tsc 报错、不会让页面 500，只会让站点对着用户说一件不成立的事。
//   这类「无据声称」只能靠扫描守住。
//
// 用法：
//   OUT="$LOCALAPPDATA/Temp/cs05c-reg.cjs"
//   ./node_modules/.bin/esbuild scripts/cs05c-copy-regression.ts \
//     --bundle --platform=node --format=cjs --outfile="$OUT"
//   CS05C_ROOT="F:/AI-验厂SEO网站" node "$OUT"
//
// ⚠️ Windows/Git Bash：CS05C_ROOT 必须是 Windows 风格路径；别用 $PWD（会是 /f/... 形态）。

import * as fs from "node:fs";
import * as path from "node:path";
import {
  COMPARE_MAX_SUPPLIERS,
  GUEST_PROFILE_LIMIT,
  MEMBERSHIP_PRICE_USD,
  DIRECTORY_PATH,
  PUBLIC_FIELDS,
  FREE_FIELDS,
  PAID_FIELDS,
} from "../lib/suppliers";

const ROOT = process.env.CS05C_ROOT
  ? path.resolve(process.env.CS05C_ROOT)
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

/** 剥掉 TS 注释 —— 注释里提到某个名字不构成"还在用它"。
 *  注意 `(^|[^:])` 这个前缀守卫：URL 里的 `https://` 不能被当成行注释切掉。 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** 读源码并**剥掉注释**再判定 —— 注释里提到某个名字不构成"还在用它"。
 *  这条经验来自 CS-05b：安全注释必须点名 paid 字段，曾导致误报 FAIL。
 *  CS-05c-r2 再次踩到：修复说明的注释里引用了 certifications，被判成残留。 */
function readSource(rel: string): string {
  return stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function readRaw(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// ---------------------------------------------------------------------------
// 字典装载
// ---------------------------------------------------------------------------

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
type Locale = (typeof LOCALES)[number];

function dictPath(loc: Locale) {
  return path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
}

const DICTS: Record<string, unknown> = {};
for (const loc of LOCALES) {
  DICTS[loc] = JSON.parse(fs.readFileSync(dictPath(loc), "utf8"));
}

type Leaf = { key: string; value: string };

function leaves(obj: unknown, prefix = "", out: Leaf[] = []): Leaf[] {
  if (obj === null || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      if (typeof v === "string") out.push({ key: `${prefix}[${i}]`, value: v });
      else leaves(v, `${prefix}[${i}]`, out);
    });
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const kp = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.push({ key: kp, value: v });
    else leaves(v, kp, out);
  }
  return out;
}

function leafKeys(obj: unknown): string[] {
  return leaves(obj).map((l) => l.key).sort();
}

function getIn(obj: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>(
      (a, c) => (a && typeof a === "object" ? (a as Record<string, unknown>)[c] : undefined),
      obj
    );
}

// ---------------------------------------------------------------------------
// 1. 九语字典里不存在按月额度的残留说法
// ---------------------------------------------------------------------------

section("1. 字典：九语「免费按月计量」残留扫描");

// 月份词（含「monthly」这类形容词形态 —— 只写 "per month" 会漏掉
// 「no monthly limit」这种写法，这正是 CS-05c 的正面目标）
const MONTH_RE =
  /(per month|monthly|monatlich|mensual|mensuelle|mensal|pro monat|par mois|al mes|por mês|毎月|月間|每月|月度|個月|شهري|شهرياً|this month|diesen monat|ce mois|este mes|este mês|本月)/i;
// 档案 / 供应商 主词
const SUBJECT_RE =
  /(profile|profil|perfil|檔案|档案|プロフィール|ملف|supplier|مورد|lieferant|fournisseur|proveedor|fornecedor|サプライヤー)/i;
// 额度 / 用量 词
const QUOTA_RE =
  /(limit|quota|usage|額度|额度|用量|上限|nutzung|utilis|uso|使用|حد|一定数|有限|limited|begrenzung|عدد محدود)/i;

// 允许的例外：**明确否认**存在按月限制的说法（这是 CS-05c 的正面目标，不是残留）。
// 九语各自的表述都在这里，少一种语言就说明那条文案没落到位。
const NEGATION_RE =
  /(no monthly limit|ohne monatliches limit|ohne monatliche begrenzung|sin límite mensual|sans limite mensuelle|sem limite mensal|月間上限なし|月間制限なし|沒有每月上限|没有每月上限|不受每月額度限制|不受月度额度限制|دون حد شهري|بدون حد شهري)/i;

// 允许的例外：与「供应商档案额度」无关的合法业务用语（工厂月产能等）
const LEGIT_KEYS = new Set([
  "supplierNetwork.form.labels.monthlyOutput", // "Monthly output (pieces)" —— 工厂月产能字段标签
  "checklist.stages[1].items.fa_capacity", // "Monthly capacity stated..." —— 审核清单项
]);

{
  const offenders: string[] = [];
  const negations: string[] = [];

  for (const loc of LOCALES) {
    for (const { key, value } of leaves(DICTS[loc])) {
      if (!MONTH_RE.test(value)) continue;
      if (!SUBJECT_RE.test(value) && !QUOTA_RE.test(value)) continue;
      if (LEGIT_KEYS.has(key)) continue;
      if (NEGATION_RE.test(value)) {
        negations.push(`${loc}.${key}`);
        continue;
      }
      offenders.push(`${loc}.${key} :: ${value.slice(0, 90)}`);
    }
  }

  check(
    "九语字典中没有任何「按月计量免费档案」的说法",
    offenders.length === 0,
    offenders.slice(0, 5).join(" | ")
  );

  // 正面断言：每一语的免费档位说明都必须**明确否认**按月限制。
  // （这条不依赖上面的 MONTH_RE 闸门 —— 否则「文案整个被删掉」也会算通过。）
  const missingNegation = LOCALES.filter(
    (l) => !NEGATION_RE.test(String(getIn(DICTS[l], "membership.freeLead") ?? ""))
  );
  check(
    "九语 membership.freeLead 都明确写出「没有每月上限」",
    missingNegation.length === 0,
    missingNegation.join(", ")
  );
  console.log(`  （info）九语中另有 ${negations.length} 处否认式表述被正确识别为正面目标`);
}

// ---------------------------------------------------------------------------
// 2. 死键已从九语字典中彻底删除
// ---------------------------------------------------------------------------

section("2. 字典：退役口径的死键已删除");

const DEAD_KEYS = [
  "quotaBanner", // 整条 QuotaBanner 文案（组件已删）
  "account.panel.quota", // "{used} / {limit} profiles this month"
  "auth.accountMenu.quota", // 同上，菜单里那份
  "auth.quotaReached", // "本月的 {limit} 个免费档案额度已用完"
];

for (const key of DEAD_KEYS) {
  const present = LOCALES.filter((l) => getIn(DICTS[l], key) !== undefined);
  check(
    `死键已删除：${key}`,
    present.length === 0,
    present.length ? `仍存在于 ${present.join(", ")}` : ""
  );
}

// ---------------------------------------------------------------------------
// 3. 九语键集合与 en 一致（删键不能只删一种语言）
// ---------------------------------------------------------------------------

section("3. 字典：九语键集合与 en 完全一致");

{
  const base = leafKeys(DICTS.en);
  check("en 叶子键数 > 2000（防止字典被截断）", base.length > 2000, `实际 ${base.length}`);
  for (const loc of LOCALES) {
    if (loc === "en") continue;
    const cur = leafKeys(DICTS[loc]);
    const missing = base.filter((k) => !cur.includes(k));
    const extra = cur.filter((k) => !base.includes(k));
    check(
      `${loc} 与 en 键集合一致`,
      missing.length === 0 && extra.length === 0,
      `缺 ${missing.length} / 多 ${extra.length}${missing.length ? `：${missing.slice(0, 3)}` : ""}`
    );
  }
}

// ---------------------------------------------------------------------------
// 4. 改写后的 9 个键 = 目标值（九语），且不含占位符残留
// ---------------------------------------------------------------------------

section("4. 字典：改写后的文案已生效且无占位符残留");

{
  // 这些键的新文案里**不应**再出现 {n} / {used} / {limit}
  const NO_PLACEHOLDER = [
    "membership.freeLead",
    "suppliers.unlockNote",
    "account.panel.quotaLabel",
    "account.panel.quotaUnlimited",
    "account.panel.signedOutLead",
    "account.metaDesc",
    "account.lead",
    "login.metaDesc",
  ];

  for (const key of NO_PLACEHOLDER) {
    const bad = LOCALES.filter((l) => {
      const v = getIn(DICTS[l], key);
      return typeof v !== "string" || /\{n\}|\{used\}|\{limit\}/.test(v);
    });
    check(`${key} 九语均无 {n}/{used}/{limit} 残留`, bad.length === 0, bad.join(", "));
  }

  // upgradeLead 仍必须保留 {price} —— 定价由 MEMBERSHIP_PRICE_USD 单一注入
  const badPrice = LOCALES.filter((l) => {
    const v = getIn(DICTS[l], "account.panel.upgradeLead");
    return typeof v !== "string" || !v.includes("{price}");
  });
  check(
    "account.panel.upgradeLead 九语均保留 {price}（定价单一事实源）",
    badPrice.length === 0,
    badPrice.join(", ")
  );

  // 升级引导不得再声称「取消每月额度」，必须指向真正解锁的 paid 层
  const paidWords =
    /(evid|inspec|inspeç|risk|risiko|risco|risque|riesgo|الأدلة|تفتيش|المخاطر|证据|證據|証拠|検査|验货|驗貨|preuve|beweis|prova)/i;
  const badUpgrade = LOCALES.filter((l) => {
    const v = String(getIn(DICTS[l], "account.panel.upgradeLead") ?? "");
    return !paidWords.test(v);
  });
  check(
    "account.panel.upgradeLead 九语都指向真正的 paid 层权益",
    badUpgrade.length === 0,
    badUpgrade.join(", ")
  );
}

// ---------------------------------------------------------------------------
// 5. 源码：退役常量的出口已彻底关闭
// ---------------------------------------------------------------------------

section("5. 源码：FREE_PROFILE_LIMIT 出口已关闭，对比上限收敛为单一事实源");

{
  const suppliersRaw = readRaw("lib/suppliers.ts");
  const suppliersCode = readSource("lib/suppliers.ts");

  check(
    "lib/suppliers.ts 不再导出 FREE_PROFILE_LIMIT",
    !/export\s+const\s+FREE_PROFILE_LIMIT\b/.test(suppliersCode)
  );
  check(
    "lib/suppliers.ts 不再有 @deprecated ... FREE_PROFILE_LIMIT 的兼容导出",
    !/@deprecated[\s\S]{0,400}export\s+const\s+FREE_PROFILE_LIMIT/.test(suppliersRaw)
  );
  check(
    "COMPARE_MAX_SUPPLIERS === 5",
    COMPARE_MAX_SUPPLIERS === 5,
    `实际 ${COMPARE_MAX_SUPPLIERS}`
  );

  // 全仓库源码扫描（排除：注释、回归脚本自身、历史 plan 文档、生成的 bundle）
  const scanDirs = ["app", "components", "lib"];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        walk(rel);
      } else if (/\.(ts|tsx)$/.test(e.name)) {
        const src = readSource(rel);
        if (/FREE_PROFILE_LIMIT/.test(src)) offenders.push(rel);
      }
    }
  };
  scanDirs.forEach(walk);

  check(
    "app/ components/ lib/ 的代码里已无 FREE_PROFILE_LIMIT 任何引用",
    offenders.length === 0,
    offenders.join(", ")
  );
}

// ---------------------------------------------------------------------------
// 6. 源码：QuotaBanner 与整套额度管道已移除
// ---------------------------------------------------------------------------

section("6. 源码：QuotaBanner 与额度响应字段已移除");

{
  check("components/QuotaBanner.tsx 已删除", !exists("components/QuotaBanner.tsx"));

  const unlocked = readSource("app/api/suppliers/[slug]/unlocked/route.ts");
  check(
    "/unlocked 响应不再回传 quotaExceeded / profilesUsed / quotaMessage",
    !/quotaExceeded\s*:/.test(unlocked) &&
      !/profilesUsed\s*:/.test(unlocked) &&
      !/quotaMessage\s*:/.test(unlocked)
  );
  check(
    "/unlocked 仍然回传 fields + evidenceStatus（契约未被误删）",
    /fields,/.test(unlocked) && /evidenceStatus,/.test(unlocked)
  );

  const uv = readSource("components/UnlockedValue.tsx");
  check(
    "UnlockedValue 不再读写 quotaExceeded / quotaMessage",
    !/quotaExceeded|quotaMessage/.test(uv)
  );
  check(
    "UnlockedValue 仍按 guest 判定决定是否发请求（CS-05b 行为未回退）",
    /guest\.status === "allowed"/.test(uv)
  );

  const ap = readSource("components/AccountPanel.tsx");
  const am = readSource("components/AccountMenu.tsx");
  check(
    "AccountPanel 不再渲染 {used}/{limit} 额度数字",
    !/profilesUsed|profilesLimit|\{used\}|\{limit\}/.test(ap)
  );
  check(
    "AccountMenu 不再渲染额度数字",
    !/profilesUsed|profilesLimit|\{used\}|\{limit\}/.test(am)
  );

  const gate = readSource("components/UnlockGate.tsx");
  check(
    "UnlockGate 不再有 quotaReached 文案位（含硬编码英文兜底）",
    !/quotaReached/.test(gate)
  );
  check(
    "UnlockGate 仍保留 free 层的 guest 放行逻辑（CS-05b 行为未回退）",
    /guest\.status === "allowed"/.test(gate)
  );

  // QuotaBanner 的残留引用（剥注释后为空）
  const refs: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(e.name) && /QuotaBanner/.test(readSource(rel))) refs.push(rel);
    }
  };
  ["app", "components", "lib"].forEach(walk);
  check("QuotaBanner 已无任何代码引用", refs.length === 0, refs.join(", "));
}

// ---------------------------------------------------------------------------
// 7. {n} 语义错配已修（对比上限 = 单一事实源）
// ---------------------------------------------------------------------------

section("7. 注册页 {n}：语义已归位（并排对比上限，不再是免费额度）");

{
  const reg = readSource("app/[locale]/register/page.tsx");
  check(
    "register 页用 COMPARE_MAX_SUPPLIERS 填 {n}",
    /const text = b\.replace\("\{n\}", String\(COMPARE_MAX_SUPPLIERS\)\)/.test(reg)
  );
  // 线上烟雾曾抓到：key={b} 会把带 "{n}" 的字典模板原样写进 RSC payload。
  // 不可见，但会让任何「渲染产物不含占位符」的检查失效 —— 所以先替换再当 key。
  check(
    "register 页不把带占位符的字典原文当 React key",
    !/key=\{b\}/.test(reg) && /key=\{text\}/.test(reg)
  );
  check("register 页不再引用 FREE_PROFILE_LIMIT", !/FREE_PROFILE_LIMIT/.test(reg));

  const cmp = readSource("components/tools/SupplierComparison.tsx");
  check(
    "SupplierComparison 的上限来自 COMPARE_MAX_SUPPLIERS（不再硬编码 5）",
    /MAX_SUPPLIERS\s*=\s*COMPARE_MAX_SUPPLIERS/.test(cmp) && !/MAX_SUPPLIERS\s*=\s*5\b/.test(cmp)
  );

  const mem = readSource("app/[locale]/membership/page.tsx");
  check(
    "membership 页不再对 freeLead 做 {n} 替换",
    !/freeLead\.replace/.test(mem)
  );
  check("membership 页不再引用 FREE_PROFILE_LIMIT", !/FREE_PROFILE_LIMIT/.test(mem));

  const notify = readSource("lib/notify.ts");
  check("lib/notify.ts 已移除 FREE_PROFILE_LIMIT", !/FREE_PROFILE_LIMIT/.test(notify));
  check(
    "注册回执邮件不再声称「每月 N 家」",
    !/per month/i.test(notify)
  );
  check(
    "付款邮件不再声称「免费档每月受限」",
    !/limited to\s+\d+|per month/i.test(notify)
  );
  check(
    "注册回执邮件的免费权益不再包含 certifications（那是 paid 层）",
    !/profiles per month \(company details, certifications/.test(notify)
  );
}

// ---------------------------------------------------------------------------
// 8. 访问分层与定价未被文案整改波及
// ---------------------------------------------------------------------------

section("8. 访问分层 / 定价 / 路径未被波及");

{
  check(
    "PUBLIC 层 = CS-05c 的 15 项 + CS-12 的 6 项工商登记级字段 = 21",
    PUBLIC_FIELDS.length === 21,
    `实际 ${PUBLIC_FIELDS.length}`
  );
  check(
    "FREE 层 = 4 项 basic + CS-12 的 4 项产能 + CS-16 的 5 项联系/属地 = 13",
    FREE_FIELDS.length === 13,
    `实际 ${FREE_FIELDS.length}`
  );
  check("PAID 层仍为 4 个字段", PAID_FIELDS.length === 4, `实际 ${PAID_FIELDS.length}`);
  check(
    "PAID 层四项未变",
    ["evidence", "inspectionHistory", "riskBreakdown", "certifications"].every((f) =>
      (PAID_FIELDS as readonly string[]).includes(f)
    )
  );
  check("MEMBERSHIP_PRICE_USD 仍为 99", MEMBERSHIP_PRICE_USD === 99);
  check("DIRECTORY_PATH 仍为 /suppliers", DIRECTORY_PATH === "/suppliers");
  check("GUEST_PROFILE_LIMIT 仍为 5", GUEST_PROFILE_LIMIT === 5);
}

// ---------------------------------------------------------------------------
// 9. CS-05c-r2：Pre-check 确认的 2 处残留（+ 2 条防回退）
// ---------------------------------------------------------------------------
//
// 为什么还要再加一段：
//   CS-05c 的线上烟雾只扫 `/[locale]` 页面，而 `/llms.txt` **不在 locale 前缀下**，
//   于是「up to 5 full profiles per month」在 75 条烟雾全绿的情况下活了下来。
//   教训写进断言 —— 独立路由必须有自己的守护。

section("9. CS-05c-r2 A：/llms.txt 已无「每月 N 家档案」语义");

{
  // ⚠️ 必须剥注释后再判定：r2 的修复注释里**故意**引用了旧串
  //    「up to 5 full profiles per month」来说明删掉了什么。
  //    直接扫原文会把「解释」当成「残留」（CS-05b 同类误报的翻版）。
  const llmsCode = readSource("app/llms.txt/route.ts");
  const llmsRaw = readRaw("app/llms.txt/route.ts");

  const oldHits = llmsCode.match(/up to\s+5[^\n]{0,80}/gi) ?? [];
  check(
    "A1 /llms.txt 源码（剥注释）已无 up to 5 ... profiles per month",
    !/up to\s+5\s+full\s+profiles\s+per\s+month/i.test(llmsCode) && oldHits.length === 0,
    oldHits.slice(0, 2).join(" | ")
  );
  check(
    "A2 /llms.txt 全文再无 per month 这一计量说法",
    !/per\s+month/i.test(llmsCode)
  );
  check(
    "A3 /llms.txt 已改为「unlimited browsing of basic supplier profiles」口径",
    /unlimited browsing of basic supplier profiles/i.test(llmsCode)
  );

  // 结构性守护：这次修复不许动路由骨架 / 不许把它挪进 [locale]
  check(
    "A4 /llms.txt 路由骨架未变（force-static + GET）",
    /export const dynamic = "force-static"/.test(llmsRaw) &&
      /export async function GET\(\)/.test(llmsRaw)
  );
  check(
    "A5 /llms.txt 仍未挂在 [locale] 下（这正是它躲过 locale 烟雾的原因）",
    !/\[locale\]/.test(llmsCode)
  );

  // 站点权威说明里凡涉及免费账号，都必须与既有 canonical 口径同义
  const freeLines = llmsCode
    .split("\n")
    .filter((l) => /Free Account Registration/i.test(l));
  check(
    "A6 /llms.txt 的免费账号条目仍只有 1 条（未被复制成多处口径）",
    freeLines.length === 1,
    `实际 ${freeLines.length} 条`
  );
}

section("9. CS-05c-r2 B：九语 freeLockLead 不再承诺 paid 层的 certifications");

{
  // 认证类词汇的九语写法（含阿拉伯语 الشهادات / شهادة）
  const CERT_RE = /(certificat|Zertifizier|认证|認證|認証|الشهادات|شهادة|گواهی)/i;
  // paid 层另外三项的九语写法 —— 免费层同样不得点名
  const PAID_LEAK_RE =
    /(inspection history|验货历史|驗貨歷史|検査履歴|historial de inspecciones|inspektionsverlauf|historique des inspections|histórico de inspeções|سجل عمليات التفتيش|risk breakdown|风险拆解|風險拆解|リスク内訳|desglose de riesgo|risikoaufschlüsselung|détail des risques|detalhamento de risco|تفصيل المخاطر|evidence record|证据记录|證據紀錄|証拠記録|registros de evidencia|evidenzdatensätze|preuves|registros de evidência|سجلات الأدلة)/i;

  const certBad = LOCALES.filter((l) =>
    CERT_RE.test(String(getIn(DICTS[l], "supplierProfile.freeLockLead") ?? ""))
  );
  check(
    "B1 九语 freeLockLead 均不再出现认证类词汇",
    certBad.length === 0,
    certBad.join(", ")
  );

  // 正向断言：必须点名**本语言既有**的 auditStatusLabel。
  // 这条防的不是「漏改」，而是「自造术语」——同一块界面出现两种说法。
  const labelBad = LOCALES.filter((l) => {
    const v = String(getIn(DICTS[l], "supplierProfile.freeLockLead") ?? "");
    const label = String(getIn(DICTS[l], "supplierProfile.auditStatusLabel") ?? "");
    return !label || !v.toLowerCase().includes(label.toLowerCase());
  });
  check(
    "B2 九语 freeLockLead 点名的第 4 项 = 本语言 supplierProfile.auditStatusLabel（术语单一事实源）",
    labelBad.length === 0,
    labelBad.join(", ")
  );

  const leakBad = LOCALES.filter((l) =>
    PAID_LEAK_RE.test(String(getIn(DICTS[l], "supplierProfile.freeLockLead") ?? ""))
  );
  check(
    "B3 九语 freeLockLead 未把任何其它 paid 字段（evidence / inspectionHistory / riskBreakdown）写进免费权益",
    leakBad.length === 0,
    leakBad.join(", ")
  );

  // 承诺的字段集合必须落在 FREE_FIELDS 内，且 free 层绝不允许混入 paid 字段
  // CS-16 新增 5 项注册买家可见的联系/属地字段（province/contactPerson/contactEmail/whatsapp/companyDescription），
  // FREE 层由 8 项扩为 13 项：4 承诺 + 4 CS-12 产能 + 5 CS-16 联系/属地。
  check(
    "B4 FREE 层 = 4 项承诺字段 + 4 项 CS-12 产能字段 + 5 项 CS-16 联系/属地字段，且绝不含 certifications",
    FREE_FIELDS.length === 13 &&
      (FREE_FIELDS as readonly string[]).every((f) =>
        [
          "established",
          "employees",
          "exportMarkets",
          "auditStatus",
          "productionCapacity",
          "monthlyOutput",
          "factorySize",
          "exportSince",
          "province",
          "contactPerson",
          "contactEmail",
          "whatsapp",
          "companyDescription",
        ].includes(f)
      ) &&
      !(FREE_FIELDS as readonly string[]).includes("certifications")
  );
  check(
    "B5 certifications 仍在 PAID 层（未被顺手挪回免费层）",
    (PAID_FIELDS as readonly string[]).includes("certifications") &&
      !(FREE_FIELDS as readonly string[]).includes("certifications")
  );
}

section("9. CS-05c-r2 C：register {n} 仍绑定 COMPARE_MAX_SUPPLIERS");

{
  const reg = readSource("app/[locale]/register/page.tsx");

  check(
    "C1 register 页仍用 String(COMPARE_MAX_SUPPLIERS) 填充 {n}",
    /String\(COMPARE_MAX_SUPPLIERS\)/.test(reg)
  );
  check(
    "C2 register 页完全不引用 GUEST_PROFILE_LIMIT",
    !/GUEST_PROFILE_LIMIT/.test(reg)
  );
  // 陷阱说明：两者**数值都是 5**，换错后页面照常渲染、tsc 无感、肉眼难辨。
  check(
    "C3 两个常量语义不同但数值巧合相同（这就是必须靠断言拦住的原因）",
    GUEST_PROFILE_LIMIT === 5 && COMPARE_MAX_SUPPLIERS === 5
  );

  const raw = readRaw("app/[locale]/register/page.tsx");
  const importBlock = raw.match(/^import[\s\S]*?from\s+"@\/lib\/suppliers";/m)?.[0] ?? "";
  check(
    "C4 register 页从 @/lib/suppliers 只取了 COMPARE_MAX_SUPPLIERS 相关符号",
    /COMPARE_MAX_SUPPLIERS/.test(importBlock) && !/GUEST_PROFILE_LIMIT/.test(importBlock),
    importBlock.replace(/\s+/g, " ").slice(0, 120)
  );
}

section("9. CS-05c-r2 D：邮件模板符合当前 Free / Paid 字段语义");

{
  const notify = readRaw("lib/notify.ts");

  // 只截取**注册回执（免费账号）**那一段。
  // 付费欢迎邮件**合法地**包含 "Certification claims with their source"
  // —— 那是 paid 层权益，一刀切会误伤。
  const rStart = notify.indexOf("export async function notifyBuyerRegisterReceived");
  const rEnd = notify.indexOf("// ---------- V2.1", rStart);
  // 剥注释：函数体里就有 r2 的修复说明，其中**点名**了 certifications
  // （"原句把 certifications 算进免费权益是错的"）。不剥就会把解释当残留。
  const receipt =
    rStart >= 0 && rEnd > rStart ? stripComments(notify.slice(rStart, rEnd)) : "";

  check("D1 已定位注册回执 notifyBuyerRegisterReceived", receipt.length > 0);
  check("D2 注册回执不再声称「per month」", !/per\s+month/i.test(receipt));
  check(
    "D3 注册回执的免费权益不含 certifications（那是 paid 层）",
    !/certificat/i.test(receipt)
  );
  check(
    "D4 注册回执点名的免费字段含 audit status（与 FREE_FIELDS 一致）",
    /audit status/i.test(receipt)
  );
  check(
    "D5 注册回执明确写出「no monthly limit」",
    /no monthly limit/i.test(receipt)
  );

  // 反向守护：付费邮件必须**继续**把认证算作会员权益（防「一刀切删干净」）
  const pStart = notify.indexOf("export async function notifyPaymentSucceeded");
  const pEnd = notify.indexOf("export async function notifyPaymentFailed", pStart);
  const paid =
    pStart >= 0 && pEnd > pStart ? stripComments(notify.slice(pStart, pEnd)) : "";
  check(
    "D6 付费欢迎邮件仍把 Certification claims 列为已解锁权益（paid 层未被误删）",
    /Certification claims/i.test(paid)
  );
  check(
    "D7 付费欢迎邮件仍列出 evidence / inspection history / risk breakdown",
    /Evidence records/i.test(paid) &&
      /Inspection history/i.test(paid) &&
      /Risk breakdown/i.test(paid)
  );
}

// ---------------------------------------------------------------------------
// 10. Final acceptance —— 本轮 6 条验收，逐条落成断言
// ---------------------------------------------------------------------------

section("10. Final acceptance（CS-05c-r2）");

{
  check("Guest 仍然是 5 unique suppliers", GUEST_PROFILE_LIMIT === 5, `实际 ${GUEST_PROFILE_LIMIT}`);

  const access = readSource("lib/access.ts");
  check(
    "Free Buyer 仍是 unlimited basic（不再有每月额度）",
    /unlimited/i.test(access) && !/FREE_PROFILE_LIMIT/.test(access)
  );

  check(
    "Paid：certifications 仍是 paid",
    (PAID_FIELDS as readonly string[]).includes("certifications")
  );

  const llmsCode = readSource("app/llms.txt/route.ts");
  check("`/llms.txt` 不再出现「5 full profiles per month」", !/5\s+full\s+profiles\s+per\s+month/i.test(llmsCode));

  const CERT_RE = /(certificat|Zertifizier|认证|認證|認証|الشهادات|شهادة|گواهی)/i;
  const stillCert = LOCALES.filter((l) =>
    CERT_RE.test(String(getIn(DICTS[l], "supplierProfile.freeLockLead") ?? ""))
  );
  check("9 locales freeLockLead 不再承诺 certifications", stillCert.length === 0, stillCert.join(", "));

  // 「历史文档不修改」不能靠嘴说 —— 断言它们**仍保留原始记录**（= 没被顺手改写）
  check(
    "历史归档未被改写：docs/V2.1-GO-LIVE-CHECKLIST.md 仍保留「5 家/月」原始记录",
    /5 家\/月/.test(readRaw("docs/V2.1-GO-LIVE-CHECKLIST.md"))
  );
  check(
    "历史归档未被改写：docs/analytics.md 仍保留 free_quota_reached 的废止记录",
    /free_quota_reached/.test(readRaw("docs/analytics.md"))
  );
  check(
    "历史归档未被改写：supabase/migrations/001_init.sql 仍在版本库中",
    exists("supabase/migrations/001_init.sql")
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`CS-05c 文案回归：${pass} PASS / ${fail} FAIL`);
if (fail) {
  console.log("\n失败项：");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("全部通过 ✓");
