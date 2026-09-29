/**
 * scripts/_s17_probe.ts —— stage1.7 离线预演探针
 *
 * 用法：node scripts/run-regression.mjs _s17_probe
 *
 * 为什么可以离线预演：
 *   `trimMetaDescription` 只看**前 budget 个字符**，且返回的是源头的前缀。
 *   因此「对已收口产物（旧阈值下的结果，≤158）再按新阈值收口」与
 *   「对源头直接按新阈值收口」**结果等价**（新窗口 90 ⊂ 旧窗口 158，前缀相同）。
 *
 * 覆盖：
 *   A. 任务 1 —— 供应商详情页：新阈值下是否回落 ≤90、是否仍以句末标点收尾
 *   B. 任务 1b —— 行业分类页：是否仍判非 CJK 主导 ⇒ 长度保持 100–158
 *   C. 任务 2 —— /tools 与 /tools/supplier-verification-checklist 两页 9 语 title/desc
 *   D. 任务 3 —— chemicals.metaDesc zh-TW 是否落 60–90 且以句末标点收尾
 *   E. 全站 desc 普查 —— 新阈值下有多少页 desc 发生变化、是否产生半句话
 */
import fs from "node:fs";
import path from "node:path";
import { trimMetaDescription, trimMetaTitle, isCjkDominant } from "../lib/pageMeta";

const ROOT = process.cwd();
const APP = path.join(ROOT, ".next", "server", "app");
const DICT = path.join(ROOT, "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

const SENT = /[.。!！?？]/;
const CJK = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const CJK_G = new RegExp(CJK.source, "g");

let pass = 0;
let fail = 0;
const fails: string[] = [];
const ck = (cond: boolean, label: string) => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(label);
  }
};

