/**
 * CS-01：auditGuide 命名空间本地化修复（幂等，可重复跑）
 *
 * 背景（线上实测证据）：
 *   1. zh / zh-TW 的 metaTitle 模板是 "{country}{type} 验厂"，且 {country} 此前填英文国名
 *      ⇒ 渲染成「ChinaBSCI 验厂」。规范 §二十四 明确要求变成「中国 BSCI 验厂」。
 *   2. **8 个非英语种的 metaDesc 全部是英文原文**（与 en 逐字相同，从未翻译）
 *      ⇒ 180 条 audit-guide URL（20 路径 × 9 语）里 160 条的 description 是英文。
 *
 * 本脚本只改 3 个键（metaTitle / h1 / metaDesc），**不增不减键** ⇒ en 叶子总数不变。
 *
 * 用法：node scripts/apply-cs01-auditguide-i18n.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

const PATCH = {
  en: {
    metaTitle: "{type} Audit in {country}",
    h1: "{type} Audit in {country}",
    metaDesc:
      "Find {type} audit, inspection and qualified suppliers in {country}. Verified factory directory, RFQ and audit request by FactoryAuditB2B.",
  },
  zh: {
    metaTitle: "{country} {type} 验厂",
    h1: "{country} {type} 验厂",
    metaDesc:
      "在{country}寻找{type}验厂、检验与合格供应商。FactoryAuditB2B 提供经核查的工厂目录、RFQ 与验厂申请。",
  },
  "zh-TW": {
    metaTitle: "{country} {type} 驗廠",
    h1: "{country} {type} 驗廠",
    metaDesc:
      "在{country}尋找{type}驗廠、檢驗與合格供應商。FactoryAuditB2B 提供經核查的工廠目錄、RFQ 與驗廠申請。",
  },
  ja: {
    metaTitle: "{country}の{type}監査",
    h1: "{country}の{type}監査",
    metaDesc:
      "{country}の{type}監査・検査・認定サプライヤーを探す。FactoryAuditB2B の検証済み工場ディレクトリ、RFQ、監査依頼。",
  },
  es: {
    metaTitle: "Auditoría {type} en {country}",
    h1: "Auditoría {type} en {country}",
    metaDesc:
      "Encuentre auditoría {type}, inspección y proveedores cualificados en {country}. Directorio de fábricas verificado, RFQ y solicitud de auditoría de FactoryAuditB2B.",
  },
  de: {
    metaTitle: "{type}-Audit in {country}",
    h1: "{type}-Audit in {country}",
    metaDesc:
      "Finden Sie {type}-Audit, Inspektion und qualifizierte Lieferanten in {country}. Verifiziertes Fabrikverzeichnis, RFQ und Audit-Anfrage von FactoryAuditB2B.",
  },
  fr: {
    metaTitle: "Audit {type} en {country}",
    h1: "Audit {type} en {country}",
    metaDesc:
      "Trouvez un audit {type}, une inspection et des fournisseurs qualifiés en {country}. Annuaire d'usines vérifié, demande de devis et d'audit par FactoryAuditB2B.",
  },
  pt: {
    metaTitle: "Auditoria {type} em {country}",
    h1: "Auditoria {type} em {country}",
    metaDesc:
      "Encontre auditoria {type}, inspeção e fornecedores qualificados em {country}. Diretório de fábricas verificado, RFQ e solicitação de auditoria da FactoryAuditB2B.",
  },
  ar: {
    metaTitle: "تدقيق {type} في {country}",
    h1: "تدقيق {type} في {country}",
    metaDesc:
      "اعثر على تدقيق {type} والفحص والموردين المؤهلين في {country}. دليل مصانع مُتحقَّق منه، وطلب RFQ وتدقيق من FactoryAuditB2B.",
  },
};

// 统一的叶子计数（与项目其它脚本保持一致：对象递归、数组整体算 1）
function countLeaves(o) {
  return Object.values(o).reduce(
    (n, v) => n + (v && typeof v === "object" && !Array.isArray(v) ? countLeaves(v) : 1),
    0
  );
}

let changed = 0;
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const dict = JSON.parse(raw);
  const before = countLeaves(dict);
  const g = (dict.auditGuide = dict.auditGuide || {});
  const p = PATCH[loc];
  const prev = { ...g };
  g.metaTitle = p.metaTitle;
  g.h1 = p.h1;
  g.metaDesc = p.metaDesc;
  const after = countLeaves(dict);
  if (before !== after) {
    throw new Error(`${loc}：叶子数从 ${before} 变成 ${after} —— 本脚本只允许改值不允许改键`);
  }
  const out = JSON.stringify(dict, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  if (out !== raw) {
    fs.writeFileSync(file, out);
    changed++;
  }
  const descChanged = prev.metaDesc !== g.metaDesc;
  console.log(
    `[${loc}] 叶子 ${after}` +
      (descChanged ? "  metaDesc 已本地化" : "  metaDesc 无变化") +
      `  title="${g.metaTitle}"`
  );
}

// 键集必须与 en 完全一致（getDictionary 无深 fallback，缺键即崩溃）
const enKeys = Object.keys(JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8")))
  .sort()
  .join(",");
for (const loc of LOCALES) {
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(DIR, `${loc}.json`), "utf8")))
    .sort()
    .join(",");
  if (keys !== enKeys) throw new Error(`${loc} 顶层键集与 en 不一致`);
}
console.log(`\n完成：${changed} 个字典文件被更新；9 语顶层键集一致 ✓`);
