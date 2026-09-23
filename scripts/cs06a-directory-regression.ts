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
// 统一口径：见 scripts/stripComments.ts。
// 🔴 曾经这里各写一份「先块注释、再行注释」的两段正则 —— 当被扫文件的行注释里含 `/*`
//    （如 AccountMenu.tsx 的 `// /api/auth/*`），它会吞掉后面整段真实代码，
//    导致正向断言假 FAIL、反向断言假 PASS。
import { stripComments } from "./stripComments";
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
    "A12 `fetchRows` 仍过滤 is_published 且按 risk_score 降序、未评分沉底",
    // 2026-09-15 改写：原断言只要求 `{ ascending: false }`，但 PostgREST 在 DESC 下
    // 默认 NULLS FIRST，会把「尚未评分」的供应商顶到目录最前 —— 与静态兜底路径的
    // 排序不一致，且让一个以「已核验」为卖点的目录以未评分企业开篇。
    // 现在要求显式 `nullsFirst: false`。（断言数不变：仍是 1 条。）
    /\.eq\("is_published",\s*true\)/.test(queries) &&
      /\.order\("risk_score",\s*\{\s*ascending:\s*false,\s*nullsFirst:\s*false\s*\}\)/.test(
        queries
      )
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
  // B6 原为「恰好 2 处（rewrite + redirect）」——写于 middleware 只有两个分支的年代。
  //
  // 🔴 STEP 13-B 修正（陈旧断言，非本轮回归）：STEP 09 上线了**第三条合法分支**
  //    —— 旧扁平产业带 URL → 层级 canonical 的 308（middleware 里的
  //    `LEGACY_CLUSTER_REDIRECTS[slug]`）。该分支已通过 STEP 09 生产验收，
  //    属已接受的架构。它随 STEP 09 一起上线却一直没进版本库（"线上有、库里没有"），
  //    本轮才补提交，因此这条断言从那时起就是 FAIL，只是没人跑过 cs06a。
  //
  //    处置：不降低强度，改成**按语义逐个钉死** —— 3 处，且每一处必须仍是它原本的角色。
  //    任何第 4 处新分支或角色漂移依然会立刻 FAIL（比原来的纯计数更严）。
  check(
    "B6 `new URL(` 恰好 3 处，且三处角色各自守恒（rewrite + 两条 redirect）",
    Boolean(urlCalls && urlCalls.length === 3) &&
      /new URL\(`\$\{localePart\}\$\{canonical\}\$\{req\.nextUrl\.search\}`,\s*req\.url\)/.test(mw) &&
      /new URL\(\(rest === "" \? "\/" : rest\) \+ req\.nextUrl\.search,\s*req\.url\)/.test(mw) &&
      /new URL\(target,\s*req\.url\)/.test(mw),
    `实际 ${urlCalls ? urlCalls.length : 0} 处`
  );
  // CS-19（工单 SEO-20260918-FAB 任务 1.1）—— 本断言按新事实改写，**断言数不变**。
  //
  // 变更：`x-pathname` 的**消费方**（app/[locale]/layout.tsx 的 generateMetadata）
  //       已被移除。原因是它在那里调用了 `await headers()`，而 Next 15 中只要
  //       generateMetadata 触碰 Dynamic API，**整棵 [locale] 子树就永久退出静态生成**
  //       （实测 prerender-manifest 仅 319 条 = 315 audit-guide + 3 元数据路由 + _not-found，
  //        全站内容页都在每次请求现场 SSR，1,233 个 sitemap URL 因此把 Worker 打成 535 个 5xx）。
  //
  // 保留：middleware 的**注入**不动 —— 它不参与静态化判定，但保留可避免未来为一个
  //       请求上下文字段再改一次路由核心。⚠️ 任何人不得再在 generateMetadata 里读它。
  check(
    "B7 `x-pathname` 注入仍在（消费方已于 CS-19 移除，注入保留备用，不得在 generateMetadata 中读取）",
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
    "C4 字段分层：PUBLIC 21 / FREE 8→13（CS-16 加 5 项联系/属地）/ PAID 恒为 4",
    PUBLIC_FIELDS.length === 21 &&
      FREE_FIELDS.length === 13 &&
      PAID_FIELDS.length === 4,
    `${PUBLIC_FIELDS.length}/${FREE_FIELDS.length}/${PAID_FIELDS.length}`
  );
  // CS-12 扩容红线：paid 层四项一字未动（付费墙没有被这次扩容动过）
  check(
    "C4b PAID 层四项未被 CS-12 改动",
    PAID_FIELDS.length === 4 &&
      ["evidence", "inspectionHistory", "riskBreakdown", "certifications"].every((f) =>
        (PAID_FIELDS as readonly string[]).includes(f)
      ),
    PAID_FIELDS.join(",")
  );
  // CS-12 公开边界：只放开工商登记级；产能属商业情报，必须留在 free 层不公开
  check(
    "C4c PUBLIC 含 6 项登记级字段（englishName/companyType/website/registrationNumber/address/selfReportedCertificates）",
    [
      "englishName",
      "companyType",
      "website",
      "registrationNumber",
      "address",
      "selfReportedCertificates",
    ].every((f) => (PUBLIC_FIELDS as readonly string[]).includes(f)) &&
      !(PUBLIC_FIELDS as readonly string[]).includes("productionCapacity"),
    PUBLIC_FIELDS.join(",")
  );
  // 🔴 两条证书轴禁互通：自述证书（public）绝不允许出现在 paid 的 certifications 语义里，
  //    也绝不允许把 paid 的 certifications 升成 public（那会把"平台已核验"洗成"工厂自述"的反向误导）。
  check(
    "C4d 自述证书 ⊥ 平台核验证书（selfReportedCertificates 不得进 PAID，certifications 不得进 PUBLIC）",
    !(PAID_FIELDS as readonly string[]).includes("selfReportedCertificates") &&
      !(PUBLIC_FIELDS as readonly string[]).includes("certifications")
  );
  check("C5 DIRECTORY_PATH 仍为 /suppliers", DIRECTORY_PATH === "/suppliers", DIRECTORY_PATH);

  // C6 P3 冻结项：死常量不许顺手删（删了会扩大 diff，且属另一 Change Set）
  const sup = readSource("lib/suppliers.ts");
  check(
    "C6 P3 冻结：`FEATURED_MAX` / `FEATURED_MIN` 定义仍在（本轮不清理死码）",
    /export\s+const\s+FEATURED_MAX\s*=/.test(sup) &&
      /export\s+const\s+FEATURED_MIN\s*=/.test(sup)
  );

  // C7 九语字典：键集合与 en 完全一致，叶子数恒为 2970（= 2936 字符串 + 4 boolean）
  // 2648 → 2666：CS-08 入驻表证书子表单 + 「我要获得证书」咨询弹窗新增 18 键 × 9 语
  // 2666 → 2694：CS-11 公开标准报告样板页 standardReport 命名空间 27 键 + footer.standardReport 1 键
  // 2694 → 2714：CS-12 档案页登记信息 7 键 + 工厂自述证书 8 键 + 产能 4 键 + evidenceCenter.issuedOn 1 键 = 20 键 × 9 语
  // 2714 → 2717：CS-02A /industry 索引页与 Master 页指南区块新增 industryPage.hubMetaDesc / hubLead / topicsTitle 3 键 × 9 语
  // 2717 → 2726：CS-02B 化工原料页新增 chemicals 命名空间 9 键 × 9 语
  // 2726 → 2735：CS-02D 后台线索列表 admin 命名空间 9 键 × 9 语（navLeads/leadsTitle/leadsLead/leadsEmpty/statNewLeads/statTotalLeads/recentLeads/colKind/colTool）
  // 2735 → 2767：CS-16 后台供应商管理 admin 命名空间 32 键（publish/unpublish/authorizedTitle/consentHistoryNote + 18 字段 label + filter/search 等，× 9 语）
  // 2767 → 2809：CS-17 Commerce V1 checkout 命名空间 31 键 + admin.orders 11 键 = 42 键 × 9 语
  // 2809 → 2822：CS-17 下单页 order 命名空间 13 键 × 9 语
  // 2822 → 2823：CS-19 / 工单 SEO-20260918-FAB 任务 2.1 —— 化工详情页标题尾部短标签
  //              chemicals.detailTitleTail 1 键 × 9 语（替换列表页用的 metaTitle 去拼标题）
  // 2823 → 2824：账号中心功能导航区小节标题 account.panel.linksTitle 1 键 × 9 语
  //              （卡片标题/说明全部复用 savedTitle/savedLead/rfqsTitle/rfqsLead
  //               与 admin.title/admin.overviewLead，故只增 1 个叶子而非 7 个）
  // 2824 → 2825：⚠️ 既有失准的记录 —— 该次攒键后**本文件与 cs08/cs12/cs13/cs16/cs17/cs20
  //              都停在 2827 之前未同步**，而发布门禁 verify-opennext-bundle.mjs 已按
  //              实际值校准。STEP-04 一并校正为同一常量，恢复"六处同源"不变式。
  // 2825 → 2827：STEP-04 供应商档案展示「地理大区 + 产业带」——
  //              supplierProfile.regionLabel / industrialClusterLabel 2 键 × 9 语
  //              （脚本：scripts/apply-step04-i18n.cjs，幂等 + 九语键集自检）
  // 2827 → 2846：CHANGE SET B 首页 Industrial Clusters 轻量入口 + 产业带目录/详情页 ——
  //              home.clusters* 3 键 + clusters.* 命名空间 16 键 × 9 语
  // 2846 → 2912：STEP-05 /verify-supplier 最小闭环（提交 → 收集 → 入库 → 人工核验）——
  //              verifySupplier.* 命名空间 65 键（含 checks[3] / rules[4] /
  //              valueOptions 5 / urgencyOptions 3 叶子）+ supplierProfile.verifyThisSupplier 1 键 × 9 语
  //              （脚本：scripts/apply-step05-i18n.cjs，幂等 + 九语键集自检）
  // 2912 → 2926：STEP-06 首页「What do you need?」四入口（home.* 下 14 键，全字符串）——
  //              needTitle/needLead + entry{Find,Cluster,Verify,Rfq}{Title,Desc,Cta} × 9 语
  //              （脚本：scripts/apply-step06-i18n.cjs，幂等 + 九语键集自检；ctaSecondary 仅改写值）
  // 2926 → 2938：STEP-07 首页 Live Buyer Requests 模块（home.* 下 12 键，全字符串）——
  //              liveTitle/liveLead + liveEmptyTitle/liveEmptyLead/liveEmptyCta + liveViewAll
  //              + liveRespondCta/livePosted/liveQuantity/liveMarket/liveIndustry/liveCerts × 9 语
  //              （脚本：scripts/apply-step07-i18n.cjs，幂等 + 九语键集自检；复用 /rfq 提交流，不新建表）
  //              （脚本：scripts/apply-changesetB-i18n.cjs，幂等 + 九语键集自检）
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
  check("C8 en 字典叶子数 = 2970（未被截断/新增）", baseKeys.length === 2970, `实际 ${baseKeys.length}`);

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