// HTML 实体必须先解码，否则 &amp; 会虚增长度（假 FAIL）
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}
function metaOf(html: string, name: string): string | null {
  const m = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`));
  return m ? decode(m[1]) : null;
}
function walk(dir: string, out: string[] = []): string[] {
  let ents: fs.Dirent[];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}
const cjkPct = (s: string) => {
  const tot = [...s].length;
  return tot === 0 ? 0 : Math.round(((s.match(CJK_G) ?? []).length / tot) * 100);
};
const rel = (p: string) => path.relative(APP, p).replace(/\\/g, "/");

const all = walk(APP);
console.log(`扫描预渲染 HTML：${all.length} 个\n`);

// ───────────────────────── A. 供应商详情页（任务 1）─────────────────────────
console.log("########## A. 供应商详情页（任务 1：阈值 10%）##########");
const supp = all.filter((p) => /\/suppliers\/[^/]+\.html$/.test(rel(p)));
console.log(`文件数 ${supp.length}（期望 81 = 9 家 × 9 语）`);
let aChanged = 0;
let aCjkPages = 0;
const aOver: string[] = [];
for (const f of supp) {
  const html = fs.readFileSync(f, "utf8");
  const oldDesc = metaOf(html, "description");
  if (!oldDesc) continue;
  const newDesc = trimMetaDescription(oldDesc);
  const n = [...newDesc].length;
  const dom = isCjkDominant(oldDesc);
  if (dom) aCjkPages++;
  if (dom && newDesc !== oldDesc) aChanged++;
  // 断言只对**CJK 主导页**成立：非主导页走拉丁 158，本来就不在 90 预算内
  if (dom) {
    if (n > 90) aOver.push(`${rel(f)} [${n}] cjk=${cjkPct(oldDesc)}%`);
    ck(SENT.test(newDesc.slice(-1)), `${rel(f)} 收口后结尾非句末标点（半句话）：${newDesc.slice(-40)}`);
  }
}
console.log(`  CJK 主导页（新阈值下走 90 预算）：${aCjkPages} / ${supp.length}`);
console.log(`  其中 desc 发生变化：${aChanged} 页`);
ck(aOver.length === 0, `有 ${aOver.length} 个 CJK 主导供应商页收口后仍 >90`);
if (aOver.length) aOver.slice(0, 10).forEach((x) => console.log(`    ✗ ${x}`));
console.log(`  断言：CJK 主导页 ≤90 且结尾句末标点 ⇒ ${aOver.length === 0 ? "OK" : "FAIL"}\n`);

// ───────────────────────── B. 行业分类页（任务 1b）─────────────────────────
console.log("########## B. 行业分类页（须保持拉丁 158）##########");
const ind = all.filter((p) => /\/industry\/[^/]+\.html$/.test(rel(p)));
console.log(`文件数 ${ind.length}（期望 13 行业 × 9 语 = 117；其中 6 拉丁/阿语 + 3 CJK 语种）`);
let bUnchanged = 0;
let bWrong = 0;
for (const f of ind) {
  const html = fs.readFileSync(f, "utf8");
  const d = metaOf(html, "description");
  if (!d) continue;
  const n = [...d].length;
  const nd = trimMetaDescription(d);
  if (nd === d) bUnchanged++;
  // 拉丁/阿语种分类页应落在 100–158；CJK 语种按 90
  const loc = rel(f).split("/")[0];
  const latinish = ["en", "es", "de", "fr", "pt", "ar"].includes(loc);
  if (latinish && (n < 100 || n > 158)) {
    bWrong++;
    if (bWrong <= 8) console.log(`    ✗ ${rel(f)} [${n}] cjk=${cjkPct(d)}%`);
  }
}
console.log(`  新阈值下长度不变：${bUnchanged} / ${ind.length}`);
ck(bWrong === 0, `有 ${bWrong} 个拉丁/阿语种行业分类页不在 100–158`);
console.log(`  断言：拉丁/阿语种 100–158 ⇒ ${bWrong === 0 ? "OK" : "FAIL"}\n`);

// ───────────────────────── C. /tools 两页（任务 2）─────────────────────────
console.log("########## C. /tools 与 checklist（任务 2：9 语）##########");
type Dict = Record<string, any>;
const dicts: Record<string, Dict> = {};
for (const l of LOCALES) {
  dicts[l] = JSON.parse(fs.readFileSync(path.join(DICT, `${l}.json`), "utf8"));
}
const BRAND = "FactoryAuditB2B";
const CHECK_BRAND = "FactoryAuditB2B RiskScore™";

function simulate(l: string, path_: string, metaTitle: string, metaDesc: string, brandTail: string) {
  // 复刻 buildPageMetadata 的收口顺序（title 先拼品牌段，再 trim；desc 直接 trim）
  const rawTitle = metaTitle.includes(BRAND) ? metaTitle : `${metaTitle} | ${brandTail}`;
  const title = trimMetaTitle(rawTitle);
  const desc = trimMetaDescription(metaDesc);
  return { title, desc, titleLen: [...title].length, descLen: [...desc].length };
}

for (const [label, get] of [
  ["/tools", (l: string) => [dicts[l].toolsIndex.metaTitle, dicts[l].toolsIndex.metaDesc] as const],
  [
    "/tools/supplier-verification-checklist",
    (l: string) => [dicts[l].checklist.page.metaTitle, dicts[l].checklist.page.metaDesc] as const,
  ],
] as const) {
  console.log(`  --- ${label} ---`);
  console.log("    loc   title(合成)  desc(收口)  descEndOk  源desc");
  for (const l of LOCALES) {
    const [mt, md] = get(l);
    const tail = label === "/tools" ? BRAND : CHECK_BRAND;
    const r = simulate(l, label, mt, md, tail);
    const endOk = SENT.test(r.desc.slice(-1));
    const srcLen = [...md].length;
    console.log(
      `    ${l.padEnd(6)} ${String(r.titleLen).padStart(4)}      ${String(r.descLen).padStart(4)}      ${endOk ? "✓" : "✗"}        ${srcLen}`,
    );
    ck(endOk, `${label} [${l}] desc 收口后结尾非句末标点`);
    // 验收 #3：/tools es desc ≤158（checklist 同口径）
    const cap = isCjkDominant(md) ? 90 : 158;
    ck(r.descLen <= cap, `${label} [${l}] desc 收口后 ${r.descLen} > 预算 ${cap}`);
  }
  console.log("");
}

// ───────────────────────── D. chemicals zh-TW（任务 3）─────────────────────
console.log("########## D. chemicals.metaDesc（任务 3）##########");
{
  const tw = dicts["zh-TW"].chemicals.metaDesc as string;
  const n = [...tw].length;
  const dominant = isCjkDominant(tw);
  const out = trimMetaDescription(tw);
  const endOk = SENT.test(out.slice(-1));
  console.log(`  zh-TW 长度 ${n}｜CJK 主导 ${dominant}｜收口后 ${[...out].length}｜endOk ${endOk}`);
  ck(dominant && n >= 60 && n <= 90, `chemicals zh-TW 不在 60–90 或未被判 CJK 主导（${n}）`);
  ck(out === tw, "chemicals zh-TW 被收口改动（应幂等）");
  ck(endOk, "chemicals zh-TW 结尾非句末标点");
  const zh = dicts["zh"].chemicals.metaDesc as string;
  console.log(`  对照 zh：长度 ${[...zh].length}\n`);
}

// ───────────────────────── E. 全站 desc 普查 ─────────────────────────
// ─── 旧阈值（25%）复刻：用于把「阈值引起的变化」与「本就未收口」精确分离 ───
const OLD_RATIO = 0.25;
const SENT_RE = /[.。!！?？]/;
const DANGLING = /[\s,;:，、；：\-–—]+$/u;
const TITLE_SEP = /[|｜—–·:：/／]/;
const isCjkOld = (text: string) => {
  if (!text) return false;
  const tot = [...text].length;
  if (!tot) return false;
  return (text.match(CJK_G) ?? []).length / tot > OLD_RATIO;
};
function trimDescOld(text: string): string {
  const budget = isCjkOld(text) ? 90 : 158;
  const chars = [...text];
  if (chars.length <= budget) return text;
  const head = chars.slice(0, budget).join("");
  for (let i = head.length - 1; i >= 0; i--) {
    if (SENT_RE.test(head[i])) return head.slice(0, i + 1).trim();
  }
  const sp = head.lastIndexOf(" ");
  return (sp > 0 ? head.slice(0, sp) : head).replace(DANGLING, "").trim();
}
function trimTitleOld(text: string): string {
  if (!text) return text;
  let body = text;
  let tail = "";
  const brandAt = text.indexOf("FactoryAuditB2B");
  if (brandAt > 0) {
    const before = text.slice(0, brandAt);
    const cands = [" | ", " — ", " – ", " · ", "|", "—", "–"]
      .map((s) => before.lastIndexOf(s))
      .filter((i) => i >= 0);
    const cut = cands.length ? Math.max(...cands) : brandAt;
    body = text.slice(0, cut);
    tail = text.slice(cut);
  }
  const budget = isCjkOld(body) ? 36 : 65;
  const chars = [...body];
  if (chars.length <= budget) return text;
  const head = chars.slice(0, budget).join("");
  const minKeep = Math.max(12, Math.floor(budget * 0.35));
  for (let i = head.length - 1; i >= 0; i--) {
    if (TITLE_SEP.test(head[i]) && i >= minKeep) {
      return head.slice(0, i).replace(DANGLING, "").trim() + tail;
    }
  }
  const sp = head.lastIndexOf(" ");
  const trimmed = (sp >= minKeep ? head.slice(0, sp) : head).replace(DANGLING, "").trim();
  if ([...trimmed].length < Math.min(12, minKeep)) return text;
  return trimmed + tail;
}

console.log("########## E. 全站 desc 普查 ##########");
let eTotal = 0;
let eByThreshold = 0;
let eByNoCollect = 0;
let eBad = 0;
const eThr: string[] = [];
const eOther: string[] = [];
for (const f of all) {
  const html = fs.readFileSync(f, "utf8");
  const d = metaOf(html, "description");
  if (!d) continue;
  eTotal++;
  const nd = trimMetaDescription(d);
  const od = trimDescOld(d);
  if (nd !== od) {
    eByThreshold++;
    eThr.push(
      `      ${rel(f).padEnd(52)} ${String([...d].length).padStart(3)} 旧→${String([...od].length).padStart(3)} 新→${String([...nd].length).padStart(3)}  cjk=${cjkPct(d)}%`,
    );
  } else if (nd !== d) {
    eByNoCollect++;
    if (eOther.length < 40)
      eOther.push(
        `      ${rel(f).padEnd(52)} ${String([...d].length).padStart(3)} → ${String([...nd].length).padStart(3)}  cjk=${cjkPct(d)}%`,
      );
  }
  if (!SENT.test(nd.slice(-1))) {
    eBad++;
    if (eBad <= 6) console.log(`    ✗ 半句话 ${rel(f)} :: ${nd.slice(-50)}`);
  }
}
console.log(`  有 desc 的页面：${eTotal}`);
console.log(`  ① 由【阈值下调】引起：${eByThreshold} 页`);
if (eThr.length) console.log(eThr.join("\n"));
console.log(`  ② 由【本就未收口】引起（与本批阈值无关）：${eByNoCollect} 页`);
if (eOther.length) console.log(eOther.join("\n"));
ck(eBad === 0, `全站有 ${eBad} 页 desc 收口后结尾无句末标点`);
console.log(`  断言：无新增半句话 ⇒ ${eBad === 0 ? "OK" : "FAIL"}\n`);

// ───────────────────────── F. title 全站对比 ─────────────────────────
console.log("########## F. title：阈值下调的额外裁剪 ##########");
let fByThreshold = 0;
let fByBudget = 0;
const fThr: string[] = [];
for (const file of all) {
  const html = fs.readFileSync(file, "utf8");
  const m = html.match(/<title>([^<]*)<\/title>/);
  if (!m) continue;
  const t = decode(m[1]);
  const nt = trimMetaTitle(t);
  const ot = trimTitleOld(t);
  if (nt !== ot) {
    fByThreshold++;
    if (fThr.length < 40)
      fThr.push(
        `      ${rel(file).padEnd(52)} ${String([...t].length).padStart(3)} 旧→${String([...ot].length).padStart(3)} 新→${String([...nt].length).padStart(3)}  body_cjk=${cjkPct(t)}%`,
      );
  } else if (nt !== t) fByBudget++;
}
console.log(`  ① 由【阈值下调】引起的额外裁剪：${fByThreshold} 页`);
if (fThr.length) console.log(fThr.join("\n"));
console.log(`  ② 本就超 65/36 预算而裁剪（与阈值无关）：${fByBudget} 页\n`);

// ───────────────────────── SELFTEST ─────────────────────────
{
  const t: Array<[string, boolean, boolean]> = [];
  const tck = (label: string, exp: boolean, act: boolean) => t.push([label, exp, act]);
  const mk = (cjkChars: number, latinChars: number) => "汉".repeat(cjkChars) + "a".repeat(latinChars);
  // 9% 占比 ⇒ 非主导（走 158）；11% ⇒ 主导（走 90）
  tck("9% 占比 ⇒ 非 CJK 主导", false, isCjkDominant(mk(9, 91)));
  tck("11% 占比 ⇒ CJK 主导", true, isCjkDominant(mk(11, 89)));
  tck("行业页 3% ⇒ 非主导", false, isCjkDominant(mk(3, 97)));
  tck("供应商页 20% ⇒ 主导", true, isCjkDominant(mk(20, 80)));
  // 端到端：超预算拉丁串必被收口（证明断言非恒真）
  const long = "Word ".repeat(60);
  tck("超预算拉丁串必被收口", false, trimMetaDescription(long) === long);

  const bad = t.filter(([, e, a]) => e !== a);
  console.log("########## SELFTEST ##########");
  for (const [l, e, a] of t) console.log(`  ${e === a ? "ok  " : "BAD "} ${l}（期望 ${e}／实际 ${a}）`);
  if (bad.length) {
    fail += bad.length;
    console.log(`SELFTEST FAILED: ${bad.length}`);
  } else {
    console.log("SELFTEST ALL OK（阈值边界 9%/11% + 行业 3% + 供应商 20% + 端到端收口）");
  }
}

console.log(`\n=== 汇总：断言 PASS=${pass} FAIL=${fail}（明细 ${fails.length}）===`);
if (fails.length) {
  console.log("失败明细（前 20）：");
  for (const f of fails.slice(0, 20)) console.log("  - " + f);
}
