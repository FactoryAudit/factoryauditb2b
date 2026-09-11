/**
 * CS-05c-r2 —— `supplierProfile.freeLockLead` 九语语义修正（幂等）
 *
 * 背景：FREE 层的字段集合是**四项**（lib/suppliers.ts FREE_FIELDS）：
 *   established · employees · exportMarkets · auditStatus
 * 而 `certifications` 属于 **PAID_FIELDS**（证据明细层的认证明细）。
 *
 * 但九语字典里的 supplierProfile.freeLockLead 都把「认证 / 认证清单 / Zertifizierungen /
 * certificaciones / الشهادات」写进了**免费账号**能看到的清单里 —— 这是**无据声称**：
 * 用户为看清「认证」而注册，注册完发现认证仍在付费墙后。
 *
 * 本脚本只做一件事：把该句第 4 项换成各语言**既有的** auditStatus 官方译法。
 *   → 术语单一事实源 = 同页的 `supplierProfile.auditStatusLabel`
 *     （该标签就渲染在 established / employees / exportMarkets 旁边，
 *      用别的词会让同一块界面出现两种说法）
 *
 * 明确不做：
 *   ✗ 不改 key、不改 JSON schema、不改键数量（不新增/删除任何键）
 *   ✗ 不重写整句（只换第 4 项，保留原句语气与前面三项）
 *   ✗ 不动其他任何 locale 键
 *
 * 幂等：重复执行结果一致；目标已是新值时不写盘。
 *
 * ⚠️ 译文一律手工撰写（DEEPSEEK_API_KEY 为空，机器翻译不可用）。
 *
 * 用法：
 *   node scripts/apply-cs05c-r2-i18n.cjs          # 执行
 *   node scripts/apply-cs05c-r2-i18n.cjs --check  # 只校验不写盘（有偏差则非 0 退出）
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const CHECK_ONLY = process.argv.includes("--check");

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

/**
 * 需要改写的 key → 九语新值。
 *
 * 第 4 项一律取各语言 `supplierProfile.auditStatusLabel` 的**原词**：
 *   en "Audit status" / zh "验厂状态" / zh-TW "驗廠狀態" / ja "監査状況" /
 *   es "Estado de la auditoría" / de "Prüfungsstatus" / fr "Statut d'audit" /
 *   pt "Estado da auditoria" / ar "حالة مراجعة الحسابات"
 */
const REWRITE = {
  "supplierProfile.freeLockLead": {
    en: "Create a free account to view the year established, employee count, export markets and audit status.",
    zh: "注册免费账号，查看成立年份、员工规模、出口市场与验厂状态。",
    "zh-TW": "註冊免費帳號，查看成立年份、員工人數、出口市場與驗廠狀態。",
    ja: "無料アカウントを作成すると、設立年・従業員数・輸出市場・監査状況を確認できます。",
    es: "Crea una cuenta gratuita para ver el año de fundación, el número de empleados, los mercados de exportación y el estado de la auditoría.",
    de: "Erstellen Sie ein kostenloses Konto, um Gründungsjahr, Mitarbeiterzahl, Exportmärkte und Prüfungsstatus zu sehen.",
    fr: "Créez un compte gratuit pour voir l'année de création, l'effectif, les marchés d'exportation et le statut d'audit.",
    pt: "Crie uma conta gratuita para ver ano de fundação, número de funcionários, mercados de exportação e o estado da auditoria.",
    ar: "أنشئ حساباً مجانياً لعرض سنة التأسيس وعدد الموظفين وأسواق التصدير وحالة مراجعة الحسابات.",
  },
};

/**
 * 一致性护栏：新文案的第 4 项必须与同语言的 auditStatusLabel 逐字相同。
 * 这样「术语漂移」会在改写阶段就暴露，而不是等用户发现界面自相矛盾。
 */
const LABEL_KEY = "supplierProfile.auditStatusLabel";

/**
 * 同样要守住的反向条件：新文案里**不得**再出现认证类词汇。
 * 覆盖九语各自的认证写法（含阿拉伯语的 الشهادات / شهادة）。
 */
const CERT_RE =
  /(certificat|certifica|Zertifizier|认证|認證|認証|認証一覧|认证列表|認證清單|الشهادات|شهادة|گواهی)/i;

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

/** 与仓库既有格式完全一致：2 空格缩进 + CRLF + 末尾换行 */
function serialize(obj) {
  return JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
}

let changed = 0;
let rewrites = 0;
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

    // 护栏 1：不得再承诺认证
    if (CERT_RE.test(next)) {
      problems.push(`${loc} 的新文案仍含认证类词汇：${next}`);
      continue;
    }

    // 护栏 2：第 4 项必须与同语言 auditStatusLabel 一致。
    //   大小写不敏感 —— 该标签是独立字段（首字母大写），而这里出现在句中，
    //   英文/西语/法语/葡语按语法必须小写。
    const label = getPath(dict, LABEL_KEY);
    if (typeof label !== "string" || !label) {
      problems.push(`${loc} 缺少 ${LABEL_KEY}（术语锚点不存在，无法校验）`);
      continue;
    }
    if (!next.toLowerCase().includes(label.toLowerCase())) {
      problems.push(`${loc} 新文案未采用本语言的 auditStatusLabel（"${label}"）：${next}`);
      continue;
    }

    if (cur !== next) {
      setPath(dict, key, next);
      rewrites++;
      console.log(`  [改写] ${loc}.json  ${key}`);
    }
  }

  const after = serialize(dict);
  if (after !== before) {
    if (!CHECK_ONLY) fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log(`  ${CHECK_ONLY ? "[需更新]" : "[已写入]"} ${loc}.json`);
  } else {
    console.log(`  [无变化] ${loc}.json`);
  }
}

console.log("");
console.log(`改写 ${rewrites} 处 · 触及 ${changed}/${LOCALES.length} 个文件`);

if (problems.length) {
  console.error("\n发现问题：");
  problems.forEach((p) => console.error("  ✗ " + p));
  process.exit(1);
}

if (CHECK_ONLY && changed > 0) {
  console.error("\n✗ 九语 freeLockLead 与 CS-05c-r2 目标状态不一致（--check 模式不写盘）");
  process.exit(1);
}

console.log(
  CHECK_ONLY
    ? "\n✓ 九语 freeLockLead 已与 CS-05c-r2 目标状态一致"
    : "\n✓ 九语 freeLockLead 修订完成"
);
