/**
 * stage1.6 执行报告生成器
 * 用法：node scripts/run-regression.mjs _s16_report2 > outputs/stage1.6-execution-report.md
 */
import fs from "fs";
import path from "path";
import { trimMetaDescription, trimMetaTitle, isCjkDominant } from "../lib/pageMeta";
import { CANDIDATES, TS_CANDIDATES } from "./_s16_cand_data";

const SENT = /[.。!！?？]/;
const WORST_COUNTRY = "Philippines";
const WORST_INDUSTRY = "Food & Beverage / 食品饮料";
const subst = (s: string) => s.replaceAll("{country}", WORST_COUNTRY).replaceAll("{industry}", WORST_INDUSTRY);

const L: string[] = [];
const p = (s = "") => L.push(s);

p("# stage1.6 执行报告 —— 第 3 批 desc/title 修复 + CJK 占比判定");
p();
p("> 生成时间：2026-09-29｜基线：CF `72ef374c`｜回滚锚点：`6facaae8`");
p();
p("## 0. 本批做了什么（一句话）");
p();
p("把 stage1.6 建议书的 **66 处**源键改写落地（字典 54 + TS 13，含新增 fr 1 处），");
p("并把 `lib/pageMeta.ts` 的「含 1 个汉字即按 CJK 预算」改成「CJK 字符**占比** > 25%」。");
p();
p("---");
p();

// ---------- 1. 字典层 ----------
p(`## 1. 字典层改写（${CANDIDATES.length} 处）—— 前后对比`);
p();
p("| # | 源键 | 语种 | 旧（源头→收口） | 新（源头→收口） | 新结尾句末 | 新幂等 | 覆盖页 |");
p("|---|---|---|---|---|---|---|---|");
CANDIDATES.forEach((c, i) => {
  const o = subst(c.old);
  const n = subst(c.neu);
  const oldOut = trimMetaDescription(o);
  const neuOut = trimMetaDescription(n);
  if (c.kind === "title") {
    const sfx = c.suffix ?? "";
    const tot = [...c.neu].length + [...sfx].length;
    p(
      `| ${i + 1} | \`${c.key}\` | ${c.loc} | 主体 ${[...c.old].length}｜合成 ${[...c.old].length + [...sfx].length} | 主体 **${[
        ...c.neu,
      ].length}**｜合成 **${tot}** | — | — | 1 |`
    );
  } else {
    p(
      `| ${i + 1} | \`${c.key}\` | ${c.loc} | ${[...o].length} → ${[...oldOut].length}${SENT.test(oldOut.slice(-1)) ? "" : " ✗"} | ${[
        ...n,
      ].length} → **${[...neuOut].length}** | ${SENT.test(neuOut.slice(-1)) ? "✓" : "✗"} | ${neuOut === n ? "✓" : "✗"} | 见 §3 |`
    );
  }
});
p();

// ---------- 2. TS 层 ----------
p(`## 2. TS 内容层改写（${TS_CANDIDATES.length} 处）—— 前后对比`);
p();
p("| # | 源（文件·字段） | 生效语种 | 旧（源头→收口） | 新（源头→收口） | 新结尾句末 | 新幂等 |");
p("|---|---|---|---|---|---|---|");
TS_CANDIDATES.forEach((c, i) => {
  const oldOut = trimMetaDescription(c.old);
  const neuOut = trimMetaDescription(c.neu);
  p(
    `| ${i + 1} | \`${c.key}\` | ${c.loc} | ${[...c.old].length} → ${[...oldOut].length}${
      SENT.test(oldOut.slice(-1)) ? "" : " ✗"
    } | ${[...c.neu].length} → **${[...neuOut].length}** | ${SENT.test(neuOut.slice(-1)) ? "✓" : "✗"} | ${
      neuOut === c.neu ? "✓" : "✗"
    } |`
  );
});
p();
p("---");
p();

// ---------- 3. CJK 占比判定 ----------
p("## 3. CJK 占比判定 —— 行业分类页效果");
p();
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
const INDUSTRIES = [
  "Electronics / 电子",
  "Textiles / 纺织",
  "Toys / 玩具",
  "Footwear / 鞋类",
  "Machinery / 机械",
  "Plastics / 塑料",
  "Home Appliances / 家电",
  "Food & Beverage / 食品饮料",
  "Chemicals / 化工",
  "Automotive / 汽车",
  "Furniture / 家具",
  "Packaging / 包装",
  "Cosmetics / 化妆品",
];
const dicts: Record<string, any> = {};
for (const l of LOCALES) dicts[l] = JSON.parse(fs.readFileSync(path.join("i18n", "dictionaries", `${l}.json`), "utf8"));
p("| 语种 | 行业分类页 desc 收口后长度（13 个行业） | 预算 | 结尾句末标点 |");
p("|---|---|---|---|");
for (const l of LOCALES) {
  const lens: number[] = [];
  let endOk = true;
  for (const name of INDUSTRIES) {
    const src = (dicts[l].industryPage.metaDesc as string).replaceAll("{industry}", name);
    const out = trimMetaDescription(src);
    lens.push([...out].length);
    if (!SENT.test(out.slice(-1))) endOk = false;
  }
  p(
    `| ${l} | ${Math.min(...lens)}–${Math.max(...lens)} | ${isCjkDominant(
      (dicts[l].industryPage.metaDesc as string).replaceAll("{industry}", INDUSTRIES[7])
    ) ? "CJK 90" : "拉丁 158"} | ${endOk ? "✓" : "✗"} |`
  );
}
p();
console.log(L.join("\n"));
