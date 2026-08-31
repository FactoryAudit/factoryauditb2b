// 一次性脚本：为 9 份字典的 auditRequest.form 注入 rateLimited 文案（保留 CRLF 与 2 空格格式）
// 运行：node scripts/add-rate-limited.cjs
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");

const RATE_LIMITED = {
  en: "You have submitted several requests recently. Please wait about an hour or email us directly.",
  zh: "您提交过于频繁，请约一小时后重试，或直接发邮件联系我们。",
  "zh-TW": "您近期提交過於頻繁，請約一小時後重試，或直接電郵聯絡我們。",
  es: "Ha enviado varias solicitudes recientemente. Espere alrededor de una hora o escríbanos directamente.",
  de: "Sie haben in letzter Zeit mehrere Anfragen gesendet. Bitte warten Sie etwa eine Stunde oder schreiben Sie uns direkt.",
  fr: "Vous avez envoyé plusieurs demandes récemment. Veuillez patienter environ une heure ou nous écrire directement.",
  pt: "Você enviou várias solicitações recentemente. Aguarde cerca de uma hora ou escreva-nos diretamente.",
  ja: "最近の送信回数が多すぎます。約1時間後にお試しいただくか、直接メールでお問い合わせください。",
  ar: "لقد أرسلت عدة طلبات مؤخرًا. يرجى الانتظار لمدة ساعة تقريبًا أو مراسلتنا مباشرة.",
};

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
let changed = 0;

for (const f of files) {
  const lang = f.replace(".json", "");
  const filePath = path.join(DIR, f);
  const text = fs.readFileSync(filePath, "utf8");
  const crlf = text.includes("\r\n");
  const obj = JSON.parse(text);
  const form = obj?.auditRequest?.form;
  if (!form) {
    console.log(`SKIP ${f}: no auditRequest.form`);
    continue;
  }
  if (form.rateLimited) {
    console.log(`SKIP ${f}: already has rateLimited`);
    continue;
  }
  form.rateLimited = RATE_LIMITED[lang] || RATE_LIMITED.en;
  let out = JSON.stringify(obj, null, 2);
  if (crlf) out = out.replace(/\n/g, "\r\n");
  fs.writeFileSync(filePath, out + (crlf ? "\r\n" : "\n"), "utf8");
  changed += 1;
  console.log(`OK ${f}: rateLimited added (${crlf ? "CRLF" : "LF"})`);
}

console.log(`done, changed ${changed} files`);
