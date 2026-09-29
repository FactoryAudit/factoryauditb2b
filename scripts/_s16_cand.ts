/**
 * stage1.6 候选测量：逐条打印 旧 → 新（源头长度 / 收口后长度 / endOk / CUT / CJK 占比）
 * 用法：node scripts/run-regression.mjs _s16_cand
 *
 * 口径（用户验收）：
 *   拉丁 desc 120–158｜CJK desc 60–90｜title 合成 50–60（含 suffix）
 *   幂等 = 收口后 === 源头（零截断）；结尾须句末标点
 */
import { trimMetaDescription, trimMetaTitle, isCjkDominant } from "../lib/pageMeta";
import { CANDIDATES, TS_CANDIDATES } from "./_s16_cand_data";

const SENT = /[.。!！?？]/;
const CJK = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const CJK_G = new RegExp(CJK.source, "g");
const WORST_COUNTRY = "Philippines";
const WORST_INDUSTRY = "Food & Beverage / 食品饮料";
const subst = (s: string) => s.replaceAll("{country}", WORST_COUNTRY).replaceAll("{industry}", WORST_INDUSTRY);

// —— 带宽常量（单一事实源，与验收口径一致）——
const LATIN_MIN = 120;
const LATIN_MAX = 158;
const CJK_MIN = 60;
const CJK_MAX = 90;
const TITLE_MIN = 50;
const TITLE_MAX = 60;

const bandLatin = (w: number) => w >= LATIN_MIN && w <= LATIN_MAX;
const bandCjk = (n: number) => n >= CJK_MIN && n <= CJK_MAX;
const bandTitle = (n: number) => n >= TITLE_MIN && n <= TITLE_MAX;

function width(s: string) {
  // CJK 按 2 计（SERP 半角宽），用于目标区间的可比口径
  return [...s].reduce((a, c) => a + (CJK.test(c) ? 2 : 1), 0);
}
function cjkPct(s: string) {
  const tot = [...s].length;
  if (!tot) return 0;
  return Math.round(((s.match(CJK_G) ?? []).length / tot) * 100);
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
  const pct = cjkPct(neuSub);

  let bandOk: boolean;
  if (kind === "title") {
    const full = neuS + (suffix ?? "");
    const tw = trimMetaTitle(full);
    const total = [...full].length;
    bandOk = bandTitle(total) && tw === full;
    if (!bandOk) {
      fail++;
      fails.push(`${key}[${loc}] title total=${total} trim=${tw === full ? "unchanged" : "CHANGED"}`);
    }
  } else {
    const isCjkBudget = isCjkDominant(neuSub);
    const w = isCjkBudget ? [...neuSub].length : width(neuSub);
    bandOk = isCjkBudget ? bandCjk(w) : bandLatin(w);
    if (!bandOk) {
      fail++;
      fails.push(
        `${key}[${loc}] desc len=${[...neuSub].length} (width ${w}) budget=${isCjkBudget ? 90 : 158} cjk=${pct}%`,
      );
    }
  }
  // title 不要求句末标点、也不参与 desc 收口
  const ok = kind === "title" ? bandOk : bandOk && neuEndOk && !neuCut;
  if (ok) pass++;
  else if (bandOk) {
    fail++;
    fails.push(`${key}[${loc}] endOk=${neuEndOk} CUT=${neuCut}`);
  }

  const tag = ok ? "PASS" : "**FAIL**";
  console.log(
    `${tag}  ${key.padEnd(48)} ${loc.padEnd(7)} old[${String([...oldSub].length).padStart(3)}->${String([...oldOut].length).padStart(3)}${
      oldEndOk ? " " : "✗"
    }] new[${String([...neuSub].length).padStart(3)}->${String([...neuOut].length).padStart(3)}${neuEndOk ? " " : "✗"}${
      neuCut ? "CUT" : "   "
    }]${kind === "title" ? " total=" + ([...neuS].length + [...(suffix ?? "")].length) : " cjk=" + String(pct).padStart(2) + "%"}`,
  );
}

console.log("########## 字典层（" + CANDIDATES.length + " 条）##########");
console.log("PASS  key                                              loc     old[src->out ] new[src->out ]  (desc 另示 CJK 占比)");
console.log("-".repeat(140));
for (const c of CANDIDATES) line(c.kind, c.key, c.loc, c.old, c.neu, c.suffix ?? "");

console.log("\n########## TS 内容层（" + TS_CANDIDATES.length + " 条）##########");
console.log("-".repeat(140));
for (const c of TS_CANDIDATES) line(c.kind, c.key, c.loc, c.old, c.neu, "");

// —— SELFTEST：确认断言在「不合规输入」上会 FAIL（防恒真假 PASS）——
{
  const t: Array<[string, boolean, boolean]> = [];
  const ck = (label: string, expected: boolean, actual: boolean) => t.push([label, expected, actual]);

  ck("latin 119 应不达标", false, bandLatin(119));
  ck("latin 120 应达标", true, bandLatin(120));
  ck("latin 158 应达标", true, bandLatin(158));
  ck("latin 159 应不达标", false, bandLatin(159));
  ck("cjk 59 应不达标", false, bandCjk(59));
  ck("cjk 60 应达标", true, bandCjk(60));
  ck("cjk 90 应达标", true, bandCjk(90));
  ck("cjk 91 应不达标", false, bandCjk(91));
  ck("title 49 应不达标", false, bandTitle(49));
  ck("title 50 应达标", true, bandTitle(50));
  ck("title 60 应达标", true, bandTitle(60));
  ck("title 61 应不达标", false, bandTitle(61));

  // 端到端：源头「首句过短 + 长尾巴」应被收口器砍成短句 ⇒ 探测器须判不达标
  const trap = "Short sentence here. " + "x".repeat(200);
  ck(
    "首句过短被砍 ⇒ 须判不达标",
    false,
    bandLatin(width(trimMetaDescription(trap))) && trimMetaDescription(trap) === trap,
  );
  // CJK 占比判定：拉丁文案 + 双语行业名 ⇒ 非 CJK 主导（这是本批改造的核心）
  ck(
    "拉丁+双语行业名 ⇒ 非 CJK 主导",
    false,
    isCjkDominant("Supplier verification for Food & Beverage / 食品饮料 across China."),
  );
  ck(
    "纯中文 ⇒ CJK 主导",
    true,
    isCjkDominant("面向中国出口市场的供应商核验与验厂服务，覆盖注册、场地、证书与公开记录核查。"),
  );

  const bad = t.filter(([, e, a]) => e !== a);
  console.log("\n########## SELFTEST（证明断言非恒真）##########");
  for (const [label, e, a] of t) console.log(`  ${e === a ? "ok  " : "BAD "} ${label}（期望 ${e}／实际 ${a}）`);
  if (bad.length) {
    fail += bad.length;
    console.log(`SELFTEST FAILED: ${bad.length} 项`);
  } else {
    console.log("SELFTEST ALL OK（12 条边界 + 1 条端到端 + 2 条 CJK 判定）");
  }
}

console.log(`\n=== 汇总：PASS=${pass} FAIL=${fail} ===`);
if (fails.length) {
  console.log("失败明细：");
  for (const f of fails) console.log("  - " + f);
}
