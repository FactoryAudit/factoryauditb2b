import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";

// 注册限流：同 IP 每小时 5 个账号。
// 正常用户不会一小时注册 5 次；bcrypt(10) 是 CPU 密集型操作，
// 不限流的话批量注册既灌库又能当 CPU 耗尽型攻击用。
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

/**
 * 用户注册（Credentials）。
 * 安全约定：
 * - 只接受 BUYER / SUPPLIER 两种自助角色。ADMIN / AUDITOR 只能后台授予，防止越权提权。
 * - 密码 bcrypt(10) 落库，永不明文存储、不写日志。
 * - 邮箱已存在时返回 409，但**不泄露**该邮箱是否已有 OAuth 账号的具体方式。
 */

const SELF_SERVE_ROLES = ["BUYER", "SUPPLIER"] as const;
type SelfServeRole = (typeof SELF_SERVE_ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    // --- 限流（放在最前面，超限就不做 bcrypt 计算） ---
    const ip = clientIp(req);
    const rl = checkRateLimit(`register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = clamp(body.name, 120) ?? "";
    const company = clamp(body.company, 200) ?? "";
    const country = clamp(body.country, 120) ?? "";
    const roleRaw = String(body.role ?? "BUYER").toUpperCase();

    // --- 校验 ---
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
    }
    // 上限 200 字符，避免 bcrypt 处理超长串造成 DoS
    if (password.length > 200) {
      return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
    }
    if (!SELF_SERVE_ROLES.includes(roleRaw as SelfServeRole)) {
      return NextResponse.json({ ok: false, error: "invalid_role" }, { status: 400 });
    }
    const role = roleRaw as SelfServeRole;

    // --- 查重 ---
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "email_taken" }, { status: 409 });
    }

    // --- 落库 ---
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role,
        // company / country 目前 User 表没有字段，随注册信息一起存入 Lead，
        // 保证不丢线索（见下方 lead 创建）
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // 注册本身是一条商业线索：B2B 站注册用户 = 高意向买家/供应商
    if (company || country) {
      await prisma.lead.create({
        data: {
          firstName: name || null,
          company: company || null,
          email,
          country: country || null,
          tool: "register",
          message: `New ${role.toLowerCase()} account registered.`,
          status: "NEW",
          score: role === "SUPPLIER" ? 60 : 70,
        },
      });
    }

    return NextResponse.json({ ok: true, userId: user.id, role: user.role });
  } catch (e) {
    console.error("register failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
