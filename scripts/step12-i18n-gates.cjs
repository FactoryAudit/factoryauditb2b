// STEP 12 —— ① 给 9 语字典加 rfq.form.labels.publicConsent
//            ② 同步 en 叶子数冻结常量 2938 → 2939（2934 字符串 → 2935 字符串）
// 跳过含 "→" 的历史 changelog 行（避免把 "2926 → 2938" 改成错误的历史数字）。
const { readFileSync, writeFileSync } = require("node:fs");

const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];

const TEXT = {
  en: "Allow my request to be shown publicly to suppliers, with my contact details hidden",
  zh: "允许将我的采购需求公开展示给供应商（隐藏我的联系方式）",
  "zh-TW": "允許將我的採購需求公開展示給供應商（隱藏我的聯絡方式）",
  es: "Permitir mostrar mi solicitud públicamente a los proveedores, ocultando mis datos de contacto",
  de: "Meine Anfrage öffentlich für Lieferanten anzeigen lassen, ohne meine Kontaktdaten",
  fr: "Autoriser l'affichage public de ma demande aux fournisseurs, mes coordonnées masquées",
  pt: "Permitir exibir meu pedido publicamente aos fornecedores, ocultando meus dados de contato",
  ja: "連絡先を伏せたうえで、私の依頼をサプライヤーに公開表示することを許可する",
  ar: "السماح بعرض طلبي علنًا للموردين مع إخفاء بيانات الاتصال الخاصة بي",
};

// ---------- ① 字典 ----------
const dictReport = [];
for (const loc of LOCALES) {
  const file = `i18n/dictionaries/${loc}.json`;
  const raw = readFileSync(file, "utf8");
  const d = JSON.parse(raw);
  const path = d?.rfq?.form?.labels;
  if (!path) {
    dictReport.push(`${loc}: SKIP (rfq.form.labels 不存在)`);
    continue;
  }
  if (path.publicConsent) {
    dictReport.push(`${loc}: already present`);
    continue;
  }
  // 插到 messageHint 之后（保持与其它表单一致的字段顺序）
  const rebuilt = {};
  for (const k of Object.keys(path)) {
    rebuilt[k] = path[k];
    if (k === "messageHint") rebuilt.publicConsent = TEXT[loc];
  }
  if (!("publicConsent" in rebuilt)) rebuilt.publicConsent = TEXT[loc];
  d.rfq.form.labels = rebuilt;
  writeFileSync(file, JSON.stringify(d, null, 2) + "\n", "utf8");
  dictReport.push(`${loc}: +publicConsent`);
}

// ---------- ② 门禁常量同步 ----------
const GATE_FILES = [
  "RELEASE-RULES.md",
  "scripts/verify-opennext-bundle.mjs",
  "scripts/cs06a-directory-regression.ts",
  "scripts/cs08-form-regression.ts",
  "scripts/cs12-profile-regression.ts",
  "scripts/cs13-supplier-seo-regression.ts",
  "scripts/cs16-supplier-mgmt-regression.ts",
  "scripts/cs17-commerce-regression.ts",
  "scripts/cs20-supplier-report.ts",
];

const gateReport = [];
for (const f of GATE_FILES) {
  let s;
  try {
    s = readFileSync(f, "utf8");
  } catch {
    gateReport.push(`${f}: MISSING`);
    continue;
  }
  let n = 0;
  const lines = s.split("\n").map((line) => {
    if (line.includes("→")) return line; // 历史 changelog 行：原样保留
    const before = line;
    const after = line.split("2938").join("2939").split("2934").join("2935");
    if (after !== before) n++;
    return after;
  });
  if (n > 0) {
    writeFileSync(f, lines.join("\n"), "utf8");
    gateReport.push(`${f}: ${n} 处已更新`);
  } else {
    gateReport.push(`${f}: 无 2938/2934`);
  }
}

console.log("=== 字典 ===");
console.log(dictReport.join("\n"));
console.log("\n=== 门禁常量 ===");
console.log(gateReport.join("\n"));
