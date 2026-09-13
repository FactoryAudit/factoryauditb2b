// scripts/apply-trust-about-i18n.mjs
// CS-02E: 把 /trust 页 reposition 为 About 后，更新三处短字段的「值」（不增删键，leaf count 不变）：
//   1. trust.metaTitle   2. trust.metaDesc   3. footer.trustCenter
// 约定：2 空格缩进 + CRLF + 末尾换行。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICT_DIR = join(__dirname, "..", "i18n", "dictionaries");

// 每种语言对应的新值
const VALUES = {
  en: {
    metaTitle: "About FactoryAuditB2B",
    metaDesc:
      "FactoryAuditB2B is operated by Jiangmen Zhiyu Technology Co., Ltd. We help global buyers find, screen, verify and audit suppliers in China and Southeast Asia.",
    trustCenter: "About",
  },
  zh: {
    metaTitle: "关于 FactoryAuditB2B",
    metaDesc:
      "FactoryAuditB2B 由江门智煜科技有限公司运营，帮助全球采购商在中国和东南亚寻找、筛选、核验与审核供应商。",
    trustCenter: "关于我们",
  },
  "zh-TW": {
    metaTitle: "關於 FactoryAuditB2B",
    metaDesc:
      "FactoryAuditB2B 由江門智煜科技有限公司營運，協助全球採購商在中國與東南亞尋找、篩選、驗證與審核供應商。",
    trustCenter: "關於我們",
  },
  ja: {
    metaTitle: "FactoryAuditB2B について",
    metaDesc:
      "FactoryAuditB2B は江門智煜科技（Jiangmen Zhiyu Technology Co., Ltd.）が運営し、中国と東南アジアのサプライヤーの発見・評価・検証・監査を支援します。",
    trustCenter: "会社概要",
  },
  es: {
    metaTitle: "Acerca de FactoryAuditB2B",
    metaDesc:
      "FactoryAuditB2B es operado por Jiangmen Zhiyu Technology Co., Ltd. Ayudamos a compradores globales a encontrar, filtrar, verificar y auditar proveedores en China y el sudeste asiático.",
    trustCenter: "Acerca de",
  },
  de: {
    metaTitle: "Über FactoryAuditB2B",
    metaDesc:
      "FactoryAuditB2B wird von Jiangmen Zhiyu Technology Co., Ltd. betrieben. Wir helfen globalen Käufern, Lieferanten in China und Südostasien zu finden, zu prüfen und zu auditieren.",
    trustCenter: "Über uns",
  },
  fr: {
    metaTitle: "À propos de FactoryAuditB2B",
    metaDesc:
      "FactoryAuditB2B est exploité par Jiangmen Zhiyu Technology Co., Ltd. Nous aidons les acheteurs du monde entier à trouver, filtrer, vérifier et auditer des fournisseurs en Chine et en Asie du Sud-Est.",
    trustCenter: "À propos",
  },
  pt: {
    metaTitle: "Sobre o FactoryAuditB2B",
    metaDesc:
      "O FactoryAuditB2B é operado pela Jiangmen Zhiyu Technology Co., Ltd. Ajudamos compradores globais a encontrar, triar, verificar e auditar fornecedores na China e no sudeste asiático.",
    trustCenter: "Sobre",
  },
  ar: {
    metaTitle: "حول FactoryAuditB2B",
    metaDesc:
      "يدير FactoryAuditB2B شركة Jiangmen Zhiyu Technology Co., Ltd. ونساعد المشترين حول العالم على العثور على الموردين وفرزهم والتحقق منهم ومراجعتهم في الصين وجنوب شرق آسيا.",
    trustCenter: "حول الموقع",
  },
};

const LANGS = Object.keys(VALUES);

for (const lang of LANGS) {
  const file = join(DICT_DIR, `${lang}.json`);
  const raw = readFileSync(file, "utf8");
  const json = JSON.parse(raw);
  const v = VALUES[lang];

  if (!json.trust) throw new Error(`${lang}.json 缺少 trust 命名空间`);
  if (!json.footer) throw new Error(`${lang}.json 缺少 footer 命名空间`);

  json.trust.metaTitle = v.metaTitle;
  json.trust.metaDesc = v.metaDesc;
  json.footer.trustCenter = v.trustCenter;

  // 2 空格缩进 + CRLF + 末尾换行
  const out = JSON.stringify(json, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  writeFileSync(file, out, "utf8");
  console.log(`updated ${lang}.json`);
}
console.log("done");
