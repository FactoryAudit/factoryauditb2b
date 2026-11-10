import { NextResponse } from "next/server";
import { checkRateLimit, clientIp, clamp } from "@/lib/rateLimit";
import { notifyAdminCareerApplication, notifyApplicantCareerReceived } from "@/lib/notify";
import { insertLead } from "@/lib/leads";
import { uploadCareerCv } from "@/lib/storage";
import { LOCALES } from "@/i18n/config";

// POST /api/careers —— /careers 人才网络申请
//
// 第一版刻意**不建招聘后台**（用户明确要求），申请连同 CV 附件直接进管理员邮箱，
// 靠邮箱搜索完成筛选。主题行结构化成 `[Auditor Application] {国家} - {专业} - {姓名}`。
//
// ⚠️ 2026-11-10 修正（migration 039）：
//   只发邮件的后果是「申请人说注册了，后台什么都看不到」—— 线索页没有、成员页也没有
//   （他没建账号），审核单更还没派到他。邮件在垃圾箱里就等于这条申请不存在。
//   ⇒ 现在**同时落库** public.leads（kind=auditor_application），走既有 /admin/leads
//     运营台。邮件仍是主通道（带 CV 附件），库是防丢的兜底 + 后台可见性。
//   落库失败绝不阻断邮件与成功返回（与 lib/leads.ts 的铁律一致）。
//
// 申请人回执：此前提交后**零反馈**（Supabase autoconfirm=true，注册信根本不发），
//   申请人只能猜「到底提交成功没有」。现补一封回执，带 Reference ID。
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

  // ---- 简历附件：选填 + 类型/大小服务端复检 ----
  // 2026-11-10：由必填改为选填。上传是最容易卡住申请人的一步，
  // 而「没简历的申请」仍可建联、追问、补交 —— 收下比丢掉有用。
  // 但一旦上传，类型与大小仍然强制校验（选填 ≠ 不校验）。
  const fileRaw = form.get("cv");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
  if (file && file.size > MAX_CV_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 400, headers: NO_STORE }
    );
  }
  let filename: string | null = null;
  let content: string | null = null;
  let cvBytes: ArrayBuffer | null = null;
  if (file) {
    filename = safeFilename(file.name || "cv");
    const ext = extOf(filename);
    const mimeOk = ALLOWED_MIME.has((file.type || "").toLowerCase());
    const extOk = ALLOWED_EXT.has(ext);
    if (!extOk || (file.type && !mimeOk)) {
      return NextResponse.json(
        { ok: false, error: "invalid_file_type" },
        { status: 400, headers: NO_STORE }
      );
    }
    // 同一份字节三处使用（Storage 上传 / 邮件附件 / 大小校验），只读一次
    cvBytes = await file.arrayBuffer();
    content = Buffer.from(cvBytes).toString("base64");
  }

  // ---- 简历存私有 bucket（migration 040）----
  // 此前简历只进管理员邮箱：后台看得到「有简历」却点不开，邮件进垃圾箱就等于没有文件。
  // 上传失败**不阻断**申请：先落库拿 Reference ID，再补附件事后补交也来得及。
  let attachmentPath: string | null = null;
  if (cvBytes && filename) {
    const up = await uploadCareerCv({
      fileName: filename,
      mime: file?.type || "",
      bytes: cvBytes,
    });
    if (up.ok) {
      attachmentPath = up.path;
    } else {
      console.error(`[careers] cv upload skipped — reason=${up.error}`);
    }
  }

  // ---- 先落库（拿到 Reference ID），再发邮件 ----
  // 顺序理由：库是防丢的兜底。邮件服务抖动时，申请至少还在后台能看到。
  const stored = await insertLead({
    kind: "auditor_application",
    tool: "careers",
    email,
    firstName: fullName,
    country,
    phone,
    // 岗位与专业是后台筛选审核员的两个主维度，放进可检索列而不是只塞 payload
    sourcing: specialization,
    message: introduction,
    score: null,
    attachmentPath,
    payload: {
      fullName,
      city,
      role,
      specialization,
      years,
      languages,
      linkedin,
      availability,
      cvFilename: filename,
      cvBytes: file?.size ?? null,
      locale,
    },
  });
  const referenceId = stored.stored ? stored.referenceId : null;

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
    // 没有简历时不带 attachments —— 传一个空数组/空文件会让 Resend 或收件端报错。
    attachments: filename && content ? [{ filename, content }] : undefined,
  });

  // sendMail 是全局 fail-open（现有架构，不在本次改动范围）：
  // 通道未配置或发送失败时不抛错，只返回 false。
  // 这里必须留下明确的服务端错误日志，避免「页面显示成功但管理员没收到」被静默吞掉。
  // 日志只写结果与非敏感字段，绝不打印 API Key / 收件地址外的凭据。
  if (!sent) {
    console.error(
      `[careers] MAIL DELIVERY FAILED — application not delivered. country=${country} role=${role} specialization=${specialization} hasCv=${Boolean(filename)} ref=${referenceId ?? "none"}`
    );
  } else {
    console.log(
      `[careers] application delivered. country=${country} role=${role} ref=${referenceId ?? "none"}`
    );
  }
  if (!stored.stored) {
    // 落库失败也要留痕：此时后台看不到这条申请，只剩邮件一条命。
    console.error(`[careers] LEAD INSERT FAILED — ${stored.reason} ${stored.message ?? ""}`.trim());
  }

  // ---- 申请人回执 ----
  // 目的只有一个：让他知道「提交成功了」，并给一个能在邮件里引用的单号。
  // 失败不影响主流程（与上面的 fail-open 一致），只记日志。
  const receiptSent = await notifyApplicantCareerReceived({
    email,
    fullName,
    role,
    referenceId,
  });
  if (!receiptSent) {
    console.error(`[careers] applicant receipt not sent. role=${role} ref=${referenceId ?? "none"}`);
  }

  // 仍返回成功（保持现有 fail-open 行为，避免申请人反复提交），但把 degraded 带出去便于排查。
  // referenceId：页面当前不展示（表单成功态只有一句致谢），留着给以后的「查询进度」用，
  // 也方便验收脚本直接在响应里断言落库结果。
  return NextResponse.json(
    { ok: true, degraded: !sent || !stored.stored, referenceId },
    { headers: NO_STORE }
  );
}
