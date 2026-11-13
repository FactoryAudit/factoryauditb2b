// scripts/apply-wechat-i18n.cjs
//
// 给 contact 命名空间注入「微信 / 手机」三个键（9 语）。
//
// 背景：用户 2026-11-13 要求把微信二维码与手机号放到站上。号码与既有
// NEXT_PUBLIC_WHATSAPP_NUMBER 是同一个（8613642606807），因此文案必须说明
// 「同号」，避免访客以为这是两条不同的线。
//
// 幂等：已存在则覆盖值，不存在则新增。
// 严格保持原文件格式：JSON.stringify(indent=2) 往返 + CRLF 还原（项目字典用 CRLF）。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];

const COPY = {
  en: {
    wechatLabel: "WeChat / Phone",
    wechatNote:
      "Scan to add us on WeChat. The number above is also our phone and WhatsApp.",
    wechatAlt: "WeChat QR code — scan to add our team",
  },
  zh: {
    wechatLabel: "微信 / 手机",
    wechatNote: "扫码加微信。上方号码同时也是手机号与 WhatsApp。",
    wechatAlt: "微信二维码，扫码添加咨询",
  },
  "zh-TW": {
    wechatLabel: "微信 / 手機",
    wechatNote: "掃碼加微信。上方號碼同時也是手機號與 WhatsApp。",
    wechatAlt: "微信二維碼，掃碼加入諮詢",
  },
  es: {
    wechatLabel: "WeChat / Teléfono",
    wechatNote:
      "Escanea para añadirnos en WeChat. El número de arriba es también nuestro teléfono y WhatsApp.",
    wechatAlt: "Código QR de WeChat para añadir a nuestro equipo",
  },
  de: {
    wechatLabel: "WeChat / Telefon",
    wechatNote:
      "Scannen Sie den Code, um uns bei WeChat hinzuzufügen. Die Nummer oben ist auch unsere Telefon- und WhatsApp-Nummer.",
    wechatAlt: "WeChat-QR-Code zum Hinzufügen unseres Teams",
  },
  fr: {
    wechatLabel: "WeChat / Téléphone",
    wechatNote:
      "Scannez le code pour nous ajouter sur WeChat. Le numéro ci-dessus est aussi notre téléphone et WhatsApp.",
    wechatAlt: "Code QR WeChat pour ajouter notre équipe",
  },
  pt: {
    wechatLabel: "WeChat / Telefone",
    wechatNote:
      "Escaneie para nos adicionar no WeChat. O número acima também é o nosso telefone e WhatsApp.",
    wechatAlt: "Código QR do WeChat para adicionar a nossa equipe",
  },
  ja: {
    wechatLabel: "WeChat / 電話",
    wechatNote: "スキャンしてWeChatに追加できます。上の番号は電話・WhatsApp兼用です。",
    wechatAlt: "WeChatのQRコード（スキャンして追加）",
  },
  ar: {
    wechatLabel: "WeChat / الهاتف",
    wechatNote: "امسح الرمز لإضافتنا على WeChat. الرقم أعلاه هو أيضًا هاتفنا وواتساب.",
    wechatAlt: "رمز QR الخاص بـ WeChat لإضافة فريقنا",
  },
};

/** 把 keys 插入到 afterKey 之后，保持键的阅读顺序（纯 JSON 语义上顺序无意义，但人对 diff 有感知）。 */
function insertAfter(obj, afterKey, patch) {
  const out = {};
  let inserted = false;
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === afterKey) {
      Object.assign(out, patch);
      inserted = true;
    }
  }
  if (!inserted) Object.assign(out, patch);
  return out;
}

let totalLeaves = 0;
for (const loc of LOCALES) {
  const file = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const dict = JSON.parse(raw);

  if (!dict.contact || typeof dict.contact !== "object") {
    throw new Error(`${loc}: contact 命名空间缺失，拒绝写入`);
  }

  dict.contact = insertAfter(dict.contact, "emailLabel", COPY[loc]);

  let out = JSON.stringify(dict, null, 2);
  if (crlf) out = out.replace(/\n/g, "\r\n");
  out += crlf ? "\r\n" : "\n";
  fs.writeFileSync(file, out, "utf8");

  const count = (o) =>
    o && typeof o === "object"
      ? Object.values(o).reduce((n, v) => n + count(v), 0)
      : 1;
  const leaves = count(dict);
  totalLeaves = leaves;
  console.log(`${loc}: contact 键已写入 | 叶子数 ${leaves}`);
}
console.log(`\n完成。en 叶子数 = ${totalLeaves}（门禁常量需同步为该值）`);
