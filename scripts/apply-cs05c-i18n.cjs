/**
 * CS-05c —— 九语字典文案修订（幂等）
 *
 * 背景：CS-05a 起「Free Buyer 每月 5 家」这条规则已退役 —— Free Buyer 改为
 * 基础层无限浏览，付费层（证据/验货历史/风险拆解/认证）由会员解锁。
 * 但 9 份字典里仍留着「每月 N 个档案」的旧口径，属于**无据声称**，必须清掉。
 *
 * 本脚本只做三件事：
 *   1. 改写 9 个仍按月计量的 key；
 *   2. 删除因口径退役而失效的死键（quotaBanner.* / account.panel.quota）；
 *   3. 删除后写回，保持 2 空格缩进 + CRLF + 末尾换行。
 *
 * 幂等：重复执行结果一致；若目标已是新值则不改动文件。
 *
 * ⚠️ 译文一律手工撰写（DEEPSEEK_API_KEY 为空，机器翻译不可用），
 *    货币符号位置沿用各语言原有写法（en/zh/ja "$99"、es/de/fr/ar "99 $"、pt "US$ 99"）。
 *
 * 用法：node scripts/apply-cs05c-i18n.cjs [--check]
 *   --check 只校验不写盘（CI/回归用），有偏差则非 0 退出。
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const CHECK_ONLY = process.argv.includes("--check");

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

/** 需要改写的 key → 九语新值 */
const REWRITE = {
  // 「免费账号每月 N 个档案」→ 基础层无每月上限
  "membership.freeLead": {
    en: "Free accounts browse basic supplier profiles with no monthly limit.",
    zh: "免费账号浏览基础供应商档案，没有每月上限。",
    "zh-TW": "免費帳號瀏覽基礎供應商檔案，沒有每月上限。",
    ja: "無料アカウントは基本プロフィールを月間上限なしで閲覧できます。",
    es: "Las cuentas gratuitas navegan los perfiles básicos sin límite mensual.",
    de: "Kostenlose Konten durchsuchen Basisprofile ohne monatliches Limit.",
    fr: "Les comptes gratuits consultent les profils de base sans limite mensuelle.",
    pt: "Contas gratuitas navegam os perfis básicos sem limite mensal.",
    ar: "تتصفح الحسابات المجانية الملفات الأساسية دون حد شهري.",
  },

  // 「每月可访问有限数量的增强档案」→ 基础免费，增强层属会员权益
  "suppliers.unlockNote": {
    en: "Basic supplier information is free to browse. Evidence records, inspection history and risk breakdowns are part of Founder Buyer membership.",
    zh: "基础供应商信息免费浏览。证据记录、验货历史与风险拆解属于 Founder Buyer 会员权益。",
    "zh-TW": "基礎供應商資訊免費瀏覽。證據紀錄、驗貨歷史與風險拆解屬於 Founder Buyer 會員權益。",
    ja: "基本的なサプライヤー情報は無料で閲覧できます。証拠記録、検査履歴、リスク内訳は Founder Buyer 会員の対象です。",
    es: "La información básica es gratuita. Los registros de evidencia, el historial de inspecciones y el desglose de riesgo forman parte de la membresía Founder Buyer.",
    de: "Grundlegende Lieferanteninformationen sind kostenlos. Evidenzdatensätze, Inspektionsverlauf und Risikoaufschlüsselung sind Teil der Founder-Buyer-Mitgliedschaft.",
    fr: "Les informations de base sont gratuites. Les preuves, l'historique des inspections et le détail des risques font partie de l'adhésion Founder Buyer.",
    pt: "As informações básicas são gratuitas. Registros de evidência, histórico de inspeções e detalhamento de risco fazem parte da assinatura Founder Buyer.",
    ar: "المعلومات الأساسية مجانية. سجلات الأدلة وسجل عمليات التفتيش وتفصيل المخاطر جزء من عضوية Founder Buyer.",
  },

  // 「取消每月档案查看数量限制」→ 真正解锁的是付费层四项
  "account.panel.upgradeLead": {
    en: "Founding Buyer is ${price} per year and unlocks evidence records, inspection history and risk breakdowns.",
    zh: "Founding Buyer 每年 ${price}，解锁证据记录、验货历史与风险拆解。",
    "zh-TW": "Founding Buyer 每年 ${price}，解鎖證據紀錄、驗貨歷史與風險拆解。",
    ja: "Founding Buyer は年額 $ {price} で、証拠記録・検査履歴・リスク内訳を利用できます。",
    es: "Founding Buyer cuesta {price} $ al año y desbloquea registros de evidencia, historial de inspecciones y desglose de riesgo.",
    de: "Founding Buyer kostet {price} $ pro Jahr und schaltet Evidenzdatensätze, Inspektionsverlauf und Risikoaufschlüsselung frei.",
    fr: "Founding Buyer coûte {price} $ par an et débloque les preuves, l'historique des inspections et le détail des risques.",
    pt: "Founding Buyer custa US$ {price} por ano e desbloqueia registros de evidência, histórico de inspeções e detalhamento de risco.",
    ar: "تبلغ تكلفة Founding Buyer {price} $ سنويًا وتتيح سجلات الأدلة وسجل عمليات التفتيش وتفصيل المخاطر.",
  },

  // 面板已只显示「不限」，标签不该再叫「本月用量」
  "account.panel.quotaLabel": {
    en: "Basic profile access",
    zh: "基础档案访问",
    "zh-TW": "基礎檔案存取",
    ja: "基本プロフィール閲覧",
    es: "Acceso a perfiles básicos",
    de: "Zugriff auf Basisprofile",
    fr: "Accès aux profils de base",
    pt: "Acesso a perfis básicos",
    ar: "الوصول إلى الملفات الأساسية",
  },

  "account.panel.quotaUnlimited": {
    en: "Unlimited",
    zh: "不限次数",
    "zh-TW": "不限次數",
    ja: "無制限",
    es: "Sin límite",
    de: "Unbegrenzt",
    fr: "Illimité",
    pt: "Ilimitado",
    ar: "بلا حدود",
  },

  "account.panel.signedOutLead": {
    en: "Your plan and membership details appear here once you sign in.",
    zh: "登录后即可查看套餐与会员信息。",
    "zh-TW": "登入後即可檢視方案與會員資訊。",
    ja: "ログインすると、プランと会員情報が表示されます。",
    es: "Tu plan y los detalles de la membresía aparecen aquí cuando inicies sesión.",
    de: "Tarif und Mitgliedschaftsdetails erscheinen hier, sobald Sie angemeldet sind.",
    fr: "Votre formule et les détails de votre adhésion apparaîtront ici une fois connecté.",
    pt: "Seu plano e os detalhes da assinatura aparecem aqui depois que você entrar.",
    ar: "تظهر خطتك وتفاصيل العضوية هنا بعد تسجيل الدخول.",
  },

  "account.metaDesc": {
    en: "Your FactoryAuditB2B account: plan and membership status.",
    zh: "你的 FactoryAuditB2B 账号：套餐与会员状态。",
    "zh-TW": "你的 FactoryAuditB2B 帳號：方案與會員狀態。",
    ja: "FactoryAuditB2B アカウントのプランと会員ステータスを確認できます。",
    es: "Tu cuenta de FactoryAuditB2B: plan y estado de la membresía.",
    de: "Ihr FactoryAuditB2B-Konto: Tarif und Mitgliedschaftsstatus.",
    fr: "Votre compte FactoryAuditB2B : formule et statut d'adhésion.",
    pt: "Sua conta FactoryAuditB2B: plano e status da assinatura.",
    ar: "حسابك في FactoryAuditB2B: الخطة وحالة العضوية.",
  },

  "account.lead": {
    en: "Your plan and membership details.",
    zh: "套餐与会员信息。",
    "zh-TW": "方案與會員資訊。",
    ja: "プランと会員情報。",
    es: "Tu plan y los detalles de la membresía.",
    de: "Ihr Tarif und die Details Ihrer Mitgliedschaft.",
    fr: "Votre formule et les détails de votre adhésion.",
    pt: "Seu plano e os detalhes da assinatura.",
    ar: "خطتك وتفاصيل عضويتك.",
  },

  "login.metaDesc": {
    en: "Sign in to your FactoryAuditB2B account to view supplier profiles and saved suppliers.",
    zh: "登录 FactoryAuditB2B 账号，查看供应商档案与收藏的供应商。",
    "zh-TW": "登入 FactoryAuditB2B 帳號，檢視供應商檔案與收藏的供應商。",
    ja: "FactoryAuditB2B アカウントにログインして、サプライヤープロフィールと保存したサプライヤーを確認できます。",
    es: "Accede a tu cuenta de FactoryAuditB2B para ver perfiles de proveedores y proveedores guardados.",
    de: "Melden Sie sich bei Ihrem FactoryAuditB2B-Konto an, um Lieferantenprofile und gespeicherte Lieferanten zu sehen.",
    fr: "Connectez-vous à votre compte FactoryAuditB2B pour consulter les profils fournisseurs et vos fournisseurs enregistrés.",
    pt: "Entre na sua conta FactoryAuditB2B para ver perfis de fornecedores e fornecedores salvos.",
    ar: "سجّل الدخول إلى حسابك في FactoryAuditB2B لعرض ملفات الموردين والموردين المحفوظين.",
  },
};

