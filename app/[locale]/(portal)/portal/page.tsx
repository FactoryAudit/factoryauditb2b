import type { Metadata } from "next";
import Link from "next/link";
import ProgressRing from "@/components/portal/ProgressRing";
import { getCurrentUser } from "@/lib/supabaseServer";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { getSupplierStats } from "@/lib/visibility";
import { getTrustSnapshot } from "@/lib/trustProfile";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

// /portal —— 工作台总览（视觉参照 Sedex 后台：进度环卡片组 + 大留白）
// 侧边栏外壳由 (portal)/layout.tsx 提供，本页只渲染内容。

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

/** Sedex 风格的白卡片 */
function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={"rounded-xl border border-[#ecebe7] bg-white p-6 sm:p-7 " + className}>
      {children}
    </section>
  );
}

/** 带进度环的卡片 */
function RingCard({
  value,
  title,
  desc,
  ctaLabel,
  ctaHref,
}: {
  value: number | null;
  title: string;
  desc: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex items-start gap-5 rounded-xl border border-[#ecebe7] bg-white p-6">
      <ProgressRing value={value} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold text-[#171717]">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#6d6b66]">{desc}</p>
        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#171717] hover:underline"
          >
            {ctaLabel}
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
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

  if (!user) {
    return (
      <Panel className="text-center">
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
      </Panel>
    );
  }

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
    if (db) {
      const { data: row } = await db
        .from("suppliers")
        .select("slug, legal_name, completeness_percent")
        .eq("id", supplierId)
        .maybeSingle();
      slug = row?.slug ?? "";
      legalName = row?.legal_name ?? "";
      completenessPercent = row?.completeness_percent ?? null;
    }

    // 自评进度：已提交=100，仅有草稿=30，未开始=0
    let selfPct = 0;
    if (db) {
      const { data: sub } = await db
        .from("supplier_assessments")
        .select("id")
        .eq("supplier_id", supplierId)
        .eq("assessment_type", "self_assessment")
        .eq("status", "submitted")
        .limit(1);
      if (sub && sub.length > 0) {
        selfPct = 100;
      } else {
        const { data: draft } = await db
          .from("supplier_assessments")
          .select("id")
          .eq("supplier_id", supplierId)
          .eq("assessment_type", "self_assessment")
          .limit(1);
        if (draft && draft.length > 0) selfPct = 30;
      }
    }

    // 核验进度：现场/线上核验=100，自评=50，无=0
    const snap = await getTrustSnapshot(supplierId);
    const verifyPct =
      snap.status === "ON_SITE_VERIFIED" || snap.status === "ONLINE_VERIFIED"
        ? 100
        : snap.status === "SELF_ASSESSED"
        ? 50
        : 0;

    const stats = await getSupplierStats(supplierId);

    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold text-[#171717]">
            {zh ? "我的工作台" : "My workspace"}
          </h1>
          {legalName ? <p className="mt-1 text-sm text-[#6d6b66]">{legalName}</p> : null}
        </header>

        {/* 顶部行动卡（对齐 Sedex「立即获取完整访问权限」） */}
        <Panel>
          <h2 className="text-[17px] font-bold text-[#171717]">
            {zh ? "让更多买家找到你" : "Get discovered by more buyers"}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#6d6b66]">
            {zh
              ? "完成基础档案与自评问卷、取得核验后，你的企业档案会出现在更多买家的搜索结果中。"
              : "Complete your profile and self-assessment, then get verified — your listing appears in more buyer searches."}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#3f4650]">
            {[
              zh ? "更高曝光" : "Higher visibility",
              zh ? "获得买家信任" : "Build buyer trust",
              zh ? "缩短成交周期" : "Close deals faster",
            ].map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-[#e07a49]">
                  ✓
                </span>
                {s}
              </li>
            ))}
          </ul>
          <Link
            href={p("/supplier-assessment")}
            className="btn btn-primary mt-5 inline-flex items-center text-sm"
          >
            {zh ? "继续完善档案" : "Continue your profile"}
            <span aria-hidden="true" className="ml-1">
              →
            </span>
          </Link>
        </Panel>

        {/* 档案完整度 */}
        <RingCard
          value={completenessPercent}
          title={zh ? "公司及工厂详细信息" : "Company & site details"}
          desc={
            zh
              ? "企业身份、生产实体与业务能力。填得越完整，买家越容易判断你是否匹配。"
              : "Company identity, production facility and capability. The more complete, the easier buyers can assess fit."
          }
          ctaLabel={zh ? "添加 / 更新信息" : "Add / update details"}
          ctaHref={p("/supplier-assessment")}
        />

        {/* 自评 + 核验 */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <RingCard
            value={selfPct}
            title={zh ? "自我评估表 (SAQ)" : "Self-assessment (SAQ)"}
            desc={
              zh
                ? "覆盖劳工、健康安全、环境与商业道德四大支柱。"
                : "Covers labour, health & safety, environment and business ethics."
            }
            ctaLabel={
              selfPct === 100
                ? zh
                  ? "查看自评"
                  : "View assessment"
                : zh
                ? "添加详细信息"
                : "Add details"
            }
            ctaHref={p("/supplier-assessment")}
          />
          <RingCard
            value={verifyPct}
            title={zh ? "核验状态" : "Verification"}
            desc={
              zh
                ? "自评不等于核验。取得平台核验后，档案可信度显著提升。"
                : "Self-assessment is not verification. Platform verification lifts your credibility."
            }
            ctaLabel={zh ? "查看表现看板" : "View performance"}
            ctaHref={p("/supplier-dashboard")}
          />
        </div>

        {/* 表现数据 */}
        <Panel>
          <h2 className="text-[15px] font-bold text-[#171717]">
            {zh ? "档案表现" : "Profile performance"}
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: zh ? "档案浏览" : "Views", value: stats.profileViews },
              { label: zh ? "独立访客" : "Visitors", value: stats.uniqueVisitors },
              { label: zh ? "被分享" : "Shares", value: stats.shares },
            ].map((c) => (
              <div key={c.label} className="rounded-lg bg-[#f7f6f3] px-4 py-3 text-center">
                <div className="text-xl font-extrabold text-[#171717]">{c.value}</div>
                <div className="mt-0.5 text-xs text-[#6d6b66]">{c.label}</div>
              </div>
            ))}
          </div>
          <Link
            href={p("/supplier-dashboard")}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#171717] hover:underline"
          >
            {zh ? "查看完整看板" : "View full dashboard"}
            <span aria-hidden="true">→</span>
          </Link>
        </Panel>

        {/* 公开档案 */}
        {slug ? (
          <Panel className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-bold text-[#171717]">
                {zh ? "你的公开档案" : "Your public profile"}
              </h2>
              <p className="mt-1 text-sm text-[#6d6b66]">
                {zh ? "看看买家眼中的企业档案。" : "See how buyers view your listing."}
              </p>
            </div>
            <Link href={p(`/suppliers/${slug}`)} className="btn btn-outline shrink-0 text-sm">
              {zh ? "查看" : "View"}
            </Link>
          </Panel>
        ) : null}
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
      db.from("rfqs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    savedCount = savedRes.count ?? 0;
    rfqCount = rfqRes.count ?? 0;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-[#171717]">
          {zh ? "我的工作台" : "My workspace"}
        </h1>
      </header>

      {/* 顶部行动卡 */}
      <Panel>
        <h2 className="text-[17px] font-bold text-[#171717]">
          {zh ? "找到经过核验的供应商" : "Source from verified suppliers"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#6d6b66]">
          {zh
            ? "按国家、行业与风险评分筛选，收藏、对比并直接发起询价。"
            : "Filter by country, industry and risk score — save, compare and send RFQs directly."}
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#3f4650]">
          {[
            zh ? "风险评分参考" : "Risk scores",
            zh ? "证据与核验记录" : "Evidence records",
            zh ? "直接对接工厂" : "Direct factory contact",
          ].map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="text-[#e07a49]">
                ✓
              </span>
              {s}
            </li>
          ))}
        </ul>
        <Link href={p("/suppliers")} className="btn btn-primary mt-5 inline-flex items-center text-sm">
          {zh ? "浏览供应商" : "Browse suppliers"}
          <span aria-hidden="true" className="ml-1">
            →
          </span>
        </Link>
      </Panel>

      {/* 活动数据 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Link
          href={p("/account/saved")}
          className="group rounded-xl border border-[#ecebe7] bg-white p-6 transition hover:border-[#d9d5cc]"
        >
          <p className="text-xs uppercase tracking-wide text-[#6d6b66]">
            {zh ? "收藏的供应商" : "Saved suppliers"}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-[#171717]">{savedCount}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#171717] group-hover:underline">
            {zh ? "查看收藏" : "View saved"}
            <span aria-hidden="true">→</span>
          </p>
        </Link>
        <Link
          href={p("/account/rfqs")}
          className="group rounded-xl border border-[#ecebe7] bg-white p-6 transition hover:border-[#d9d5cc]"
        >
          <p className="text-xs uppercase tracking-wide text-[#6d6b66]">
            {zh ? "我的询价" : "My RFQs"}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-[#171717]">{rfqCount}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#171717] group-hover:underline">
            {zh ? "查看询价" : "View RFQs"}
            <span aria-hidden="true">→</span>
          </p>
        </Link>
      </div>

      {/* 快捷入口 */}
      <Panel>
        <h2 className="text-[15px] font-bold text-[#171717]">{zh ? "下一步" : "Next steps"}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href={p("/rfq")}
            className="rounded-lg border border-[#ecebe7] px-4 py-3 text-sm font-medium text-[#171717] transition hover:border-[#d9d5cc] hover:bg-[#f7f6f3]"
          >
            {zh ? "发起询价 →" : "Submit an RFQ →"}
          </Link>
          <Link
            href={p("/assessment-faq/buyer")}
            className="rounded-lg border border-[#ecebe7] px-4 py-3 text-sm font-medium text-[#171717] transition hover:border-[#d9d5cc] hover:bg-[#f7f6f3]"
          >
            {zh ? "读懂供应商自评 →" : "Understand self-assessments →"}
          </Link>
        </div>
      </Panel>
    </div>
  );
}
