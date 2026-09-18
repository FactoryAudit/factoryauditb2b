// scripts/account-hub-dict.mjs —— /account 账号中心「功能导航区」文案
//
// 背景（2026-09-18 排查）：
//   /account 主页此前只渲染一张「邮箱 / 套餐 / 额度」卡片，两个真实存在的子页面
//   （/account/saved 收藏夹、/account/rfqs 我的询价）**只在右上角折叠下拉里有入口**，
//   主页一个链接都没有 ⇒ 页面是死胡同，账号中心不像账号中心。
//
//   本脚本只补**一个**小节标题 `linksTitle`；卡片标题与说明全部复用既有键：
//     · account.savedTitle / account.savedLead   →「收藏的供应商」卡片
//     · account.rfqsTitle  / account.rfqsLead    →「我的询价」卡片
//     · admin.title / admin.overviewLead         →「管理后台」卡片（仅 isAdmin 渲染）
//   因此 9 语只需各补 1 个叶子，而不是 7 个 —— 复用既有翻译，不制造重复文案。
//
// 纪律（项目约定）：
//   · 只新增、绝不覆盖已存在的非空值；
//   · 2 空格缩进 + CRLF + 末尾换行（与既有字典逐字节一致，已实测 round-trip 稳定）；
//   · 每个语言打印 before / after，便于人工核对。
//
// 用法：node scripts/account-hub-dict.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.CS19_ROOT ?? process.cwd();
const LOCALES = ["en", "zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];

// 小节标题：这一区是「你自己产生的东西放哪儿」，
// 不写「快捷操作」之类站上并不存在的能力。
const TITLE = {
  en: "Your activity",
  zh: "你的活动",
  "zh-TW": "你的活動",
  ja: "アクティビティ",
  de: "Ihre Aktivität",
  fr: "Votre activité",
  es: "Tu actividad",
  pt: "A sua atividade",
  ar: "نشاطك",
};

/** 插在 panel.upgradeTitle 之前 —— 渲染顺序为「账号信息 → 功能导航 → 升级卡片」 */
const KEY = "linksTitle";
const BEFORE_KEY = "upgradeTitle";

let changed = 0;
let skipped = 0;

for (const locale of LOCALES) {
  const file = path.join(ROOT, "i18n", "dictionaries", `${locale}.json`);
  const orig = fs.readFileSync(file, "utf8");
  const dict = JSON.parse(orig);
  const panel = dict.account?.panel;
  if (!panel || typeof panel !== "object") {
    console.log(`${locale}: ⚠️ 无 account.panel 命名空间，跳过`);
    continue;
  }
  const before = panel[KEY];
  if (typeof before === "string" && before.length > 0) {
    console.log(`${locale}: 已存在，未改动 -> ${JSON.stringify(before)}`);
    skipped++;
    continue;
  }

  const rebuilt = {};
  let inserted = false;
  for (const k of Object.keys(panel)) {
    if (k === BEFORE_KEY) {
      rebuilt[KEY] = TITLE[locale];
      inserted = true;
    }
    rebuilt[k] = panel[k];
  }
  if (!inserted) rebuilt[KEY] = TITLE[locale];

  const next = {};
  for (const k of Object.keys(dict)) {
    next[k] = k === "account" ? { ...dict.account, panel: rebuilt } : dict[k];
  }

  const out = JSON.stringify(next, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(
    `${locale}: ${JSON.stringify(before ?? null)} -> ${JSON.stringify(TITLE[locale])}` +
      `  [${[...TITLE[locale]].length} 字符]  ${orig.length} -> ${out.length} 字节`
  );
}

console.log("");
console.log(`改动 ${changed} 个语言，跳过 ${skipped} 个。`);

// ---------- 自检 ----------

/** 数叶子：字符串/数字/boolean 计 1，数组/对象递归（与 cs06a C8 口径一致） */
function countLeaves(v) {
  if (Array.isArray(v)) return v.length === 0 ? 0 : v.reduce((s, x) => s + countLeaves(x), 0);
  if (v && typeof v === "object") return Object.values(v).reduce((s, x) => s + countLeaves(x), 0);
  return 1;
}

let bad = 0;
const enLeaf = countLeaves(JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "dictionaries", "en.json"), "utf8")));
const enKeys = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "dictionaries", "en.json"), "utf8"));

for (const locale of LOCALES) {
  const file = path.join(ROOT, "i18n", "dictionaries", `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const v = dict.account?.panel?.[KEY];
  if (typeof v !== "string" || v.length === 0) bad++;
  // 九语键集合必须与 en 完全一致（getDictionary 无深 fallback）
  const same =
    JSON.stringify(Object.keys(dict.account.panel)) ===
    JSON.stringify(Object.keys(enKeys.account.panel));
  if (!same) bad++;
  console.log(
    `  自检 ${locale.padEnd(6)} panel键=${String(Object.keys(dict.account.panel).length).padStart(2)}` +
      ` 键序同 en=${same ? "是" : "否 ✗"}  ${JSON.stringify(v ?? "<<MISSING>>")}`
  );
}

// 复用的四个键在 9 语都必须存在（本脚本不写它们，只依赖它们）
for (const locale of LOCALES) {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", "dictionaries", `${locale}.json`), "utf8"));
  const need = [dict.account?.savedTitle, dict.account?.savedLead, dict.account?.rfqsTitle, dict.account?.rfqsLead, dict.admin?.title, dict.admin?.overviewLead];
  if (need.some((x) => typeof x !== "string" || x.length === 0)) {
    console.log(`  ❌ ${locale}: 复用键缺失 ${JSON.stringify(need)}`);
    bad++;
  }
}

console.log("");
console.log(`en 叶子数 = ${enLeaf}（改动前为 2823）`);
console.log(bad === 0 ? "✅ 自检通过（9/9 齐备、键序与 en 一致、复用键齐备）" : `❌ 自检失败：${bad} 项`);
process.exit(bad === 0 ? 0 : 1);
