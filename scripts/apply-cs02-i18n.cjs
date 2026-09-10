// CS-02 —— 注入 2 个新文案键 × 9 语（幂等，可重复执行）
//
// 背景：详情页两处文案语义错误，必须换掉而不是复用旧键：
//   1) verification.evidenceOnFile
//      —— 旧键 verification.evidence = "Evidence reviewed" 被当作证据条数的标签。
//         「档案里有几条证据」≠「已复核」。必须分开表述。
//   2) supplierProfile.certClaimsReported
//      —— 旧键 supplierProfile.certificationsLabel = "Certifications" 被当作
//         suppliers.certifications（自述声明数组）的标签，会被读成「已获认证」。
//
// 格式约定：2 空格缩进 + CRLF + 末尾换行（与既有字典一致）
// 用法: node scripts/apply-cs02-i18n.cjs
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(process.cwd(), "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

// [verification.evidenceOnFile, supplierProfile.certClaimsReported]
const VALUES = {
  en: ["Evidence on file", "Reported certification claims"],
  zh: ["档案内证据条数", "已申报的认证声明"],
  "zh-TW": ["檔案內證據筆數", "已申報的認證聲明"],
  ja: ["記録されている証拠の件数", "申告された認証情報"],
  es: ["Evidencia registrada", "Certificaciones declaradas"],
  de: ["Hinterlegte Nachweise", "Gemeldete Zertifikatsangaben"],
  fr: ["Preuves archivées", "Certifications déclarées"],
  pt: ["Evidências registradas", "Certificações declaradas"],
  ar: ["الأدلة المسجلة", "شهادات مُصرَّح بها"],
};

const PATHS = [
  ["verification", "evidenceOnFile"],
  ["supplierProfile", "certClaimsReported"],
];

let total = 0;
for (const locale of LOCALES) {
  const file = path.join(DIR, locale + ".json");
  if (!fs.existsSync(file)) {
    console.log("跳过（文件不存在）: " + locale);
    continue;
  }
  const raw = fs.readFileSync(file, "utf8");
  const dict = JSON.parse(raw);
  const vals = VALUES[locale];
  let changed = 0;
  PATHS.forEach(([ns, key], i) => {
    if (!dict[ns]) {
      console.log("  ⚠️ " + locale + " 缺少命名空间 " + ns + "，跳过 " + key);
      return;
    }
    const before = dict[ns][key];
    if (before !== vals[i]) {
      dict[ns][key] = vals[i];
      changed++;
    }
  });
  if (changed > 0) {
    // JSON.stringify 用 LF，必须转回 CRLF；末尾补一个换行
    const out = JSON.stringify(dict, null, 2).replace(/\n/g, "\r\n") + "\r\n";
    fs.writeFileSync(file, out, "utf8");
  }
  console.log(locale.padEnd(7) + " 变更 " + changed + " 处");
  total += changed;
}
console.log("\n合计变更: " + total + " 处（" + LOCALES.length + " 语 × 2 键 = " + LOCALES.length * 2 + "）");
