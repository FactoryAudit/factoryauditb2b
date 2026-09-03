import { NextRequest, NextResponse } from "next/server";
import { notifyAdminBuyerRegister, notifyBuyerRegisterReceived } from "@/lib/notify";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { appendRegisterRow } from "@/lib/googleSheets";

// Free Account 注册（Supplier Directory V2 §12）。
// 无数据库 / 无登录系统（V2.0）：注册实为「申请目录访问」，三路并行落数据：
//   1. 通知管理员（邮件）→ 人工回复跟进；
//   2. 给注册者发诚实回执（不承诺建号/登录，只承诺一个工作日内人工回复）；
//   3. append 到 Google Sheet（可选 CRM，需 .env 配 webhook，fail-open）。
// 表单不收集密码；字段白名单 + 限流 + 长度上限，与 supplier-register 同模式。

const REG_LIMIT = 10; // 同 IP 每小时最多 10 次注册
const REG_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const KNOWN_FIELDS = ["email", "name", "company"] as const;

export async function POST(req: NextRequest) {
  try {
    // 限流放最前（不解析 body、不发信）
    const ip = clientIp(req);
    const rl = checkRateLimit(`buyer-register:${ip}`, REG_LIMIT, REG_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message:
            "Too many sign-ups from this address recently. Please wait a while, or email us directly.",
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const raw = body?.fields ?? {};

    const f: Record<string, string> = {};
    for (const key of KNOWN_FIELDS) {
      const rawVal = raw[key];
      if (rawVal === undefined || rawVal === null) continue;
      const v = String(rawVal).trim().slice(0, 200);
      if (v) f[key] = v;
    }

    const email = String(f.email || "").toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    if (!f.name) {
      return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
    }

    const id = crypto.randomUUID();

    // 三路并行（通道未配置时各自降级为日志，不阻塞主流程）：
    //   1. 通知管理员（邮件）
    //   2. 给注册者发回执邮件
    //   3. 把记录 append 到 Google Sheet（可选 CRM 视图；需 .env 配 webhook）
    await Promise.allSettled([
      notifyAdminBuyerRegister({ id, fields: f }),
      notifyBuyerRegisterReceived({ email, name: f.name, id }),
      appendRegisterRow({
        referenceId: id,
        email,
        name: f.name,
        company: f.company ?? "",
        submittedAt: new Date().toISOString(),
        source: "buyer-register",
      }),
    ]);

    return NextResponse.json({ ok: true, accountId: id });
  } catch (e) {
    console.error("buyer register failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
