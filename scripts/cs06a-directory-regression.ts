// scripts/cs06a-directory-regression.ts —— CS-06a 目录筛选渲染回归（只读，fail 时退出码 1）
//
// 守护两件事，且**只守护这两件**：
//   1) Bug B（P0）：Supplier Directory 的**筛选结果必须等于实际渲染的卡片**。
//      缺陷形态是 `const featured = all.slice(0, FEATURED_MAX)` —— filtered 被算对、
//      被喂给计数标签与 JSON-LD，却唯独没喂给网格。于是
//      `?country=vietnam` 显示「1 suppliers listed」旁边并排 4 张卡，
//      并且 `?country=nowhere`（0 命中）**永远看不到空态**。
//      线上 9 例实测：计数全部正确（4/3/1/2/1/2/2/0/0/0），卡片恒为 4。
//
//   2) Bug A（P2）：`/en/* → /*` 的 301 丢失 query。
//      根因与 CS-05b 修过的 rewrite 分支同一个：`new URL(target, req.url)`
//      只继承 origin，base 上的 query string 不会被带过去。
//
// 为什么必须源码级断言：
//   Bug B 不会让 tsc 报错、不会让页面 500、不会让 Lighthouse 掉分 ——
//   它只会让页面自己跟自己矛盾（「0 家」旁边摆 4 张卡）。
//   这类"结构性不一致"只能靠扫描源码守住。
//
// 用法：
//   OUT="$LOCALAPPDATA/Temp/cs06a-reg.cjs"
//   ./node_modules/.bin/esbuild scripts/cs06a-directory-regression.ts \
//     --bundle --platform=node --format=cjs --outfile="$OUT"
//   CS06A_ROOT="F:/AI-验厂SEO网站" node "$OUT"
//
// ⚠️ Windows/Git Bash：CS06A_ROOT 必须是 Windows 风格路径；别用 $PWD（会是 /f/... 形态）。

import * as fs from "node:fs";
import * as path from "node:path";
import {
  GUEST_PROFILE_LIMIT,
  COMPARE_MAX_SUPPLIERS,
  MEMBERSHIP_PRICE_USD,
  PUBLIC_FIELDS,
  FREE_FIELDS,
  PAID_FIELDS,
  DIRECTORY_PATH,
} from "../lib/suppliers";

const ROOT = process.env.CS06A_ROOT
  ? path.resolve(process.env.CS06A_ROOT)
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

