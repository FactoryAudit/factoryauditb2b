// CS-02D · admin 命名空间新增 9 个键 × 9 语
//
// 铁律（改字典的统一做法）：
//   1. 一律用 Write 落脚本，不手改 JSON（避免缩进/换行/编码漂移）
//   2. 输出 2 空格缩进 + CRLF + 末尾换行
//   3. getDictionary() 无深 fallback ⇒ 九语键集必须与 en 完全一致
//   4. 只新增，绝不改动既有键的值
//
// 用法：node scripts/apply-cs02d-i18n.cjs

const fs = require("fs");
const path = require("path");

const ROOT = process.env.CS_ROOT ?? process.cwd();
const DIR = path.join(ROOT, "i18n", "dictionaries");

// 新增键：en 为单一事实源，其余八语逐条对照
const ADD = {
  en: {
    navLeads: "Leads",
    leadsTitle: "Leads",
    leadsLead:
      "Buyer enquiries, supplier applications and profile claims. Every submission is stored here with a reference number, not only emailed.",
    leadsEmpty:
      "No leads yet. Once a buyer submits a form or a supplier applies, it appears here with a reference number.",
    statNewLeads: "New leads (7 days)",
    statTotalLeads: "Total leads",
    recentLeads: "Recent leads",
    colKind: "Type",
    colTool: "Source",
  },
  zh: {
    navLeads: "线索",
    leadsTitle: "线索",
    leadsLead: "买家咨询、供应商入驻申请与档案认领。所有提交都会带编号留档，不只发邮件。",
    leadsEmpty: "暂无线索。买家提交表单或供应商提交申请后，会带编号出现在这里。",
    statNewLeads: "近 7 天新线索",
    statTotalLeads: "线索总数",
    recentLeads: "最近线索",
    colKind: "类型",
    colTool: "来源",
  },
  "zh-TW": {
    navLeads: "線索",
    leadsTitle: "線索",
    leadsLead: "買家諮詢、供應商入駐申請與檔案認領。所有提交都會帶編號留檔，不只發信。",
    leadsEmpty: "暫無線索。買家提交表單或供應商提交申請後，會帶編號出現在這裡。",
    statNewLeads: "近 7 天新線索",
    statTotalLeads: "線索總數",
    recentLeads: "最近線索",
    colKind: "類型",
    colTool: "來源",
  },
  ja: {
    navLeads: "リード",
    leadsTitle: "リード",
    leadsLead:
      "バイヤーの問い合わせ、サプライヤー登録申請、プロファイル申請。すべての送信内容はメールだけでなく、番号付きでここに記録されます。",
    leadsEmpty:
      "まだリードはありません。バイヤーがフォームを送信するか、サプライヤーが申請すると、参照番号付きでここに表示されます。",
    statNewLeads: "新規リード（7日間）",
    statTotalLeads: "リード総数",
    recentLeads: "最近のリード",
    colKind: "種別",
    colTool: "送信元",
  },
  es: {
    navLeads: "Leads",
    leadsTitle: "Leads",
    leadsLead:
      "Consultas de compradores, solicitudes de proveedores y reclamaciones de perfil. Todo envío se guarda aquí con número de referencia, no solo por correo.",
    leadsEmpty:
      "Aún no hay leads. Cuando un comprador envía un formulario o un proveedor solicita registrarse, aparecerá aquí con un número de referencia.",
    statNewLeads: "Leads nuevos (7 días)",
    statTotalLeads: "Total de leads",
    recentLeads: "Leads recientes",
    colKind: "Tipo",
    colTool: "Origen",
  },
  de: {
    navLeads: "Leads",
    leadsTitle: "Leads",
    leadsLead:
      "Käuferanfragen, Lieferantenbewerbungen und Profil-Ansprüche. Jede Einsendung wird hier mit Referenznummer gespeichert, nicht nur per E-Mail versandt.",
    leadsEmpty:
      "Noch keine Leads. Sobald ein Käufer ein Formular sendet oder ein Lieferant sich bewirbt, erscheint der Eintrag hier mit Referenznummer.",
    statNewLeads: "Neue Leads (7 Tage)",
    statTotalLeads: "Leads insgesamt",
    recentLeads: "Neueste Leads",
    colKind: "Art",
    colTool: "Quelle",
  },
  fr: {
    navLeads: "Leads",
    leadsTitle: "Leads",
    leadsLead:
      "Demandes d'acheteurs, candidatures de fournisseurs et revendications de fiche. Chaque envoi est consigné ici avec un numéro de référence, pas seulement envoyé par e-mail.",
    leadsEmpty:
      "Aucun lead pour l'instant. Dès qu'un acheteur envoie un formulaire ou qu'un fournisseur dépose une candidature, il apparaît ici avec un numéro de référence.",
    statNewLeads: "Nouveaux leads (7 jours)",
    statTotalLeads: "Total des leads",
    recentLeads: "Leads récents",
    colKind: "Type",
    colTool: "Source",
  },
  pt: {
    navLeads: "Leads",
    leadsTitle: "Leads",
    leadsLead:
      "Consultas de compradores, candidaturas de fornecedores e reivindicações de perfil. Cada envio fica registado aqui com número de referência, não apenas por e-mail.",
    leadsEmpty:
      "Ainda sem leads. Quando um comprador enviar um formulário ou um fornecedor se candidatar, aparecerá aqui com um número de referência.",
    statNewLeads: "Leads novos (7 dias)",
    statTotalLeads: "Total de leads",
    recentLeads: "Leads recentes",
    colKind: "Tipo",
    colTool: "Origem",
  },
  ar: {
    navLeads: "العملاء المحتملون",
    leadsTitle: "العملاء المحتملون",
    leadsLead:
      "استفسارات المشترين وطلبات تسجيل الموردين وطلبات ملكية السجلات. كل إرسال يُحفظ هنا برقم مرجعي، ولا يُرسل بالبريد فقط.",
    leadsEmpty:
      "لا يوجد عملاء محتملون بعد. عند إرسال مشترٍ لنموذج أو تقديم مورد لطلب، يظهر هنا برقم مرجعي.",
    statNewLeads: "عملاء جدد (٧ أيام)",
    statTotalLeads: "إجمالي العملاء المحتملين",
    recentLeads: "أحدث العملاء المحتملين",
    colKind: "النوع",
    colTool: "المصدر",
  },
};

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

