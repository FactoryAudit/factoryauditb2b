#!/usr/bin/env node
/**
 * P1-9 对比工具字典（2026-09-01）
 * 1) toolCards.supplierComparison（首页/工具索引卡片）
 * 2) compare 块（对比工具页面全部文案）
 * 策略：en/zh/zh-TW 手写；es/de/fr/pt/ja/ar 复制英文（英文回退，符合项目惯例）。
 * 运行：node scripts/apply-compare-dict.cjs
 */
const fs = require("fs");
const path = require("path");

const D = path.join(process.cwd(), "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];
const copyEn = ["es", "de", "fr", "pt", "ja", "ar"];

const load = (l) => JSON.parse(fs.readFileSync(path.join(D, `${l}.json`), "utf8"));
const save = (l, d) =>
  fs.writeFileSync(path.join(D, `${l}.json`), JSON.stringify(d, null, 2) + "\n", "utf8");

const card = {
  en: {
    title: "Supplier Comparison",
    desc: "Score two to five suppliers on the same eight dimensions and compare them side by side.",
  },
  zh: {
    title: "供应商对比",
    desc: "用同一套八维标准给 2 到 5 家供应商打分并排比较。",
  },
  "zh-TW": {
    title: "供應商對比",
    desc: "用同一套八維標準給 2 到 5 家供應商打分並排比較。",
  },
};

const compare = {
  en: {
    metaTitle: "Supplier Comparison Tool — Compare 2 to 5 Suppliers Side by Side",
    metaDesc:
      "Score two to five suppliers on the same eight dimensions and compare them side by side. Self-reported inputs, decision support only.",
    badge: "Free tool",
    h1: "Supplier Comparison",
    lead:
      "Score two to five suppliers against the same eight dimensions and see them side by side. You enter the answers, so this is decision support, not a verification.",
    addSupplier: "Add a supplier",
    supplierLabel: "Supplier",
    namePlaceholder: "Supplier A",
    remove: "Remove",
    maxNote: "Up to five suppliers at a time.",
    minNote: "Add at least two suppliers to see a comparison.",
    dimensionCol: "Dimension",
    strong: "Strong",
    strongHint: "Documented and verifiable",
    adequate: "Adequate",
    adequateHint: "Partly documented",
    weak: "Weak",
    weakHint: "Missing or inadequate",
    unknown: "Unknown",
    unknownHint: "Not checked yet",
    scoreCol: "Score",
    summaryTitle: "Comparison summary",
    bestNote: "Highest score on the inputs you entered.",
    biggestGapTitle: "Where they differ most",
    biggestGapNote:
      "The dimension with the widest spread between the highest and lowest score.",
    noGapNote: "No meaningful gap yet. Fill in more dimensions to see where they differ.",
    disclaimer:
      "This comparison uses the numbers you enter. It is decision support, not a verification. A high score does not mean we have checked the supplier.",
    ctaTitle: "Want these answers checked?",
    ctaLead:
      "Verification starts at $99 per supplier and turns self-reported answers into reviewed evidence.",
    ctaPrimary: "Request verification",
    reset: "Reset",
  },
  zh: {
    metaTitle: "供应商对比工具 — 2 到 5 家并排比较",
    metaDesc: "用同一套八维标准给 2 到 5 家供应商打分并排比较。数据由你填写，仅作决策参考。",
    badge: "免费工具",
    h1: "供应商对比",
    lead:
      "用同一套八维标准给 2 到 5 家供应商打分并排查看。答案由你填写，因此这是决策参考，不是核验结论。",
    addSupplier: "添加供应商",
    supplierLabel: "供应商",
    namePlaceholder: "供应商 A",
    remove: "移除",
    maxNote: "一次最多比较 5 家。",
    minNote: "至少添加 2 家才能看到对比结果。",
    dimensionCol: "维度",
    strong: "强",
    strongHint: "有文件且可核实",
    adequate: "中等",
    adequateHint: "部分有文件",
    weak: "弱",
    weakHint: "缺失或不足",
    unknown: "未核实",
    unknownHint: "尚未核查",
    scoreCol: "得分",
    summaryTitle: "对比汇总",
    bestNote: "在你填写的数据中得分最高。",
    biggestGapTitle: "差异最大的维度",
    biggestGapNote: "最高分与最低分差距最大的那个维度。",
    noGapNote: "暂时没有明显差异。继续填写更多维度即可看到差距。",
    disclaimer:
      "本对比使用你填写的数据，仅作决策参考，不是核验结论。高分不代表我们已经核查过该供应商。",
    ctaTitle: "想让这些答案被核实？",
    ctaLead: "核验按供应商计价，起价 99 美元，把自报答案变成经过审阅的证据。",
    ctaPrimary: "申请核验",
    reset: "重置",
  },
  "zh-TW": {
    metaTitle: "供應商對比工具 — 2 到 5 家並排比較",
    metaDesc: "用同一套八維標準給 2 到 5 家供應商打分並排比較。資料由你填寫，僅作決策參考。",
    badge: "免費工具",
    h1: "供應商對比",
    lead:
      "用同一套八維標準給 2 到 5 家供應商打分並排查看。答案由你填寫，因此這是決策參考，不是核驗結論。",
    addSupplier: "新增供應商",
    supplierLabel: "供應商",
    namePlaceholder: "供應商 A",
    remove: "移除",
    maxNote: "一次最多比較 5 家。",
    minNote: "至少新增 2 家才能看到對比結果。",
    dimensionCol: "維度",
    strong: "強",
    strongHint: "有文件且可核實",
    adequate: "中等",
    adequateHint: "部分有文件",
    weak: "弱",
    weakHint: "缺失或不足",
    unknown: "未核實",
    unknownHint: "尚未核查",
    scoreCol: "得分",
    summaryTitle: "對比彙總",
    bestNote: "在你填寫的資料中得分最高。",
    biggestGapTitle: "差異最大的維度",
    biggestGapNote: "最高分與最低分差距最大的那個維度。",
    noGapNote: "暫時沒有明顯差異。繼續填寫更多維度即可看到差距。",
    disclaimer:
      "本對比使用你填寫的資料，僅作決策參考，不是核驗結論。高分不代表我們已經核查過該供應商。",
    ctaTitle: "想讓這些答案被核實？",
    ctaLead: "核驗按供應商計價，起價 99 美元，把自報答案變成經過審閱的證據。",
    ctaPrimary: "申請核驗",
    reset: "重置",
  },
};

for (const l of LOCALES) {
  const d = load(l);
  const src = copyEn.includes(l) ? "en" : l;
  d.toolCards.supplierComparison = card[src] ?? card.en;
  d.compare = compare[src] ?? compare.en;
  save(l, d);
  console.log(`updated ${l}`);
}
console.log("done");
