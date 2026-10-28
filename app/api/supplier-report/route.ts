import { NextRequest, NextResponse } from "next/server";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { getChecklistTemplates, getSupplierSelfAssessment } from "@/lib/supplierAssessments";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  buildSelfAssessmentReport,
  selfAssessmentReportNumber,
} from "@/lib/selfAssessmentReport";
import { buildReportDocHtml, type ReportLang } from "@/lib/supplierReportDocHtml";

// 供应商自评报告（Self-Assessment Summary）生成出口。
//
// 🔴 定位：**即时生成，不落库**。第一版只让供应商自己看/打印，不挂档案页、不对买家开放。
//   落库与分享权限等"报告归属"那一层（buyer 额度、分享链接）另行设计，
//   本条路由刻意不碰 —— 避免生成即产生一份"对外资产"。
//
// 🔴 归属裁决：resolveSupplierAccess（会话优先 / 邮箱兜底 / 歧义拒）。
//   校验不通过的请求不会读到任何别人的答案。
//
// 🔴 内容红线全部落在 lib/selfAssessmentReport.ts 里（不给分、不给结论、
//   全部标 reported），本路由只负责取数与渲染，不得在此追加任何总结性判断。

const LIMIT = 30; // 同 IP 每小时最多 30 次（报告生成有渲染开销）
const WINDOW_MS = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = checkRateLimit(`supplier-report:${ip}`, LIMIT, WINDOW_MS);
    if (!rl.ok) {
      return new NextResponse("Too many requests. Please try again later.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      });
    }

    const sp = req.nextUrl.searchParams;
    const supplierId = (sp.get("supplier") ?? "").trim();
    const email = (sp.get("email") ?? "").trim() || null;
    const lang: ReportLang = sp.get("lang") === "zh" ? "zh" : "en";
    const download = sp.get("download") === "1";

    if (!supplierId) {
      return new NextResponse("supplier is required", { status: 400 });
    }

    const access = await resolveSupplierAccess({ claimedSupplierId: supplierId, email });
    if (!access.ok) {
      return new NextResponse(
        access.code === "not_owner" ? "This account is not linked to a supplier." : "Sign in required.",
        { status: access.status ?? 403 }
      );
    }
    const realId = access.identity.supplierId;

    const db = createAdminClient();
    if (!db) return new NextResponse("Service unavailable.", { status: 503 });

    const { data: supplier, error } = await db
      .from("suppliers")
      .select("slug, legal_name, english_name, province, city, country_code, website, registration_number, employees, established")
      .eq("id", realId)
      .maybeSingle();
    if (error || !supplier) {
      return new NextResponse("Supplier not found.", { status: 404 });
    }

    const templates = await getChecklistTemplates();
    if (templates.length === 0) {
      return new NextResponse("Questionnaire is not configured yet.", { status: 503 });
    }

    const draft = await getSupplierSelfAssessment(realId);
    const responses = (draft?.responses ?? null) as Record<string, unknown> | null;

    // 证书台账：报告第 05 章的唯一可信来源。
    // 🔴 问卷 SP13 只是单选题，不代表持证；台账才有编号 / 发证机构 / 有效期 / 证据状态。
    const { data: certRows } = await db
      .from("supplier_certifications")
      .select(
        "program_code, display_name, certificate_no, certificate_number, issuing_body, certification_body, issue_date, expiry_date, verification_status, evidence_status"
      )
      .eq("supplier_id", realId)
      .order("expiry_date", { ascending: false });

    const certifications = (certRows ?? []).map((c) => ({
      programCode: String(c.program_code ?? ""),
      displayName: (c.display_name as string | null) ?? null,
      certificateNo: (c.certificate_no as string | null) ?? (c.certificate_number as string | null) ?? null,
      issuingBody: (c.issuing_body as string | null) ?? (c.certification_body as string | null) ?? null,
      issueDate: (c.issue_date as string | null) ?? null,
      expiryDate: (c.expiry_date as string | null) ?? null,
      verificationStatus: (c.verification_status as string | null) ?? null,
      evidenceStatus: (c.evidence_status as string | null) ?? null,
    }));

    // 没有基础档案答案就不出报告 —— 否则会生成一份通篇「—」的空壳，
    // 对外看起来像"报告已出具"，属误导。
    const hasProfile = ["SP01", "SP02", "SP03", "SP06"].some((k) => {
      const v = responses?.[k];
      return typeof v === "string" && v.trim().length > 0;
    });
    if (!hasProfile) {
      return new NextResponse(
        "Complete the company profile (Step 1) before generating a report.",
        { status: 409 }
      );
    }

    const now = new Date();
    const doc = buildSelfAssessmentReport({
      templates,
      responses: responses as never,
      supplier,
      certifications,
      reportNumber: selfAssessmentReportNumber(String(supplier.slug ?? ""), now),
      reportDate: now.toISOString().slice(0, 10),
      preparedFor: "",
    });

    const html = buildReportDocHtml(doc, lang, {
      supplierName: String(supplier.legal_name ?? supplier.slug ?? ""),
      slug: String(supplier.slug ?? ""),
      generatedAt: now.toISOString(),
      // 🔴 必须覆盖：这份报告不含任何独立核验，标题不能叫 Due Diligence Report。
      titleOverride: { en: "Self-Assessment Summary", zh: "自评摘要报告" },
    });

    const fileName = `${doc.reportNumber}-${lang}.html`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
        // 报告含企业自述信息，禁止被搜索引擎抓取
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (e) {
    console.error("[api/supplier-report] failed", e);
    return new NextResponse("Report generation failed.", { status: 500 });
  }
}
