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
      from: process.env.FROM_EMAIL || "hello@factoryauditb2b.com",
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
        from: process.env.FROM_EMAIL || "FactoryAuditB2B <hello@factoryauditb2b.com>",
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

/**
 * RFQ 询价确认邮件（发给客户）
 *
 * 为什么单独写一封而不是复用 notifyCustomerLeadReceived：
 *   RFQ 是本站转化主线。客户拿到 **RFQ 编号** 才能后续对账、追问进度；
 *   同时要回显他填的产品，让他当场确认"我们收到的是对的"。
 *   通用线索确认邮件两样都做不到。
 *
 * 措辞约束（避免无据声称）：
 *   只承诺"一个工作日内回复"，与全站其他确认邮件口径一致，不承诺具体交付物或时效保证。
 */
export async function notifyCustomerRfqReceived(rfq: {
  email: string;
  name?: string | null;
  referenceId: string;
  product: string;
}): Promise<boolean> {
  if (!rfq.email) return false;
  return sendMail({
    to: rfq.email,
    subject: `We received your RFQ ${rfq.referenceId} — FactoryAuditB2B`,
    text: [
      `Hi ${rfq.name || "there"},`,
      "",
      "Thank you. We have received your sourcing request.",
      "",
      `RFQ reference : ${rfq.referenceId}`,
      `Product       : ${rfq.product}`,
      "",
      "Our team will review it and get back to you within one business day.",
      "Please quote the RFQ reference above if you need to follow up.",
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

// —— CS-08：认证辅导需求（入驻表「我要获得证书」按钮）——

// 管理员通知：供应商在入驻表里提交的验厂/认证辅导需求。
// 与入驻申请分开（kind="certification_request"），便于独立跟进，不混进 Supplier Master Sheet。
export async function notifyAdminCertificationRequest(data: {
  id: string;
  fields: Record<string, string>;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过认证辅导需求通知");
    return false;
  }
  const f = data.fields;
  const line = (label: string, val?: string) => (val ? `${label}: ${val}` : null);
  const body = [
    `Request ID: ${data.id}`,
    "",
    "— Certification Consulting Request —",
    line("Requested certification(s)", f.certHelpWanted),
    line("Company", f.certHelpCompany),
    line("Contact person", f.certHelpContactName),
    line("Email", f.certHelpContactEmail),
    line("Notes", f.certHelpNote),
    "",
    "Source: the 'I want to obtain certification' button on the supplier application form.",
    "Next steps: reply to the contact above with scope, timeline and pricing for factory audit / certification consulting.",
  ]
    .filter(Boolean)
    .join("\n");
  return sendMail({
    to: adminEmail,
    subject: `[FactoryAuditB2B] Certification Consulting Request ${data.id}`,
    text: body,
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
    subject: `[FactoryAuditB2B] New Buyer Sign-up ${data.id}`,
    text: [
      `Account ID: ${data.id}`,
      "",
      "— Buyer Account Created (V2.1) —",
      `Email: ${f.email ?? ""}`,
      `Name: ${f.name ?? ""}`,
      `Company: ${f.company ?? ""}`,
      "",
      "Account was created automatically by Supabase Auth with a Free plan.",
      "No manual setup is required. Review memberships in the admin dashboard if they request an upgrade.",
    ].join("\n"),
  });
}

// 买家注册回执
// 2026-09-03 修订：去掉「手动建号 + 发登录信息」空承诺（V2.0 无登录系统）。
// 2026-09-03 再次修订（V2.1）：注册即自动建号，账号立即可用，
//   因此改为「账号已创建 + 直接登录」，不再写「一个工作日内人工回复」。
export async function notifyBuyerRegisterReceived(data: {
  email: string;
  name?: string | null;
  id: string;
}): Promise<boolean> {
  if (!data.email) return false;
  return sendMail({
    to: data.email,
    subject: "Your FactoryAuditB2B account is ready",
    text: [
      `Hi${data.name ? ` ${data.name}` : ""},`,
      "",
      "Your FactoryAuditB2B account is ready. You can sign in now:",
      "https://factoryauditb2b.com/login",
      "",
      `Reference ID: ${data.id}`,
      "",
      "With a free account you can:",
      // CS-05c：不再是「每月 5 家」。免费档位是基础档案**无限**浏览；
      // 且原句把 certifications 算进免费权益是错的 —— 认证属 paid 层。
      "- Browse basic supplier profiles with no monthly limit (established year, employee count, export markets, audit status)",
      "- Save suppliers to your list",
      "- Submit RFQs and track their status",
      "",
      `Founding Buyer Membership ($${MEMBERSHIP_PRICE_USD}/year) unlocks the full directory, evidence records and risk breakdowns:`,
      "https://factoryauditb2b.com/membership",
      "",
      "FactoryAuditB2B",
    ].join("\n"),
  });
}

// ---------- V2.1：Stripe 订阅通知（客户方向） ----------

/**
 * 支付成功 → 欢迎成为 Founding Buyer。
 *
 * 由 /api/stripe/webhook 的 checkout.session.completed 调用。
 * 发送失败不影响会员开通（webhook 里已 catch），这里只负责组织文案。
 *
 * 文案铁律：只陈述已发生的事实（已开通、到期日、权益），
 * 不做任何"保证找到供应商""保证成交"之类的承诺。
 */
export async function notifyPaymentSucceeded(data: {
  email: string;
  periodEnd: Date | null;
}): Promise<boolean> {
  if (!data.email) return false;

  const renewLine = data.periodEnd
    ? `Your subscription renews on ${data.periodEnd.toISOString().slice(0, 10)}.`
    : "Your subscription is active.";

  return sendMail({
    to: data.email,
    subject: "Welcome to Founding Buyer — FactoryAuditB2B",
    text: [
      "Your Founding Buyer Membership is active.",
      "",
      `Plan: Founding Buyer ($${MEMBERSHIP_PRICE_USD}/year)`,
      renewLine,
      "",
      "What is now unlocked:",
      "- Evidence records with verification status and source",
      "- Inspection history",
      "- Risk breakdown by dimension",
      "- Certification claims with their source",
      "",
      "Manage your subscription or update your card:",
      "https://factoryauditb2b.com/account",
      "",
      "If you need supplier matching help, reply to this email or send an RFQ:",
      "https://factoryauditb2b.com/rfq",
      "",
      "FactoryAuditB2B",
    ].join("\n"),
  });
}

/**
 * 扣款失败 → 请更新支付方式。
 *
 * 由 /api/stripe/webhook 的 invoice.payment_failed 调用。
 * 措辞要点：明确说明"会员权益暂时受限"而不是"已取消"，
 * Stripe 会在一个月内重试数次，很多用户更新卡片后就恢复了。
 */
export async function notifyPaymentFailed(data: {
  email: string;
}): Promise<boolean> {
  if (!data.email) return false;

  return sendMail({
    to: data.email,
    subject: "Action needed: payment failed — FactoryAuditB2B",
    text: [
      "We could not process the payment for your Founding Buyer Membership.",
      "",
      "Stripe will retry the payment over the next few weeks. To avoid losing access,",
      "update your card now:",
      "https://factoryauditb2b.com/account",
      "",
      "Your saved suppliers and RFQ history stay on your account either way.",
      "",
      "If you believe this is a mistake, reply to this email.",
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
