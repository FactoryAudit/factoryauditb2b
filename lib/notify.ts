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

/** 邮件附件。content 统一为 **base64**（HTTP 通道直接透传，SMTP 通道转 Buffer）。 */
export type MailAttachment = { filename: string; content: string };

type NotifyInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

// 发送单封邮件。邮件通道未配置时仅打日志并返回 false（不抛错）。
// ⚠️ 必须整体透传 input：早期版本只解构了 to/subject/text/html，
//    会把 attachments 丢掉（表现为「邮件收到、简历附件丢失」）。
export async function sendMail(input: NotifyInput): Promise<boolean> {
  if (mailProvider === "http") return sendMailHttp(input);
  return sendMailSmtp(input);
}

// —— SMTP 通道（本地开发 / 支持 SMTP 的 Node 环境） ——
async function sendMailSmtp({
  to,
  subject,
  text,
  html,
  attachments,
}: NotifyInput): Promise<boolean> {
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
      // nodemailer 要 Buffer，不强转会在部分传输器上把 base64 当纯文本发出去
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
      })),
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
async function sendMailHttp({
  to,
  subject,
  text,
  html,
  attachments,
}: NotifyInput): Promise<boolean> {
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
        // Resend 格式：content 为 base64 字符串
        ...(attachments?.length ? { attachments } : {}),
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

// ---------- CS-17 Commerce V1：服务订单双邮件 ----------

/**
 * 管理员通知：新服务订单。
 *
 * 与 notifyAdminNewLead 的区别（所以不复用）：
 *   订单带**金额与收款方式**，是财务口径而不是线索口径 ——
 *   运营要拿它去对账、去核销，必须一眼看到 ORD 号、金额、状态。
 *
 * 文案铁律：只陈述已发生的事实，不承诺交付时效（时效由人工确认后再回）。
 */
export async function notifyAdminNewOrder(order: {
  referenceId: string;
  serviceName: string;
  amountText: string | null;
  quantity: number;
  email: string;
  company?: string | null;
  country?: string | null;
  supplierSlug?: string | null;
  locale?: string | null;
  provider?: string | null;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过新订单通知");
    return false;
  }
  const line = (label: string, val?: string | null) => (val ? `${label}: ${val}` : null);
  const body = [
    `Order: ${order.referenceId}`,
    "",
    "— Service Order —",
    line("Service", order.serviceName),
    line("Quantity", String(order.quantity)),
    line("Amount", order.amountText ?? "To be quoted"),
    line("Status", "pending_payment"),
    line("Payment channel", order.provider ?? "not selected yet"),
    "",
    "— Buyer —",
    line("Email", order.email),
    line("Company", order.company),
    line("Country", order.country),
    line("Supplier", order.supplierSlug),
    line("Locale", order.locale),
    "",
    "Next steps: confirm scope and price with the buyer, then mark the order as paid in the admin console once payment arrives.",
  ]
    .filter(Boolean)
    .join("\n");
  return sendMail({
    to: adminEmail,
    subject: `[FactoryAuditB2B] New Order ${order.referenceId}`,
    text: body,
  });
}

/**
 * 客户订单回执。
 *
 * 必须让客户拿到**订单号**——他要把它抄进电汇附言，也靠它追问进度。
 * 措辞铁律：不写"已付款"、不承诺交付时效；金额若是待报价就明说 To be quoted，
 * 绝不用 0 或占位数字顶替。
 */
export async function notifyCustomerOrderReceived(order: {
  referenceId: string;
  serviceName: string;
  amountText: string | null;
  quantity: number;
  email: string;
  locale?: string | null;
}): Promise<boolean> {
  if (!order.email) return false;
  const lang = order.locale && order.locale !== "en" ? `/${order.locale}` : "";
  return sendMail({
    to: order.email,
    subject: `We received your order ${order.referenceId} — FactoryAuditB2B`,
    text: [
      "Thank you. We have received your order.",
      "",
      `Order reference : ${order.referenceId}`,
      `Service         : ${order.serviceName}`,
      `Quantity        : ${order.quantity}`,
      `Amount          : ${order.amountText ?? "To be quoted"}`,
      "",
      "Our team will confirm the scope and send payment instructions within one business day.",
      "Please quote the order reference above in your payment and in any follow-up.",
      "",
      `Order status: https://factoryauditb2b.com${lang}/checkout/${order.referenceId}`,
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

// ---------- STEP-05：Verify Supplier（买家请求核验某供应商）----------
//
// 语义红线（与 supplier_claim 完全一致）：
//   收到一条 "Verify Supplier" 请求 ≠ 该供应商已核验。落库 kind=supplier_verification
//   只代表「买家提出了一项核验需求，等待人工跟进」。绝不触发任何 Trust / Level 变更，
//   也绝不因为「有人提交过」就对外声称该供应商「verified」。

// 管理员：新核验请求（= 一条待跟进的商业线索）
export async function notifyAdminSupplierVerificationRequest(data: {
  id: string;
  /** 买家填写的供应商网址或公司名（原文，未做任何解析/断言） */
  supplierRef: string;
  /** 若请求来自某条档案页，这里是该档案 slug；否则 null */
  slug?: string | null;
  /** 供应商档案名（仅当 slug 命中时存在） */
  supplierName?: string | null;
  fields: Record<string, string>;
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过核验请求通知");
    return false;
  }
  const f = data.fields;
  return sendMail({
    to: adminEmail,
    subject: `[FactoryAuditB2B] Supplier Verification Request (${data.id})`,
    text: [
      `Request ID: ${data.id}`,
      `Supplier on record: ${data.supplierName ? `${data.supplierName} (${data.slug})` : "— (not linked to a profile)"}`,
      "",
      "— Supplier as given by the buyer —",
      `Supplier reference: ${data.supplierRef}`,
      `Product / category  : ${f.productCategory ?? ""}`,
      `Order value band    : ${f.orderValueBand ?? ""}`,
      `Country of import   : ${f.buyerCountry ?? ""}`,
      `Urgency             : ${f.urgency ?? ""}`,
      "",
      "— Buyer —",
      `Company Email : ${f.buyerEmail ?? ""}`,
      `Contact Name  : ${f.contactName ?? ""}`,
      `Company Name  : ${f.buyerCompany ?? ""}`,
      "",
      "— What the buyer wants checked —",
      `Concerns: ${f.concerns ?? ""}`,
      "",
      "Next steps: confirm the supplier identity (URL + company name), check whether a profile exists, then scope a verification or audit. This is a lead, not a verification result. Never mark the supplier verified on the basis of this submission alone.",
    ].join("\n"),
  });
}

// ---------- Careers / 人才网络：/careers 申请（CV 直投邮箱）----------
//
// 设计取舍：第一版**不建招聘后台、不建简历库**。申请以邮件形式落到收件箱，
// 靠邮箱搜索完成筛选（这正是主题行要结构化到「国家 - 专业 - 姓名」的原因）：
//   `[Auditor Application] Vietnam - SMETA - Nguyen Van A`
// 以后来一个 "Vietnam / Electronics / SMETA / 2-day audit" 的需求，
// 直接在邮箱搜 `Vietnam SMETA` 就能把人捞出来。
//
// 收件人：NOTIFY_ADMIN_EMAIL（与其它线索同一收件箱，便于统一搜索）。

/**
 * 主题行用**申请人的国家 + 专业方向 + 姓名**，便于日后按
 * 「国家 + 体系/专业」组合搜索。缺失片段用 "—" 占位（绝不用空串拼出畸形主题）。
 */
export function careerApplicationSubject(data: {
  country: string;
  specialization: string;
  fullName: string;
}): string {
  // 主题行会进邮件头：必须压掉换行与控制字符，否则形如
  // "Nguyen\r\nBcc: attacker@evil.com" 的姓名会往主题里塞出额外头段（头部注入）。
  // 同时压掉连续空白，保证收件箱里标题始终是单行可读。
  const seg = (v: string) => {
    const s = (v || "").replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    return s || "—";
  };
  return `[Auditor Application] ${seg(data.country)} - ${seg(data.specialization)} - ${seg(data.fullName)}`;
}

export async function notifyAdminCareerApplication(data: {
  fullName: string;
  country: string;
  city: string;
  role: string;
  specialization: string;
  years: string;
  languages: string;
  email: string;
  phone: string;
  linkedin: string;
  availability: string;
  introduction: string;
  cvFilename: string | null;
  locale?: string | null;
  attachments?: MailAttachment[];
}): Promise<boolean> {
  const adminEmail = process.env.NOTIFY_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[notify] NOTIFY_ADMIN_EMAIL 未配置，跳过招聘申请通知");
    return false;
  }
  const line = (label: string, val?: string) => (val ? `${label}: ${val}` : null);
  const body = [
    "— Applicant —",
    line("Full name", data.fullName),
    line("Country / Region", data.country),
    line("City", data.city),
    "",
    "— Profile —",
    line("Role", data.role),
    line("Specialization", data.specialization),
    line("Years of experience", data.years),
    line("Languages", data.languages),
    // Availability 是后续「按项目调人」的关键字段，单独成段便于扫读
    line("Availability", data.availability),
    "",
    "— Contact —",
    line("Email", data.email),
    line("Phone / WhatsApp", data.phone),
    line("LinkedIn", data.linkedin),
    "",
    "— Introduction —",
    data.introduction || "—",
    "",
    "— CV / Resume —",
    data.cvFilename ? `Attached: ${data.cvFilename}` : "Not provided",
    line("Locale", data.locale ?? ""),
    "",
    "Next steps: reply to the applicant, or file them in the talent pool by country + specialization + availability.",
  ]
    .filter((x) => x !== null)
    .join("\n");
  return sendMail({
    to: adminEmail,
    subject: careerApplicationSubject({
      country: data.country,
      specialization: data.specialization,
      fullName: data.fullName,
    }),
    text: body,
    attachments: data.attachments,
  });
}

// 买家回执：Reference ID + 人工跟进周期 + 明确「非核验结论」
export async function notifyVerificationRequestReceived(data: {
  email: string;
  companyName?: string | null;
  id: string;
  supplierRef: string;
}): Promise<boolean> {
  if (!data.email) return false;
  return sendMail({
    to: data.email,
    subject: "We received your supplier verification request — FactoryAuditB2B",
    text: [
      `Hi${data.companyName ? ` ${data.companyName}` : ""},`,
      "",
      `We received your verification request for: ${data.supplierRef}`,
      `Reference ID: ${data.id}`,
      "",
      "A specialist will review the details and reply within one business day with the scope, what can be checked, and the cost.",
      "",
      "Please note: this submission is a request, not a verification result. It does not change any supplier's status, and payment does not guarantee a particular outcome. We tell you what we find, including when we cannot confirm something.",
      "",
      "FactoryAuditB2B",
    ].join("\n"),
  });
}
