// scripts/apply-about-inperson-i18n.cjs
//
// 给 about 命名空间注入「线下见面」三键（9 语）。
//
// 背景：用户 2026-11-13 提供本人出席线下采购活动签到现场的照片，要求用于
// 提升站点可信度。照片能诚实支撑的事实只有两条：品牌在线下有实体展位/签到台、
// 团队是真人。因此文案只讲「核验由人执行、我们在线下与人见面」，不涉及
// 活动规模、场次、成交或客户数量（这些照片证明不了，编造即违规）。
//
// 幂等：已存在则覆盖值，不存在则新增。
// 格式：JSON.stringify(indent=2) 往返 + CRLF 还原（项目字典用 CRLF）。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"];

const COPY = {
  en: {
    inPersonTitle: "Verification is done by people, not software",
    inPersonBody:
      "The same team that answers your inquiry reviews the factory documents and joins the video walkthrough. We also meet suppliers and buyers face to face at offline sourcing events in China — a company you can meet is harder to fake than a company you can only read about.",
    inPersonCaption:
      "Our team on site at an offline sourcing event in China. Verification is run by our own team, not outsourced.",
  },
  zh: {
    inPersonTitle: "核验是人做的，不是软件做的",
    inPersonBody:
      "回复你询盘的、审工厂资料的、参加视频看厂的，是同一支团队。我们也在中国的线下采购活动现场与供应商、买家面对面——能见到面的公司，比只能读到的公司更难伪造。",
    inPersonCaption:
      "团队在中国一场线下采购活动现场。核验由我们自己执行，不外包。",
  },
  "zh-TW": {
    inPersonTitle: "核驗是人做的，不是軟體做的",
    inPersonBody:
      "回覆你詢盤的、審工廠資料的、參加視訊看廠的，是同一支團隊。我們也在中國的線下採購活動現場與供應商、買家面對面——能見到面的公司，比只能讀到的公司更難偽造。",
    inPersonCaption:
      "團隊在中國一場線下採購活動現場。核驗由我們自己執行，不外包。",
  },
  es: {
    inPersonTitle: "La verificación la hacen personas, no un software",
    inPersonBody:
      "El mismo equipo que responde a tu consulta revisa la documentación de la fábrica y participa en la videollamada de inspección. También conocemos proveedores y compradores en persona en ferias de abastecimiento presenciales en China: es más difícil falsificar una empresa a la que puedes conocer que una de la que solo puedes leer.",
    inPersonCaption:
      "Nuestro equipo en una feria de abastecimiento presencial en China. La verificación la realiza nuestro propio equipo, sin subcontratación.",
  },
  de: {
    inPersonTitle: "Verifizierung machen Menschen, keine Software",
    inPersonBody:
      "Dasselbe Team, das Ihre Anfrage beantwortet, prüft die Fabrikunterlagen und nimmt an der Video-Besichtigung teil. Wir treffen Lieferanten und Einkäufer auch persönlich auf Beschaffungsmessen in China – ein Unternehmen, das man treffen kann, ist schwerer zu fälschen als eines, über das man nur liest.",
    inPersonCaption:
      "Unser Team auf einer Beschaffungsmesse in China. Die Verifizierung erfolgt durch unser eigenes Team, nicht durch Subunternehmer.",
  },
  fr: {
    inPersonTitle: "La vérification est faite par des personnes, pas par un logiciel",
    inPersonBody:
      "La même équipe qui répond à votre demande examine les documents de l'usine et participe à la visite vidéo. Nous rencontrons aussi fournisseurs et acheteurs en personne lors de salons d'approvisionnement en Chine — une entreprise que l'on peut rencontrer est plus difficile à falsifier qu'une entreprise dont on ne fait que lire la présentation.",
    inPersonCaption:
      "Notre équipe sur un salon d'approvisionnement en Chine. La vérification est réalisée par notre propre équipe, sans sous-traitance.",
  },
  pt: {
    inPersonTitle: "A verificação é feita por pessoas, não por software",
    inPersonBody:
      "A mesma equipe que responde ao seu contato analisa os documentos da fábrica e participa da visita por vídeo. Também encontramos fornecedores e compradores pessoalmente em feiras de compras presenciais na China — é mais difícil falsificar uma empresa que você pode conhecer do que uma que você só lê.",
    inPersonCaption:
      "Nossa equipe em uma feira de compras presencial na China. A verificação é feita pela nossa própria equipe, sem terceirização.",
  },
  ja: {
    inPersonTitle: "検証はソフトウェアではなく、人が行います",
    inPersonBody:
      "お問い合わせに返信するチームが、そのまま工場書類の確認とビデオ立会いを担当します。中国の調達イベントでは、サプライヤーやバイヤーと直接お会いしています。会える会社は、読むだけの会社より偽装が難しいからです。",
    inPersonCaption:
      "中国の調達イベント会場での当社チーム。検証は外部委託せず、自社チームが実施します。",
  },
  ar: {
    inPersonTitle: "التحقق يقوم به أشخاص، لا برنامج",
    inPersonBody:
      "الفريق نفسه الذي يرد على استفسارك هو من يراجع مستندات المصنع ويشارك في المعاينة بالفيديو. كما نلتقي بالموردين والمشترين وجهًا لوجه في فعاليات التوريد في الصين — فمن الصعب تزييف شركة يمكنك لقاؤها أكثر من شركة تقرأ عنها فقط.",
    inPersonCaption:
      "فريقنا في فعالية توريد حضورية في الصين. يتم التحقق بواسطة فريقنا الداخلي، دون الاستعانة بجهات خارجية.",
  },
};

/** 把 keys 插入到 afterKey 之后，保持键的阅读顺序。 */
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

let enLeaves = 0;
for (const loc of LOCALES) {
  const file = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const dict = JSON.parse(raw);

  if (!dict.about || typeof dict.about !== "object") {
    throw new Error(`${loc}: about 命名空间缺失，拒绝写入`);
  }

  dict.about = insertAfter(dict.about, "storyBody", COPY[loc]);

  let out = JSON.stringify(dict, null, 2);
  if (crlf) out = out.replace(/\n/g, "\r\n");
  out += crlf ? "\r\n" : "\n";
  fs.writeFileSync(file, out, "utf8");

  const count = (o) =>
    o && typeof o === "object"
      ? Object.values(o).reduce((n, v) => n + count(v), 0)
      : 1;
  const leaves = count(dict);
  if (loc === "en") enLeaves = leaves;
  console.log(`${loc}: about 三键已写入 | 叶子数 ${leaves}`);
}
console.log(`\n完成。en 叶子数 = ${enLeaves}（门禁常量需同步为该值）`);
