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
import { MEMBERSHIP_PRICE_USD } from "./suppliers";

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

// —— Supplier Network V1.0：供应商入驻双邮件 ——

// 管理员通知：结构化文本，可直接粘贴进 Google Sheets（Supplier Master Sheet）
export async function notifyAdminSupplierRegistration(data: {
  id: string;
  fields: Record<string, string>;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过供应商入驻通知");
    return false;
  }
  const f = data.fields;
  const line = (label: string, val?: string) =>
    val ? `${label}: ${val}` : null;
  const body = [
    `Supplier ID: ${data.id}`,
    "",
    "— Company Information —",
    line("Company Name", f.companyName),
    line("English Name", f.englishName),
    line("Company Type", f.companyType),
    line("Registration Number", f.registrationNumber),
    line("Established", f.establishedYear),
    line("Website", f.website),
    "",
    "— Factory Information —",
    line("Country", f.factoryCountry),
    line("City", f.factoryCity),
    line("Address", f.factoryAddress),
    line("Employees", f.employees),
    line("Factory Size", f.factorySize),
    "",
    "— Products & Capability —",
    line("Main Products", f.mainProducts),
    line("Production Capacity", f.productionCapacity),
    line("Monthly Output", f.monthlyOutput),
    "",
    "— Export —",
    line("Export Markets", f.exportMarkets),
    line("Exporting Since", f.exportSince),
    "",
    "— Certificates —",
    line("Certificates", f.certificates),
    "",
    "— Contact —",
    line("Contact Person", f.contactName),
    line("Email", f.contactEmail),
    line("Phone", f.contactPhone),
    line("WhatsApp", f.contactWhatsapp),
    "",
    "— Availability —",
    line("Audit Availability", f.auditAvailability),
    line("Inspection Availability", f.inspectionAvailability),
    "",
    "— Authorization —",
    line("Authorize Company Profile", f.authorizeCompanyProfile),
    line("Contact Visibility", f.contactVisibility),
    line("Message", f.message),
    "",
    "Next steps: 1) completeness check  2) document consistency  3) evidence level  4) risk score  5) status decision. Record in Supplier Master Sheet.",
    "Reminder: risk score is informational only, not certification. Evidence below 'Independently Verified' must not be shown as verified.",
  ]
    .filter(Boolean)
    .join("\n");
  return sendMail({
    to: adminEmail,
    subject: `[FactoryAuditB2B] New Supplier Registration ${data.id}`,
    text: body,
  });
}

// 供应商回执：Reference ID + 审核周期 + 不承诺保证
export async function notifySupplierReceived(data: {
  email: string;
  companyName?: string | null;
  id: string;
}): Promise<boolean> {
  if (!data.email) return false;
  return sendMail({
    to: data.email,
    subject: "We received your supplier application — FactoryAuditB2B",
    text: [
      `Hi${data.companyName ? ` ${data.companyName}` : ""},`,
      "",
      "We received your application to join the FactoryAuditB2B Supplier Network.",
      `Reference ID: ${data.id}`,
      "",
      "Our team reviews every application manually. We will reply within one business day.",
      "Joining the network is free. Being listed does not imply certification or guarantee of orders.",
      "",
      "FactoryAuditB2B",
    ].join("\n"),
  });
}

// ---------- Supplier Directory V2：Free Account 注册 ----------

// 管理员：新买家注册通知
export async function notifyAdminBuyerRegister(data: {
  id: string;
  fields: Record<string, string>;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过买家注册通知");
    return false;
  }
  const f = data.fields;
  return sendMail({
    to: adminEmail,
    subject: `[FactoryAuditB2B] New Free Account Sign-up ${data.id}`,
    text: [
      `Account ID: ${data.id}`,
      "",
      "— Free Account Registration —",
      `Email: ${f.email ?? ""}`,
      `Name: ${f.name ?? ""}`,
      `Company: ${f.company ?? ""}`,
      "",
      "Next steps: create the account in the admin system, confirm the email domain, then reply to the buyer with sign-in instructions.",
    ].join("\n"),
  });
}

// 买家回执：Reference ID + 审核周期 + 真实可用功能说明
// 2026-09-03 修订：去掉「手动建号 + 发登录信息」空承诺（V2.0 无登录系统），
// 改为与其他表单一致：收到 → 人工回复一个工作日；说明目录实际全开放。
export async function notifyBuyerRegisterReceived(data: {
  email: string;
  name?: string | null;
  id: string;
}): Promise<boolean> {
  if (!data.email) return false;
  return sendMail({
    to: data.email,
    subject: "We received your request — FactoryAuditB2B",
    text: [
      `Hi${data.name ? ` ${data.name}` : ""},`,
      "",
      "We received your request for the Supplier Intelligence Directory.",
      `Reference ID: ${data.id}`,
      "",
      "Our team reviews requests manually and will reply within one business day.",
      "The full supplier directory is free to browse on factoryauditb2b.com — no account is required to view profiles.",
      `If you want Founding Buyer benefits ($${MEMBERSHIP_PRICE_USD}/year), reply to this email and we'll get you set up. Online payment is not open yet.`,
      "",
      "FactoryAuditB2B",
    ].join("\n"),
  });
}

// ---------- Supplier Directory V2：Supplier Claim Profile ----------

// 管理员：新认领提交
export async function notifyAdminSupplierClaim(data: {
  id: string;
  slug: string;
  supplierName: string;
  fields: Record<string, string>;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过供应商认领通知");
    return false;
  }
  const f = data.fields;
  return sendMail({
    to: adminEmail,
    subject: `[FactoryAuditB2B] Supplier Claim ${data.slug} (${data.id})`,
    text: [
      `Claim ID: ${data.id}`,
      `Supplier: ${data.supplierName} (${data.slug})`,
      "",
      "— Claimant —",
      `Company Email: ${f.companyEmail ?? ""}`,
      `Contact Name: ${f.contactName ?? ""}`,
      `Company Name: ${f.companyName ?? ""}`,
      `Authorized: ${f.authorization === "yes" ? "Yes" : "No"}`,
      "",
      "— Supporting Information —",
      `Note: ${f.supportNote ?? ""}`,
      "",
      "Next steps: verify the company email domain matches the supplier, check authorization, then either grant the claim or reply to the claimant. Verification results are never sold; payment does not guarantee a positive outcome.",
    ].join("\n"),
  });
}

// 认领回执：Reference ID + 审核周期 + 不承诺保证
export async function notifyClaimReceived(data: {
  email: string;
  companyName?: string | null;
  id: string;
  slug: string;
}): Promise<boolean> {
  if (!data.email) return false;
  return sendMail({
    to: data.email,
    subject: "We received your profile claim — FactoryAuditB2B",
    text: [
      `Hi${data.companyName ? ` ${data.companyName}` : ""},`,
      "",
      `We received your claim request for ${data.slug}.`,
      `Reference ID: ${data.id}`,
      "",
      "Our team verifies every claim manually and will reply within one business day.",
      "Please note: claiming a profile does not change its risk score or verification status, and payment does not guarantee a positive verification result.",
      "",
      "FactoryAuditB2B",
    ].join("\n"),
  });
}
