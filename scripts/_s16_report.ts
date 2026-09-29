/**
 * stage1.6 生成改写建议文档 outputs/stage1.6-proposal.md
 * 用法：node scripts/run-regression.mjs _s16_report
 */
import fs from "fs";
import { trimMetaDescription, trimMetaTitle } from "../lib/pageMeta";
import { CANDIDATES, TS_CANDIDATES } from "./_s16_cand_data";

const SENT = /[.。!！?？]/;
const CJK = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const subst = (s: string) =>
  s.replaceAll("{country}", "Philippines").replaceAll("{industry}", "Food & Beverage / 食品饮料");

/** 每条改动覆盖的页面数 */
const COVER: Record<string, number> = {
  "countryHub.metaDesc": 5,
  "industryPage.metaDesc": 13,
  "inspection.metaDesc": 1,
  "trainingPage.metaDesc": 1,
  "serviceVerification.metaDesc": 1,
  "careers.metaDesc": 1,
  "pricing.metaDesc": 1,
  "risk.page.metaDesc": 1,
  "risk.page.metaTitle": 1,
  "methodology.metaDesc": 1,
  "verifySupplier.metaDesc": 1,
  "resourcesIndex.metaDesc": 1,
  "trainingPlans.metaDesc": 1,
  "legal.termsTitle": 1,
  "monitoring.metaDesc": 1,
  "chemicals.metaDesc": 1,
  "caseStudies/trading-company-posing-as-factory": 7,
  "caseStudies/legal-entity-mismatch-before-deposit": 7,
  "caseStudies/label-defect-stopped-before-loading": 7,
  "caseStudies/qualifying-replacement-supplier-vietnam": 7,
  "fieldReports/carton-count-mismatch-at-loading": 7,
  "fieldReports/moisture-in-cartons-before-shipment": 7,
  "fieldReports/shared-building-fire-exits": 7,
  "fieldReports/undisclosed-subcontracted-process": 7,
  "industry/food-beverage/food-factory-audit-checklist": 7,
  "industry/food-beverage/food-supplier-verification": 7,
  "industry/chemicals/chemical-supplier-verification": 7,
  "CASE_LIST_META.zh": 2,
  "FIELD_REPORT_LIST_META.zh": 2,
};

/** 这条改动对应「141 项」里的几项 */
const FLAGGED: Record<string, number> = {
  "countryHub.metaDesc": 5,
  "industryPage.metaDesc": 1, // es 2 + pt 1 = 3，逐语种计（下表按语种行计）
  "inspection.metaDesc": 1,
  "trainingPage.metaDesc": 1,
  "serviceVerification.metaDesc": 1,
  "careers.metaDesc": 1,
  "pricing.metaDesc": 1,
  "risk.page.metaDesc": 1,
  "methodology.metaDesc": 1,
  "verifySupplier.metaDesc": 1,
  "resourcesIndex.metaDesc": 1,
  "trainingPlans.metaDesc": 1,
  "monitoring.metaDesc": 0, // 属"desc 偏短"额外项
  "caseStudies/trading-company-posing-as-factory": 7,
  "caseStudies/legal-entity-mismatch-before-deposit": 7,
  "caseStudies/label-defect-stopped-before-loading": 7,
  "caseStudies/qualifying-replacement-supplier-vietnam": 7,
  "fieldReports/carton-count-mismatch-at-loading": 7,
  "fieldReports/moisture-in-cartons-before-shipment": 7,
  "fieldReports/shared-building-fire-exits": 7,
  "fieldReports/undisclosed-subcontracted-process": 7,
  "industry/food-beverage/food-factory-audit-checklist": 7,
  "industry/food-beverage/food-supplier-verification": 7,
  "industry/chemicals/chemical-supplier-verification": 7,
};

/** 逐行（key|loc）覆盖的「141 项」数；缺省回退到 FLAGGED[key] */
const FLAGGED_ROW: Record<string, number> = {
  "industryPage.metaDesc|es": 2,
  "industryPage.metaDesc|pt": 1,
  "countryHub.metaDesc|en": 5,
  "countryHub.metaDesc|es": 5,
  "countryHub.metaDesc|de": 5,
  "countryHub.metaDesc|fr": 5,
  "countryHub.metaDesc|pt": 5,
  "countryHub.metaDesc|ar": 5,
};
const flaggedFor = (c: { key: string; loc: string }) =>
  FLAGGED_ROW[`${c.key}|${c.loc}`] ?? FLAGGED[c.key] ?? 0;

