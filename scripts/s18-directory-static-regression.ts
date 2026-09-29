// scripts/s18-directory-static-regression.ts —— stage1.8「目录静态化」回归（只读，fail 退出码 1）
//
// 守护 stage1.8 引入的四件事：
//   1) /suppliers 与 /industrial-clusters 已由「动态渲染」改为「预渲染（构建期冻结）」，
//      且**不得回退** —— 回退后线上 TTFB 会回到 2.6–4.2s，在 Cloudflare Workers
//      Free（CPU 10ms/req）下直接变成 5xx。
//   2) 预渲染的代价被显式承认并设闸门：全量供应商内联进 HTML ⇒ **已发布供应商 ≤ 50 家**
//      （D1 决策）。这条闸门必须能被机器检查，否则它只是一句注释。
//   3) 过滤态的 noindex 不能静默失效：页面预渲染后 generateMetadata 拿不到 searchParams，
//      改由 middleware 注入 `X-Robots-Tag: noindex, follow`（D3）。
//   4) 派生值仍只在服务端算 —— 客户端组件不得重新推导核验等级 / 风险色等业务值，
//      那是「服务端唯一权威」铁律，也是权限边界（禁客户端 fetch）。
//
// 用法：
//   node --env-file=.env scripts/run-regression.mjs s18-directory-static-regression
//
// ⚠️ 产物级断言（B 段）要求先完成 `next build`；缺失即 FAIL（不做"跳过"，
//    否则会把"没构建"伪装成"通过"）。

import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./stripComments";
import { LEGACY_CLUSTER_REDIRECTS } from "../lib/clusterRoutes";

const ROOT = process.env.S18_ROOT ? path.resolve(process.env.S18_ROOT) : process.cwd();

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const APP = path.join(ROOT, ".next", "server", "app");

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

