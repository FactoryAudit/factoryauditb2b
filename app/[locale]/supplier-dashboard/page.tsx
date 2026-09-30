import type { Metadata } from "next";
import SupplierDashboard from "@/components/supplier/SupplierDashboard";
import VerificationBadge, {
  type BadgeState,
  type TrustProfileDict,
} from "@/components/supplier/VerificationBadge";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import {
  getSupplierStats,
  computeVisibilityPoints,
  recomputeVisibilityScore,
  type VisibilityInput,
} from "@/lib/visibility";
import { getTrustSnapshot } from "@/lib/trustProfile";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/supplier-dashboard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ supplier?: string; email?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.supplierDashboard.pageTitle,
    description: t.supplierDashboard.pageDesc,
    // 供应商私有看板：不索引
    robots: { index: false, follow: false },
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const sp = await searchParams;
  const dict = await getDictionary(locale);
  const sd = (dict.supplierDashboard ?? {}) as Record<string, string>;
  const tp = (dict.trustProfile ?? {}) as unknown as TrustProfileDict;

  // 归属裁决（会话优先 / 邮箱兜底 / 歧义拒）。与 supplier-assessment 同一套闸门。
  const access = await resolveSupplierAccess({
    claimedSupplierId: (sp.supplier || "").trim() || null,
    email: (sp.email || "").trim() || null,
  });

  if (!access.ok) {
    const reason = access.code;
    return (
      <main className="container py-10" data-track-page="supplier_dashboard">
        <section className="max-w-3xl mx-auto text-center mb-8">
          <h1 className="text-4xl font-extrabold text-[#171717] mt-2">
            {sd.pageTitle ?? "Supplier Dashboard"}
          </h1>
        </section>
        <div className="card p-6 max-w-xl mx-auto text-center">
          {reason === "not_owner" ? (
            <p className="text-[#b45309]">
              {dict.selfAssessment?.notOwner ??
                "This account is not linked to a supplier."}
            </p>
          ) : (
            <p className="text-[#2b2b2b]">
              {dict.selfAssessment?.signInRequired ??
                "Please sign in to your supplier account to continue."}
            </p>
          )}
          <a
            className="btn-primary inline-block mt-4 px-6 py-3"
            href={localePath(locale, "/account")}
          >
            {dict.selfAssessment?.signIn ?? "Sign in"}
          </a>
        </div>
      </main>
    );
  }

  const supplierId = access.identity.supplierId;

  // 聚合统计（service_role，只返回聚合数，绝不返回买家个人信息）
  const stats = await getSupplierStats(supplierId);

  // 三态信任（复用 CS-D 唯一 resolver，绝不本地重算）
  const snap = await getTrustSnapshot(supplierId);
  const badgeState = snap.status as BadgeState;

  // 分享需要 slug + 可见度计算所需字段（绝不传内部 supplier UUID 给客户端）
  const db = createAdminClient();
  let slug = "";
  let completenessPercent: number | null = null;
  let hasSubmittedAssessment = false;
  if (db) {
    const { data: row } = await db
      .from("suppliers")
      .select("slug, completeness_percent")
      .eq("id", supplierId)
      .maybeSingle();
    slug = row?.slug ?? "";
    completenessPercent = row?.completeness_percent ?? null;
    const { data: arow } = await db
      .from("supplier_assessments")
      .select("id")
      .eq("supplier_id", supplierId)
      .eq("assessment_type", "self_assessment")
      .eq("status", "submitted")
      .limit(1);
    hasSubmittedAssessment = !!arow && arow.length > 0;
  }

  // 可见度积分：实时计算并持久化刷新预计算表（该表先前无人写入，
  // 看板必须展示真实分而非恒为 "—"）。EXPIRED 视为无有效验证加成（等同 NONE）。
  const trustStatus: VisibilityInput["trustStatus"] =
    snap.status === "ONLINE_VERIFIED"
      ? "ONLINE_VERIFIED"
      : snap.status === "ON_SITE_VERIFIED"
      ? "ON_SITE_VERIFIED"
      : snap.status === "SELF_ASSESSED"
      ? "SELF_ASSESSED"
      : "NONE";
  const visibilityInput: VisibilityInput = {
    completenessPercent,
    hasSubmittedAssessment,
    trustStatus,
    stats,
  };
  const visibilityPoints =
    (await recomputeVisibilityScore(supplierId, visibilityInput)) ??
    computeVisibilityPoints(visibilityInput);

  return (
    <main className="container py-10" data-track-page="supplier_dashboard">
      <section className="max-w-4xl mx-auto mb-8">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">
          Supplier Portal
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-extrabold text-[#171717]">
            {sd.pageTitle ?? "Supplier Dashboard"}
          </h1>
          <VerificationBadge state={badgeState} dict={tp} href="#verification-details" />
        </div>
        <p className="text-[#6d6b66] mt-3 text-lg">
          {sd.pageDesc ??
            "Track how buyers discover and engage with your verified supplier profile."}
        </p>
      </section>

      <SupplierDashboard
        slug={slug}
        sd={sd}
        stats={stats}
        visibilityPoints={visibilityPoints}
      />

      <p className="text-center text-xs text-[#8c8982] mt-10">
        <a className="underline" href={localePath(locale, "/supplier-assessment")}>
          {sd.backToAssessment ?? "Edit self-assessment"}
        </a>{" "}
        · FactoryAuditB2B
      </p>
    </main>
  );
}
