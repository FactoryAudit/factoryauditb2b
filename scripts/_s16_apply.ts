/**
 * stage1.6 应用器（路径感知版）：把 _s16_cand_data.ts 的 66 处 old→new 精确写入源码
 *
 *   字典层 53 处 → i18n/dictionaries/<loc>.json
 *     做法：先按「缩进栈」把整份 JSON 的**每个叶子路径 → 行号**建表，
 *     再按候选里的 JSON 路径（如 risk.page.metaTitle）定位到唯一那一行，
 *     比对当前值是否等于 old，只替换该行的值 ⇒ 不会误伤同名值（如 nav 文案）。
 *
 *   TS 内容层 13 处 → lib/caseStudies.ts / lib/fieldReports.ts / lib/industryContent.ts
 *     做法：整串精确替换，要求命中恰好 1 次。
 *
 * 用法：
 *   node scripts/run-regression.mjs _s16_apply --check   # 只体检，不写文件
 *   node scripts/run-regression.mjs _s16_apply --apply   # 写入
 */
import * as fs from "fs";
import * as path from "path";
import { CANDIDATES, TS_CANDIDATES } from "./_s16_cand_data";

const ROOT = path.resolve(__dirname, "..");
const MODE = process.argv.includes("--apply") ? "apply" : "check";

// ─────────────────────────────────────────────────────────────
// 字典：从原始文本建立「叶子路径 → 行号」索引
// ─────────────────────────────────────────────────────────────
type Leaf = { line: number; indent: string; keyRaw: string; valueRaw: string };

// 注意：字典里存在「数组对象」（如 home.howSteps[].title）⇒ 同一路径会有多行，
// 因此这里保留**全部**候选行，后面按「当前值 === 候选 old」来唯一确定目标行。
function indexLeaves(src: string): Map<string, Leaf[]> {
  const out = new Map<string, Leaf[]>();
  const lines = src.split(/\r?\n/);
  const stack: { indent: number; key: string }[] = [];
  const KEY_RE = /^(\s*)"((?:[^"\\]|\\.)*)"\s*:\s*(.*)$/;
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln];
    const m = line.match(KEY_RE);
    if (!m) {
      const cm = line.match(/^(\s*)[}\]]/);
      if (cm) {
        const ind = cm[1].length;
        while (stack.length && stack[stack.length - 1].indent >= ind) stack.pop();
      }
      continue;
    }
    const indent = m[1].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const key = JSON.parse(`"${m[2]}"`) as string;
    const val = m[3];
    if (val.startsWith("{") || val.startsWith("[")) {
      stack.push({ indent, key });
    } else {
      const p = stack.map((x) => x.key).concat(key).join(".");
      const arr = out.get(p) ?? [];
      arr.push({ line: ln, indent: m[1], keyRaw: m[2], valueRaw: val });
      out.set(p, arr);
    }
  }
  return out;
}

/** 从 `"xxx",` / `"xxx"` 这样的行尾片段里取出字符串值 */
function readStringToken(raw: string): string | null {
  const m = raw.match(/^"((?:[^"\\]|\\.)*)"\s*,?\s*$/);
  return m ? (JSON.parse(`"${m[1]}"`) as string) : null;
}

const esc = (s: string) => JSON.stringify(s);
const vis = (s: string) =>
  [...s]
    .map((c) => (c.codePointAt(0)! < 0x20 || (c.codePointAt(0)! >= 0x2000 && c.codePointAt(0)! <= 0x200f) || c === "\u00a0" ? `\\u${c.codePointAt(0)!.toString(16).padStart(4, "0")}` : c))
    .join("");

const fileCache = new Map<string, string>();
const lineCache = new Map<string, string[]>();
const read = (rel: string) => {
  if (!fileCache.has(rel)) fileCache.set(rel, fs.readFileSync(path.join(ROOT, rel), "utf8"));
  return fileCache.get(rel)!;
};
const linesOf = (rel: string) => {
  if (!lineCache.has(rel)) lineCache.set(rel, read(rel).split(/\r?\n/));
  return lineCache.get(rel)!;
};

// ─────────────────────────────────────────────────────────────
// 体检 / 应用
// ─────────────────────────────────────────────────────────────
const okList: string[] = [];
const alreadyList: string[] = [];
const failList: string[] = [];

