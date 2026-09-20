// scripts/apply-step07-i18n.cjs —— STEP-07 i18n 注入（幂等，CRLF 写出，9 语键集自检）
//
// 在 home.* 命名空间下新增 12 个叶子键（全字符串）：
//   liveTitle / liveLead / liveEmptyTitle / liveEmptyLead / liveEmptyCta /
//   liveViewAll / liveRespondCta / livePosted / liveQuantity / liveMarket /
//   liveIndustry / liveCerts
// 沿用 STEP-06 的 camelCase 叶子键风格，不新建 homepage.*。

const fs = require("fs");
const path = require("path");

const DICT_DIR = path.join(process.cwd(), "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

const TRANS = {
  en: {
    liveTitle: "Live Buyer Requests",
    liveLead: "See what buyers are currently looking for.",
    liveEmptyTitle: "No active buyer requests yet.",
    liveEmptyLead: "New sourcing requests will appear here as buyers publish their requirements.",
    liveEmptyCta: "Submit a Sourcing Request",
    liveViewAll: "View all buyer requests",
    liveRespondCta: "Respond to Request",
    livePosted: "Posted",
    liveQuantity: "Quantity",
    liveMarket: "Target Market",
    liveIndustry: "Industry",
    liveCerts: "Certifications",
  },
  zh: {
    liveTitle: "实时采购需求",
    liveLead: "看看买家正在寻找什么。",
    liveEmptyTitle: "暂无进行中的采购需求。",
    liveEmptyLead: "当买家发布采购需求时，将显示在此处。",
    liveEmptyCta: "提交采购需求",
    liveViewAll: "查看全部采购需求",
    liveRespondCta: "响应此需求",
    livePosted: "发布于",
    liveQuantity: "数量",
    liveMarket: "目标市场",
    liveIndustry: "行业",
    liveCerts: "认证要求",
  },
  "zh-TW": {
    liveTitle: "即時採購需求",
    liveLead: "看看買家正在尋找什麼。",
    liveEmptyTitle: "暫無進行中的採購需求。",
    liveEmptyLead: "當買家發布採購需求時，將顯示於此處。",
    liveEmptyCta: "提交採購需求",
    liveViewAll: "查看全部採購需求",
    liveRespondCta: "回應此需求",
    livePosted: "發佈於",
    liveQuantity: "數量",
    liveMarket: "目標市場",
    liveIndustry: "行業",
    liveCerts: "認證要求",
  },
  ja: {
    liveTitle: "ライブの買い手依頼",
    liveLead: "買い手が現在探しているものをご覧ください。",
    liveEmptyTitle: "現在、有効な買い手依頼はありません。",
    liveEmptyLead: "買い手が要件を公開すると、ここに表示されます。",
    liveEmptyCta: "調達依頼を送信",
    liveViewAll: "すべての買い手依頼を見る",
    liveRespondCta: "この依頼に応募",
    livePosted: "投稿日",
    liveQuantity: "数量",
    liveMarket: "対象市場",
    liveIndustry: "業界",
    liveCerts: "認証要件",
  },
  es: {
    liveTitle: "Solicitudes de compradores en vivo",
    liveLead: "Vea qué están buscando los compradores ahora mismo.",
    liveEmptyTitle: "Aún no hay solicitudes de compradores activas.",
    liveEmptyLead: "Las nuevas solicitudes de abastecimiento aparecerán aquí cuando los compradores publiquen sus requisitos.",
    liveEmptyCta: "Enviar una solicitud de abastecimiento",
    liveViewAll: "Ver todas las solicitudes de compradores",
    liveRespondCta: "Responder a la solicitud",
    livePosted: "Publicado",
    liveQuantity: "Cantidad",
    liveMarket: "Mercado objetivo",
    liveIndustry: "Industria",
    liveCerts: "Certificaciones",
  },
  de: {
    liveTitle: "Live-Käuferanfragen",
    liveLead: "Sehen Sie, wonach Käufer aktuell suchen.",
    liveEmptyTitle: "Noch keine aktiven Käuferanfragen.",
    liveEmptyLead: "Neue Beschaffungsanfragen erscheinen hier, sobald Käufer ihre Anforderungen veröffentlichen.",
    liveEmptyCta: "Beschaffungsanfrage senden",
    liveViewAll: "Alle Käuferanfragen ansehen",
    liveRespondCta: "Auf Anfrage antworten",
    livePosted: "Veröffentlicht",
    liveQuantity: "Menge",
    liveMarket: "Zielmarkt",
    liveIndustry: "Branche",
    liveCerts: "Zertifizierungen",
  },
  fr: {
    liveTitle: "Demandes d'acheteurs en direct",
    liveLead: "Voyez ce que les acheteurs recherchent actuellement.",
    liveEmptyTitle: "Aucune demande d'acheteur active pour le moment.",
    liveEmptyLead: "Les nouvelles demandes d'approvisionnement apparaîtront ici lorsque les acheteurs publieront leurs besoins.",
    liveEmptyCta: "Envoyer une demande d'approvisionnement",
    liveViewAll: "Voir toutes les demandes d'acheteurs",
    liveRespondCta: "Répondre à la demande",
    livePosted: "Publié",
    liveQuantity: "Quantité",
    liveMarket: "Marché cible",
    liveIndustry: "Secteur",
    liveCerts: "Certifications",
  },
  pt: {
    liveTitle: "Solicitações de compradores ao vivo",
    liveLead: "Veja o que os compradores estão procurando agora.",
    liveEmptyTitle: "Ainda não há solicitações de compradores ativas.",
    liveEmptyLead: "Novas solicitações de suprimento aparecerão aqui quando os compradores publicarem seus requisitos.",
    liveEmptyCta: "Enviar uma solicitação de suprimento",
    liveViewAll: "Ver todas as solicitações de compradores",
    liveRespondCta: "Responder à solicitação",
    livePosted: "Publicado",
    liveQuantity: "Quantidade",
    liveMarket: "Mercado-alvo",
    liveIndustry: "Setor",
    liveCerts: "Certificações",
  },
  ar: {
    liveTitle: "طلبات المشترين المباشرة",
    liveLead: "شاهد ما يبحث عنه المشترون حالياً.",
    liveEmptyTitle: "لا توجد طلبات مشترين نشطة بعد.",
    liveEmptyLead: "ستظهر طلبات التوريد الجديدة هنا عندما ينشر المشترون متطلباتهم.",
    liveEmptyCta: "إرسال طلب توريد",
    liveViewAll: "عرض جميع طلبات المشترين",
    liveRespondCta: "الرد على الطلب",
    livePosted: "نُشر في",
    liveQuantity: "الكمية",
    liveMarket: "السوق المستهدف",
    liveIndustry: "القطاع",
    liveCerts: "الشهادات",
  },
};

// ---- 叶子计数（与项目既有 leaves() 同源：对象递归 / 数组展开 / 原始值计 1）----
function leaves(o) {
  let n = 0;
  const walk = (x) => {
    if (x && typeof x === "object") {
      if (Array.isArray(x)) x.forEach(walk);
      else Object.values(x).forEach(walk);
    } else n++;
  };
  walk(o);
  return n;
}

function writeCrlf(file, obj) {
  const text = JSON.stringify(obj, null, 2).replace(/\r\n/g, "\n").replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, text, "utf8");
}

let addedTotal = 0;
for (const loc of LOCALES) {
  const file = path.join(DICT_DIR, `${loc}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.home) dict.home = {};
  const trans = TRANS[loc];
  let added = 0;
  for (const [k, v] of Object.entries(trans)) {
    if (dict.home[k] === undefined) {
      dict.home[k] = v;
      added++;
    }
  }
  writeCrlf(file, dict);
  addedTotal += added;
  console.log(`${loc}: +${added} keys, leaves=${leaves(dict)}`);
}

// ---- 9 语键集一致性自检 ----
const en = JSON.parse(fs.readFileSync(path.join(DICT_DIR, "en.json"), "utf8"));
const enHomeKeys = Object.keys(en.home).sort().join(",");
let consistent = true;
for (const loc of LOCALES) {
  const d = JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${loc}.json`), "utf8"));
  if (Object.keys(d.home).sort().join(",") !== enHomeKeys) {
    console.error(`KEYSET MISMATCH: ${loc}`);
    consistent = false;
  }
}
console.log(consistent ? "9-LANG KEYSET CONSISTENT ✓" : "KEYSET MISMATCH ✗");
console.log(`TOTAL ADDED: ${addedTotal}`);