/** 因口径退役而彻底失效的键（连父对象一起删） */
const DELETE_KEYS = [
  "quotaBanner",
  "account.panel.quota",
  // 账户菜单里那条 "{used} / {limit} profiles this month"
  "auth.accountMenu.quota",
  // 旧的额度提示：「本月的 {limit} 个免费档案额度已用完」。
  // 唯一消费者 buildQuotaMessage() 已在 CS-05b 删除，此处只剩一具会误导人的尸体。
  "auth.quotaReached",
];

function getPath(obj, dotted) {
  return dotted.split(".").reduce((a, c) => (a == null ? a : a[c]), obj);
}

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  const last = parts.pop();
  let cur = obj;
  for (const p of parts) {
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[last] = value;
}

function deletePath(obj, dotted) {
  const parts = dotted.split(".");
  const last = parts.pop();
  let cur = obj;
  for (const p of parts) {
    if (cur[p] == null || typeof cur[p] !== "object") return false;
    cur = cur[p];
  }
  if (!(last in cur)) return false;
  delete cur[last];
  return true;
}

/** 与仓库既有格式完全一致：2 空格缩进 + CRLF + 末尾换行 */
function serialize(obj) {
  return JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
}

let changed = 0;
let rewrites = 0;
let deletions = 0;
const problems = [];

