import { NextResponse } from "next/server";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";
import { notifyAdminCareerApplication } from "@/lib/notify";
import { LOCALES } from "@/i18n/config";

// POST /api/careers —— /careers 人才网络申请
//
// 第一版刻意**不落库、不建招聘后台**（用户明确要求）：
//   申请连同 CV 附件直接进管理员邮箱，靠邮箱搜索完成筛选。
//   主题行结构化成 `[Auditor Application] {国家} - {专业} - {姓名}`，
//   以后按「国家 + 体系/专业 + 可出差」组合搜就能把人捞出来。
//
// 附件限制（服务端强制，前端提示只是提速）：
//   类型 PDF / DOC / DOCX，最大 5 MB。
//   简历含个人身份信息，因此类型与大小必须在服务端复检，不能只信客户端。

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
} as const;

// 真人投递，比 RFQ 宽松，但仍要拦住脚本灌入
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CV_BYTES = 5 * 1024 * 1024;

// 白名单按 MIME + 扩展名双重判定：浏览器给的 MIME 并不总是可信，
// 有些环境会把 docx 报成空串或 application/octet-stream。
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXT = new Set(["pdf", "doc", "docx"]);

/** 文件名净化：只留安全字符，去掉路径分隔符与控制字符（防路径遍历 / 头部注入） */
function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "cv";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 120);
  return cleaned || "cv";
}

function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : "";
}

function normalizeLocale(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s && (LOCALES as readonly string[]).includes(s) ? s : null;
}

export async function POST(req: Request) {
  // ---- 限流放最前 ----
  const ip = clientIp(req);
  const rl = checkRateLimit(`careers:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400, headers: NO_STORE }
    );
  }

  const str = (k: string, max: number) => clamp(form.get(k), max) ?? "";

  const fullName = str("fullName", 120);
  const country = str("country", 80);
  const city = str("city", 120);
  const role = str("role", 80);
  const specialization = str("specialization", 200);
  const years = str("years", 20);
  const languages = str("languages", 200);
  const email = str("email", 254).trim().toLowerCase();
  const phone = str("phone", 60);
  const linkedin = str("linkedin", 300);
  const availability = str("availability", 120);
  const introduction = str("introduction", 3000);
  const locale = normalizeLocale(form.get("locale"));

  // ---- 必填校验：核心检索维度（国家 / 岗位 / 专业 / 可参与方式）+ 联系方式 + 简历 ----
  if (!fullName || !country || !role || !specialization || !availability) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400, headers: NO_STORE }
    );
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400, headers: NO_STORE }
    );
  }

  // ---- 简历附件：类型 + 大小服务端复检 ----
  const fileRaw = form.get("cv");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
  if (!file) {
    return NextResponse.json(
      { ok: false, error: "cv_required" },
      { status: 400, headers: NO_STORE }
    );
  }
  if (file.size > MAX_CV_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 400, headers: NO_STORE }
    );
  }
  const filename = safeFilename(file.name || "cv");
  const ext = extOf(filename);
  const mimeOk = ALLOWED_MIME.has((file.type || "").toLowerCase());
  const extOk = ALLOWED_EXT.has(ext);
  if (!extOk || (file.type && !mimeOk)) {
    return NextResponse.json(
      { ok: false, error: "invalid_file_type" },
      { status: 400, headers: NO_STORE }
    );
  }

  const content = Buffer.from(await file.arrayBuffer()).toString("base64");

  const sent = await notifyAdminCareerApplication({
    fullName,
    country,
    city,
    role,
    specialization,
    years,
    languages,
    email,
    phone,
    linkedin,
    availability,
    introduction,
    cvFilename: filename,
    locale,
    attachments: [{ filename, content }],
  });

  // sendMail 是全局 fail-open（现有架构，不在本次改动范围）：
  // 通道未配置或发送失败时不抛错，只返回 false。
  // 这里必须留下明确的服务端错误日志，避免「页面显示成功但管理员没收到」被静默吞掉。
  // 日志只写结果与非敏感字段，绝不打印 API Key / 收件地址外的凭据。
  if (!sent) {
    console.error(
      `[careers] MAIL DELIVERY FAILED — application not delivered. country=${country} role=${role} specialization=${specialization} hasCv=${Boolean(filename)}`
    );
  } else {
    console.log(`[careers] application delivered. country=${country} role=${role}`);
  }

  // 仍返回成功（保持现有 fail-open 行为，避免申请人反复提交），但把 degraded 带出去便于排查。
  return NextResponse.json({ ok: true, degraded: !sent }, { headers: NO_STORE });
}