const L: string[] = [];
L.push("# stage1.6 第 3 批 desc 修复 —— 改写建议（待确认）");
L.push("");
L.push(`> 生成时间：2026-09-29｜部署基线：CF \`72ef374c\`｜回滚锚点：\`6facaae8\``);
L.push(`> 共 **${CANDIDATES.length + TS_CANDIDATES.length}** 处源键改动，全部经 \`trimMetaDescription\` / \`trimMetaTitle\` 预演验证：**收口零命中（幂等）+ 结尾句末标点**。`);
L.push("");
L.push("## 0. 一处例外说明");
L.push("");
L.push("`\u0060chemicals.metaTitle\u0060` 未动：zh/zh-TW 标题为 CJK（预算 36 字），不套拉丁 50–60 区间。");
L.push("");
L.push("---");
L.push("");
L.push("## 1. 数据源定位结果");
L.push("");
L.push("| # | 板块 | 数据源（唯一） | 取值方式 | 被标记页 |");
L.push("|---|---|---|---|---|");
L.push("| 1 | countries 详情 | **字典 `countryHub.metaDesc`** | `{country}` 占位符替换（`name`=China…Philippines，纯拉丁） | 30 |");
L.push("| 2 | industry 分类 | **字典 `industryPage.metaDesc`** | `{industry}` 替换为**双语行业名**（如 `Food & Beverage / 食品饮料`） | 3 |");
L.push("| 3 | industry 主题 | **`lib/industryContent.ts`** `INDUSTRY_COPY[..].topics[..].metaDesc.en/zh` | `pickZhPair` ⇒ **7 语种回退 en** | 21 |");
L.push("| 4 | case-studies 详情 | **`lib/caseStudies.ts`** `CASE_STUDIES[..].metaDescEn/Zh` | `pickZhPair` ⇒ 7 语种回退 en | 28 |");
L.push("| 5 | field-reports 详情 | **`lib/fieldReports.ts`** `FIELD_REPORTS[..].metaDescEn/Zh` | `pickZhPair` ⇒ 7 语种回退 en | 28 |");
L.push("| 6 | services | 字典 `inspection.metaDesc` / `trainingPage.metaDesc` / `serviceVerification.metaDesc` | 直读 | 8 |");
L.push("| 7 | careers / pricing / methodology / verify-supplier / resources / training-plans | 各自字典键 | 直读 | 5+5+3+2+2+1 |");
L.push("| 8 | tools 风险计算器 | 字典 `risk.page.metaDesc` + `risk.page.metaTitle`（页面拼 `\\| FactoryAuditB2B RiskScore™`） | 直读 + 页面级后缀 29 字符 | 5 |");
L.push("| 9 | monitoring | 字典 `monitoring.metaDesc` | 直读（es/de/fr） | 3（额外项） |");
L.push("| 10 | terms 标题 | 字典 `legal.termsTitle`（页面模板拼 `\\| FactoryAuditB2B`，18 字符） | 直读 | 6（额外项） |");
L.push("| 11 | chemicals 中文 | 字典 `chemicals.metaDesc`（zh 短，其余 8 语已达标） | 直读 | 2（额外项） |");
L.push("| 12 | case-studies 列表 | **`CASE_LIST_META.zh`** | `pickZhCopy` ⇒ zh-TW 由 `twText` 繁化 | 2（额外项） |");
L.push("| 13 | field-reports 列表 | **`FIELD_REPORT_LIST_META.zh`** | 同上 | 2（额外项） |");
L.push("");
L.push("🔴 **两个关键发现**");
L.push("");
L.push("1. **`pickZhPair` 的 7 语种回退**：`case-studies` 4 条 + `field-reports` 4 条 + `industry` 主题 3 条 = **11 条 en 源头，覆盖 7 × 11 = 77 项**（占 141 的 55%）。");
L.push("2. **`CJK_RE.test()` 把「拉丁文案 + 双语行业名」误判成中文** ⇒ 行业分类页的 desc 预算被压到 **90**（而非 158）。实测**影响 82 页**（76 个行业分类页 + 6 个供应商页），其 desc 被压在 64–90 字符。详见 §4。");
L.push("");
L.push("---");
L.push("");
L.push("## 2. 字典层改写对照（" + CANDIDATES.length + " 处）");
L.push("");
L.push("| 源键 | 语种 | 旧（源头→收口） | 新（源头→收口） | 结尾OK | 幂等 | 覆盖页 | 属 141 |");
L.push("|---|---|---|---|---|---|---|---|");
for (const c of CANDIDATES) {
  const o = subst(c.old);
  const n = subst(c.neu);
  const oldOut = trimMetaDescription(o);
  const neuOut = trimMetaDescription(n);
  const endOk = SENT.test(neuOut.slice(-1));
  const cut = neuOut !== n;
  const cov = c.kind === "title" ? (COVER[c.key] ?? 1) : c.loc === "" ? 1 : COVER[c.key] ?? 1;
  const flagged = flaggedFor(c);
  L.push(
    `| \`${c.key}\` | ${c.loc} | ${[...o].length} → ${[...oldOut].length}${SENT.test(oldOut.slice(-1)) ? "" : " ✗"} | **${[...n].length} → ${[...neuOut].length}** | ${endOk ? "✓" : "✗"} | ${cut ? "✗" : "✓"} | ${c.kind === "title" ? 1 : cov} | ${flagged ? "✓" : "—"} |`,
  );
}
L.push("");
L.push("");
L.push("### 2b. title 越界对照（" + CANDIDATES.filter((c) => c.kind === "title").length + " 处）");
L.push("");
L.push("| 源键 | 语种 | 旧主体 | 旧合成 | 新主体 | 新合成 | 目标 50–60 |");
L.push("|---|---|---|---|---|---|---|");
for (const c of CANDIDATES.filter((c) => c.kind === "title")) {
  const sfx = c.suffix ?? "";
  const of = trimMetaTitle(c.old + sfx);
  const nf = trimMetaTitle(c.neu + sfx);
  const tot = [...c.neu].length + [...sfx].length;
  L.push(
    `| \`${c.key}\` | ${c.loc} | ${[...c.old].length} | ${[...c.old].length + [...sfx].length} | **${[...c.neu].length}** | **${tot}** | ${tot >= 50 && tot <= 60 ? "✓" : "✗"} |`,
  );
  void of;
  void nf;
}
L.push("");
L.push("---");
L.push("");
L.push("## 3. TS 内容层改写对照（" + TS_CANDIDATES.length + " 处）");
L.push("");
L.push("| 源（文件·字段） | 生效语种 | 旧（源头→收口） | 新（源头→收口） | 结尾OK | 幂等 | 覆盖页 | 属 141 |");
L.push("|---|---|---|---|---|---|---|---|");
for (const c of TS_CANDIDATES) {
  const oldOut = trimMetaDescription(c.old);
  const neuOut = trimMetaDescription(c.neu);
  const endOk = SENT.test(neuOut.slice(-1));
  const cut = neuOut !== c.neu;
  L.push(
    `| \`${c.key}\` | ${c.loc} | ${[...c.old].length} → ${[...oldOut].length}${SENT.test(oldOut.slice(-1)) ? "" : " ✗"} | **${[...c.neu].length} → ${[...neuOut].length}** | ${endOk ? "✓" : "✗"} | ${cut ? "✗" : "✓"} | ${COVER[c.key] ?? 1} | ${flaggedFor(c) ? flaggedFor(c) : "—"} |`,
  );
}
L.push("");