for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.json`);
  const before = fs.readFileSync(file, "utf8");
  const dict = JSON.parse(before);

  for (const [key, table] of Object.entries(REWRITE)) {
    const next = table[loc];
    if (typeof next !== "string" || !next) {
      problems.push(`${loc} 缺少 ${key} 的译文`);
      continue;
    }
    const cur = getPath(dict, key);
    if (cur === undefined) {
      problems.push(`${loc} 不存在键 ${key}（字典结构与 en 不一致）`);
      continue;
    }
    if (cur !== next) {
      setPath(dict, key, next);
      rewrites++;
    }
  }

  for (const key of DELETE_KEYS) {
    if (deletePath(dict, key)) deletions++;
    else if (CHECK_ONLY && getPath(dict, key) !== undefined) {
      problems.push(`${loc} 删除失败：${key}`);
    }
  }

  const after = serialize(dict);
  if (after !== before) {
    if (!CHECK_ONLY) fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log(`  ${CHECK_ONLY ? "[需更新]" : "[已写入]"} ${loc}.json  (${before.length} → ${after.length})`);
  } else {
    console.log(`  [无变化] ${loc}.json`);
  }
}

console.log("");
console.log(`改写 ${rewrites} 处 · 删除 ${deletions} 个死键 · 触及 ${changed}/${LOCALES.length} 个文件`);

if (problems.length) {
  console.error("\n发现问题：");
  problems.forEach((p) => console.error("  ✗ " + p));
  process.exit(1);
}

if (CHECK_ONLY && changed > 0) {
  console.error("\n✗ 字典与 CS-05c 目标状态不一致（--check 模式不写盘）");
  process.exit(1);
}

console.log(CHECK_ONLY ? "\n✓ 九语字典已与 CS-05c 目标状态一致" : "\n✓ 九语字典修订完成");