function countLeaves(o) {
  let n = 0;
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") n += countLeaves(v);
    else n++;
  }
  return n;
}

let fail = 0;
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const json = JSON.parse(raw);
  const admin = json.admin;
  if (!admin) {
    console.log(`FAIL ${loc}: 缺少 admin 命名空间`);
    fail++;
    continue;
  }

  const before = countLeaves(json);
  let added = 0;
  for (const [k, v] of Object.entries(ADD[loc])) {
    if (Object.prototype.hasOwnProperty.call(admin, k)) {
      console.log(`SKIP ${loc}.${k} 已存在`);
      continue;
    }
    admin[k] = v;
    added++;
  }

  // 2 空格缩进 + CRLF + 末尾换行
  const out = JSON.stringify(json, null, 2).replace(/\r?\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  const after = countLeaves(json);
  console.log(`${loc}: +${added} 键，叶子 ${before} → ${after}`);
  if (added !== Object.keys(ADD[loc]).length) fail++;
}

// 键集一致性：九语 admin 键必须与 en 完全一致
const enKeys = Object.keys(JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8")).admin);
for (const loc of LOCALES) {
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(DIR, `${loc}.json`), "utf8")).admin);
  const missing = enKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !enKeys.includes(k));
  if (missing.length || extra.length) {
    console.log(`FAIL ${loc} 键集不一致 missing=${missing} extra=${extra}`);
    fail++;
  }
}

console.log(fail === 0 ? "CS-02D i18n OK" : `CS-02D i18n FAIL(${fail})`);
process.exit(fail === 0 ? 0 : 1);
