#!/usr/bin/env node
/**
 * apply-evidence-i18n.cjs
 * 1) FORCE 修复 ja / zh-TW 的 verification.levels / levelsShort 西语污染
 *    （历史批量翻译脚本误把西语 "Nivel 0: No verificado" / "Sin verificar" 等写入 ja/zh-TW）
 * 2) 幂等补齐 evidence 命名空间 12 键（8 语言；zh 已译则跳过）
 *
 * 用法: node scripts/apply-evidence-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));

// ---------- 1) FORCE 修复 levels 西语污染 ----------
const LEVELS_FIX = {
  ja: {
    levels: [
      "レベル 0: 未検証",
      "レベル 1: 事業情報を確認済み",
      "レベル 2: 書類をレビュー済み",
      "レベル 3: 工場を検証済み",
      "レベル 4: 工場を監査済み",
    ],
    levelsShort: [
      "未検証",
      "事業情報確認済み",
      "書類レビュー済み",
      "工場検証済み",
      "工場監査済み",
    ],
  },
  "zh-TW": {
    levels: [
      "等級 0：未核實",
      "等級 1：商業資訊已核對",
      "等級 2：文件已審閱",
      "等級 3：工廠已核驗",
      "等級 4：工廠已驗廠",
    ],
    levelsShort: [
      "未核實",
      "商業資訊已核對",
      "文件已審閱",
      "工廠已核驗",
      "工廠已驗廠",
    ],
  },
};

// ---------- 2) evidence 命名空间翻译 ----------
const EVIDENCE_L10N = {
  "zh-TW": {
    title: "認證與證據",
    lead: "我們把供應商交來的材料與我們實際核查過的證據分開。工廠提供了一份文件，不等於我們審閱並確認了它。",
    reviewed: "證據已審閱",
    provided: "文件已提供",
    notProvided: "未提供",
    verified: "已核實",
    partiallyVerified: "部分核實",
    unverified: "未核實",
    expired: "已過期",
    missing: "缺失",
    restricted: "原始文件：受限",
    validAtReview: "審閱時有效",
    statusNote: "「文件已提供」表示供應商把材料交給了我們；「證據已審閱」表示我們對照來源核對過。",
  },
  ja: {
    title: "認証と証拠",
    lead: "サプライヤーから受け取った書類と、実際に確認した証拠を分けて扱います。工場が提供した書類は、レビュー済みの証拠と同じではありません。",
    reviewed: "証拠レビュー済み",
    provided: "書類提供済み",
    notProvided: "未提供",
    verified: "検証済み",
    partiallyVerified: "一部検証済み",
    unverified: "未検証",
    expired: "有効期限切れ",
    missing: "欠落",
    restricted: "原本：制限付き",
    validAtReview: "レビュー時点で有効",
    statusNote:
      "「書類提供済み」はサプライヤーから受け取ったことを意味します。「証拠レビュー済み」は出典と照合したことを意味します。",
  },
  de: {
    title: "Zertifizierungen & Belege",
    lead: "Wir trennen, was der Lieferant übergeben hat, von dem, was wir tatsächlich geprüft haben. Ein Dokument, das die Fabrik bereitgestellt hat, ist nicht dasselbe wie ein von uns geprüfter Beleg.",
    reviewed: "Beleg geprüft",
    provided: "Dokument bereitgestellt",
    notProvided: "Nicht bereitgestellt",
    verified: "Verifiziert",
    partiallyVerified: "Teilweise verifiziert",
    unverified: "Nicht verifiziert",
    expired: "Abgelaufen",
    missing: "Fehlend",
    restricted: "Originaldokument: eingeschränkt",
    validAtReview: "Zum Prüfzeitpunkt gültig",
    statusNote:
      "„Dokument bereitgestellt“ bedeutet, dass der Lieferant es uns gegeben hat. „Beleg geprüft“ bedeutet, dass wir es mit seiner Quelle abgeglichen haben.",
  },
  fr: {
    title: "Certifications et preuves",
    lead: "Nous distinguons ce que le fournisseur nous a remis de ce que nous avons réellement vérifié. Un document fourni par l'usine n'est pas la même chose qu'une preuve que nous avons examinée.",
    reviewed: "Preuve examinée",
    provided: "Document fourni",
    notProvided: "Non fourni",
    verified: "Vérifié",
    partiallyVerified: "Partiellement vérifié",
    unverified: "Non vérifié",
    expired: "Expiré",
    missing: "Manquant",
    restricted: "Document original : restreint",
    validAtReview: "Valide au moment de l'examen",
    statusNote:
      "« Document fourni » signifie que le fournisseur nous l'a donné. « Preuve examinée » signifie que nous l'avons vérifiée par rapport à sa source.",
  },
  es: {
    title: "Certificaciones y pruebas",
    lead: "Separamos lo que el proveedor entregó de lo que realmente hemos comprobado. Un documento proporcionado por la fábrica no es lo mismo que una prueba que hemos revisado.",
    reviewed: "Prueba revisada",
    provided: "Documento proporcionado",
    notProvided: "No proporcionado",
    verified: "Verificado",
    partiallyVerified: "Parcialmente verificado",
    unverified: "Sin verificar",
    expired: "Caducado",
    missing: "Faltante",
    restricted: "Documento original: restringido",
    validAtReview: "Válido al momento de la revisión",
    statusNote:
      "«Documento proporcionado» significa que el proveedor nos lo entregó. «Prueba revisada» significa que lo comprobamos contra su fuente.",
  },
  pt: {
    title: "Certificações e evidências",
    lead: "Separamos o que o fornecedor entregou do que realmente verificamos. Um documento fornecido pela fábrica não é o mesmo que uma evidência que revisamos.",
    reviewed: "Evidência revisada",
    provided: "Documento fornecido",
    notProvided: "Não fornecido",
    verified: "Verificado",
    partiallyVerified: "Parcialmente verificado",
    unverified: "Não verificado",
    expired: "Expirado",
    missing: "Ausente",
    restricted: "Documento original: restrito",
    validAtReview: "Válido no momento da revisão",
    statusNote:
      "«Documento fornecido» significa que o fornecedor nos entregou. «Evidência revisada» significa que verificamos contra a fonte.",
  },
  ar: {
    title: "الشهادات والأدلة",
    lead: "نفصل بين ما سلّمه المورد وما تحققنا منه فعلياً. المستند الذي قدمه المصنع ليس نفس الدليل الذي راجعناه.",
    reviewed: "دليل قيد المراجعة",
    provided: "مستند مقدم",
    notProvided: "غير مقدم",
    verified: "تم التحقق منه",
    partiallyVerified: "تم التحقق جزئياً",
    unverified: "لم يتم التحقق",
    expired: "منتهي الصلاحية",
    missing: "مفقود",
    restricted: "المستند الأصلي: مقيد",
    validAtReview: "ساري وقت المراجعة",
    statusNote:
      "«مستند مقدم» يعني أن المورد أعطاه لنا. «دليل قيد المراجعة» يعني أننا تحققنا منه مقابل مصدره.",
  },
};

function fixLevels(locale) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const fix = LEVELS_FIX[locale];
  if (!fix) return 0;
  if (!dict.verification) dict.verification = {};
  let n = 0;
  for (const k of ["levels", "levelsShort"]) {
    dict.verification[k] = [...fix[k]];
    n += fix[k].length;
  }
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${locale} levels/levelsShort FORCE 修复 ${n} 项`);
  return n;
}

function applyEvidence(locale) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const l10n = EVIDENCE_L10N[locale];
  if (!l10n) return;
  let written = 0;
  if (!dict.evidence) dict.evidence = {};
  for (const [k, v] of Object.entries(l10n)) {
    if (dict.evidence[k] === undefined || dict.evidence[k] === en.evidence[k]) {
      dict.evidence[k] = v;
      written++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${locale} evidence 写入 ${written} 键`);
}

for (const loc of Object.keys(LEVELS_FIX)) fixLevels(loc);
for (const loc of Object.keys(EVIDENCE_L10N)) applyEvidence(loc);
console.log("完成。");
