import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { recommendSuppliersForRfq, listRfqMatches } from "@/lib/rfqMatching";
import { isTestRfq } from "@/lib/adminBusiness";
import RfqMatchPanel, { type MatchPanelDict } from "@/components/admin/RfqMatchPanel";
import RfqMatchesTable, { type MatchesTableDict } from "@/components/admin/RfqMatchesTable";

// Admin · 单个询价单：看需求 → 看来源 → 看推荐 → 确认匹配 → 跟进状态
//   STEP 12 CS-D 建立（推荐 + 确认）；STEP 13 CS-C/CS-D 补全（来源/授权/联系人字段 +
//   已确认匹配列表 + suggested→contacted→won/lost 跟进）。
//
// 隐私边界：本页是后台（noindex，requireAdmin 拦截），可看到 email 用于业务联系；
// 但**前台公开接口** listPublicRfqs 只 SELECT 白名单列，绝不返回 email/phone/message。
//
// 🔴 测试探针标记：历史验收脚本写进生产的探针（如 CS-02B 的 RFQ-CXJCRL）会被打上
//    TEST 徽章。让 Admin 一眼看出"这条不该当商机跟"，是 spec §7 测试数据隔离的落点。

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
        .select(
          "id, reference_id, product, quantity, country, industry_code, message, is_public, status, source_type, source_path, created_at, target_market, certifications_req, industrial_cluster_slug, email, company"
        )
        .eq("reference_id", referenceId)
        .maybeSingle()
    : { data: null };

  if (!rfq) notFound();

  const rfqId = String(rfq.id);
  const allRecs = await recommendSuppliersForRfq({
    id: rfqId,
    referenceId: String(rfq.reference_id ?? ""),
    industryCode: rfq.industry_code == null ? null : String(rfq.industry_code),
    country: rfq.country == null ? null : String(rfq.country),
    product: rfq.product == null ? null : String(rfq.product),
    clusterSlug: rfq.industrial_cluster_slug == null ? null : String(rfq.industrial_cluster_slug),
  });
  const matches = await listRfqMatches(rfqId);
  // 已确认过的供应商从推荐池里摘掉，避免 Admin 重复确认（重复确认本身是幂等的，但会看糊）
  const matchedIds = new Set(matches.map((m) => m.supplierId));
  const recs = allRecs.filter((r) => !matchedIds.has(r.supplierId));

  const isTest = isTestRfq({
    referenceId: rfq.reference_id,
    product: rfq.product,
    company: rfq.company,
    email: rfq.email,
  });

  const isZh = locale === "zh" || locale === "zh-TW";

  const dict: MatchPanelDict = isZh
    ? { title: "推荐供应商（确定性匹配 v1）", empty: "暂无可推荐的已发布供应商（行业/国家/产品均无命中，或供应商未发布）。", confirm: "确认匹配", confirming: "提交中…", done: "已确认匹配", failed: "失败", score: "得分", reasons: "依据" }
    : { title: "Recommended suppliers (deterministic v1)", empty: "No eligible published supplier matched (no industry/country/product hit, or supplier unpublished).", confirm: "Confirm match", confirming: "Saving…", done: "Match confirmed", failed: "Failed", score: "Score", reasons: "Why" };

  const matchDict: MatchesTableDict = isZh
    ? {
        title: "已确认匹配 / 业务跟进",
        empty: "尚未确认任何匹配。",
        supplier: "供应商",
        status: "状态",
        note: "备注",
        createdAt: "确认时间",
        saving: "写入中…",
        failed: "状态更新失败",
        statusLabel: { suggested: "已推荐", contacted: "已联系", won: "成交", lost: "失去/不跟进" },
        actionLabel: { contacted: "标记已联系", won: "标记成交", lost: "标记不跟进" },
      }
    : {
        title: "Confirmed matches / follow-up",
        empty: "No match confirmed yet.",
        supplier: "Supplier",
        status: "Status",
        note: "Note",
        createdAt: "Confirmed",
        saving: "Saving…",
        failed: "Status update failed",
        statusLabel: { suggested: "suggested", contacted: "contacted", won: "won", lost: "lost" },
        actionLabel: { contacted: "Mark contacted", won: "Mark won", lost: "Mark lost" },
      };

  const t = isZh
    ? { back: "← 返回询价单列表", product: "产品", quantity: "数量", country: "国家", industry: "行业", targetMarket: "目标市场", certifications: "要求认证", cluster: "产业带", status: "状态", public: "公开授权", source: "来源（类型 / 路径）", created: "提交时间", message: "需求说明", buyer: "买家", test: "测试探针 —— 非真实买家，勿当商机跟进" }
    : { back: "← Back to RFQ list", product: "Product", quantity: "Quantity", country: "Country", industry: "Industry", targetMarket: "Target market", certifications: "Certifications", cluster: "Cluster", status: "Status", public: "Public consent", source: "Source (type / path)", created: "Created", message: "Requirements", buyer: "Buyer", test: "TEST PROBE — not a real buyer; do not pursue as business" };

  const certs = Array.isArray(rfq.certifications_req)
    ? (rfq.certifications_req as unknown[]).map(String).join(", ")
    : "";

  const row = (k: string, v: string | null) => (
    <tr className="border-b border-[#e2e8f0]">
      <td className="w-56 px-3 py-2 align-top text-xs uppercase text-[#64748b]">{k}</td>
      <td className="px-3 py-2 text-sm text-[#0f172a]">{v || "—"}</td>
    </tr>
  );

  return (
    <div>
      <Link href={p("/admin/rfqs")} className="text-sm text-[#0f4c81] hover:underline">
        {t.back}
      </Link>
      <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-bold text-[#0f172a]">
        <span className="font-mono">{String(rfq.reference_id)}</span>
        {isTest && (
          <span className="rounded bg-[#fdf3d8] px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
            TEST — {t.test}
          </span>
        )}
      </h1>

      <div className="mt-4 overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
        <table className="w-full text-left">
          <tbody>
            {row(t.product, rfq.product == null ? null : String(rfq.product))}
            {row(t.quantity, rfq.quantity == null ? null : String(rfq.quantity))}
            {row(t.industry, rfq.industry_code == null ? null : String(rfq.industry_code))}
            {row(t.country, rfq.country == null ? null : String(rfq.country))}
            {row(t.targetMarket, rfq.target_market == null ? null : String(rfq.target_market))}
            {row(t.certifications, certs || null)}
            {row(t.cluster, rfq.industrial_cluster_slug == null ? null : String(rfq.industrial_cluster_slug))}
            {row(t.status, rfq.status == null ? null : String(rfq.status))}
            {row(t.public, rfq.is_public ? (isZh ? "是（买家已显式授权）" : "yes (buyer opted in)") : isZh ? "否" : "no")}
            {row(t.source, [rfq.source_type, rfq.source_path].filter(Boolean).join("  ") || null)}
            {row(t.created, new Date(String(rfq.created_at)).toISOString().slice(0, 10))}
            {row(t.message, rfq.message == null ? null : String(rfq.message))}
            {row(
              t.buyer,
              [rfq.company, rfq.email].filter(Boolean).map(String).join("  ·  ") || null
            )}
          </tbody>
        </table>
      </div>

      <RfqMatchesTable referenceId={String(rfq.reference_id)} matches={matches} dict={matchDict} />
      <RfqMatchPanel referenceId={String(rfq.reference_id)} recommendations={recs} dict={dict} />
    </div>
  );
}
