// CS-12 幂等字典注入：档案页「工商登记信息 + 工厂自述证书 + 产能」文案
// 用法: node scripts/apply-cs12-i18n.cjs
//
// 注入位置：
//   · supplierProfile.*  —— 19 个新键（登记信息 7 + 自述证书 8 + 产能 4）
//   · evidenceCenter.issuedOn —— CertificationList 补渲染颁发日期所需标签
//
// 格式铁律：2 空格缩进 + CRLF + 末尾换行（与仓库现有字典一致）。
// 幂等：逐键判存，已存在则跳过，绝不覆盖既有译文。
//
// 🔴 写完后必须同步下面两处 en 叶子数精确常量（本脚本会打印实测值）：
//      scripts/cs06a-directory-regression.ts  → C8
//      scripts/cs08-form-regression.ts        → G4
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const DIR = path.join(ROOT, "i18n", "dictionaries");

// 全站铁律：禁破折号修辞、禁营销词、禁无据声称。
// 「自述证书」相关文案一律显式写出「未经平台核验」，不得只写 Certificates。
const K = {
  en: {
    registrationTitle: "Company registration details",
    registrationLead:
      "Registration facts as reported by the company. Contact details are not published.",
    regEnglishName: "English name",
    regCompanyType: "Company type",
    regRegistrationNo: "Registration number",
    regWebsite: "Website",
    regAddress: "Registered address",
    selfCertTitle: "Certificates reported by the factory",
    selfCertLead: "Self-reported, not verified",
    selfCertNone: "This factory has not reported any certificates.",
    selfCertName: "Certificate",
    selfCertNumber: "No.",
    selfCertIssued: "Issued",
    selfCertExpires: "Expires",
    selfCertDisclaimer:
      "These entries were provided by the factory and have not been reviewed or verified by FactoryAuditB2B. They are not a platform verification result.",
    capacityProduction: "Production capacity",
    capacityMonthly: "Monthly output",
    capacityFactorySize: "Factory size",
    capacityExportSince: "Exporting since",
  },
  zh: {
    registrationTitle: "公司登记信息",
    registrationLead: "以下为企业自行申报的登记事实。联系方式不予公开。",
    regEnglishName: "英文名称",
    regCompanyType: "公司类型",
    regRegistrationNo: "注册号",
    regWebsite: "官网",
    regAddress: "注册地址",
    selfCertTitle: "工厂自述证书",
    selfCertLead: "工厂自述 · 未经核验",
    selfCertNone: "该工厂未提供任何证书信息。",
    selfCertName: "证书名称",
    selfCertNumber: "编号",
    selfCertIssued: "颁发日期",
    selfCertExpires: "到期日期",
    selfCertDisclaimer:
      "以上内容由工厂自行填报，FactoryAuditB2B 未做任何审核或核验，不构成平台核验结果。",
    capacityProduction: "生产能力",
    capacityMonthly: "月产量",
    capacityFactorySize: "工厂规模",
    capacityExportSince: "出口起始年份",
  },
  "zh-TW": {
    registrationTitle: "公司登記資訊",
    registrationLead: "以下為企業自行申報的登記事實。聯絡方式不予公開。",
    regEnglishName: "英文名稱",
    regCompanyType: "公司類型",
    regRegistrationNo: "註冊號",
    regWebsite: "官網",
    regAddress: "註冊地址",
    selfCertTitle: "工廠自述證書",
    selfCertLead: "工廠自述 · 未經核驗",
    selfCertNone: "該工廠未提供任何證書資訊。",
    selfCertName: "證書名稱",
    selfCertNumber: "編號",
    selfCertIssued: "頒發日期",
    selfCertExpires: "到期日期",
    selfCertDisclaimer:
      "以上內容由工廠自行填報，FactoryAuditB2B 未做任何審核或核驗，不構成平台核驗結果。",
    capacityProduction: "生產能力",
    capacityMonthly: "月產量",
    capacityFactorySize: "工廠規模",
    capacityExportSince: "出口起始年份",
  },
  ja: {
    registrationTitle: "会社登記情報",
    registrationLead: "以下は企業が自ら申告した登記情報です。連絡先は公開していません。",
    regEnglishName: "英文社名",
    regCompanyType: "会社形態",
    regRegistrationNo: "登記番号",
    regWebsite: "ウェブサイト",
    regAddress: "登記上の所在地",
    selfCertTitle: "工場が申告した証明書",
    selfCertLead: "自己申告・未検証",
    selfCertNone: "この工場は証明書を申告していません。",
    selfCertName: "証明書名",
    selfCertNumber: "番号",
    selfCertIssued: "発行日",
    selfCertExpires: "有効期限",
    selfCertDisclaimer:
      "これらの内容は工場が自ら申告したもので、FactoryAuditB2B による審査・検証は行っていません。プラットフォームの検証結果ではありません。",
    capacityProduction: "生産能力",
    capacityMonthly: "月間生産量",
    capacityFactorySize: "工場規模",
    capacityExportSince: "輸出開始年",
  },
  es: {
    registrationTitle: "Datos registrales de la empresa",
    registrationLead:
      "Datos registrales declarados por la propia empresa. Los datos de contacto no se publican.",
    regEnglishName: "Nombre en inglés",
    regCompanyType: "Tipo de sociedad",
    regRegistrationNo: "Número de registro",
    regWebsite: "Sitio web",
    regAddress: "Domicilio social",
    selfCertTitle: "Certificados declarados por la fábrica",
    selfCertLead: "Declarado por la fábrica, sin verificar",
    selfCertNone: "Esta fábrica no ha declarado ningún certificado.",
    selfCertName: "Certificado",
    selfCertNumber: "N.º",
    selfCertIssued: "Emitido",
    selfCertExpires: "Vence",
    selfCertDisclaimer:
      "Estos datos los aportó la fábrica y FactoryAuditB2B no los ha revisado ni verificado. No son un resultado de verificación de la plataforma.",
    capacityProduction: "Capacidad de producción",
    capacityMonthly: "Producción mensual",
    capacityFactorySize: "Tamaño de la fábrica",
    capacityExportSince: "Exporta desde",
  },
  de: {
    registrationTitle: "Handelsregisterdaten des Unternehmens",
    registrationLead:
      "Vom Unternehmen selbst angegebene Registerdaten. Kontaktdaten werden nicht veröffentlicht.",
    regEnglishName: "Englischer Name",
    regCompanyType: "Rechtsform",
    regRegistrationNo: "Registernummer",
    regWebsite: "Website",
    regAddress: "Eingetragener Sitz",
    selfCertTitle: "Von der Fabrik angegebene Zertifikate",
    selfCertLead: "Selbstauskunft, nicht überprüft",
    selfCertNone: "Diese Fabrik hat keine Zertifikate angegeben.",
    selfCertName: "Zertifikat",
    selfCertNumber: "Nr.",
    selfCertIssued: "Ausgestellt",
    selfCertExpires: "Gültig bis",
    selfCertDisclaimer:
      "Diese Angaben stammen von der Fabrik selbst. FactoryAuditB2B hat sie weder geprüft noch verifiziert; sie sind kein Verifizierungsergebnis der Plattform.",
    capacityProduction: "Produktionskapazität",
    capacityMonthly: "Monatliche Produktion",
    capacityFactorySize: "Fabrikgröße",
    capacityExportSince: "Exportiert seit",
  },
  fr: {
    registrationTitle: "Informations d'immatriculation de l'entreprise",
    registrationLead:
      "Données d'immatriculation déclarées par l'entreprise elle-même. Les coordonnées ne sont pas publiées.",
    regEnglishName: "Nom en anglais",
    regCompanyType: "Forme juridique",
    regRegistrationNo: "Numéro d'immatriculation",
    regWebsite: "Site web",
    regAddress: "Siège social",
    selfCertTitle: "Certificats déclarés par l'usine",
    selfCertLead: "Déclaré par l'usine, non vérifié",
    selfCertNone: "Cette usine n'a déclaré aucun certificat.",
    selfCertName: "Certificat",
    selfCertNumber: "N°",
    selfCertIssued: "Délivré le",
    selfCertExpires: "Expire le",
    selfCertDisclaimer:
      "Ces informations ont été fournies par l'usine et n'ont été ni examinées ni vérifiées par FactoryAuditB2B. Elles ne constituent pas un résultat de vérification de la plateforme.",
    capacityProduction: "Capacité de production",
    capacityMonthly: "Production mensuelle",
    capacityFactorySize: "Taille de l'usine",
    capacityExportSince: "Exporte depuis",
  },
  pt: {
    registrationTitle: "Dados de registro da empresa",
    registrationLead:
      "Dados de registro declarados pela própria empresa. Os contatos não são publicados.",
    regEnglishName: "Nome em inglês",
    regCompanyType: "Tipo de sociedade",
    regRegistrationNo: "Número de registro",
    regWebsite: "Site",
    regAddress: "Endereço registrado",
    selfCertTitle: "Certificados declarados pela fábrica",
    selfCertLead: "Declarado pela fábrica, não verificado",
    selfCertNone: "Esta fábrica não declarou nenhum certificado.",
    selfCertName: "Certificado",
    selfCertNumber: "N.º",
    selfCertIssued: "Emitido em",
    selfCertExpires: "Válido até",
    selfCertDisclaimer:
      "Estas informações foram fornecidas pela fábrica e não foram analisadas nem verificadas pela FactoryAuditB2B. Não são um resultado de verificação da plataforma.",
    capacityProduction: "Capacidade de produção",
    capacityMonthly: "Produção mensal",
    capacityFactorySize: "Tamanho da fábrica",
    capacityExportSince: "Exporta desde",
  },
  ar: {
    registrationTitle: "بيانات تسجيل الشركة",
    registrationLead: "بيانات التسجيل المعلنة من الشركة نفسها. لا تُنشر بيانات الاتصال.",
    regEnglishName: "الاسم بالإنجليزية",
    regCompanyType: "نوع الشركة",
    regRegistrationNo: "رقم التسجيل",
    regWebsite: "الموقع الإلكتروني",
    regAddress: "العنوان المسجل",
    selfCertTitle: "شهادات صرّح بها المصنع",
    selfCertLead: "إفادة المصنع · غير مُتحقَّق منها",
    selfCertNone: "لم يعلن هذا المصنع عن أي شهادات.",
    selfCertName: "الشهادة",
    selfCertNumber: "الرقم",
    selfCertIssued: "تاريخ الإصدار",
    selfCertExpires: "تاريخ الانتهاء",
    selfCertDisclaimer:
      "هذه البيانات مقدمة من المصنع ولم تخضع لأي مراجعة أو تحقق من FactoryAuditB2B، ولا تُعد نتيجة تحقق من المنصة.",
    capacityProduction: "الطاقة الإنتاجية",
    capacityMonthly: "الإنتاج الشهري",
    capacityFactorySize: "حجم المصنع",
    capacityExportSince: "يصدّر منذ",
  },
};

