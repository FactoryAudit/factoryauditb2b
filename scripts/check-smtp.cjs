#!/usr/bin/env node
/**
 * SMTP 自检（商业化命脉）
 * ------------------------------------------------------------
 * 作用：验证「客户提交询盘后，你能不能真的收到邮件」。
 * 用法：npm run check:smtp
 *
 * 它会：
 *   1. 读取 .env 的邮件配置
 *   2. 检测是否仍是 Ethereal 测试账号（收不到真实邮件，会明确报警）
 *   3. 测试 SMTP 连接 + 账号认证
 *   4. 真发一封测试邮件到 NOTIFY_ADMIN_EMAIL
 *   5. 用大白话报告问题原因和解决办法
 */
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

// ---- 读取 .env（独立脚本不会自动加载）----
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i === -1) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    // 去掉包裹的引号
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const HOST = env.SMTP_HOST;
const PORT = Number(env.SMTP_PORT || 587);
const USER = env.SMTP_USER;
const PASS = env.SMTP_PASS;
const TO = env.NOTIFY_ADMIN_EMAIL;
const FROM = env.FROM_EMAIL || USER;

const line = "=".repeat(58);
console.log(line);
console.log("  SMTP 自检 — 客户询盘能不能真的进你邮箱");
console.log(line);

// ---- 0) 必填项检查 ----
const missing = [];
if (!HOST) missing.push("SMTP_HOST");
if (!USER) missing.push("SMTP_USER");
if (!PASS) missing.push("SMTP_PASS");
if (!TO) missing.push("NOTIFY_ADMIN_EMAIL");
if (missing.length) {
  console.log("\n[FAIL] 缺少配置:", missing.join(", "));
  console.log("      → 复制 .env.example 为 .env 并补全邮件段（见 DEPLOY.md §4）\n");
  process.exit(1);
}

console.log(`\nSMTP 服务器 : ${HOST}:${PORT}`);
console.log(`发信账号    : ${USER}`);
console.log(`测试收件箱  : ${TO}`);

// ---- 1) 检测 Ethereal 测试账号（最常见坑）----
if (/ethereal/i.test(HOST) || /ethereal/i.test(USER || "")) {
  console.log("\n" + "!".repeat(58));
  console.log("[FAIL] 你用的还是 Ethereal —— 这是「开发测试假邮箱」！");
  console.log("       邮件不会真的送到任何人的收件箱，");
  console.log("       客户询盘等于石沉大海，你会白白丢单。");
  console.log("!".repeat(58));
  console.log("\n换成真实邮箱（以 QQ 邮箱为例，2 分钟搞定）：");
  console.log("  1. 登录 mail.qq.com → 设置 → 账户");
  console.log("  2. 找到「POP3/SMTP服务」→ 开启");
  console.log("  3. 按提示发短信验证，拿到一串「授权码」（不是登录密码！）");
  console.log("  4. 修改 .env：");
  console.log('       SMTP_HOST="smtp.qq.com"');
  console.log("       SMTP_PORT=465");
  console.log('       SMTP_USER="你的QQ号@qq.com"');
  console.log('       SMTP_PASS="刚才拿到的16位授权码"');
  console.log('       NOTIFY_ADMIN_EMAIL="你日常收信的邮箱"');
  console.log("\n  改完再跑一次：npm run check:smtp\n");
  process.exit(1);
}

// ---- 2) 连接 + 认证 + 发信 ----
(async () => {
  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465, // 465=SSL, 587=STARTTLS
    auth: { user: USER, pass: PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  console.log("\n[1/2] 正在连接并验证账号 ...");
  try {
    await transporter.verify();
    console.log("      [PASS] 连接成功，账号密码正确");
  } catch (e) {
    console.log(`      [FAIL] ${e.code || ""} ${e.message || e}`);
    console.log("\n  常见原因：");
    if (e.code === "EAUTH") {
      console.log("   · 账号或密码错了 → QQ/163 邮箱要用「授权码」，不是登录密码");
      console.log("   ·  Gmail 要用「应用专用密码」，且需开启两步验证");
    } else if (e.code === "ECONNECTION" || e.code === "ETIMEDOUT" || e.code === "ESOCKET") {
      console.log("   · 端口被防火墙/运营商拦截 → 试 465（SSL）或 587（STARTTLS）");
      console.log("   · 确认 SMTP_HOST 拼写正确（QQ: smtp.qq.com，Gmail: smtp.gmail.com）");
    } else {
      console.log("   · 把上面的错误信息发给技术顾问排查");
    }
    console.log("");
    process.exit(1);
  }

  console.log("[2/2] 正在发送测试邮件 ...");
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to: TO,
      subject: "[FactoryAuditB2B] 邮件配置自检 — 收到就说明配置成功",
      text: [
        "恭喜！这封邮件说明你的询盘通知已经打通。",
        "",
        "从现在起，客户在网站提交需求时：",
        "  · 你会收到这封邮箱的新线索通知",
        "  · 客户会收到一封「已收到」的确认邮件",
        "",
        `发信账号: ${USER}`,
        `SMTP: ${HOST}:${PORT}`,
      ].join("\n"),
    });
    console.log(`      [PASS] 已发送 (messageId: ${info.messageId})`);
    console.log("\n" + line);
    console.log("  全部通过！请去收件箱确认收到这封测试邮件。");
    console.log(`  收件箱: ${TO}`);
    console.log("  （没收到的话，先看垃圾邮件箱）");
    console.log(line + "\n");
  } catch (e) {
    console.log(`      [FAIL] ${e.code || ""} ${e.message || e}`);
    if (e.code === "EENVELOPE") {
      console.log("\n  原因：发件地址(FROM_EMAIL)与认证账号不匹配。");
      console.log("  → 把 FROM_EMAIL 改成和 SMTP_USER 一样的地址再试。");
    }
    console.log("");
    process.exit(1);
  }
})();