/** 剥掉注释 —— 注释里提到旧写法不构成"还在用它"。
 *  `(^|[^:])` 前缀守卫：URL 里的 `https://` 不能被当成行注释切掉。
 *  （这条守卫在 CS-05c-r2 已踩过两次，此处直接沿用。） */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function readSource(rel: string): string {
  return stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function readRaw(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const PAGE = "app/[locale]/suppliers/page.tsx";
const MW = "middleware.ts";

// ---------------------------------------------------------------------------
section("A. Bug B —— 筛选结果 = 实际渲染的卡片（源码级防回归）");
// ---------------------------------------------------------------------------

{
  const page = readSource(PAGE);
  check("目录页源码可读且非空", page.length > 2000, `实际 ${page.length} 字符`);

  // A1 缺陷形态不得复现
  const legacySlice = page.match(/all\.slice\(/g);
  check(
    "A1 目录页不再出现 `all.slice(`（缺陷形态根除）",
    !legacySlice,
    legacySlice ? `命中 ${legacySlice.length} 次` : ""
  );

  // A2 展示集合由筛选结果派生（这是 count == cards 恒等成立的唯一依据）
  check(
    "A2 展示集合 `const displayed = filtered;` 存在",
    /const\s+displayed\s*=\s*filtered\s*;/.test(page)
  );

  // A3 网格消费展示集合（不是 all、不是 featured）
  const grid = page.match(/displayed\.map\(\(x\)\s*=>/g);
  check(
    "A3 网格 `.map` 消费 `displayed`",
    Boolean(grid && grid.length === 1),
    `命中 ${grid ? grid.length : 0} 次`
  );

  // A4 空态消费展示集合，且渲染 s.empty（此前 0 命中时提示永不出现）
  check(
    "A4 空态分支绑定 `displayed.length === 0`",
    /\{displayed\.length\s*===\s*0\s*\?\s*\(/.test(page)
  );
  check(
    "A4b 空态分支仍渲染 `s.empty`",
    /s\.empty\s*\}/.test(page)
  );

  // A5 计数标签绑 filtered.length —— 与 A2 合起来 ⇒ 计数恒等于卡片数
  check(
    "A5 计数标签仍绑 `String(filtered.length)`",
    /String\(filtered\.length\)/.test(page)
  );

  // A5b 旧集合 `featured` 不得以任何集合身份残留（key 名 s.featuredTitle 不算）
  const legacyRefs = page.match(/\bfeatured\.(length|map|slice|filter)|const\s+featured\b/g);
  check(
    "A5c 旧展示集合 `featured` 已彻底移除（除字典键 s.featuredTitle / s.featuredLead 外）",
    !legacyRefs,
    legacyRefs ? legacyRefs.join(", ") : ""
  );

  // A6 筛选谓词未被顺手改动（三项「与」关系）
  check(
    "A6 `filtered` 仍同时使用 country / industry / matchQ 三项条件",
    /\(!country\s*\|\|\s*x\.country\s*===\s*country\)/.test(page) &&
      /\(!industry\s*\|\|\s*x\.industryCode\s*===\s*industry\)/.test(page) &&
      /matchQ\(x\)/.test(page)
  );

  // A7 搜索词仍覆盖公司名 / 产品 / 城市
  check(
    "A7 `matchQ` 仍覆盖 legalName / mainProducts / city",
    /x\.legalName\.toLowerCase\(\)\.includes\(q\)/.test(page) &&
      /x\.mainProducts\.some\(/.test(page) &&
      /x\.city\.toLowerCase\(\)\.includes\(q\)/.test(page)
  );

  // A8 筛选 chip 的数据源仍是全量（否则筛掉一个国家后 chip 会自我消失）
  check(
    "A8 国家 / 行业 chip 仍由全量 `all` 派生",
    /all\.map\(\(x\)\s*=>\s*x\.country\)/.test(page) &&
      /all\.map\(\(x\)\s*=>\s*x\.industryCode\)/.test(page)
  );

  // A9 JSON-LD 仍与页面显示结果一致（同用 filtered）
  check(
    "A9 JSON-LD numberOfItems / itemListElement 仍绑 `filtered`",
    /numberOfItems:\s*filtered\.length/.test(page) &&
      /itemListElement:\s*filtered\.map\(/.test(page)
  );

  // A10 linkWith 真值守卫未被改成 `!== undefined`（空串会把筛选项"粘"死）
  check(
    "A10 `linkWith` 三类参数仍用真值守卫（if (c) / if (i) / if (query)）",
    /if\s*\(c\)\s*params\.set\("country",\s*c\)/.test(page) &&
      /if\s*\(i\)\s*params\.set\("industry",\s*i\)/.test(page) &&
      /if\s*\(query\)\s*params\.set\("q",\s*query\)/.test(page)
  );

  // A11 数据源与排序契约未变
  const queries = readSource("lib/queries.ts");
  check(
    "A11 目录页数据源仍是 `listSupplierDirectory()`",
    /await\s+listSupplierDirectory\(\)/.test(page)
  );
  check(
    "A12 `fetchRows` 仍过滤 is_published 且按 risk_score 降序",
    /\.eq\("is_published",\s*true\)/.test(queries) &&
      /\.order\("risk_score",\s*\{\s*ascending:\s*false\s*\}\)/.test(queries)
  );
}

// ---------------------------------------------------------------------------
section("B. Bug A —— `/en/*` 301 必须保住 query（源码级防回归）");
// ---------------------------------------------------------------------------

{
  const mw = readSource(MW);
  check("中间件源码可读且非空", mw.length > 500, `实际 ${mw.length} 字符`);

  // B1 301 分支的 URL 拼接必须带上 search
  const redirectBlock = mw.match(
    /if\s*\(first\s*===\s*DEFAULT_LOCALE\)\s*\{[\s\S]*?\n\s*\}/
  );
  const block = redirectBlock ? redirectBlock[0] : "";
  check(
    "B1 定位到 `first === DEFAULT_LOCALE` 分支",
    block.length > 0
  );
  check(
    "B2 301 分支的 `new URL(...)` 拼接了 `req.nextUrl.search`",
    /new URL\([\s\S]*?req\.nextUrl\.search[\s\S]*?\)/.test(block),
    block.replace(/\s+/g, " ").slice(0, 160)
  );

  // B3 仍是 301，且空路径仍落回 "/"
  check(
    "B3 仍为 `NextResponse.redirect(..., 301)`",
    /NextResponse\.redirect\([\s\S]*?,\s*301\s*\)/.test(block)
  );
  check(
    "B4 空路径回退逻辑 `rest === \"\" ? \"/\" : rest` 保留",
    /rest\s*===\s*""\s*\?\s*"\/"\s*:\s*rest/.test(block)
  );

  // B5 matcher 与其余分支未被扩大改动
  check(
    "B5 `config.matcher` 未变",
    /matcher:\s*\["\/\(\(\?!api\|_next\|\.\*\\\\\.\.\*\)\.\*\)"\]/.test(mw)
  );
  const urlCalls = mw.match(/new URL\(/g);
  check(
    "B6 `new URL(` 仍恰好 2 处（rewrite + redirect），未新增分支",
    Boolean(urlCalls && urlCalls.length === 2),
    `实际 ${urlCalls ? urlCalls.length : 0} 处`
  );
  check(
    "B7 `x-pathname` 注入仍在",
    /requestHeaders\.set\("x-pathname",\s*pathname\)/.test(mw)
  );
  check(
    "B8 非默认语言的放行分支仍在（8 个 locale 不受影响）",
    /isLocale\(first\)\s*&&\s*first\s*!==\s*DEFAULT_LOCALE/.test(mw)
  );
}

// ---------------------------------------------------------------------------
section("C. 未扩张 —— 本轮不得顺手改动的部分");
// ---------------------------------------------------------------------------

{
  // C1 访问层级 / 定价 / 路径常量
  check("C1 GUEST_PROFILE_LIMIT 仍为 5", GUEST_PROFILE_LIMIT === 5, String(GUEST_PROFILE_LIMIT));
  check("C2 COMPARE_MAX_SUPPLIERS 仍为 5", COMPARE_MAX_SUPPLIERS === 5, String(COMPARE_MAX_SUPPLIERS));
  check(
    "C3 MEMBERSHIP_PRICE_USD 仍为 99",
    MEMBERSHIP_PRICE_USD === 99,
    String(MEMBERSHIP_PRICE_USD)
  );
  check(
    "C4 字段分层未变：PUBLIC 15 / FREE 4 / PAID 4",
    PUBLIC_FIELDS.length === 15 &&
      FREE_FIELDS.length === 4 &&
      PAID_FIELDS.length === 4,
    `${PUBLIC_FIELDS.length}/${FREE_FIELDS.length}/${PAID_FIELDS.length}`
  );
  check("C5 DIRECTORY_PATH 仍为 /suppliers", DIRECTORY_PATH === "/suppliers", DIRECTORY_PATH);

  // C6 P3 冻结项：死常量不许顺手删（删了会扩大 diff，且属另一 Change Set）
  const sup = readSource("lib/suppliers.ts");
  check(
    "C6 P3 冻结：`FEATURED_MAX` / `FEATURED_MIN` 定义仍在（本轮不清理死码）",
    /export\s+const\s+FEATURED_MAX\s*=/.test(sup) &&
      /export\s+const\s+FEATURED_MIN\s*=/.test(sup)
  );

  // C7 九语字典：键集合与 en 完全一致，叶子数恒为 2666（= 2662 字符串 + 4 boolean）
  // 2648 → 2666：CS-08 入驻表证书子表单 + 「我要获得证书」咨询弹窗新增 18 键 × 9 语
  const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
  type Leaf = { key: string; value: unknown };
  function leaves(obj: unknown, prefix = "", out: Leaf[] = []): Leaf[] {
    if (obj === null || typeof obj !== "object") {
      out.push({ key: prefix, value: obj });
      return out;
    }
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
      return out;
    }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      leaves(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }

  const dictLeaves: Record<string, Leaf[]> = {};
  for (const loc of LOCALES) {
    const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
    check(`C7 字典存在：${loc}.json`, fs.existsSync(p));
    dictLeaves[loc] = leaves(JSON.parse(fs.readFileSync(p, "utf8")));
  }
  const baseKeys = dictLeaves.en.map((l) => l.key).sort();
  check("C8 en 字典叶子数 = 2666（未被截断/新增）", baseKeys.length === 2666, `实际 ${baseKeys.length}`);

  for (const loc of LOCALES) {
    if (loc === "en") continue;
    const keys = dictLeaves[loc].map((l) => l.key).sort();
    const missing = baseKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !baseKeys.includes(k));
    check(
      `C9 ${loc} 与 en 键集合一致（本轮不动 i18n）`,
      missing.length === 0 && extra.length === 0,
      `missing=${missing.length} extra=${extra.length}`
    );
  }

  // C10 历史归档与迁移文件未被改写（不许"修复历史"）
  check(
    "C10 历史归档仍在：PROJECT_FINALIZATION_AUDIT 保留原 Bug A/B 记录",
    exists(".workbuddy/artifacts/FACTORYAUDITB2B_PROJECT_FINALIZATION_AUDIT.md") &&
      /all\.slice\(\)/.test(readRaw(".workbuddy/artifacts/FACTORYAUDITB2B_PROJECT_FINALIZATION_AUDIT.md")) &&
      /Bug A/.test(readRaw(".workbuddy/artifacts/FACTORYAUDITB2B_PROJECT_FINALIZATION_AUDIT.md"))
  );
  check(
    "C11 CS-05b 报告仍写着「CS-06 Bug A 剩余部分」",
    /CS-06 Bug A 剩余部分/.test(
      readRaw(".workbuddy/artifacts/FACTORYAUDITB2B_CS05B_IMPLEMENTATION_REPORT.md")
    )
  );
  check(
    "C12 CS-05c 报告仍写着「CS-06 Bug B」",
    /CS-06 Bug B/.test(
      readRaw(".workbuddy/artifacts/FACTORYAUDITB2B_CS05C_IMPLEMENTATION_REPORT.md")
    )
  );
  const MIGRATIONS = [
    "001_init.sql",
    "002_payments.sql",
    "003_fix_profile_company.sql",
    "004_documents.sql",
    "005_storage.sql",
    "006_compliance_fields.sql",
  ];
  const migMissing = MIGRATIONS.filter((m) => !exists(`supabase/migrations/${m}`));
  check(
    "C13 6 个迁移文件仍在（本轮零 DB 变更）",
    migMissing.length === 0,
    migMissing.join(", ")
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`CS-06a 目录筛选回归：${pass} PASS / ${fail} FAIL   （ROOT=${ROOT}）`);
if (fail) {
  console.log("\n失败项：");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("全部通过 ✓");
