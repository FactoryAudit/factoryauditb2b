/**
 * scripts/g4-desc-idempotency-regression.ts —— 第 4 批 guides 9 语补全的**常驻回归**
 *
 * 覆盖：批 4.1（前 10 篇）+ 批 4.2（#11–20）+ 批 4.3（#21–30）= 30 篇 × 6 语 = 180 条已补齐的 metaDesc。
 * 每次再补一批（4.4/4.5）后，只需把 EXPECTED 同步为新的补齐条数。
 *
 * 为什么必须用**真实收口函数**：`pickGuideDesc` 的返回值会经 `buildPageMetadata` →
 * `trimMetaDescription`。若某条超预算，收口函数会按「预算内最后一个句末标点」重写它，
 * 于是「本地预渲染 HTML 里的 desc」≠「源码里的 desc」——所有逐字断言都会失真。
 * 因此硬门槛是：**收口函数对每条都零命中（trim(raw) === raw）**。
 *
 * 阴性对照：喂一条必然超预算的串，确认 trimMetaDescription 确实改写了它
 * （证明本脚本的「零命中」断言不是恒真）。
 *
 * 运行：
 *   node --env-file=.env scripts/run-regression.mjs g4-desc-idempotency-regression G4_ROOT
 */
import { GUIDES } from "../lib/guides";
import { metaDescriptionBudget, trimMetaDescription } from "../lib/pageMeta";

const LANGS = ["ja", "es", "de", "fr", "pt", "ar"] as const;
const FIELD: Record<(typeof LANGS)[number], string> = {
  ja: "metaDescJa",
  es: "metaDescEs",
  de: "metaDescDe",
  fr: "metaDescFr",
  pt: "metaDescPt",
  ar: "metaDescAr",
};

// 批 4.1（10 篇）+ 批 4.2（10 篇）+ 批 4.3（10 篇）= 30 篇 × 6 语
const EXPECTED = 180;

const ENDER_RE = /[.。!！?？]["'”’»)\]）]*$/;

type G = (typeof GUIDES)[number];

let n = 0;
let fail = 0;
const perSlug: string[] = [];

for (const g of GUIDES as G[]) {
  const row: string[] = [];
  for (const lg of LANGS) {
    const v = (g as unknown as Record<string, string | undefined>)[FIELD[lg]];
    if (typeof v !== "string") continue; // 未补齐的语种 ⇒ 回退 en，行为与补齐前一致
    n++;
    const errs: string[] = [];
    const len = [...v].length;
    const budget = metaDescriptionBudget(v);
    if (len > budget) errs.push(`len ${len} > budget ${budget}`);
    if (trimMetaDescription(v) !== v) errs.push("收口非幂等（trim(raw) !== raw）");
    if (v === g.metaDescEn) errs.push("与 metaDescEn 逐字相同（未本地化）");
    if (!ENDER_RE.test(v)) errs.push("结尾无句末标点");
    if (/[—–]/.test(v)) errs.push("含破折号");
    if (errs.length) {
      fail++;
      console.log(`✗ ${g.slug}/${lg} [${len}/${budget}] ${errs.join("; ")}`);
    }
    row.push(`${lg}:${len}`);
  }
  if (row.length) perSlug.push(`${g.slug.padEnd(42)} ${row.join(" ")}`);
}

console.log("--- 已补齐的字段（slug + 各语种实测长度）---");
for (const r of perSlug) console.log(r);
console.log("---");
console.log(`补齐字段 ${n} 条（期望 ${EXPECTED}）｜FAIL ${fail}`);

// 阴性对照：超预算串必须被真实收口函数改写
const NEGATIVE = "A".repeat(400) + " tail.";
const negChanged = trimMetaDescription(NEGATIVE) !== NEGATIVE;
console.log(`阴性对照：超预算串被收口改写 = ${negChanged}（必须为 true）`);

const ok = fail === 0 && n === EXPECTED && negChanged;
console.log(ok ? "=> ALL CLEAN" : "=> NOT CLEAN");
if (!ok) process.exitCode = 1;