// ---- 字典层 ----
const idxMemo = new Map<string, Map<string, Leaf[]>>();
for (const c of CANDIDATES) {
  const rel = path.join("i18n", "dictionaries", `${c.loc}.json`);
  if (!idxMemo.has(rel)) idxMemo.set(rel, indexLeaves(read(rel)));
  const idx = idxMemo.get(rel)!;
  const cands = idx.get(c.key);
  if (!cands || cands.length === 0) {
    failList.push(`[${c.loc}] ${c.key}：字典里找不到该路径`);
    continue;
  }
  const lines = linesOf(rel);
  // 同一路径可能命中多行（数组对象）⇒ 用「当前值」唯一确定
  const hitOld = cands.filter((l) => readStringToken(l.valueRaw) === c.old);
  const hitNew = cands.filter((l) => readStringToken(l.valueRaw) === c.neu);
  if (hitOld.length === 1) {
    const leaf = hitOld[0];
    const tail = leaf.valueRaw.trimEnd().endsWith(",") ? "," : "";
    lines[leaf.line] = `${leaf.indent}"${leaf.keyRaw}": ${esc(c.neu)}${tail}`;
    okList.push(`[${c.loc}] ${c.key}`);
  } else if (hitOld.length === 0 && hitNew.length >= 1) {
    alreadyList.push(`[${c.loc}] ${c.key}`);
  } else {
    const shown = cands
      .slice(0, 3)
      .map((l) => `第 ${l.line + 1} 行 = ${vis((readStringToken(l.valueRaw) ?? "<非字符串>").slice(0, 80))}`)
      .join("\n        ");
    failList.push(
      `[${c.loc}] ${c.key}：old 命中 ${hitOld.length} 次（要求 1）\n        old(候选) = ${vis(c.old.slice(0, 80))}\n        ${shown}`
    );
  }
}

// ---- TS 内容层 ----
const tsFileOf = (key: string): string => {
  if (key.startsWith("caseStudies/") || key === "CASE_LIST_META.zh") return path.join("lib", "caseStudies.ts");
  if (key.startsWith("fieldReports/") || key === "FIELD_REPORT_LIST_META.zh") return path.join("lib", "fieldReports.ts");
  if (key.startsWith("industry/")) return path.join("lib", "industryContent.ts");
  throw new Error(`未知 TS 候选键：${key}`);
};
const tsCache = new Map<string, string>();
const readTs = (rel: string) => {
  if (!tsCache.has(rel)) tsCache.set(rel, read(rel));
  return tsCache.get(rel)!;
};
for (const c of TS_CANDIDATES) {
  const rel = tsFileOf(c.key);
  const src = readTs(rel);
  const nOld = src.split(c.old).length - 1;
  const nNew = src.split(c.neu).length - 1;
  if (nOld === 1) {
    tsCache.set(rel, src.replace(c.old, c.neu));
    okList.push(`TS ${c.key} @ ${rel}`);
  } else if (nOld === 0 && nNew >= 1) {
    alreadyList.push(`TS ${c.key} @ ${rel}`);
  } else {
    failList.push(`TS ${c.key} @ ${rel}：old 命中 ${nOld} 次（要求 1）`);
  }
}

console.log(`### 模式：${MODE}`);
console.log(`### 待应用：${okList.length} 处｜幂等已存在：${alreadyList.length} 处｜失败：${failList.length} 处\n`);

if (failList.length) {
  console.log("---- 失败明细 ----");
  for (const f of failList) console.log("  ✗ " + f);
  console.log("\n### 未写任何文件 ###");
  process.exit(1);
}

if (MODE === "apply") {
  const dictFiles = [...new Set(CANDIDATES.map((c) => path.join("i18n", "dictionaries", `${c.loc}.json`)))];
  for (const rel of dictFiles) {
    const raw = read(rel);
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    // split 的结果已含末尾空串，join 回去即可精确保原（切勿再 push 空串）
    const body = linesOf(rel);
    fs.writeFileSync(path.join(ROOT, rel), body.join(eol), "utf8");
  }
  for (const rel of tsCache.keys()) fs.writeFileSync(path.join(ROOT, rel), tsCache.get(rel)!, "utf8");
  console.log("### 写入完成 ###");
  for (const rel of [...dictFiles, ...tsCache.keys()]) console.log("  ✔ " + rel);
} else {
  console.log("### --check 通过（未写文件）###");
}
