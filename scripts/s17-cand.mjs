// scripts/_s17_cand.mjs —— stage1.7 候选文案测量（只读，不写盘）
// 用法：node scripts/_s17_cand.mjs
//
// 口径：拉丁 desc 120–158｜CJK desc 60–90｜双句且结尾句末标点｜收口幂等
import fs from "node:fs";

const CJK = /[\u3000-\u9fff\u3040-\u30ff\uacad-\ud7af\uac00-\ud7af]/;
const CJK_G = new RegExp(CJK.source, "g");
const SENT = /[.。!！?？]/;
// 与 lib/pageMeta.ts 的 desc 口径保持一致
const DESC_RATIO = 0.1;
const isCjk = (s) => {
  const t = [...s].length;
  return t ? (s.match(CJK_G) ?? []).length / t > DESC_RATIO : false;
};

const CAND = {
  toolsIndex: {
    en: "Free tools to evaluate supplier risk, check verification readiness, build audit checklists and analyse audit reports. No account required.",
    zh: "免费工具：评估供应商风险、检查核验完备度、生成验厂检查表、分析验厂报告。全部工具无需注册即可使用，帮助买家在询价前完成初步筛选。",
    "zh-TW":
      "免費工具：評估供應商風險、檢查核驗完備度、產生驗廠檢查表、分析驗廠報告。全部工具無需註冊即可使用，協助買家在詢價前完成初步篩選。",
    ja: "サプライヤーをスクリーニングし、文書を確認し、監査チェックリストを作成し、監査レポートを分析するための無料ツール。アカウントは必要ありません。",
    es: "Herramientas gratuitas para evaluar el riesgo del proveedor y preparar la verificación. Cree listas de auditoría y analice informes sin necesidad de cuenta.",
    de: "Kostenlose Werkzeuge zum Prüfen von Lieferanten, Kontrollieren von Dokumenten, Erstellen von Prüflisten und Auswerten von Auditberichten. Ohne Konto.",
    fr: "Outils gratuits pour filtrer des fournisseurs, contrôler des documents, créer des listes d'audit et analyser des rapports. Sans compte.",
    pt: "Ferramentas grátis para filtrar fornecedores, conferir documentos, montar listas de auditoria e analisar relatórios. Sem cadastro.",
    ar: "أدوات مجانية لتقييم مخاطر الموردين والتحقق من جاهزية التدقيق وإنشاء قوائم التدقيق وتحليل تقارير التدقيق. لا حاجة إلى حساب.",
  },
  checklist: {
    en: "A free step-by-step checklist covering company identity, factory capability, quality, compliance and commercial terms. Tick items and track progress.",
    zh: "免费的逐步核查清单，覆盖企业身份、厂房能力、质量、合规与商务条款六大维度。可逐项勾选并记录进度，验厂前完成自查后打印归档。",
    "zh-TW":
      "免費的逐步查核清單，涵蓋企業身分、廠房能力、品質、合規與商務條款六大面向。可逐項勾選並記錄進度，驗廠前完成自查後列印歸檔。",
    ja: "会社の身元、工場の能力、品質、コンプライアンス、商取引条件を網羅した無料のステップ別チェックリスト。項目にチェックを入れ、進捗を記録できます。",
    es: "Una lista de verificación gratuita y paso a paso sobre identidad, capacidad, calidad, cumplimiento y términos comerciales. Marque ítems y siga su progreso.",
    de: "Kostenlose Schritt-für-Schritt-Liste zu Identität, Kapazität, Qualität, Compliance und Handelsbedingungen. Punkte abhaken und Fortschritt verfolgen.",
    fr: "Une liste gratuite étape par étape couvrant l'identité, la capacité, la qualité, la conformité et les conditions d'achat. Cochez et suivez la progression.",
    pt: "Uma lista gratuita passo a passo sobre identidade, capacidade, qualidade, conformidade e condições comerciais. Marque os itens e acompanhe o progresso.",
    ar: "قائمة تحقق مجانية خطوة بخطوة تغطي هوية الشركة وقدرة المصنع والجودة والامتثال والشروط التجارية. حدد البنود وتابع تقدمك واطبع ملف المورد.",
  },
};

const DICT = "i18n/dictionaries";
let bad = 0;
let checked = 0;

for (const [group, table] of Object.entries(CAND)) {
  console.log(`\n########## ${group} ##########`);
  console.log("  loc     len  预算   cjk%  endOk  判定");
  for (const [loc, val] of Object.entries(table)) {
    checked++;
    const n = [...val].length;
    const cjk = isCjk(val);
    const cap = cjk ? 90 : 158;
    const floor = cjk ? 60 : 120;
    const endOk = SENT.test(val.slice(-1));
    const bandOk = n >= floor && n <= cap;
    const ok = bandOk && endOk;
    if (!ok) bad++;
    console.log(
      `  ${loc.padEnd(7)} ${String(n).padStart(4)}  ${String(cap).padStart(4)}  ${String(
        Math.round(((val.match(CJK_G) ?? []).length / n) * 100),
      ).padStart(4)}  ${endOk ? "✓" : "✗"}     ${ok ? "OK" : `FAIL(${!bandOk ? "长度" : "句末标点"})`}`,
    );
  }
}

// 与现有字典对照：确认「将要改」的键确实存在、且当前值确实不合规
console.log("\n########## 与现有字典对照（将要改哪些）##########");
const cur = {};
for (const l of ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"]) {
  cur[l] = JSON.parse(fs.readFileSync(`${DICT}/${l}.json`, "utf8"));
}
for (const [group, table] of Object.entries(CAND)) {
  const names = [];
  for (const [loc, val] of Object.entries(table)) {
    const old =
      group === "toolsIndex"
        ? cur[loc].toolsIndex.metaDesc
        : cur[loc].checklist.page.metaDesc;
    if (old !== val) names.push(`${loc}(${[...old].length}→${[...val].length})`);
  }
  console.log(`  ${group.padEnd(11)} 需改 ${names.length} 语：${names.join(" ") || "无"}`);
}

console.log(`\n=== 候选测量：检查 ${checked} 条｜不合规 ${bad} 条 ===`);
if (bad) console.log("（修正后再落盘）");
