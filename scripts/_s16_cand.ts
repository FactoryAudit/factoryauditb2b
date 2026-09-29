/**
 * stage1.6 候选测量：逐条打印 旧 → 新（源头长度 / 收口后长度 / endOk / CUT）
 * 用法：node scripts/run-regression.mjs _s16_cand
 */
import { trimMetaDescription, trimMetaTitle } from "../lib/pageMeta";
import { CANDIDATES, TS_CANDIDATES } from "./_s16_cand_data";

const SENT = /[.。!！?？]/;
const CJK = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const WORST_COUNTRY = "Philippines";
const WORST_INDUSTRY = "Food & Beverage / 食品饮料";
const subst = (s: string) => s.replaceAll("{country}", WORST_COUNTRY).replaceAll("{industry}", WORST_INDUSTRY);

function width(s: string) {
  // CJK 按 2 计（SERP 半角宽），用于目标区间的可比口径
  return [...s].reduce((a, c) => a + (CJK.test(c) ? 2 : 1), 0);
}

let pass = 0;
let fail = 0;
const fails: string[] = [];

function line(kind: string, key: string, loc: string, oldS: string, neuS: string, suffix: string) {
  const oldSub = subst(oldS);
  const neuSub = subst(neuS);
  const oldOut = trimMetaDescription(oldSub);
  const neuOut = trimMetaDescription(neuSub);
  const neuEndOk = SENT.test(neuOut.slice(-1));
  const neuCut = neuOut !== neuSub;
  const oldEndOk = SENT.test(oldOut.slice(-1));

  let bandOk: boolean;
  if (kind === "title") {
    const full = neuS + (suffix ?? "");
    const tw = trimMetaTitle(full);
    const total = [...full].length;
    bandOk = total >= 50 && total <= 60 && tw === full;
    if (!bandOk) fails.push(`${key}[${loc}] title total=${total} trim=${tw === full ? "unchanged" : "CHANGED"}`);
  } else {
    const isCjkBudget = CJK.test(neuSub);
    const w = isCjkBudget ? [...neuSub].length : width(neuSub);
    bandOk = isCjkBudget ? w >= 60 && w <= 90 : w >= 115 && w <= 158;
    if (!bandOk) fails.push(`${key}[${loc}] desc len=${[...neuSub].length} (width ${w}) budget=${isCjkBudget ? 90 : 158}`);
  }
  // title 不要求句末标点、也不参与 desc 收口
  const ok = kind === "title" ? bandOk : bandOk && neuEndOk && !neuCut;
  if (ok) pass++;
  else if (bandOk) fails.push(`${key}[${loc}] endOk=${neuEndOk} CUT=${neuCut}`);

  const tag = ok ? "PASS" : "**FAIL**";
  console.log(
    `${tag}  ${key.padEnd(48)} ${loc.padEnd(7)} old[${String([...oldSub].length).padStart(3)}->${String([...oldOut].length).padStart(3)}${
      oldEndOk ? " " : "✗"
    }] new[${String([...neuSub].length).padStart(3)}->${String([...neuOut].length).padStart(3)}${neuEndOk ? " " : "✗"}${
      neuCut ? "CUT" : "   "
    }]${kind === "title" ? " total=" + ([...neuS].length + [...(suffix ?? "")].length) : ""}`,
  );
}

console.log("########## 字典层（" + CANDIDATES.length + " 条）##########");
console.log("PASS  key                                              loc     old[src->out ] new[src->out ]");
console.log("-".repeat(140));
for (const c of CANDIDATES) line(c.kind, c.key, c.loc, c.old, c.neu, c.suffix ?? "");

console.log("\n########## TS 内容层（" + TS_CANDIDATES.length + " 条）##########");
console.log("-".repeat(140));
for (const c of TS_CANDIDATES) line(c.kind, c.key, c.loc, c.old, c.neu, "");

console.log(`\n=== 汇总：PASS=${pass} FAIL=${fail} ===`);
if (fails.length) {
  console.log("失败明细：");
  for (const f of fails) console.log("  - " + f);
}
