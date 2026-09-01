#!/usr/bin/env node
/**
 * apply-home-bottom-i18n.cjs
 * 补齐 home.bottomCta / home.bottomLead 的 7 语言翻译（trust 页 notConfigured 分支与首页底部引用）。
 * 幂等保护：仅当现值 === en 值或缺失时写入。
 *
 * 用法: node scripts/apply-home-bottom-i18n.cjs
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));

const L10N = {
  "zh-TW": {
    bottomCta: "核實這家供應商",
    bottomLead:
      "把公司名稱和地址發給我們。我們會告訴你能確認什麼、不能確認什麼，以及費用多少。",
  },
  ja: {
    bottomCta: "このサプライヤーを検証する",
    bottomLead:
      "会社名と住所をお送りください。確認できること、確認できないこと、費用をお知らせします。",
  },
  de: {
    bottomCta: "Diesen Lieferanten verifizieren",
    bottomLead:
      "Senden Sie uns Firmenname und Adresse. Wir sagen Ihnen, was wir bestätigen können, was nicht und was es kostet.",
  },
  fr: {
    bottomCta: "Vérifier ce fournisseur",
    bottomLead:
      "Envoyez-nous le nom et l'adresse de l'entreprise. Nous vous dirons ce que nous pouvons confirmer, ce que nous ne pouvons pas confirmer et le coût.",
  },
  es: {
    bottomCta: "Verificar este proveedor",
    bottomLead:
      "Envíenos el nombre y la dirección de la empresa. Le diremos qué podemos confirmar, qué no podemos y cuánto cuesta.",
  },
  pt: {
    bottomCta: "Verificar este fornecedor",
    bottomLead:
      "Envie-nos o nome e o endereço da empresa. Diremos o que podemos confirmar, o que não podemos e quanto custa.",
  },
  ar: {
    bottomCta: "تحقق من هذا المورد",
    bottomLead:
      "أرسل لنا اسم الشركة وعنوانها. سنخبرك بما يمكننا تأكيده، وما لا يمكننا تأكيده، والتكلفة.",
  },
};

let total = 0;
for (const [loc, kv] of Object.entries(L10N)) {
  const file = path.join(DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.home) dict.home = {};
  let n = 0;
  for (const [k, v] of Object.entries(kv)) {
    if (dict.home[k] === undefined || dict.home[k] === en.home[k]) {
      dict.home[k] = v;
      n++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${loc}: 写入 ${n} 键`);
  total += n;
}
console.log(`共写入 ${total} 键。`);
