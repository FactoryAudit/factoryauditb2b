// scripts/lock-brand-terms.cjs (v2)
// 把"产品名 / 服务档位 / 工具名 / UI 档位"在所有非 zh 语言里锁成英文。
// "描述文案"（包含空格的长句、说明、faq、lead 等）允许翻译。
const fs = require("fs");
const path = require("path");
const D = path.join(process.cwd(), "i18n", "dictionaries");
const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));

/** 完整的"必须英文"key 路径清单 */
const KEEP_EN_PATHS = [
  // 品牌
  "brand.name", "brand.eva", "brand.tagline",
  // 行业缩写：翻译了反而没人认得
  "nav.rfq",
  // 注意：nav 其余项**不锁**。tools/suppliers/services/resources/pricing/about…
  // 是 UI 导航词，不是品牌名，必须跟着语言走。
  // 上一版把它们全锁成英文属过度修正（起因是 MyMemory 把 Resources 翻成「供应商培训」），
  // 正解是手写高质量翻译而非退回英文。翻译见各字典的 nav 段。
  // nav.menu.* 同理跟随语言（与中文站一致）；*Desc 描述本就在翻译，不在清单内。
  // 页脚产品/服务名
  "footer.allTools","footer.riskCalculator","footer.verificationChecklist",
  "footer.supplierVerification","footer.factoryAudit","footer.sourcingService",
  "footer.improvementService","footer.allServices","footer.containerCalculator",
  "footer.trustCenter",
  // 首页覆盖 / 工具
  "home.coverageTitle","home.coveragePhase",
  "home.coverageService1","home.coverageService2","home.coverageService3",
  "home.coverageCta","home.otherRegionTitle","home.otherRegionCta",
  "home.toolsTitle",
  // toolsIndex 工具
  "toolsIndex.badge","toolsIndex.h1",
  // toolCards 全部 title（7 个）
  "toolCards.riskCalculator.title","toolCards.verificationChecklist.title",
  "toolCards.riskAssessment.title","toolCards.auditChecklist.title",
  "toolCards.supplierScorecard.title","toolCards.auditReportAnalyzer.title",
  "toolCards.documentChecker.title",
  // services hub 5 个服务 + 面包屑
  "servicesIndex.badge","servicesIndex.servicesTitle",
  "servicesIndex.items.verification.title",
  "servicesIndex.items.factoryAudit.title",
  "servicesIndex.items.inspection.title",
  "servicesIndex.items.sourcing.title",
  "servicesIndex.items.improvement.title",
  "servicesIndex.coverageTitle",
  "servicesIndex.notSureCta",
  "servicesIndex.breadcrumb",
  // pricing 4 个 plan 名 + 顶部标题
  "pricing.h1","pricing.plansTitle",
  // 风险维度标签
  "risk.dimensions.company.label","risk.dimensions.quality.label",
  "risk.dimensions.compliance.label","risk.dimensions.production.label",
  "risk.dimensions.supplychain.label","risk.dimensions.documentation.label",
  "risk.levels.LOW","risk.levels.MODERATE","risk.levels.ELEVATED","risk.levels.HIGH","risk.levels.CRITICAL",
  // 验证等级
  "verification.levelLabel",
  // 验货
  "inspection.badge","inspection.h1",
  // 信任中心
  "trust.badge","trust.h1",
  // 其他页面标题（已自动锁）
  // 行业标准缩写（散落在 countries.js / 标准列表）：在 coverage.ts 里硬编码英文，不需同步
];

const LANGS = ["es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

function readPath(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
function setPath(obj, dotted, val) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

let totalReset = 0;
for (const lang of LANGS) {
  const p = path.join(D, lang + ".json");
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  let changed = 0;
  for (const key of KEEP_EN_PATHS) {
    const want = readPath(en, key);
    if (want === undefined) continue;
    const have = readPath(d, key);
    if (have !== want) {
      setPath(d, key, want);
      changed++;
    }
  }
  if (changed > 0) {
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n", "utf8");
    console.log(`[${lang}] reset ${changed} brand terms to en`);
    totalReset += changed;
  } else {
    console.log(`[${lang}] ok`);
  }
}
console.log(`total: ${totalReset} terms reset across 7 langs`);