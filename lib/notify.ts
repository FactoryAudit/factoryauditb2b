// 邮件通知框架 —— 双通道：SMTP（本地开发）/ HTTP API（Cloudflare Workers）
// ⚠️ Cloudflare Workers 禁止 SMTP 出站（25/465/587 端口被平台拦截），
//    上线必须用 MAIL_PROVIDER=http（HTTP API 邮件服务，兼容 Resend 格式）。
// 环境变量：
//   MAIL_PROVIDER          "smtp"（默认，本地 Ethereal）| "http"（生产）
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS（smtp 模式）
//   MAIL_HTTP_URL          http 模式端点，默认 https://api.resend.com/emails
//   MAIL_HTTP_KEY          http 模式 API Key（如 Resend API Key）
//   NOTIFY_ADMIN_EMAIL     管理员收件邮箱，必填才会发
//   FROM_EMAIL             发件地址，默认 support@factoryauditb2b.com
import nodemailer from "nodemailer";

const mailProvider = (process.env.MAIL_PROVIDER || "smtp").toLowerCase();
const httpMailConfigured = Boolean(process.env.MAIL_HTTP_KEY);

const smtpConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter && smtpConfigured) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });
  }
  return transporter;
}

type NotifyInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// 发送单封邮件。邮件通道未配置时仅打日志并返回 false（不抛错）。
export async function sendMail({ to, subject, text, html }: NotifyInput): Promise<boolean> {
  if (mailProvider === "http") return sendMailHttp({ to, subject, text, html });
  return sendMailSmtp({ to, subject, text, html });
}

// —— SMTP 通道（本地开发 / 支持 SMTP 的 Node 环境） ——
async function sendMailSmtp({ to, subject, text, html }: NotifyInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.log(`[notify:degraded] to=${to} subject=${subject}`);
    return false;
  }
  try {
    const info = await t.sendMail({
      from: process.env.FROM_EMAIL || "support@factoryauditb2b.com",
      to,
      subject,
      text,
      html,
    });
    // Ethereal 测试账号会返回预览链接，便于本地验证；生产 SMTP 无该字段，不打印。
    const preview = (info as { preview?: string }).preview;
    if (preview) console.log("[notify] preview:", preview);
    return true;
  } catch (e) {
    console.error("[notify] send failed", e);
    return false;
  }
}

// —— HTTP API 通道（Cloudflare Workers 生产环境） ——
// 兼容 Resend API 格式：POST {MAIL_HTTP_URL}，Authorization: Bearer <key>
// 免费额度：Resend 100 封/天；SendGrid 等换 URL/格式即可（需同步改本函数）。
async function sendMailHttp({ to, subject, text, html }: NotifyInput): Promise<boolean> {
  const apiKey = process.env.MAIL_HTTP_KEY;
  const endpoint = process.env.MAIL_HTTP_URL || "https://api.resend.com/emails";
  if (!apiKey) {
    console.log(`[notify:degraded] MAIL_HTTP_KEY 未配置，跳过 to=${to}`);
    return false;
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "FactoryAuditB2B <support@factoryauditb2b.com>",
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) {
      console.error(`[notify] http mail failed ${res.status}`, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notify] http mail error", e);
    return false;
  }
}

// 管理员新线索通知
export async function notifyAdminNewLead(lead: {
  tool?: string | null;
  firstName?: string | null;
  email?: string | null;
  company?: string | null;
  country?: string | null;
  message?: string | null;
  score?: number | null;
  id: string;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过管理员通知");
    return false;
  }
  return sendMail({
    to: adminEmail,
    subject: `[FactoryAuditB2B] 新线索 ${lead.tool || "unknown"}`,
    text: [
      `来源: ${lead.tool || "unknown"}`,
      `姓名: ${lead.firstName || "—"}`,
      `邮箱: ${lead.email || "—"}`,
      `公司: ${lead.company || "—"}`,
      `国家: ${lead.country || "—"}`,
      `意向分: ${lead.score ?? "—"}/100`,
      lead.message ? `需求:\n${lead.message}` : "",
      `线索ID: ${lead.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

// 客户确认邮件
export async function notifyCustomerLeadReceived(lead: {
  email: string;
  firstName?: string | null;
  tool?: string | null;
}): Promise<boolean> {
  if (!lead.email) return false;
  return sendMail({
    to: lead.email,
    subject: "We received your request — FactoryAuditB2B",
    text: [
      `Hi ${lead.firstName || "there"},`,
      "",
      "We received your request and our team will get back to you within one business day.",
      `Reference: ${lead.tool || "lead"}`,
      "",
      "FactoryAuditB2B",
    ].join("\n"),
  });
}
