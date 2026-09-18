// scripts/cs19-chemicals-dict.mjs —— 工单 SEO-20260918-FAB 任务 2.1
//
// 给 9 个语言字典的 `chemicals` 命名空间补一个**短标题尾标签** `detailTitleTail`，
// 供 /chemicals/[slug] 详情页替换原来的 `chemicals.metaTitle`（列表页关键词堆叠串，
// fr 70 / es 64 / pt 63 / de 59 字符）——后者与「品种名 + CAS + 品牌后缀」拼接后
// 实测产出 48–124 字符的标题（最长达 1,121px），远超 Google 桌面端约 600px 的标题区。
//
// 纪律（项目约定）：
//   · 只新增、绝不覆盖已存在的非空值；
//   · 2 空格缩进 + CRLF + 末尾换行（与既有字典逐字节一致，已实测 round-trip 稳定）；
//   · 每个语言打印 before / after，便于人工核对。
//
// 用法：node scripts/cs19-chemicals-dict.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.CS19_ROOT ?? process.cwd();
const LOCALES = ["en", "zh", "zh-TW", "ja", "de", "fr", "es", "pt", "ar"];

// 全部 ≤ 25 字符：与最长的「品种名 + CAS」（Titanium dioxide (CAS 13463-67-7)，32 字符）
// 拼接后仍 ≤ 60 字符。措辞只描述页面实际内容（应用 + 需索取的文件），
// 不写「已核验供应商」之类页面本身不承载的结论。
const TAIL = {
  en: "Applications & documents",
  zh: "应用与文件",
  "zh-TW": "應用與文件",
  ja: "用途と書類",
  de: "Anwendungen & Dokumente",
  fr: "Applications & documents",
  es: "Usos y documentos",
  pt: "Aplicações e documentos",
  ar: "التطبيقات والمستندات",
};

const KEY = "detailTitleTail";
let changed = 0;
let skipped = 0;

for (const locale of LOCALES) {
  const file = path.join(ROOT, "i18n", "dictionaries", `${locale}.json`);
  const orig = fs.readFileSync(file, "utf8");
  const dict = JSON.parse(orig);
  const chem = dict.chemicals;
  if (!chem || typeof chem !== "object") {
    console.log(`${locale}: ⚠️ 无 chemicals 命名空间，跳过`);
    continue;
  }
  const before = chem[KEY];
  if (typeof before === "string" && before.length > 0) {
    console.log(`${locale}: 已存在，未改动 -> ${JSON.stringify(before)}`);
    skipped++;
    continue;
  }

  // 重建 chemicals，把新键插在 metaTitle 之后（保持可读、diff 最小）
  const rebuilt = {};
  let inserted = false;
  for (const k of Object.keys(chem)) {
    rebuilt[k] = chem[k];
    if (k === "metaTitle") {
      rebuilt[KEY] = TAIL[locale];
      inserted = true;
    }
  }
  if (!inserted) rebuilt[KEY] = TAIL[locale];

  const next = {};
  for (const k of Object.keys(dict)) {
    next[k] = k === "chemicals" ? rebuilt : dict[k];
  }

  const out = JSON.stringify(next, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(
    `${locale}: ${JSON.stringify(before ?? null)} -> ${JSON.stringify(TAIL[locale])}` +
      `  [${[...TAIL[locale]].length} 字符]  ${orig.length} -> ${out.length} 字节`
  );
}

console.log("");
console.log(`改动 ${changed} 个语言，跳过 ${skipped} 个。`);

// 自检：9 语键齐备 + 长度闸门
let bad = 0;
for (const locale of LOCALES) {
  const file = path.join(ROOT, "i18n", "dictionaries", `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const v = dict.chemicals?.[KEY];
  const len = v ? [...v].length : -1;
  if (!v) bad++;
  if (len > 25) bad++;
  console.log(`  自检 ${locale.padEnd(6)} len=${String(len).padStart(2)} ${v ?? "<<MISSING>>"}`);
}
console.log(bad === 0 ? "✅ 自检通过（9/9 齐备且 ≤25 字符）" : `❌ 自检失败：${bad} 项`);
process.exit(bad === 0 ? 0 : 1);
