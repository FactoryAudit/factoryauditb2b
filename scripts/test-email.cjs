const nodemailer = require("nodemailer");
const fs = require("fs");
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 生产守卫（2026-09-30 加）
// 本脚本第 2 步会删掉 .env 里的 NOTIFY_ADMIN_EMAIL / FROM_EMAIL 真值，并写入一次性
// Ethereal 假账号 ⇒ **生产邮件配置会被冲掉**。现在生产通道是 Resend HTTP API
// （Workers 禁 SMTP），已不需要 SMTP 假账号，因此：检测到 Resend 已配置就拒跑。
// 确实要做纯 SMTP 实验：先备份 .env，再加 --force。
// ─────────────────────────────────────────────────────────────────────────────
function readEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i === -1) continue;
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return out;
}

if (!process.argv.includes("--force")) {
  const _env = readEnvFile(".env");
  const _httpMail = (_env.MAIL_PROVIDER || "").toLowerCase() === "http" || !!_env.MAIL_HTTP_KEY;
  if (_httpMail) {
    console.error("");
    console.error("⛔ 已中止：检测到生产邮件通道（Resend HTTP）已配置。");
    console.error("   本脚本会删掉 .env 的 NOTIFY_ADMIN_EMAIL / FROM_EMAIL 真值，");
    console.error("   并换成一次性 Ethereal 假账号 —— 生产配置会被冲掉。");
    console.error("");
    console.error("   生产通道请改用（不需要 SMTP）：");
    console.error("     · 端点/Key：GET https://api.resend.com/domains  → 200 + status=verified");
    console.error("     · 投递回执：GET https://api.resend.com/emails   → 看 last_event");
    console.error("     · 真发一封：POST https://api.resend.com/emails");
    console.error("   详见技能 mail-channel-live-verification。");
    console.error("");
    console.error("   确实要做纯 SMTP 实验：先备份 .env，再加 --force 重跑。");
    console.error("");
    process.exit(1);
  }
}

(async () => {
  // 1) 创建 Ethereal 测试账号（仅用于本地验证 SMTP 发送链路）
  const testAccount = await nodemailer.createTestAccount();
  console.log("Ethereal user:", testAccount.user);
  console.log("Ethereal pass:", testAccount.pass);

  // 2) 把 SMTP 配置写入 .env（开发期测试用，上线请改为真实 SMTP）
  const envPath = ".env";
  let env = fs.readFileSync(envPath, "utf8");
  env = env.replace(/#?SMTP_HOST=.*\n?/g, "");
  env = env.replace(/#?SMTP_PORT=.*\n?/g, "");
  env = env.replace(/#?SMTP_USER=.*\n?/g, "");
  env = env.replace(/#?SMTP_PASS=.*\n?/g, "");
  env = env.replace(/#?NOTIFY_ADMIN_EMAIL=.*\n?/g, "");
  env = env.replace(/#?FROM_EMAIL=.*\n?/g, "");
  const block = `
# ---- 邮件通知 (SMTP) ----
# 本地测试用 Ethereal 账号（上线请替换为真实 SMTP，见 .env.example）
SMTP_HOST="${testAccount.smtp.host}"
SMTP_PORT=${testAccount.smtp.port}
SMTP_USER="${testAccount.user}"
SMTP_PASS="${testAccount.pass}"
NOTIFY_ADMIN_EMAIL="admin@factoryauditb2b.com"
FROM_EMAIL="support@factoryauditb2b.com"
`;
  env += block;
  fs.writeFileSync(envPath, env, "utf8");
  console.log("已写入 .env SMTP 段");

  // 3) 直接发一封管理员通知，验证发送链路
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  const info = await transporter.sendMail({
    from: "support@factoryauditb2b.com",
    to: "admin@factoryauditb2b.com",
    subject: "[FactoryAuditB2B] 新线索 audit-request (SMTP 链路测试)",
    text: [
      "来源: audit-request",
      "姓名: Test Buyer",
      "邮箱: test@example.com",
      "公司: Test Co",
      "国家: Germany",
      "意向分: 70/100",
      "需求:",
      "SMTP 发送链路验证成功。",
    ].join("\n"),
  });
  console.log("发送结果 messageId:", info.messageId);
  console.log("预览链接:", nodemailer.getTestMessageUrl(info));
})();
