import { NextRequest, NextResponse } from "next/server";
import {
  notifyAdminSupplierVerificationRequest,
  notifyVerificationRequestReceived,
} from "@/lib/notify";
import { insertLead } from "@/lib/leads";
import { leadScore } from "@/lib/leadScore";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { getSupplierDetail } from "@/lib/queries";

// STEP-05：/verify-supplier 表单提交入口 —— 买家「我已经找到一个供应商，
// 但不知道它是不是真的 / 靠不靠谱」的最小闭环。
//
// 闭环：提交供应商 URL / 公司名 → 收集买家需求 → 入库（public.leads,
//       kind='supplier_verification'）→ 后台处理 → 转人工核验服务。
//
// ⚠️ 语义红线（与 /api/supplier-claim 完全一致）：
//    写进 leads 只代表「收到了一条核验请求」，**绝不**触发任何 Trust / Level 变更，
//    绝不等同于 verified。核验结论由人工产出，不由本路由产出。
//
// 🔴 与 supplier-claim 的**关键差异**（刻意为之，不是遗漏）：
//    supplier-claim 的 slug 必须存在于供应商数据（防伪造 profile 认领）；
//    本路由的供应商**允许是任意外部 URL / 公司名** —— 买家往往在还没进我们
//    目录的时候就需要核验。因此 slug 是**可选的关联**（命中即关联档案，
//    未命中不影响提交），而不是前置门禁。
//    代价：不做「该供应商是否已核验」的实时断言 —— 这正是本 Change Set
//    明确不做的自动评分/自动结论。
//
// 规则：
//   - 同 IP 每小时最多 5 次（与 claim 同档）
//   - 字段白名单 + 长度夹取；email 正则校验
//   - 落库失败不阻断邮件（与 lib/leads.ts 铁律一致）

const VERIFY_LIMIT = 5; // 同 IP 每小时最多 5 次核验请求
const VERIFY_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 字段长度上限：长文本 2000，其余 300（与 supplier-claim 同口径） */
const KNOWN_FIELDS = [
  "buyerEmail",
  "contactName",
  "buyerCompany",
  "buyerCountry",
  "productCategory",
  "orderValueBand",
  "urgency",
  "concerns",
] as const;

/** 订单金额档位：白名单枚举，不接受自由文本（这是给人工排优先级的，不是给用户写小作文的） */
const ORDER_VALUE_BANDS = new Set([
  "lt5k",
  "5k-25k",
  "25k-100k",
  "gt100k",
  "unknown",
]);

/** 紧急度：白名单枚举 */
const URGENCY = new Set(["now", "30days", "planning"]);

export async function POST(req: NextRequest) {
  try {
    // 限流放最前（与 supply-claim / audit-request 同位置）
    const ip = clientIp(req);
    const rl = checkRateLimit(`verify-supplier:${ip}`, VERIFY_LIMIT, VERIFY_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          message:
            "Too many verification requests from this address recently. Please wait a while, or email us directly.",
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();

    // 供应商标识：URL 或公司名，至少要有其一（这是本表单的**主字段**）
    const supplierUrl = String(body?.supplierUrl ?? "").trim().slice(0, 500);
    const supplierCompanyName = String(body?.supplierCompanyName ?? "")
      .trim()
      .slice(0, 300);
    if (!supplierUrl && !supplierCompanyName) {
      return NextResponse.json({ ok: false, error: "supplier_required" }, { status: 400 });
    }
    // 用户填的是网址还是名字，都要能落进同一条 supplier_name / supplier_website。
    // 这里不做 URL 解析、不做域名提取 —— 只原样记录买家给的东西。
    const supplierRef = supplierUrl || supplierCompanyName;

    // 可选的档案关联：命中则写进 payload，用于后台把请求挂到具体档案上。
    // 未命中**不报错**（见文件头「关键差异」）。
    const rawSlug = String(body?.slug ?? "").trim().slice(0, 200);
    //
    // 🔴 必须走 getSupplierDetail()，**不能**用 STATIC_SUPPLIERS。
    //   实测踩过：guangzhou-sunny-food 是 Supabase 里的真实档案，但
    //   lib/staticData.ts 的 STATIC_SUPPLIERS 只有 4 条种子数据（离线兜底用）。
    //   用 STATIC_SUPPLIERS.find() 会让**绝大多数真实档案**关联失败，
    //   表现为 payload.slug 恒为 null —— 后台拿不到「这条请求是为哪家提的」。
    //   getSupplierDetail() 才是与前台档案页同源的数据入口：
    //   它按 slug + is_published=true 查 Supabase，并自带静态兜底。
    //   查询失败（含 slug 不存在）时安静降级为「外部供应商」，绝不阻断提交。
    let supplier: Awaited<ReturnType<typeof getSupplierDetail>> = null;
    if (rawSlug) {
      try {
        supplier = await getSupplierDetail(rawSlug);
      } catch (e) {
        // 关联是**增值信息**，不是提交的前置条件。查档失败不该让买家白填一遍表单。
        console.error("[api/verify-supplier] supplier lookup failed", e);
        supplier = null;
      }
    }

    // 字段白名单 + 夹取
    const raw = body?.fields ?? {};
    const f: Record<string, string> = {};
    for (const key of KNOWN_FIELDS) {
      const rawVal = raw[key];
      if (rawVal === undefined || rawVal === null) continue;
      const max = key === "concerns" ? 2000 : 300;
      const v = String(rawVal).trim().slice(0, max);
      if (v) f[key] = v;
    }

    const email = String(f.buyerEmail || "").toLowerCase();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    // 枚举字段：非法值一律丢弃（不报错也不写脏数据）
    if (f.orderValueBand && !ORDER_VALUE_BANDS.has(f.orderValueBand)) delete f.orderValueBand;
    if (f.urgency && !URGENCY.has(f.urgency)) delete f.urgency;

    const id = crypto.randomUUID();

    const saved = await insertLead({
      kind: "supplier_verification",
      tool: "verify-supplier",
      email,
      firstName: f.contactName || null,
      company: f.buyerCompany || null,
      country: f.buyerCountry || null,
      sourcing: f.productCategory || null,
      // 供应商名：优先用档案里的规范名（若已关联），否则用买家原文
      supplierName: supplier?.legalName || supplierCompanyName || null,
      supplierWebsite: supplierUrl || null,
      message: f.concerns || null,
      score: leadScore({
        email,
        company: f.buyerCompany,
        supplierWebsite: supplierUrl,
        sourcing: f.productCategory,
        message: f.concerns,
        // tool 含 "verification" ⇒ leadScore 的「高商业意图来源」+15 命中
        tool: "verify-supplier",
      }),
      payload: {
        slug: supplier?.slug ?? null,
        supplierRef,
        fields: f,
      },
    });
    if (!saved.stored) {
      console.error("[api/verify-supplier] not stored", saved.reason, saved.message ?? "");
    }
    const referenceId = saved.stored ? saved.referenceId : null;

    // 双邮件（通道未配置时降级为日志，不阻塞 —— 落库已成功就不该因邮件失败给用户报错）
    await Promise.allSettled([
      notifyAdminSupplierVerificationRequest({
        id: referenceId ?? id,
        supplierRef,
        slug: supplier?.slug ?? null,
        supplierName: supplier?.legalName ?? null,
        fields: f,
      }),
      notifyVerificationRequestReceived({
        email,
        companyName: f.buyerCompany,
        id: referenceId ?? id,
        supplierRef,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      requestId: id,
      referenceId,
      stored: saved.stored,
    });
  } catch (e) {
    console.error("verify supplier request failed", e);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
}
