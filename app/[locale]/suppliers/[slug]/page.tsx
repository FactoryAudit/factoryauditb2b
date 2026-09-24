import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { getSupplierDetail, listSupplierSlugs, lastCheckedOf } from "@/lib/queries";
import {
  getSupplierPublicCertifications,
  getSupplierPublicAudits,
} from "@/lib/queries";
import { CertificationList } from "@/components/CertificationList";
import { AuditHistoryPanel } from "@/components/AuditHistoryPanel";
// CS-12：公开侧「工商登记信息」与「工厂自述证书」（两条独立区块，分别落位）
import {
  SupplierRegistrationPanel,
  SupplierSelfReportedCerts,
} from "@/components/SupplierRegistrationPanel";
// CS-21：三标签审核徽章（工厂自评估 / 平台在线评估 / 平台现场审核）
import { getSupplierTags } from "@/lib/supplierAssessments";
import AssessmentTags from "@/components/supplier/AssessmentTags";
// CS-22 / CS-A：公开档案页增强 —— 验证徽章 / 详情 / 历史 / 工厂照片 / 分享
// 状态一律由服务端推导（lib/trustProfile.ts），组件只渲染、绝不自判 Verified。
import {
  getTrustSnapshot,
  getSupplierPublicFlags,
  isProfilePublic,
  isProfileNoindex,
} from "@/lib/trustProfile";
import VerificationBadge, {
  type BadgeState,
} from "@/components/supplier/VerificationBadge";
import VerificationDetails from "@/components/supplier/VerificationDetails";
import FactoryPhotoGallery from "@/components/supplier/FactoryPhotoGallery";
import ShareProfileButton from "@/components/supplier/ShareProfileButton";
import ProfileViewTracker from "@/components/supplier/ProfileViewTracker";
import { listPublicFactoryImages } from "@/lib/supplierImages";
// CS-21：采购商侧审核报告付费下载占位（标签①②③）
import AssessmentReportPaywall from "@/components/buyer/AssessmentReportPaywall";
import {
  publicVerificationLevel,
  LEVEL_SCOPE,
  evidenceLabel,
  evidenceProvenance,
  type EvidenceProvenance,
} from "@/lib/verification";
import { overallLevel, LEVEL_COLOR } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, LOCALE_META, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";
// PHASE 03：供应商档案的 SEO / GEO / AI-search 唯一推导层。
//   标题 / 描述 / Buyer Snapshot / FAQ / Schema / 可索引性 全部由这里产出，
//   页面只负责「把推导结果渲染出来」—— 绝不在页面里另写一份 SEO 判断。
import {
  resolveSupplierSeoCopy,
  generateSupplierTitle,
  generateSupplierDescription,
  generateSupplierSnapshot,
  generateSupplierFaq,
  generateSupplierSchema,
  determineSupplierIndexability,
  dateOnly,
  supplierSeoDataFromView,
  type SnapshotLabels,
} from "@/lib/seo/supplierSeo";
import { ORG_URL } from "@/lib/organizationSchema";
// STEP 10-D §22：供应商档案的「产业带」回链 —— 用正式层级 canonical URL（不得手写）。
// LEGACY_CLUSTER_REDIRECTS 仅含 8 个 P0 slug→canonical，恰好等于 Admin 允许写入的已发布集群集合。
import { LEGACY_CLUSTER_REDIRECTS } from "@/lib/clusterRoutes";
import { UnlockGate } from "@/components/UnlockGate";
// 解锁字段按需取：真值不随页面下发，避免进 RSC flight payload（游客看源码就能读到）
import { UnlockedValue, UnlockedEvidenceStatus } from "@/components/UnlockedValue";
// CS-05b：Guest 的「5 家不同 supplier」额度判定（客户端 localStorage 记账）
import { GuestAccessProvider } from "@/components/GuestAccessProvider";

const BASE = "https://factoryauditb2b.com";
const DIRECTORY_PATH = "/suppliers";

/**
 * PHASE 03：把数据层的供应商视图映射成 SEO 推导输入。
 *
 * 映射逻辑**不在这里** —— 它在 `lib/seo/supplierSeo.ts` 的 `supplierSeoDataFromView()`，
 * 与回归脚本共用同一段代码。页面只负责把公开层的核验记录喂进去，
 * 绝不自行推导等级（等级只能由 publicVerificationLevel 决定）。
 */
function buildSupplierSeoData(
  s: NonNullable<Awaited<ReturnType<typeof getSupplierDetail>>>,
  verifiedAudits: Awaited<ReturnType<typeof getSupplierPublicAudits>>,
  verifiedCerts: Awaited<ReturnType<typeof getSupplierPublicCertifications>>
) {
  return supplierSeoDataFromView(s, {
    verifiedAudits,
    verifiedCertifications: (verifiedCerts ?? []).map((c) => ({
      programCode: c.programCode,
      issuingBody: c.issuingBody,
    })),
  });
}

