// Windows fs.cpSync 静默失败补丁（Node 22 + Windows，Node issue 59168 相关）
// 用法：node _patch-opennext.cjs
const fs = require("fs");
const path = require("path");

const FILES = [
  "node_modules/@opennextjs/aws/dist/build/helper.js",
  "node_modules/@opennextjs/aws/dist/build/createAssets.js",
  "node_modules/@opennextjs/aws/dist/build/installDeps.js",
  "node_modules/@opennextjs/cloudflare/dist/cli/build/utils/copy-package-cli-files.js",
];

const FN_DEF = `function copyDirContentsSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirContentsSync(s, d);
    else fs.copyFileSync(s, d);
  }
}
`;

function findCallEnd(s, startIdx) {
  // startIdx 指向 '(' 的位置，返回配对 ')' 之后的下标
  let depth = 0;
  for (let i = startIdx; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

let anyChange = false;
for (const rel of FILES) {
  const file = path.join(process.cwd(), rel);
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  const re = /fs\.cpSync\(/g;
  let m;
  let last = 0;
  let out = "";
  let count = 0;
  while ((m = re.exec(s)) !== null) {
    const callStart = m.index;
    const parenIdx = m.index + "fs.cpSync".length; // '(' 位置
    const callEnd = findCallEnd(s, parenIdx);
    if (callEnd === -1) {
      console.log(`[SKIP] ${rel}: 括号不配对`);
      break;
    }
    out += s.slice(last, callStart);
    out += "copyDirContentsSync(";
    out += s.slice(parenIdx + 1, callEnd - 1);
    out += ")";
    last = callEnd;
    count++;
  }
  if (count > 0) {
    out += s.slice(last);
    s = out;
    // 注入函数定义（在最后一个 import 语句之后）
    const importRe = /(^import .*?;\n)/m;
    // 找最后一个 import 行
    const lines = s.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImport = i;
    }
    if (lastImport !== -1) {
      lines.splice(lastImport + 1, 0, "\n" + FN_DEF.trimEnd());
      s = lines.join("\n");
    } else {
      s = FN_DEF + "\n" + s;
    }
    fs.writeFileSync(file, s);
    anyChange = true;
    console.log(`[PATCHED] ${rel}: ${count} 处 cpSync 替换`);
  } else {
    console.log(`[NO-CHANGE] ${rel}: 无 cpSync 调用`);
  }
}
console.log(anyChange ? "补丁完成。" : "无需补丁。");