/** evidenceCenter.issuedOn —— CertificationList 与自述证书共用同一措辞口径 */
const ISSUED_ON = {
  en: "Issued",
  zh: "颁发日期",
  "zh-TW": "頒發日期",
  ja: "発行日",
  es: "Emitido",
  de: "Ausgestellt",
  fr: "Délivré le",
  pt: "Emitido em",
  ar: "تاريخ الإصدار",
};

const LOCALES = Object.keys(K);
let changed = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${locale}（文件不存在）`);
    continue;
  }
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;

  if (!obj.supplierProfile) {
    console.log(`WARN  ${locale} 缺 supplierProfile 命名空间，跳过该语言`);
    continue;
  }
  for (const [k, v] of Object.entries(K[locale])) {
    if (k in obj.supplierProfile) continue; // 幂等：不覆盖既有译文
    obj.supplierProfile[k] = v;
    added++;
  }

  if (obj.evidenceCenter && !("issuedOn" in obj.evidenceCenter)) {
    obj.evidenceCenter.issuedOn = ISSUED_ON[locale];
    added++;
  }

  if (added === 0) {
    console.log(`SKIP  ${locale}（已全部存在）`);
    continue;
  }

  const out = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(`OK    ${locale}.json 新增 ${added} 键（${obj.supplierProfile ? "supplierProfile" : "?"}）`);
}

// ---- 叶子数实测（en 为单一事实源）----
function leaves(o) {
  if (Array.isArray(o)) return o.reduce((n, x) => n + leaves(x), 0);
  if (o && typeof o === "object") {
    return Object.values(o).reduce((n, x) => n + leaves(x), 0);
  }
  return 1;
}
const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));
console.log(`\n完成：${changed}/${LOCALES.length} 个语言文件被修改`);
console.log(`en 叶子数 = ${leaves(en)}  ← 必须同步 cs06a-directory-regression.ts C8 与 cs08-form-regression.ts G4`);

// 九语键集一致性自检（getDictionary 无深 fallback，键集必须严格一致）
const enKeys = JSON.stringify(Object.keys(en.supplierProfile).sort());
let mismatch = 0;
for (const locale of LOCALES) {
  const o = JSON.parse(fs.readFileSync(path.join(DIR, `${locale}.json`), "utf8"));
  const keys = JSON.stringify(Object.keys(o.supplierProfile || {}).sort());
  if (keys !== enKeys) {
    mismatch++;
    console.log(`  🔴 ${locale} 的 supplierProfile 键集与 en 不一致`);
  }
}
console.log(mismatch === 0 ? "九语 supplierProfile 键集一致 ✓" : `键集不一致语言数 = ${mismatch}`);