// ★ CS-19（工单 SEO-20260918-FAB 任务 1.1 / 1.3）—— 本页改走 ISR（一小时窗口）。
//
// 背景：此前 app/[locale]/layout.tsx 的 `await headers()` 把整棵 [locale] 子树拖成
// 动态渲染；摘除后其余页面转为构建期预渲染（prerender-manifest 319 → 1,597）。
// 本页则按工单任务 1.3 由 `force-dynamic` 改为 ISR。
//
// 取舍：
//   · 收益：构建期为 sitemap 中本页家族（81 / 1,233 = 6.6%）产出静态产物；
//     增量缓存就位后，不再逐请求跑 React SSR + 3 次 Supabase 往返。
//   · 代价：窗口内数据最多滞后 1 小时。供应商「发布」= DB 的 is_published 改 true
//     （一次 UPDATE），改完未必立刻可见。**若发布时效重新成为硬要求，
//     把下面的 revalidate 去掉并恢复 `export const dynamic = "force-dynamic";` 即可。**
//
// 🔴 部署事实（2026-09-20 核对，**已修正 09-18 的过时结论**）：
//   09-18 曾判定 `open-next.config.ts` 是 `defineCloudflareConfig({})` ⇒ 缓存层为 dummy
//   ⇒ 每请求现场渲染、revalidate 形同虚设但**数据实时**。该结论**已失效**。
//
//   现配置为 `incrementalCache: staticAssetsIncrementalCache` +
//   `enableCacheInterception: true`：`.open-next/cache/` 被复制进
//   `assets/cdn-cgi/_next_cache/`，其 `set()` / `delete()` 均为 no-op
//   ⇒ **缓存只读，页面数据在构建时冻结**。
//
//   实测响应头（线上）：
//     · 本页（预渲染/ISR）：`Cache-Control: s-maxage=30xx, stale-while-revalidate=2592000`
//       + `x-nextjs-prerender: 1` ⇒ 构建时快照
//     · /industrial-clusters（force-dynamic）：`private, no-cache, no-store, max-age=0,
//       must-revalidate` ⇒ 即时
//
//   ⚠️ 因此 `revalidate = 3600` 当前**不生效**：本页内容会冻结到下一次
//      build + deploy，而不是每小时自更新。改库（如后台填 cluster_slug / region、
//      发布供应商）后，产业带页可能马上可见，本页却要等下一次发布。
//
//   ✅ 现行策略（用户 2026-09-20 拍板，写进发布流程）：
//      **数据库修改 → 正式发布时必须重新 build/deploy。**
//      在后台开始频繁改供应商资料之前，不改 R2 ISR —— 收益不抵风险。
//      将来若发布时效重新成为硬要求，二选一：
//        a) 配 R2 增量缓存：建 bucket + 加 r2_buckets 绑定 + 传入
//           `incrementalCache: r2IncrementalCache`（真 ISR，按窗口更新）；
//        b) 去掉下面的 revalidate 并恢复 `export const dynamic = "force-dynamic";`
//           （放弃静态产物，换回逐请求实时）。
//      ⚠️ 无论选哪条，都**不要**加 Cache Rule 边缘缓存并覆盖 /suppliers ——
//         那会按边缘 TTL 提供过期档案。
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await listSupplierSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const path = `${DIRECTORY_PATH}/${slug}`;
  const t = await getDictionary(locale);
  const contentLocale = locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh" : "en";
  const s = await getSupplierDetail(slug, contentLocale);
  if (!s) {
    return buildPageMetadata({
      locale,
      path,
      title: t.supplierProfile.metaTitle,
      description: t.supplierProfile.metaDesc,
      robots: { index: false },
    });
  }
  const [verifiedCerts, verifiedAudits] = await Promise.all([
    getSupplierPublicCertifications(slug),
    getSupplierPublicAudits(slug),
  ]);
  const { seo, level } = buildSupplierSeoData(s, verifiedAudits, verifiedCerts);
  const copy = resolveSupplierSeoCopy(locale);
  const opts = { copy, levelLabel: t.verification.levelsShort[level] };

  // ★ PHASE 03：meta 不再手工拼接。
  //   旧实现把 legacy verification_status 直接写进 title/description，
  //   等于把「无证据支撑的历史声明」送进 Google 结果页 —— 最高风险的公开位。
  //   现在统一走 lib/seo/supplierSeo.ts：未核验时描述里显式写 supplier-declared。
  const title = generateSupplierTitle(seo, locale, opts);
  const description = generateSupplierDescription(seo, locale, opts);

  // ★ §八：可索引性闸门。不达标的档案 noindex（但仍 follow 内链），
  //   与 sitemap 的提交集合同源（app/sitemap.ts 调的是同一个函数）。
  const verdict = determineSupplierIndexability(seo);

  // CS-A：叠加「公开档案」闸门。
  //   只在**显式**不公开时才追加 noindex（public_profile_enabled=false /
  //   profile_status ∈ private|unlisted / is_published=false）。
  //   profile_status 缺失（NULL）不算 noindex —— 那是"还没设置"，不是"不许收录"，
  //   混为一谈会把一批正在被收录的页面一夜掉索引。
  const flags = await getSupplierPublicFlags(slug);
  const blocked = flags ? isProfileNoindex(flags) : false;

  return buildPageMetadata({
    locale,
    path,
    title,
    description,
    robots: verdict.indexable && !blocked
      ? { index: true, follow: true }
      : { index: false, follow: true },
  });
}

