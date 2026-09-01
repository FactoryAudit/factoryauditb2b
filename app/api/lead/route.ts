import { NextRequest, NextResponse } from "next/server";
import { leadScore } from "@/lib/leadScore";
import { notifyAdminNewLead, notifyCustomerLeadReceived } from "@/lib/notify";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";

// 保存 Lead 并通知管理员/客户（PRD §21 漏斗：工具使用 → 邮箱捕获 → Lead）
// V2.0 去数据库：不再写 Prisma。线索通过邮件通知送达管理员，
// 后续由运营手动归档到 Google Sheets（CRM）。leadId 用随机 UUID 生成，仅作关联标识。
// 统一入口：TOOL / SERVICE / RFQ / SUPPLIER / CONTACT 等所有商业意向
// 支持 tool 值：supplier-risk-calculator / custom-services / audit-request / rfq / contact ...

// 限流阈值：同一个 IP 每小时最多 5 条线索。
// 真实买家不会一小时提交 5 次询价；超过这个量基本是脚本灌数据或竞对骚扰。
// 每次提交会触发两封邮件，不限流等于给人一个免费的邮件轰炸入口。
const LEAD_LIMIT = 5;
const LEAD_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    // --- 限流（放在最前面，超限就不再解析 body、不发信） ---
    const ip = clientIp(req);
    const rl = checkRateLimit(`lead:${ip}`, LEAD_LIMIT, LEAD_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message:
            "You have submitted several requests recently. Please wait a while, or email us directly.",
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const lead = body?.lead ?? {};
    const risk = body?.result ?? {};
    const tool = clamp(lead.tool, 64) || "supplier-risk-calculator";

    // 统一字段映射（兼容各来源表单命名差异）
    // 所有字段都做长度上限，防止超长输入撑爆邮件正文
    const firstName = clamp(lead.firstName || lead.name, 120);
    const company = clamp(lead.company, 200);
    const email = String(lead.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    const country = clamp(lead.country, 120);
    const sourcing = clamp(lead.sourcing || lead.product, 300);
    const supplierWebsite = clamp(lead.supplierWebsite, 500);
    const message = clamp(lead.message, 5000);
    const riskLevel = clamp(risk.level || lead.riskLevel, 32);

    const score = leadScore({
      email,
      company,
      supplierWebsite,
      riskLevel,
      tool,
      sourcing,
      message,
    });

    // 随机 leadId 作为线索关联标识（不再有数据库自增 id）
    const id = crypto.randomUUID();

    // 通知（邮件通道未配置时自动降级为日志，不阻塞主流程）
    await Promise.allSettled([
      notifyAdminNewLead({
        id,
        tool,
        firstName,
        email,
        company,
        country,
        message,
        score,
      }),
      notifyCustomerLeadReceived({ email, firstName, tool }),
    ]);

    return NextResponse.json({ ok: true, leadId: id, score });
  } catch (e) {
    console.error("lead save failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
