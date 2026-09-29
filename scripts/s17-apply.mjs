// scripts/_s17_apply.mjs —— stage1.7 字典层替值（只改值，不增删键；强制保持纯 CRLF）
//
// 用法：node scripts/_s17_apply.mjs
//
// 护栏（任一不满足即 exit 1，不写盘）：
//   ① 旧值必须**恰好命中 1 次**（避免短串误伤其它 section）
//   ② 写回后必须仍是**纯 CRLF**（cs13 F1d 断言：bare LF 会假 FAIL）
//   ③ 叶子数 / 键集必须与替换前**完全一致**（只改值不增删键）
import fs from "node:fs";

const FILE = "i18n/dictionaries/zh-TW.json";

const OLD =
  "來自中國的化工原料：各自用途、買家需索取的文件，以及如何向已驗證供應商詢價。";
const NEW =
  "來自中國的化工原料：各品項的常見用途、買家下單前應索取的文件與許可證，以及如何向已驗證供應商詢價，並核對實際產能與交期。";

/** 递归收集所有「叶子路径」（与 cs 系列计数器的口径一致：数组元素也计入） */
function leaves(node, path = "", out = []) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out);
  } else {
    out.push(path);
  }
  return out;
}

const raw = fs.readFileSync(FILE, "utf8");
const hits = raw.split(OLD).length - 1;
if (hits !== 1) {
  console.error(`✗ 旧值命中 ${hits} 次（应为 1）—— 中止，未写盘。`);
  process.exit(1);
}

const before = JSON.parse(raw);
const beforeLeaves = leaves(before);

const next = raw.replace(OLD, NEW);
const after = JSON.parse(next);
const afterLeaves = leaves(after);

// ③ 键集/叶子数一致
if (afterLeaves.length !== beforeLeaves.length) {
  console.error(
    `✗ 叶子数变化 ${beforeLeaves.length} → ${afterLeaves.length}（违反了「只改值」）—— 中止，未写盘。`
  );
  process.exit(1);
}
const missing = beforeLeaves.filter((p) => !afterLeaves.includes(p));
if (missing.length) {
  console.error(`✗ 键集变化，丢失 ${missing.length} 个叶子（如 ${missing[0]}）—— 中止，未写盘。`);
  process.exit(1);
}

// ② 纯 CRLF 护栏
const crlf = (next.match(/\r\n/g) || []).length;
const bareLF = (next.match(/(?<!\r)\n/g) || []).length;
if (bareLF !== 0) {
  console.error(`✗ 写回后出现 ${bareLF} 处 bare LF（字典必须纯 CRLF）—— 中止，未写盘。`);
  process.exit(1);
}
const tailCRLF = next.endsWith("\r\n");
if (!tailCRLF) {
  console.error("✗ 文件末尾不是 CRLF —— 中止，未写盘。");
  process.exit(1);
}

fs.writeFileSync(FILE, next, "utf8");

console.log("✓ 字典替值完成（1 处）");
console.log(`  旧值长度 ${[...OLD].length} → 新值长度 ${[...NEW].length}`);
console.log(`  crlf=${crlf} bareLF=${bareLF} tailCRLF=${tailCRLF}`);
console.log(`  叶子数 ${beforeLeaves.length} → ${afterLeaves.length}（不变）`);
console.log(`  新值：${NEW}`);
