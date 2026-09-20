import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { recommendSuppliersForRfq } from "@/lib/rfqMatching";
import RfqMatchPanel, { type MatchPanelDict } from "@/components/admin/RfqMatchPanel";

// Admin · 单个询价单：查看推荐供应商 + 手动确认匹配（STEP 12 Change Set D）
//
// 隐私边界：本页是后台（noindex，requireAdmin 拦截），可看到 email 用于业务联系；
// 但**前台公开接口** listPublicRfqs 只 SELECT 白名单列，绝不返回 email/phone/message。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; referenceId: string }> };

export default async function AdminRfqMatchPage({ params }: Props) {
  const { locale: raw, referenceId } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();
  const p = (href: string) => localePath(locale, href);

  const db = createAdminClient();
  const { data: rfq } = db
    ? await db
        .from("rfqs")
        .select("id, reference_id, product, quantity, country, industry_code, message, is_public, status, source_type, source_path, created_at")
        .eq("reference_id", referenceId)
        .maybeSingle()
    : { data: null };

  if (!rfq) notFound();

  const recs = await recommendSuppliersForRfq({
    id: String(rfq.id),
    referenceId: String(rfq.reference_id ?? ""),
    industryCode: rfq.industry_code == null ? null : String(rfq.industry_code),
    country: rfq.country == null ? null : String(rfq.country),
    product: rfq.product == null ? null : String(rfq.product),
  });

  const isZh = locale === "zh" || locale === "zh-TW";
  const dict: MatchPanelDict = isZh
    ? { title: "推荐供应商（确定性匹配 v1）", empty: "暂无可推荐的已发布供应商（行业/国家/产品均无命中，或供应商未发布）。", confirm: "确认匹配", confirming: "提交中…", done: "已确认匹配", failed: "失败", score: "得分", reasons: "依据" }
    : { title: "Recommended suppliers (deterministic v1)", empty: "No eligible published supplier matched (no industry/country/product hit, or supplier unpublished).", confirm: "Confirm match", confirming: "Saving…", done: "Match confirmed", failed: "Failed", score: "Score", reasons: "Why" };

  const t = isZh
    ? { back: "← 返回询价单列表", product: "产品", quantity: "数量", country: "国家", industry: "行业", status: "状态", public: "公开", source: "来源", created: "提交时间", message: "需求说明" }
    : { back: "← Back to RFQ list", product: "Product", quantity: "Quantity", country: "Country", industry: "Industry", status: "Status", public: "Public", source: "Source", created: "Created", message: "Requirements" };

  const row = (k: string, v: string | null) => (
    <tr className="border-b border-[#e2e8f0]">
      <td className="px-3 py-2 text-xs uppercase text-[#64748b]">{k}</td>
      <td className="px-3 py-2 text-sm text-[#0f172a]">{v || "—"}</td>
    </tr>
  );

  return (
    <div>
      <Link href={p("/admin/rfqs")} className="text-sm text-[#0f4c81] hover:underline">
        {t.back}
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-[#0f172a]">
        <span className="font-mono">{String(rfq.reference_id)}</span>
      </h1>

      <div className="mt-4 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <table className="w-full text-left">
          <tbody>
            {row(t.product, rfq.product == null ? null : String(rfq.product))}
            {row(t.quantity, rfq.quantity == null ? null : String(rfq.quantity))}
            {row(t.country, rfq.country == null ? null : String(rfq.country))}
            {row(t.industry, rfq.industry_code == null ? null : String(rfq.industry_code))}
            {row(t.status, rfq.status == null ? null : String(rfq.status))}
            {row(t.public, rfq.is_public ? "yes" : "no")}
            {row(t.source, [rfq.source_type, rfq.source_path].filter(Boolean).join(" ") || null)}
            {row(t.created, new Date(String(rfq.created_at)).toISOString().slice(0, 10))}
            {row(t.message, rfq.message == null ? null : String(rfq.message))}
          </tbody>
        </table>
      </div>

      <RfqMatchPanel referenceId={String(rfq.reference_id)} recommendations={recs} dict={dict} />
    </div>
  );
}
