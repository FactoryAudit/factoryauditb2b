import { NextRequest, NextResponse } from "next/server";
import { notifyAdminSupplierRegistration, notifySupplierReceived } from "@/lib/notify";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";

// Supplier Network V1.0：供应商免费入驻表单统一入口。
// 无数据库：数据经邮件送达管理员（结构化文本，可直接粘贴进 Google Sheets），
// 后续人工审核 → 定 Evidence Level / Status / Risk Score → 通过后录入 staticData 发布。
// 与 /api/lead 的关系：独立路由（字段差异大），限流与邮件通道复用。

const REG_LIMIT = 5; // 同 IP 每小时最多 5 次入驻申请
const REG_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 白名单校验：只保留已声明字段，防止任意键注入邮件正文
const KNOWN_FIELDS = [
  "companyName",
  "englishName",
  "companyType",
  "registrationNumber",
  "establishedYear",
  "website",
  "factoryCountry",
  "factoryCity",
  "factoryAddress",
  "employees",
  "factorySize",
  "mainProducts",
  "productionCapacity",
  "monthlyOutput",
  "exportMarkets",
  "exportSince",
  "certificates",
  "contactName",
  "contactEmail",
  "contactPhone",
  "contactWhatsapp",
  "auditAvailability",
  "inspectionAvailability",
  "authorizeCompanyProfile",
  "contactVisibility",
  "message",
] as const;

export async function POST(req: NextRequest) {
  try {
    // 限流放最前（不解析 body、不发信）
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-register:${ip}`, REG_LIMIT, REG_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message:
            "You have submitted several applications recently. Please wait a while, or email us directly.",
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const raw = body?.fields ?? {};

    // 字段长度上限（防超长输入撑爆邮件正文）
    const f: Record<string, string> = {};
    for (const key of KNOWN_FIELDS) {
      const rawVal = raw[key];
      if (rawVal === undefined || rawVal === null) continue;
      const max = key === "message" ? 5000 : key.includes("Address") ? 500 : 300;
      const v = String(rawVal).trim().slice(0, max);
      if (v) f[key] = v;
    }

    // 必填校验
    const email = String(f.contactEmail || "").toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    if (!f.companyName) {
      return NextResponse.json({ ok: false, error: "company name required" }, { status: 400 });
    }
    if (f.authorizeCompanyProfile !== "yes" && f.authorizeCompanyProfile !== "no") {
      return NextResponse.json({ ok: false, error: "authorization required" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    // 双邮件（通道未配置时降级为日志，不阻塞）
    await Promise.allSettled([
      notifyAdminSupplierRegistration({ id, fields: f }),
      notifySupplierReceived({ email, companyName: f.companyName, id }),
    ]);

    return NextResponse.json({ ok: true, supplierId: id });
  } catch (e) {
    console.error("supplier register failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
