import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabaseServer";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { getSupplierStats } from "@/lib/visibility";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

// /portal —— 工作台总览页（内容）。
//
// 侧边栏外壳已由 (portal)/layout.tsx 统一提供，本页面只渲染工作台内容。
// 服务端按身份分流：供应商 → 供应商工作台；买家 → 买家工作台。
// 未登录时由 layout 直接放行 children，本页面渲染「请登录」引导。

const PATH = "/portal";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.account.h1,
    description: t.account.lead,
    robots: { index: false, follow: false },
  });
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh" || locale === "zh-TW";

  const user = await getCurrentUser();

  // 未登录 → 请登录引导（服务端直出，不依赖客户端 /api/me）
  if (!user) {
    return (
      <div className="card p-8 text-center max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-[#171717]">{t.account.signInTitle}</h1>
        <p className="mt-2 text-[#6d6b66]">{t.account.signInLead}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={p("/login")} className="btn btn-primary text-sm">
            {t.account.panel.signInCta}
          </Link>
          <Link href={p("/register")} className="btn btn-outline text-sm">
            {t.account.panel.registerCta}
          </Link>
        </div>
      </div>
    );
  }

  // 供应商归属裁决（复用唯一裁决层，session 邮箱反查 suppliers.contact_email）
  const access = await resolveSupplierAccess({
    claimedSupplierId: null,
    email: null,
  });
  const isSupplier = access.ok;

  // ==================== 供应商工作台 ====================
  if (isSupplier) {
    const supplierId = access.identity.supplierId;
    const db = createAdminClient();
    let slug = "";
    let completenessPercent: number | null = null;
    let legalName = "";
    let verificationStatus: string | null = null;
    if (db) {
      const { data: row } = await db
        .from("suppliers")
        .select("slug, legal_name, completeness_percent, verification_status")
        .eq("id", supplierId)
        .maybeSingle();
      slug = row?.slug ?? "";
      legalName = row?.legal_name ?? "";
      completenessPercent = row?.completeness_percent ?? null;
      verificationStatus = row?.verification_status ?? null;
    }
    const stats = await getSupplierStats(supplierId);

    return (
      <div>
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold text-[#171717]">
            {zh ? "供应商工作台" : "Supplier Workspace"}
          </h1>
          {legalName ? <p className="mt-1 text-[#6d6b66]">{legalName}</p> : null}
        </header>

        {/* 档案完成度 + 核验状态 */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-[#6d6b66]">
              {zh ? "档案完成度" : "Profile completeness"}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[#171717]">
              {completenessPercent === null ? "—" : `${completenessPercent}%`}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-[#6d6b66]">
              {zh ? "核验状态" : "Verification status"}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-[#171717]">
              {verificationStatus === null || verificationStatus === ""
                ? "—"
                : verificationStatus}
            </div>
          </div>
        </section>

        {/* 看板摘要 */}
        <section className="card p-5 mt-6">
          <h2 className="text-lg font-bold text-[#171717]">
            {zh ? "档案表现" : "Profile performance"}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: zh ? "档案浏览" : "Profile views", value: stats.profileViews },
              { label: zh ? "独立访客" : "Unique visitors", value: stats.uniqueVisitors },
              { label: zh ? "被分享" : "Times shared", value: stats.shares },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-[#ebe8e1] bg-white p-4 text-center">
                <div className="text-xl font-extrabold text-[#171717]">{c.value}</div>
                <div className="mt-1 text-xs text-[#6d6b66]">{c.label}</div>
              </div>
            ))}
          </div>
          <Link href={p("/supplier-dashboard")} className="muted-link mt-4 inline-block text-sm">
            {zh ? "查看完整看板 →" : "View full dashboard →"}
          </Link>
        </section>

        {/* 快捷入口 */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href={p("/supplier-assessment")}
            className="card p-5 transition hover:border-[#171717]"
          >
            <div className="font-semibold text-[#171717]">
              {zh ? "完成自评问卷" : "Complete self-assessment"}
            </div>
            <p className="mt-1 text-sm text-[#3f4650]">
              {zh
                ? "填写基础档案即可提交发布；质量、社会责任、环保模块按需补充。"
                : "Complete the basic profile to submit for review; add quality, social and environmental modules as needed."}
            </p>
          </Link>
          {slug ? (
            <Link
              href={p(`/suppliers/${slug}`)}
              className="card p-5 transition hover:border-[#171717]"
            >
              <div className="font-semibold text-[#171717]">
                {zh ? "查看公开档案" : "View public profile"}
              </div>
              <p className="mt-1 text-sm text-[#3f4650]">
                {zh ? "看看买家眼中的你的企业档案。" : "See how buyers view your supplier profile."}
              </p>
            </Link>
          ) : (
            <div className="card p-5 opacity-60">
              <div className="font-semibold text-[#171717]">
                {zh ? "公开档案未生成" : "Public profile not ready"}
              </div>
              <p className="mt-1 text-sm text-[#3f4650]">
                {zh
                  ? "完成自评并提交审核后生成。"
                  : "Available after you complete the self-assessment and submit for review."}
              </p>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ==================== 买家工作台 ====================
  const db = createAdminClient();
  let savedCount = 0;
  let rfqCount = 0;
  if (db && user.id) {
    const [savedRes, rfqRes] = await Promise.all([
      db
        .from("saved_suppliers")
        .select("supplier_id", { count: "exact", head: true })
        .eq("user_id", user.id),
      db
        .from("rfqs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);
    savedCount = savedRes.count ?? 0;
    rfqCount = rfqRes.count ?? 0;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-[#171717]">
          {zh ? "买家工作台" : "Buyer Workspace"}
        </h1>
      </header>

      {/* 活动统计 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={p("/account/saved")} className="card p-5 transition hover:border-[#171717]">
          <div className="text-xs uppercase tracking-wide text-[#6d6b66]">
            {zh ? "收藏的供应商" : "Saved suppliers"}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#171717]">{savedCount}</div>
        </Link>
        <Link href={p("/account/rfqs")} className="card p-5 transition hover:border-[#171717]">
          <div className="text-xs uppercase tracking-wide text-[#6d6b66]">
            {zh ? "我的询价" : "My RFQs"}
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#171717]">{rfqCount}</div>
        </Link>
      </section>

      {/* 快捷入口 */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={p("/suppliers")} className="card p-5 transition hover:border-[#171717]">
          <div className="font-semibold text-[#171717]">
            {zh ? "查找供应商" : "Find suppliers"}
          </div>
          <p className="mt-1 text-sm text-[#3f4650]">
            {zh ? "按国家、行业、风险评分筛选已验证供应商。" : "Browse verified suppliers by country, industry and risk score."}
          </p>
        </Link>
        <Link href={p("/rfq")} className="card p-5 transition hover:border-[#171717]">
          <div className="font-semibold text-[#171717]">
            {zh ? "发起询价" : "Submit an RFQ"}
          </div>
          <p className="mt-1 text-sm text-[#3f4650]">
            {zh ? "提交采购需求，让匹配的供应商主动联系你。" : "Post your sourcing request and let matched suppliers reach out."}
          </p>
        </Link>
      </section>
    </div>
  );
}