export default async function SupplierProfilePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const sp = t.supplierProfile;
  const ev = t.evidence;
  const v = t.verification;
  const rp = t.reportPreview;
  const p = (href: string) => localePath(locale, href);

  // CS-05b：注册 CTA 一律带 ?next= 回到**当前**供应商页。
  // 第 6 家被 Guest 额度拦下时尤其关键 —— 用户注册完必须回到他原本想看的那家，
  // 被丢回首页等于把最强的注册意图信号浪费掉。
  const supplierPath = p(`${DIRECTORY_PATH}/${slug}`);
  const registerHref = `${p("/register")}?next=${encodeURIComponent(supplierPath)}`;

  // 内容层只有 en/zh 两版：zh-TW 走 zh 文案并在各自函数内繁化，其余语言一律 en。
  const contentLocale = locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh" : "en";
  const s = await getSupplierDetail(slug, contentLocale);
  if (!s) notFound();

  // 公开认证 / 审核记录（spec §5/§12）。queries 层只返回 VERIFIED 且供应商已发布的记录，
  // 表未建或未配置数据库时返回 [] —— 前台不崩，只是不渲染内容。
  const [verifiedCerts, verifiedAudits] = await Promise.all([
    getSupplierPublicCertifications(slug),
    getSupplierPublicAudits(slug),
  ]);

  // CS-21：三标签审核（仅展示已发布 published 的标签）
  const assessmentTags = await getSupplierTags(s.id);

  // ==========================================================================
  // CS-22 / CS-A：信任档案（徽章 / 详情 / 历史 / 工厂照片 / 分享）
  //
  // 所有状态在这里由服务端一次性推导完，下面只做渲染：
  //   · badgeState  —— 三态 + EXPIRED，绝不在组件里判断谁能拿 Verified
  //   · profileIsPublic —— 公开闸门，决定照片/分享是否渲染 + 是否 noindex
  //   · factoryPhotos —— 只可能是 APPROVED + PUBLIC 的行（见 supplierImages）
  // ==========================================================================
  const tp = t.trustProfile;
  const publicFlags = await getSupplierPublicFlags(slug);
  const profileIsPublic = publicFlags ? isProfilePublic(publicFlags) : false;
  const trust = await getTrustSnapshot(s.id);
  // 状态完全由 lib/trustProfile.resolveVerificationBadge 推导（含 EXPIRED），
  // 组件不再自行判断谁能拿 Verified（CS-D #02 / #13 / #22）。
  const badgeState: BadgeState = trust.status as BadgeState;
  const factoryPhotos = profileIsPublic ? await listPublicFactoryImages(s.id) : [];

  // STEP 10-D §22：供应商档案「产业带」回链。仅当 cluster_slug 命中已发布 P0 集群
  // （LEGACY_CLUSTER_REDIRECTS 即 Admin 允许写入的集合）时才给可点击链接；
  // REVIEW / KEEP_NULL（cluster_slug = NULL）一律为 undefined ⇒ 纯文本展示。
  const clusterHref = s.clusterSlug ? LEGACY_CLUSTER_REDIRECTS[s.clusterSlug] : undefined;

  const ec = t.evidenceCenter;
  const uiLocale = contentLocale;

  // ★ CS-02：公开等级的唯一权威推导。
  //   旧代码 `levelFromStatus(s.verificationStatus)` 直接拿 legacy 声明文本
  //   （"Identity Verified" / "Factory Verified"）当等级，导致零证据的供应商
  //   也显示 Business checked / Factory verified。这里改为：
  //     ① 权威字段 suppliers.verification_level
  //     ② 且必须有真实已发布的审核/核验事件
  //   二者缺一 → Level 0 · Unverified。Evidence 条数不参与升档。
  const hasRealVerificationEvent = verifiedAudits.length > 0;
  const level = publicVerificationLevel(s.verificationLevel, hasRealVerificationEvent);
  const scope = LEVEL_SCOPE[level];
  // 风险等级由引擎推导，不在页面重复判定阈值。
  // 🔴 无分数 ⇒ 无等级。绝不用 `overallLevel(s.riskScore ?? 0)` —— 0 是 CRITICAL，
  //    会让一个「平台尚未评分」的企业在页面上被标成「High risk」。
  const riskBand =
    typeof s.riskScore === "number" ? overallLevel(s.riskScore) : null;
  // 无分数时用中性灰，绝不借用 CRITICAL 的红 —— 颜色本身也是一种风险断言。
  const riskColor = riskBand ? LEVEL_COLOR[riskBand] : "#64748b";

  // 证据状态标签不再在本页拼装：核验状态属 paid 层，
  // 由 /api/suppliers/[slug]/unlocked 校验档位后本地化返回（避免真值进 RSC payload）。
  // 展示口径不变：只展示「已核验 / 部分核验 / 未核验 / 已过期 / 缺失」，
  // 不提供原始文件下载（PRD §20 + 第三方报告分发限制）。

  const provenanceLabel: Record<EvidenceProvenance, string> = {
    provided: sp.provProvided,
    reviewed: sp.provReviewed,
    independent: sp.provIndependent,
    onsite: sp.provOnsite,
  };
  const provenanceStyle: Record<EvidenceProvenance, string> = {
    provided: "border-[#cbd5e1] text-[#475569]",
    reviewed: "border-[#0f4c81] text-[#0f4c81]",
    independent: "border-[#0f4c81] text-[#0f4c81] bg-[#e6eef6]",
    onsite: "border-[#0f4c81] text-white bg-[#0f4c81]",
  };
  /* 最近一次核验日期：取自证据记录，没有记录就显示「暂无核验记录」。
     绝不用 new Date() 顶替 —— 那会把「今天」伪装成核验日期。 */
  const lastVerifiedDate = lastCheckedOf(s.evidence);

  const profileUrl = `${BASE}${p(`${DIRECTORY_PATH}/${slug}`)}`;

  // ===========================================================================
  // PHASE 03：SEO / GEO / AI-search 产物全部由 lib/seo/supplierSeo.ts 推导
  // ===========================================================================
  const { seo } = buildSupplierSeoData(s, verifiedAudits, verifiedCerts);
  const seoCopy = resolveSupplierSeoCopy(locale);
  const seoOpts = { copy: seoCopy, levelLabel: v.levelsShort[level] };

  // FAQ：每一条都由真实数据触发（§七）。渲染出来的就是 FAQPage 的 mainEntity，
  // 不存在「Schema 里有、页面上看不到」的情况。
  const faq = generateSupplierFaq(seo, locale, seoOpts);

  // Buyer Snapshot：只用公开层字段；行标签全部来自既有字典键 ⇒ 九语本地化（§六 / §八）
  const snapshotLabels: SnapshotLabels = {
    englishName: sp.regEnglishName,
    city: t.trust.cityLabel,
    // STEP-04：region / industrialCluster 两个新行标签。
    // 两者都由 generateSupplierSnapshot 的 pushIfPresent 渲染 —— **无值即无该行**，
    // 不会出现「无资料」占位（当前 region / cluster_slug 全为 NULL ⇒ 页面与改动前逐字一致）。
    region: sp.regionLabel,
    country: t.suppliers.filterCountry,
    businessType: sp.businessTypeLabel,
    industry: sp.industryLabel,
    industrialCluster: sp.industrialClusterLabel,
    products: sp.productsTitle,
    address: sp.regAddress,
    website: sp.regWebsite,
    registrationNumber: sp.regRegistrationNo,
    verificationLevel: sp.verificationLevel,
    lastUpdated: sp.lastUpdated,
    lastChecked: sp.lastChecked,
    evidenceOnFile: v.evidenceOnFile,
    // 无分数时留空：generateSupplierSnapshot 只在 profileScore 是数字时才会读这个标签，
    // 留空让它不参与，绝不为了填满字段而给一个不存在的等级。
    scoreBand: riskBand ? t.risk.ui.level[riskBand] : "",
  };
  const snapshot = generateSupplierSnapshot(seo, locale, snapshotLabels, seoOpts);

  // 可索引性闸门与 generateMetadata / app/sitemap.ts 同源。
  // 页面本身不需要消费判定结果（robots 在 metadata 里），但把它算出来是刻意的：
  // 三处调用同一个纯函数，任何一处改动都会让另外两处立即同频，
  // 不存在「sitemap 提交了、页面却 noindex」的漂移空间。
  const indexability = determineSupplierIndexability(seo);
  if (!indexability.indexable) {
    // 不可索引的档案仍然渲染（用户可能从内链点进来），只是不进搜索引擎。
    // 这里不做 UI 处理，仅保留判定结果以便运行时排查。
    console.warn(
      `[supplier-seo] ${slug} noindex: ${indexability.reason} (attrs: ${indexability.attributes.join(",") || "none"})`
    );
  }

  const jsonLd = generateSupplierSchema(
    seo,
    {
      locale,
      profileUrl,
      homeUrl: `${BASE}${p("/")}`,
      directoryUrl: `${BASE}${p(DIRECTORY_PATH)}`,
      breadcrumbHome: t.countryHub.breadcrumbHome,
      breadcrumbDirectory: sp.directoryBreadcrumb,
      htmlLang: LOCALE_META[locale].htmlLang,
      publisherId: `${ORG_URL}#organization`,
    },
    faq
  );

  return (
    // CS-05b：整页共享同一次 Guest 额度判定（避免"字段 A 解锁、字段 B 锁着"的撕裂）。
    // key={s.id} —— 客户端在两家供应商之间跳转时强制重新判定，不沿用上一家的结果。
    <GuestAccessProvider key={s.id} supplierId={s.id}>
      <main className="container py-10" data-track-page={ANALYTICS_EVENTS.profileView}>
        <JsonLd data={jsonLd} />

        {/* 面包屑（可见 + JSON-LD 一致） */}
        <nav aria-label={t.supplierProfile.directoryBreadcrumb} className="text-sm text-[#64748b]">
          <Link href={p("/")} className="hover:text-[#0f4c81]">
            {t.countryHub.breadcrumbHome}
          </Link>
          <span className="mx-2">/</span>
          <Link href={p(DIRECTORY_PATH)} className="hover:text-[#0f4c81]">
            {sp.directoryBreadcrumb}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#0f172a]">{s.legalName}</span>
        </nav>

        {/* 公开摘要：核心价值直出，会员墙不放在顶部 */}
        <section className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h1 className="text-3xl font-bold text-[#0f172a]">{s.legalName}</h1>
            <p className="text-[#64748b] mt-1">
              {s.city}, {s.countryName ?? s.country.toUpperCase()} ·{" "}
              {s.businessType === "Manufacturer" ? sp.manufacturer : sp.tradingCompany}
            </p>
            <p className="mt-3 text-sm text-[#475569]">{s.mainProducts.join(" · ")}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {s.capabilities.map((c) => (
                <span
                  key={c.refType + c.refCode}
                  title={`${c.refType} · ${c.source}`}
                  className={`rounded-full px-3 py-1 text-sm border ${
                    c.verified
                      ? "border-[#0f4c81] text-[#0f4c81] bg-[#e6eef6]"
                      : "border-[#cbd5e1] text-[#475569]"
                  }`}
                >
                  {c.verified ? "✓ " : "○ "}
                  {c.label} · {c.verified ? ev.reviewed : sp.selfReported}
                </span>
              ))}
            </div>

            <p className="mt-3 text-sm text-[#8a5410] bg-[#fff4e0] rounded-md px-3 py-2">
              {sp.featuredNote}
            </p>
          </div>

          {/* 信任摘要卡（公开） */}
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-[#64748b]">
              {sp.verificationLevel}
            </div>
            <div className="text-2xl font-extrabold text-[#0f4c81] mt-1">
              {v.levelLabel} {level}
            </div>
            <div className="font-medium text-[#0f172a]">{v.levelsShort[level]}</div>

            {/* CS-21：三标签审核徽章 */}
            <AssessmentTags tags={assessmentTags} />

            {/* CS-22 / CS-A：三态验证徽章（状态由 trustProfile.ts 推导，组件不自判） */}
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-[#64748b]">
                {tp.badgeTitle}
              </div>
              <div className="mt-1.5">
                {/* 只有存在验证/历史记录时徽章才可点 —— 点开即跳到下方 Verification Details */}
                <VerificationBadge
                  state={badgeState}
                  dict={tp}
                  dataTrack={ANALYTICS_EVENTS.verificationBadgeView}
                  href={
                    trust.active || trust.history.length > 0
                      ? "#verification-details"
                      : undefined
                  }
                />
              </div>
            </div>

            <div className="mt-4 text-xs uppercase tracking-wide text-[#64748b]">
              {sp.riskScore}
            </div>
            {typeof s.riskScore === "number" ? (
              <>
                <div className="text-2xl font-extrabold" style={{ color: riskColor }}>
                  {s.riskScore} / 100
                </div>
                <div className="text-sm font-medium" style={{ color: riskColor }}>
                  {t.risk.ui.level[overallLevel(s.riskScore)]}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.riskScore}%`, background: riskColor }}
                  />
                </div>
              </>
            ) : (
              <div className="text-2xl font-extrabold text-[#64748b]">—</div>
            )}
            <p className="mt-1 text-xs text-[#64748b]">{sp.scoreDirection}</p>

            {/* PHASE 03 §一：评分是「档案信号」而非独立风险判定，必须在分数**紧邻处**说明。
                这句免责声明比分数本身更重要 —— 一个未核验的供应商也可以有高分，
                不写清楚就是让买家把「资料齐全」误读成「风险已核」。 */}
            <p className="mt-2 text-xs leading-relaxed text-[#8a5410] bg-[#fff4e0] rounded-md px-2 py-1.5">
              {seoCopy.scoreDisclaimer}
            </p>

            <div className="mt-4 text-xs uppercase tracking-wide text-[#64748b]">
              {sp.lastChecked}
            </div>
            <div className="text-sm font-medium text-[#0f172a]">
              {lastVerifiedDate ?? sp.noCheckRecord}
            </div>

            {/* PHASE 03 §一：档案更新时间与「最近核验日期」是两个不同的事实。
                前者是记录被修改的时间，后者是证据的核验日期，不得互相顶替。 */}
            <div className="mt-3 text-xs uppercase tracking-wide text-[#64748b]">
              {sp.lastUpdated}
            </div>
            <div className="text-sm font-medium text-[#0f172a]">
              {dateOnly(s.updatedAt) ?? sp.noCheckRecord}
            </div>

            {/* ⚠️ CS-02：这里标签必须是 "Evidence on file"，不能用 "Evidence reviewed"。
                s.evidenceCount 是**档案里存在多少条证据记录**（事实计数），
                不等于「平台已复核」。存在证据 ≠ 已核验 —— 二者是两条轴。
                旧代码用 v.evidence（"Evidence reviewed"）是错误暗示。 */}
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-[#64748b]">{v.evidenceOnFile}</span>
              <span className="font-medium text-[#0f172a]">{s.evidenceCount ?? 0}</span>
            </div>
          </div>
        </section>

        {/* ==================================================================
            Buyer Snapshot（PHASE 03 §六 / §八）
            存在的理由：
              · 买家与 AI 检索系统都需要**一处**能一眼读完的真实事实块，
                而不是把事实散落在 12 个区块里靠推断拼接；
              · 每行要么是真实数据、要么是明确的「无资料」占位 —— 绝不编造、绝不暗示；
              · 只放公开层字段。free / paid 字段（员工数 / 成立年份 / 出口市场 / 证声明细）
                仍然走各自的 UnlockGate，不从这里漏出去。
            行标签来自既有字典键 ⇒ 九种语言全部本地化。
            ================================================================== */}
        <section className="mt-8 card p-6">
          <h2 className="text-xl font-bold text-[#0f172a]">{seoCopy.snapshotTitle}</h2>
          <dl className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {snapshot.map((row) =>
              row.note ? (
                <div key={row.id} className="sm:col-span-2">
                  <p className="text-xs leading-relaxed text-[#8a5410] bg-[#fff4e0] rounded-md px-2 py-1.5">
                    {row.value}
                  </p>
                </div>
              ) : (
                <div key={row.id} className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
                  <dt className="text-[#64748b]">{row.label}</dt>
                  <dd
                    className={`text-right ${row.unknown ? "text-[#94a3b8] italic" : "font-medium text-[#0f172a]"}`}
                  >
                    {row.id === "industrialCluster" && clusterHref ? (
                      <Link
                        href={p(clusterHref)}
                        className="text-[#0f4c81] hover:underline"
                        data-track="supplier_cluster_backlink"
                      >
                        {row.value}
                      </Link>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              )
            )}
          </dl>
          <p className="mt-3 text-xs text-[#64748b]">{t.suppliers.trustNote}</p>
        </section>

        {/* Overview：公开字段 + 免费层锁区 */}
        <section className="mt-8">
          <h2 className="text-xl font-bold text-[#0f172a] mb-3">{sp.overviewTitle}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-xs text-[#64748b]">{sp.businessTypeLabel}</div>
              <div className="font-semibold">{s.businessType}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-[#64748b]">{sp.industryLabel}</div>
              <div className="font-semibold">{s.industryCode ?? "—"}</div>
            </div>
            {/* 员工规模（free 层）—— 服务端只输出锁态，真值由客户端解锁后填入 */}
            <UnlockGate
              layer="free"
              variant="raw"
              registerHref={registerHref}
              membershipHref={p("/pricing#founding-buyer")}
              locked={
                <div className="card p-4 opacity-80">
                  <div className="text-xs text-[#64748b]">{sp.employeesLabel}</div>
                  <div className="font-semibold text-[#94a3b8]">
                    🔒{" "}
                    <Link href={registerHref} className="text-[#0f4c81] underline">
                      {sp.freeLockCta}
                    </Link>
                  </div>
                </div>
              }
            >
              <div className="card p-4">
                <div className="text-xs text-[#64748b]">{sp.employeesLabel}</div>
                <div className="font-semibold">
                  <UnlockedValue slug={s.slug} locale={uiLocale} field="employees" />
                </div>
              </div>
            </UnlockGate>

            {/* 出口市场（free 层） */}
            <UnlockGate
              layer="free"
              variant="raw"
              registerHref={registerHref}
              membershipHref={p("/pricing#founding-buyer")}
              locked={
                <div className="card p-4 opacity-80">
                  <div className="text-xs text-[#64748b]">{sp.exportMarketsLabel}</div>
                  <div className="font-semibold text-[#94a3b8]">
                    🔒{" "}
                    <Link href={registerHref} className="text-[#0f4c81] underline">
                      {sp.freeLockCta}
                    </Link>
                  </div>
                </div>
              }
            >
              <div className="card p-4">
                <div className="text-xs text-[#64748b]">{sp.exportMarketsLabel}</div>
                <div className="font-semibold">
                  <UnlockedValue slug={s.slug} locale={uiLocale} field="exportMarkets" />
                </div>
              </div>
            </UnlockGate>

            {/* CS-12：产能与出口年限（free 层）。
                这些是工厂在入驻表单里自填的商业情报，不是工商登记事实 ⇒
                不随页面直出，和 established / employees 同等对待。 */}
            {(
              [
                ["productionCapacity", sp.capacityProduction],
                ["monthlyOutput", sp.capacityMonthly],
                ["factorySize", sp.capacityFactorySize],
                ["exportSince", sp.capacityExportSince],
              ] as const
            ).map(([field, label]) => (
              <UnlockGate
                key={field}
                layer="free"
                variant="raw"
                registerHref={registerHref}
                membershipHref={p("/pricing#founding-buyer")}
                locked={
                  <div className="card p-4 opacity-80">
                    <div className="text-xs text-[#64748b]">{label}</div>
                    <div className="font-semibold text-[#94a3b8]">
                      🔒{" "}
                      <Link href={registerHref} className="text-[#0f4c81] underline">
                        {sp.freeLockCta}
                      </Link>
                    </div>
                  </div>
                }
              >
                <div className="card p-4">
                  <div className="text-xs text-[#64748b]">{label}</div>
                  <div className="font-semibold">
                    <UnlockedValue slug={s.slug} locale={uiLocale} field={field} />
                  </div>
                </div>
              </UnlockGate>
            ))}
          </div>

          {/* 免费层解锁说明（已登录后不再显示注册引导） */}
          <UnlockGate
            layer="free"
            variant="raw"
            registerHref={registerHref}
            membershipHref={p("/pricing#founding-buyer")}
            locked={
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-4 py-3">
                <div className="text-sm text-[#475569]">
                  <span className="font-semibold text-[#0f172a]">{sp.freeLockTitle}.</span>{" "}
                  {sp.freeLockLead}
                </div>
                <Link
                  href={registerHref}
                  className="btn btn-outline text-sm"
                  data-track={ANALYTICS_EVENTS.profileFreeCta}
                  data-track-value={s.slug}
                >
                  {sp.freeLockCta}
                </Link>
              </div>
            }
          >
            {null}
          </UnlockGate>
        </section>

        {/* CS-12：工商登记信息（公开层）。排在"平台核验范围"之前 ——
            这几行是档案的事实底座，读者应先看到"这家是谁"，再看"平台核验了什么"。 */}
        <SupplierRegistrationPanel data={s} dict={sp} />

        {/* 平台核验范围（方法论级，公开） */}
        <section className="mt-8 card p-6 bg-[#f7f9fc]">
          <h2 className="text-xl font-bold text-[#0f172a]">{sp.verifiedByTitle}</h2>
          <p className="text-sm text-[#64748b] mt-1 mb-4">{sp.verifiedByLead}</p>
          <ul className="space-y-1 text-sm text-[#475569]">
            {scope.length === 0 ? (
              <li>{v.noRecord}</li>
            ) : (
              scope.map((x) => <li key={x}>✓ {x}</li>)
            )}
          </ul>
          <div className="mt-4 text-sm text-[#0f172a]">
            <span className="text-[#64748b]">{sp.lastChecked}: </span>
            <span className="font-medium">{lastVerifiedDate ?? sp.noCheckRecord}</span>
          </div>
          <div className="mt-4 border-t border-[#e2e8f0] pt-3">
            <h3 className="font-semibold text-[#0f172a] text-sm">{sp.neverClaimedTitle}</h3>
            <p className="text-xs text-[#64748b] mt-1">{sp.neverClaimed}</p>
          </div>
        </section>

        {/* 认证（公开层，仅已验证记录，只展示元数据、不提供原始文件） */}
        <CertificationList items={verifiedCerts} dict={ec} />

        {/* 审核记录（公开层，仅已验证记录） */}
        <AuditHistoryPanel items={verifiedAudits} dict={ec} />

        {/* CS-12：工厂自述证书（公开层）。刻意排在平台已核验内容之后 ——
            版本顺序本身就在传递"平台核验过什么"与"工厂自己说了什么"的可信度差异。 */}
        <SupplierSelfReportedCerts data={s} dict={sp} />

        {/* CS-22 / CS-A #7：工厂照片（只渲染 APPROVED + PUBLIC，不加载 original） */}
        {profileIsPublic && (
          <FactoryPhotoGallery images={factoryPhotos} dict={tp} />
        )}

        {/* CS-22 / CS-A #8 #9：验证详情 + 验证历史
            没有任何验证记录时也渲染（此时显示"暂无核验记录"），
            但完全未核验且无历史时整段不出现，避免制造空区块。 */}
        {(trust.active || trust.history.length > 0) && (
          <VerificationDetails
            active={trust.active}
            history={trust.history}
            dict={tp}
            badgeState={badgeState}
          />
        )}

        {/* 付费层锁区：证据明细 / 认证明细 / 验货历史 */}
        <section className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-[#0f172a]">{ev.title}</h2>
            <p className="text-sm text-[#64748b] mt-1 mb-3">{sp.paidLockLead}</p>
            <ul className="space-y-2 text-sm text-[#475569]">
              {s.evidence.slice(0, 2).map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{evidenceLabel(e.type, uiLocale)}</span>
                  {/* paid 层：证据核验状态 */}
                  <UnlockGate
                    layer="paid"
                    registerHref={registerHref}
                    membershipHref={p("/pricing#founding-buyer")}
                    locked={<span className="text-[#94a3b8]">🔒</span>}
                  >
                    <UnlockedEvidenceStatus
                      slug={s.slug}
                      locale={uiLocale}
                      evidenceId={e.id}
                      className="font-medium"
                      style={{ color: riskColor }}
                    />
                  </UnlockGate>
                </li>
              ))}
              {s.evidence.length === 0 && (
                <li className="text-[#94a3b8]">{sp.evidenceEmpty}</li>
              )}
            </ul>
            <p className="text-xs text-[#64748b] mt-3">{ev.statusNote}</p>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-bold text-[#0f172a]">{sp.auditHistory ?? sp.auditStatusLabel}</h2>
            <p className="text-sm text-[#64748b] mt-1 mb-3">{sp.paidLockLead}</p>
            <ul className="space-y-2 text-sm text-[#475569]">
              <li className="flex justify-between gap-3">
                <span>{sp.inspectionHistoryLabel}</span>
                <UnlockGate
                  layer="paid"
                  registerHref={registerHref}
                  membershipHref={p("/pricing#founding-buyer")}
                  locked={<span className="text-[#94a3b8]">🔒</span>}
                >
                  <UnlockedValue
                    slug={s.slug}
                    locale={uiLocale}
                    field="inspectionHistory"
                    className="font-medium text-[#0f172a]"
                  />
                </UnlockGate>
              </li>
              <li className="flex justify-between gap-3">
                {/* ⚠️ CS-02：这里展示的是 suppliers.certifications 原始数组 ——
                    它是**供应商/来源自述的声明**，不是平台核验结果。
                    标签必须是 "Reported certification claims"，绝不能只写 "Certifications"
                    （那会让人误读成「已获认证」）。 */}
                <span>{sp.certClaimsReported}</span>
                <UnlockGate
                  layer="paid"
                  registerHref={registerHref}
                  membershipHref={p("/pricing#founding-buyer")}
                  locked={<span className="text-[#94a3b8]">🔒</span>}
                >
                  <UnlockedValue
                    slug={s.slug}
                    locale={uiLocale}
                    field="certifications"
                    className="font-medium text-[#0f172a]"
                  />
                </UnlockGate>
              </li>
            </ul>
            <p className="text-xs text-[#64748b] mt-3">{sp.paidLockNote}</p>
          </div>
        </section>

        {/* 付费解锁 CTA（成为 Founding Buyer 后不再显示） */}
        <UnlockGate
          layer="paid"
          variant="raw"
          registerHref={registerHref}
          membershipHref={p("/pricing#founding-buyer")}
          locked={
            <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#0f4c81] bg-[#e6eef6] px-4 py-3">
              <div className="text-sm text-[#475569]">
                <span className="font-semibold text-[#0f172a]">{sp.paidLockTitle}.</span>{" "}
                {sp.paidLockLead}
              </div>
              <Link
                href={p("/pricing#founding-buyer")}
                className="btn btn-primary text-sm"
                data-track={ANALYTICS_EVENTS.profilePaidCta}
                data-track-value={s.slug}
              >
                {sp.paidLockCta}
              </Link>
            </section>
          }
        >
          {null}
        </UnlockGate>

        {/* Report preview（风险分公开，报告为服务产品） */}
        <section className="mt-10 card p-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#0f4c81]">
            {rp.badge}
          </span>
          <h2 className="text-2xl font-bold text-[#0f172a] mt-1">{rp.title}</h2>
          <p className="text-sm text-[#64748b] mt-1">{rp.lead}</p>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="font-semibold text-[#0f172a]">{rp.execTitle}</h3>
              <p className="text-sm text-[#475569] mt-1">
                {rp.riskLevel}: {riskBand ? t.risk.ui.level[riskBand] : "—"}
              </p>
              <p className="text-sm text-[#475569]">
                {rp.score}: {typeof s.riskScore === "number" ? `${s.riskScore} / 100` : "—"}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[#0f172a]">{rp.verificationTitle}</h3>
              <ul className="text-sm text-[#475569] mt-1 space-y-1">
                {scope.length === 0 ? (
                  <li>{v.noRecord}</li>
                ) : (
                  scope.map((x) => <li key={x}>✓ {x}</li>)
                )}
              </ul>
              <h3 className="font-semibold text-[#0f172a] mt-4">{rp.recommendationTitle}</h3>
              <p className="text-sm text-[#475569] mt-1">
                {level >= 3 ? sp.recVerified : sp.recUnverified}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-[#e2e8f0] pt-5">
            <h3 className="font-semibold text-[#0f172a]">{rp.unlockTitle}</h3>
            <p className="text-sm text-[#475569] mt-1">{rp.unlockLead}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={p("/custom-services")} className="btn btn-primary">
              {rp.unlockCta}
            </Link>
            <Link href={p("/factory-audit/request")} className="btn btn-outline">
              {sp.requestAudit}
            </Link>
            {/* STEP-05：把「这家到底靠不靠谱」的疑问接到 /verify-supplier 最小闭环。
                带 ?supplier=<slug> —— 目标页在客户端按此关联后台档案，
                买家不用重新打一遍供应商名（减少提交摩擦 = 提高线索转化）。
                同时带 supplier_name 作为**纯兜底**：目标页在服务端不读 searchParams
                （读了就无法预渲染），因此这个参数只在客户端 JS 不可用时用于展示。
                ⚠️ 这是**链接**不是按钮动作：本页仍保持零客户端交互的预渲染形态，
                不因新增入口把档案页从静态产物拖回动态渲染。 */}
            <Link
              href={`${p("/verify-supplier")}?supplier=${encodeURIComponent(slug)}`}
              className="btn btn-outline"
            >
              {sp.verifyThisSupplier}
            </Link>
          </div>
          <p className="text-xs text-[#64748b] mt-3">
            {rp.methodologyLead}{" "}
            <Link href={p("/methodology")} className="text-[#0f4c81] underline">
              {rp.methodologyLink}
            </Link>
          </p>
        </section>

        {/* CS-21：采购商审核报告付费下载（占位，不接真实支付） */}
        <AssessmentReportPaywall supplierId={s.id} tags={assessmentTags} locale={locale} />

        {/* ==================================================================
            FAQ（PHASE 03 §七 / §九）
            两条铁律：
              ① 每一条都由**真实数据**触发（lib/seo/supplierSeo.ts 的 generateSupplierFaq）——
                 没有产品就不问产品，没有城市就不问地点，绝不写通用套话凑数。
              ② 这里渲染出来的就是 FAQPage JSON-LD 的 mainEntity（同一个数组），
                 不存在「Schema 声称有 FAQ、页面上却看不到」的结构化数据造假。
            ================================================================== */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-[#0f172a]">{t.common.faq}</h2>
          <div className="mt-4 space-y-4">
            {faq.map((f) => (
              <div key={f.id} className="card p-5">
                <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
                <p className="text-[#475569] mt-2 text-sm">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Claim / RFQ */}
        <section className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-semibold text-[#0f172a]">{sp.claimTitle}</h2>
            <p className="text-sm text-[#475569] mt-1">{sp.claimLead}</p>
            <Link
              href={p(`${DIRECTORY_PATH}/${slug}/claim`)}
              className="btn btn-outline mt-4 inline-block"
              data-track={ANALYTICS_EVENTS.claimView}
              data-track-value={s.slug}
            >
              {sp.claimCta}
            </Link>
          </div>
          <div className="card p-6">
            <h2 className="font-semibold text-[#0f172a]">{sp.notSatisfiedTitle}</h2>
            <p className="text-sm text-[#475569] mt-1">{sp.notSatisfiedLead}</p>
            <Link href={p("/rfq")} className="btn btn-outline mt-4 inline-block">
              {sp.notSatisfiedCta}
            </Link>
          </div>
        </section>

        {/* ==================================================================
            CS-22 / CS-A #11：Share CTA
            只有公开档案才签发分享链接 —— 分享一个未公开的档案没有意义，
            也会绕过可见性闸门。链接里只有 share_token，没有内部 supplier UUID。
            ================================================================== */}
        <section className="mt-6 card p-6">
          {profileIsPublic ? (
            <>
              <h2 className="font-semibold text-[#0f172a]">{tp.shareTitle}</h2>
              <p className="text-sm text-[#64748b] mt-1">{tp.shareLead}</p>
              <ShareProfileButton slug={slug} dict={tp} />
            </>
          ) : (
            <>
              <h2 className="font-semibold text-[#0f172a]">{tp.notPublicTitle}</h2>
              <p className="text-sm text-[#64748b] mt-1">{tp.notPublicLead}</p>
            </>
          )}
        </section>

        {/* 浏览埋点：零 UI，页面保持预渲染静态产物 */}
        {profileIsPublic && <ProfileViewTracker slug={slug} />}
      </main>
    </GuestAccessProvider>
  );
}
