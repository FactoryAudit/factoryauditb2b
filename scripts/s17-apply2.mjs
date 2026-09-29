// scripts/_s17_apply2.mjs —— stage1.7 字典层替值（tools 两页 9 语 desc）
// 用法：node scripts/_s17_apply2.mjs
//
// 护栏（任一不满足即 exit 1，不写盘）：
//   ① 旧值 JSON 片段必须恰好命中 1 次
//   ② 新值必须**先自检通过**（拉丁 120–158 / CJK 60–90 + 结尾句末标点）
//   ③ 写回后必须纯 CRLF、末尾 CRLF
//   ④ 叶子数 / 键集与替换前完全一致（只改值不增删键）
import fs from "node:fs";

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const CRLF = CR + LF;

const DICT = "i18n/dictionaries";
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

// 与 scripts/_s17_cand.mjs 同源的候选（已测量通过 18/18）
const CAND = {
  toolsIndex: {
    zh: "免费工具：评估供应商风险、检查核验完备度、生成验厂检查表、分析验厂报告。全部工具无需注册即可使用，帮助买家在询价前完成初步筛选。",
    "zh-TW":
      "免費工具：評估供應商風險、檢查核驗完備度、產生驗廠檢查表、分析驗廠報告。全部工具無需註冊即可使用，協助買家在詢價前完成初步篩選。",
    es: "Herramientas gratuitas para evaluar el riesgo del proveedor y preparar la verificación. Cree listas de auditoría y analice informes sin necesidad de cuenta.",
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

const CJK = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const CJK_G = new RegExp(CJK.source, "g");
const SENT = /[.。!！?？]/;
const isCjk = (s) => {
  const t = [...s].length;
  return t ? (s.match(CJK_G) ?? []).length / t > 0.1 : false;
};

/** 行尾体检：返回 { lf, crlf, bareLF } */
function eolStats(text) {
  const lf = text.split(LF).length - 1;
  const crlf = text.split(CRLF).length - 1;
  return { lf, crlf, bareLF: lf - crlf };
}

/** 自检：新值必须落带宽且以句末标点收尾（否则中止，不写盘） */
function selfCheck(val, label) {
  const n = [...val].length;
  const cjk = isCjk(val);
  const lo = cjk ? 60 : 120;
  const hi = cjk ? 90 : 158;
  if (n < lo || n > hi) throw new Error(`${label} 长度 ${n} 不在 ${lo}–${hi}`);
  if (!SENT.test(val.slice(-1))) throw new Error(`${label} 结尾非句末标点`);
  return n;
}

function leaves(node, path = "", out = []) {
  if (Array.isArray(node)) node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out);
  } else out.push(path);
  return out;
}

const getter = (d, group) =>
  group === "toolsIndex" ? d.toolsIndex.metaDesc : d.checklist.page.metaDesc;

let changed = 0;
const report = [];

for (const loc of LOCALES) {
  const file = `${DICT}/${loc}.json`;
  let raw = fs.readFileSync(file, "utf8");
  const before = JSON.parse(raw);
  const beforeLeaves = leaves(before);
  let touched = false;

  for (const [group, table] of Object.entries(CAND)) {
    const neu = table[loc];
    if (!neu) continue;
    const old = getter(before, group);
    if (old === neu) continue;

    const n = selfCheck(neu, `${group}[${loc}]`);

    const oldJson = JSON.stringify(old);
    const hits = raw.split(oldJson).length - 1;
    if (hits !== 1) throw new Error(`${group}[${loc}] 旧值 JSON 片段命中 ${hits} 次（应为 1）`);
    raw = raw.replace(oldJson, JSON.stringify(neu));
    touched = true;
    changed++;
    report.push(
      `  ${loc.padEnd(6)} ${group.padEnd(11)} ${String([...old].length).padStart(3)} → ${String(n).padStart(3)}`,
    );
  }

  if (!touched) continue;

  // 写盘前统一护栏
  const after = JSON.parse(raw);
  const afterLeaves = leaves(after);
  if (afterLeaves.length !== beforeLeaves.length) {
    throw new Error(`${loc}: 叶子数变化 ${beforeLeaves.length} → ${afterLeaves.length}`);
  }
  const missing = beforeLeaves.filter((p) => !afterLeaves.includes(p));
  if (missing.length) throw new Error(`${loc}: 丢失叶子 ${missing[0]}`);

  const e = eolStats(raw);
  if (e.bareLF !== 0) throw new Error(`${loc}: 出现 ${e.bareLF} 处 bare LF`);
  if (!raw.endsWith(CRLF)) throw new Error(`${loc}: 末尾非 CRLF`);

  fs.writeFileSync(file, raw, "utf8");
}

console.log("✓ 字典替值完成");
console.log(report.join("\n"));
console.log(`\n共改动 ${changed} 处`);

// 全量复核
console.log("\n########## 9 语字典格式复核 ##########");
for (const loc of LOCALES) {
  const raw = fs.readFileSync(`${DICT}/${loc}.json`, "utf8");
  const d = JSON.parse(raw);
  const e = eolStats(raw);
  console.log(
    `  ${loc.padEnd(6)} crlf=${String(e.crlf).padStart(5)} bareLF=${e.bareLF} leaf=${leaves(d).length} tailCRLF=${raw.endsWith(CRLF)}`,
  );
}