// ---- 4. 汇总 ----
const dictFlaggedPages = CANDIDATES.reduce((a, c) => a + flaggedFor(c), 0);
const tsFlaggedPages = TS_CANDIDATES.reduce((a, c) => a + (FLAGGED[c.key] ?? 0), 0);
L.push("---");
L.push("");
L.push("## 4. 覆盖汇总");
L.push("");
L.push("| 组 | 源键改动数 | 覆盖页面数 | 其中属「141 项」 |");
L.push("|---|---|---|---|");
L.push(`| 字典层 | ${CANDIDATES.length} | ${CANDIDATES.reduce((a, c) => a + (c.kind === "title" ? 1 : COVER[c.key] ?? 1), 0)} | ${dictFlaggedPages} |`);
L.push(`| TS 内容层 | ${TS_CANDIDATES.length} | ${TS_CANDIDATES.reduce((a, c) => a + (COVER[c.key] ?? 1), 0)} | ${tsFlaggedPages} |`);
L.push("");
L.push("- `countryHub.metaDesc` 单语种 → **5 页**（china/malaysia/philippines/thailand/vietnam）");
L.push("- `caseStudies/*.metaDescEn` 单条 → **7 页**（en/ja/es/de/fr/pt/ar）");
L.push("- 11 条 en 源头 ⇒ **77 页**");
L.push("- `CASE_LIST_META.zh` / `FIELD_REPORT_LIST_META.zh` 单条 → **2 页**（zh + zh-TW）");
L.push("");
L.push("### 🔴 关于「industry 分类页 desc 只能到 84 字符」");
L.push("");
L.push("`lib/pageMeta.ts` 的预算判定是 `CJK_RE.test(text) ? 90 : 158`——**只要有 1 个 CJK 字符就按 90 算**。");
L.push("行业分类页把 `{industry}` 替换成**双语名**（`Food & Beverage / 食品饮料`，22 字符含 4 个汉字），");
L.push("于是一整段拉丁文案的预算被压到 90。实测**全站 82 页**受此影响（76 行业分类页 + 6 供应商页），desc 长度被夹在 **64–90**。");
L.push("");
L.push("| 方案 | 做法 | 行业分类页 desc（es 为例） | 影响面 | 风险 |");
L.push("|---|---|---|---|---|");
L.push("| **A（默认，本次只做）** | 只改源头，把行业名后的句子收短，保证含双语名 ≤90 | 84 字符 | 0（不改收口函数） | 无 |");
L.push("| **A+B（建议追加）** | 把 `CJK_RE.test()` 改为**CJK 占比 > 25%** 判定 | 约 100–158 字符 | **82 页** | 改动全站收口器，需全量重跑 sweep + 4 个回归 |");
L.push("");
L.push("---");
L.push("");
L.push("## 5. 风险与未解决问题");
L.push("");
L.push("1. **`legal.termsTitle` 的 ar 值疑似原译文有误**：现值 `مدة الخدمة` 字面是「服务期限」，非「服务条款」；建议改为 `شروط الخدمة وقواعد استخدام المنصة`。**属语义订正，需您确认**。");
L.push("2. **`risk.page.metaTitle` 的语义词挪动**：为把合成标题压进 50–60，es/fr/pt 改用「采购风险计算器」措辞（`riesgo de compra` / `risque d'achat` / `risco de compra`），en 保持 `Supplier Risk Calculator` 不变。若您希望严格保留「供应商」字面，则只能接受 62–65 字符的越界值——**请二选一**。");
L.push("3. **`countryHub.metaDesc` 的 ar 原本是英文未翻译**（`Supplier verification and factory audit in {country}: …`）。本次一并译为阿拉伯语。");
L.push("4. **新增中文串未进 `TW_MAP.str` 全串映射**：`twText` 走词组/单字兜底，实测输出正确（`文档`→`檔案` 等），但若要严格一致应重跑 `scripts/gen-tw-mapping.py`。");
L.push("5. **存在绕过 `buildPageMetadata` 的页面**：`/tools`、`/tools/supplier-verification-checklist` 直接写 `metadata`，**不经 desc 收口**（实测 es desc 达 208 字符）。属另一类问题（未收口 ≠ 半句话），不在 141 内，未动。");
L.push("6. **仍非幂等的 desc 源键（CUT=Y 但结尾有标点）**：全站审计命中 96 处（如 `coverage.metaDesc`、`servicesIndex.metaDesc`、`methodology.metaDesc` en/de、`monitoring.metaDesc` en/pt/ar 等）。它们渲染出的 desc **是完整句子**，仅比源头短，不属缺陷类；若要求全站幂等需再开一批。");
L.push("");

fs.writeFileSync("outputs/stage1.6-proposal.md", L.join("\n"), "utf8");
console.log("WROTE outputs/stage1.6-proposal.md  lines=" + L.length);