function src(rel: string): string {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return "";
  return stripComments(fs.readFileSync(p, "utf8"));
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

const PAGE = "app/[locale]/suppliers/page.tsx";
const CLUSTERS_PAGE = "app/[locale]/industrial-clusters/page.tsx";
const CLUSTERS_SEG = "app/[locale]/industrial-clusters/[...segments]/page.tsx";
const GRID = "components/supplier/DirectoryGrid.tsx";
const VIEW = "components/supplier/DirectoryView.tsx";
const MW = "middleware.ts";

// ===========================================================================
section("A. 静态化与禁令（源码级防回退）");
// ===========================================================================

{
  const page = src(PAGE);
  const clusters = src(CLUSTERS_PAGE);
  const seg = src(CLUSTERS_SEG);
  const grid = src(GRID);
  const view = src(VIEW);
  const mw = src(MW);

  check("A1 关键源文件均可读", page.length > 1000 && clusters.length > 500 && seg.length > 1000 && grid.length > 500 && view.length > 1000);

  // ── A2 /suppliers 必须是预渲染 ─────────────────────────────────────────────
  check(
    "A2 目录页不再读 searchParams（读它 = Next 强制动态渲染）",
    !/searchParams/.test(page)
  );
  check(
    "A3 目录页声明 `export const revalidate = 3600`",
    /export\s+const\s+revalidate\s*=\s*3600/.test(page)
  );
  check(
    "A4 目录页不得出现 force-dynamic / revalidate = 0",
    !/force-dynamic/.test(page) && !/revalidate\s*=\s*0\b/.test(page)
  );

  // ── A5 /industrial-clusters 两条路由 ──────────────────────────────────────
  check(
    "A5 产业带目录页已去 force-dynamic，改 revalidate",
    !/force-dynamic/.test(clusters) && /export\s+const\s+revalidate\s*=\s*3600/.test(clusters)
  );
  check(
    "A6 产业带 catch-all 已去 force-dynamic，改 revalidate + dynamicParams",
    !/force-dynamic/.test(seg) &&
      /export\s+const\s+revalidate\s*=\s*3600/.test(seg) &&
      /export\s+const\s+dynamicParams\s*=\s*true/.test(seg)
  );
  check(
    "A7 产业带 catch-all 有 generateStaticParams（否则详情页不进静态产物）",
    /export\s+async\s+function\s+generateStaticParams\(\)/.test(seg) &&
      /listPublishedClusters\(\)/.test(seg) &&
      /buildClusterCanonicalPath\(/.test(seg)
  );

  // ── A8 客户端过滤的三条硬约束 ──────────────────────────────────────────────
  check(
    "A8 DirectoryGrid 是客户端组件且用 useSearchParams",
    /"use client"/.test(grid) && /useSearchParams\(\)/.test(grid)
  );
  check(
    "A9 DirectoryGrid 首帧不过滤（mounted 闸门）——否则 hydration mismatch / 首屏抖动",
    /useEffect\(\(\)\s*=>\s*setMounted\(true\),\s*\[\]\)/.test(grid) &&
      /mounted\s*\?\s*readActive\(searchParams\)/.test(grid)
  );
  check(
    "A10 禁客户端取数（数据必须由服务端 props 传入，权限裁剪点不得前移）",
    !/fetch\(/.test(grid) && !/@\/lib\/queries/.test(grid) && !/@\/lib\/trustProfile/.test(grid)
  );

  // ── A11 派生值仍只在服务端算 ───────────────────────────────────────────────
  // 这些标识只允许出现在 page.tsx（算的地方），绝不能出现在展示层。
  check(
    "A11 展示层不重新推导派生值（等级 / 风险色 / 证据文案一律由服务端算好）",
    !/overallLevel/.test(view) &&
      !/LEVEL_COLOR/.test(view) &&
      !/publicVerificationLevel/.test(view) &&
      !/riskLabel\(/.test(view) &&
      !/evidenceDocs/.test(view) &&
      !/levelsShort/.test(view) &&
      !/noCheckRecord/.test(view)
  );
  check(
    "A12 展示层不取数、不读上下文（纯组件：可由服务端与客户端共用）",
    !/@\/lib\/queries/.test(view) && !/getDictionary/.test(view) && !/useSearchParams/.test(view)
  );

  // ── A13 过滤态 noindex 的落地通道 ─────────────────────────────────────────
  check(
    "A13 middleware 注入 X-Robots-Tag: noindex, follow",
    /X-Robots-Tag[\s\S]{0,120}noindex,\s*follow/i.test(mw)
  );
  check(
    "A14 命中条件与旧口径逐字一致（/suppliers 且 country / industry / q 任一为真；不含 utm）",
    /stripLocalePrefix\(pathname\)\s*===\s*"\/suppliers"/.test(mw) &&
      /get\("country"\)/.test(mw) &&
      /get\("industry"\)/.test(mw) &&
      /get\("q"\)/.test(mw) &&
      !/utm_/.test(mw)
  );
  check(
    "A15 注入只加响应头，不得改动 locale 重写逻辑（rewrite 目标与 matcher 原样）",
    /\(pathname === "\/" \? `\/\$\{DEFAULT_LOCALE\}` : `\/\$\{DEFAULT_LOCALE\}\$\{pathname\}`\)/.test(mw) &&
      /matcher:\s*\["\/\(\(\?!api\|_next\|\.\*\\\\\.\.\*\)\.\*\)"\]/.test(mw)
  );
}

// ===========================================================================
section("B. 产物级 —— 预渲染覆盖与 D1 内联上限");
// ===========================================================================

{
  check(
    "B1 构建产物存在（.next/server/app）",
    fs.existsSync(APP),
    `缺少 ${APP} —— 请先跑 next build`
  );

  // 每个语种：卡片数 == 详情页数 == 供应商数；且 ≤ 50（D1 闸门）
  const cardCounts: Record<string, number> = {};
  const missingNames: string[] = [];
  let maxCards = 0;

  for (const loc of LOCALES) {
    const dirHtml = path.join(APP, loc, "suppliers.html");
    const detailDir = path.join(APP, loc, "suppliers");

    if (!fs.existsSync(dirHtml)) {
      check(`B2 [${loc}] 目录页已预渲染（${loc}/suppliers.html）`, false, "文件不存在");
      continue;
    }
    if (!fs.existsSync(detailDir)) {
      check(`B2 [${loc}] 详情页目录存在（${loc}/suppliers/）`, false, "目录不存在");
      continue;
    }

    const slugs = fs
      .readdirSync(detailDir)
      .filter((f) => f.endsWith(".html"))
      .map((f) => f.replace(/\.html$/, ""));
    const html = fs.readFileSync(dirHtml, "utf8");
    // ⚠️ 只能数「供应商卡」：FAQ 区块用的是 `card p-5`（无 hover:border），
    //    不加限定会把 4 张 FAQ 一并数进来（实测 9+4=13）。
    const cards = (html.match(/class="card p-5 hover:border/g) ?? []).length;

    // 每张卡片必须是 /suppliers/<slug> 的链接（逐字命中详情页 slug 集合）
    const missed = slugs.filter((s) => !html.includes(`/suppliers/${s}"`));
    if (missed.length) missingNames.push(`${loc}: ${missed.join(",")}`);

    cardCounts[loc] = cards;
    maxCards = Math.max(maxCards, cards);

    check(
      `B2 [${loc}] 目录 HTML 含全部 ${slugs.length} 家供应商卡片（卡片数=${cards}）`,
      cards === slugs.length && cards > 0 && missed.length === 0,
      `卡片 ${cards} / 详情页 ${slugs.length}${missed.length ? ` / 缺链接 ${missed.join(",")}` : ""}`
    );
  }

  check(
    "B3 🔑 D1 内联上限：任一语种卡片数 ≤ 50（超限须改分页或动态渲染）",
    maxCards <= 50 && maxCards > 0,
    `实测最大 ${maxCards} 家`
  );

  // JSON-LD 的 numberOfItems 必须等于卡片数（描述的就是这份 HTML）
  const enHtml = fs.existsSync(path.join(APP, "en", "suppliers.html"))
    ? fs.readFileSync(path.join(APP, "en", "suppliers.html"), "utf8")
    : "";
  const nMatch = enHtml.match(/"numberOfItems":(\d+)/);
  check(
    "B4 JSON-LD numberOfItems == 预渲染卡片数（结构化数据描述的就是这份静态 HTML）",
    Boolean(nMatch) && Number(nMatch![1]) === cardCounts["en"],
    nMatch ? `numberOfItems=${nMatch[1]} cards=${cardCounts["en"]}` : "未找到 numberOfItems"
  );

  // ── 产业带：8 个 P0 详情页 × 9 语 = 72 ────────────────────────────────────
  const canonicalPaths = Object.values(LEGACY_CLUSTER_REDIRECTS);
  let detailOk = 0;
  const detailMissing: string[] = [];
  for (const loc of LOCALES) {
    for (const cp of canonicalPaths) {
      const rel = cp.replace(/^\/industrial-clusters\//, "");
      const f = path.join(APP, loc, "industrial-clusters", `${rel}.html`);
      if (fs.existsSync(f)) detailOk++;
      else detailMissing.push(`${loc}/${rel}`);
    }
  }
  const expectedDetails = canonicalPaths.length * LOCALES.length;
  check(
    `B5 产业带详情页静态化 ${detailOk}/${expectedDetails}（8 产业带 × 9 语 = 72）`,
    detailOk === expectedDetails && expectedDetails === 72,
    detailMissing.length ? `缺 ${detailMissing.slice(0, 6).join(", ")}` : `期望 ${expectedDetails}`
  );

  // ── 产业带聚合页（国家段 / 国家+省·市段）────────────────────────────────
  const aggMissing: string[] = [];
  for (const loc of LOCALES) {
    for (const rel of ["china", "thailand", "vietnam", "indonesia", "china/guangdong", "vietnam/bac-ninh", "indonesia/batam", "indonesia/jepara"]) {
      const f = path.join(APP, loc, "industrial-clusters", `${rel}.html`);
      if (!fs.existsSync(f)) aggMissing.push(`${loc}/${rel}`);
    }
  }
  check(
    "B6 产业带聚合页（国家 / 国家+省·市）亦进静态产物",
    aggMissing.length === 0,
    aggMissing.length ? `缺 ${aggMissing.slice(0, 6).join(", ")}` : ""
  );

  check(
    "B7 产业带目录页已预渲染（9 语）",
    LOCALES.every((loc) => fs.existsSync(path.join(APP, loc, "industrial-clusters.html"))),
    LOCALES.filter((loc) => !fs.existsSync(path.join(APP, loc, "industrial-clusters.html"))).join(",")
  );
}

// ===========================================================================
console.log(`\n${"=".repeat(60)}`);
console.log(`stage1.8 目录静态化回归：${pass} PASS / ${fail} FAIL   （ROOT=${ROOT}）`);
if (fail) {
  console.log("\n失败项：");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("全部通过 ✓");
