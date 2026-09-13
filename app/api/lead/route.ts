import { NextRequest, NextResponse } from "next/server";
import { leadScore } from "@/lib/leadScore";
import { insertLead } from "@/lib/leads";
import { getCurrentUser } from "@/lib/supabaseServer";
import { notifyAdminNewLead, notifyCustomerLeadReceived } from "@/lib/notify";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";

// 保存 Lead 并通知管理员/客户（PRD §21 漏斗：工具使用 → 邮箱捕获 → Lead）
//
// CS-02D：本路由**落库**（public.leads，kind=buyer_lead）。
//   此前这里只发邮件、一行不落库 —— migration 008 把表建好了却没有写入方，
//   后台永远查不到线索，是典型的一等「假功能」。现在由 lib/leads.ts 统一写入。
//
// 失败方向（重要）：落库失败**不阻断**邮件、不阻断成功响应。
//   数据库抖动不该让一单真实意向凭空消失；邮件是最后一道兜底。
//   响应里的 stored=false 是给运营看的信号，不是给用户的失败提示。
//
// 统一入口：TOOL / SERVICE / RFQ / SUPPLIER / CONTACT 等所有商业意向
// 支持 tool 值：supplier-risk-calculator / custom-services / audit-request / rfq / contact ...
//
// 登录用户（如有）会写入 user_id，游客为 NULL。

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

    // 落库短号 LEAD-XXXXXX（运营可在邮件/工单里直接引用）；撞号由 lib/leads.ts 重试解决。
    // 旧的 uuid leadId 保留在响应里作向后兼容（既有前端与回归脚本读它）。
    const id = crypto.randomUUID();

    // 登录用户才带 user_id；游客为 NULL（leads 只对 service_role 开放写权限，RLS 双保险）
    const user = await getCurrentUser().catch(() => null);
    const saved = await insertLead({
      kind: "buyer_lead",
      tool,
      email,
      firstName,
      company,
      country,
      sourcing,
      supplierName: clamp(lead.supplierName || lead.supplier, 300) || null,
      supplierWebsite,
      message,
      score,
      // 原始载荷无损兜底：上游表单以后加字段，即使列没跟上，这里也一定找得到
      payload: { lead, result: risk },
      userId: user?.id ?? null,
    });
    const referenceId = saved.stored ? saved.referenceId : null;
    if (!saved.stored) {
      console.error("[api/lead] not stored", saved.reason, saved.message ?? "");
    }

    // 通知（邮件通道未配置时自动降级为日志，不阻塞主流程）
    // 管理员邮件用短号做标识 —— 与库里 reference_id 一致，可直接反查。
    await Promise.allSettled([
      notifyAdminNewLead({
        id: referenceId ?? id,
        tool: saved.stored ? tool : `${tool} (not stored)`,
        firstName,
        email,
        company,
        country,
        message,
        score,
      }),
      notifyCustomerLeadReceived({ email, firstName, tool }),
    ]);

    return NextResponse.json({ ok: true, leadId: id, referenceId, stored: saved.stored, score });
  } catch (e) {
    console.error("lead save failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
