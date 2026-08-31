const nodemailer = require("nodemailer");
const fs = require("fs");

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
