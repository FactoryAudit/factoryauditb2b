// STEP 12 —— 提交 + 复核（本机 Windows git 有「假成功」历史：必须复核 ref 真落盘）
const { execSync } = require("node:child_process");
const { writeFileSync } = require("node:fs");

const out = [];
function run(cmd) {
  try {
    const s = execSync(cmd, { encoding: "utf8", maxBuffer: 1024 * 1024 * 16 });
    out.push("$ " + cmd + "\n" + (s || "").trim());
    return s || "";
  } catch (e) {
    out.push("$ " + cmd + "\n[ERROR] " + (e.stdout || "") + (e.stderr || ""));
    return "";
  }
}

// 只提交已 staged 的内容（本轮改动），不 -A，避免把构建产物/临时文件卷进来
run('git commit -F .git-msg-step12.txt');
const head = run("git rev-parse HEAD").trim();
const log = run("git log --oneline -3");
const short = run("git rev-parse --short HEAD").trim();

// 复核：分支 ref 是否真的指向该 commit（防「假成功」）
const refOk = run("git log -1 --format=%H").trim() === head;
const status = run("git status --porcelain=v1 --untracked-files=no");

out.push("\n=== 复核 ===");
out.push("HEAD = " + head);
out.push("short = " + short);
out.push("ref 落盘一致 = " + refOk);
out.push("剩余未提交(已跟踪文件改动) = " + (status.trim() ? "有" : "无"));

writeFileSync("step12-commit-result.txt", out.join("\n"), "utf8");
console.log(out.join("\n"));
