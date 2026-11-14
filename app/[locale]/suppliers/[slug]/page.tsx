import type { Metadata } from "next";
import type { ReactNode } from "react";
import { industryDisplayName, listIndustries } from "@/lib/taxonomy";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import {
  getSupplierDetail,
  listSupplierSlugs,
  lastCheckedOf,
  getSupplierPresenceFlags,
} from "@/lib/queries";
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
import SupplierInquiryForm from "@/components/supplier/SupplierInquiryForm";
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
import { supplierDisplayName, supplierNameDiffersFromLegal } from "@/lib/supplierDisplayName";
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
 * 「登录后才可见」的快照行 id。
 *
 * 🔴 2026-10-31（文哥拍板，**撤销 10-28 的决定**）：官网与注册地址恢复公开。
 *   10-28 曾把官网/地址清空，理由是「采购商拿官网绕过平台直接联系工厂」。
 *   但代价是：未登录访客一行差异化信息都看不到 —— 名录页 70 家档案几乎全是模板文案，
 *   对搜索引擎也是近似重复内容，反而拖累索引质量。
 *   新判断：官网域名与工商注册地址本身是企业**公开自称/公开登记**的事实，
 *   采购商照样能在展会名录、海关数据里找到，锁它换不来转化，只换来「空壳页」的观感。
 *   真正需要锁的是**产能、员工规模、出口市场、联系方式**这类商业情报 —— 那部分没动。
 *
 * 现在恒为空集：保留这层机制，是为了以后要加回闸门时只改一处。
 * ⚠️ 加任何 id 进来都必须是「服务端清空 value」，不要改成 CSS 隐藏或前端条件渲染 ——
 *    那样真实值仍在 HTML 里，爬虫与游客都能拿到。
 */
const GATED_SNAPSHOT_IDS = new Set<string>([]);

/**
 * 把供应商官网字段转成**可点击的出站链接**；不合法就返回 null（回落成纯文本）。
 *
 * 为什么现在才加（2026-11-08）：官网与地址在 2026-10-31 已经放开到公开层，
 * 但一直是纯文本 `<dd>https://www.uwyes.com</dd>` —— 对网站没有出站链接价值，
 * 对方也就没有理由在自己官网回链我们（反链邀请时手里没有对等筹码）。
 *
 * 🔴 安全边界（这是唯一一处把数据库里自由文本渲染成 href 的地方）：
 *   · 只放行 http / https，其余协议（javascript: / data: / file:）一律 null；
 *   · hostname 必须含点号 —— 挡掉 `localhost`、`javascript` 这类无点号的伪 host；
 *   · 缺协议时补 https://（库里大量值是 `www.xxx.com` 这种写法）；
 *   · 解析失败一律 null。绝不做字符串拼接式 href。
 *   React 自身还会转义属性值，但这里不能依赖下游兜底。
 *
 * rel 用 `noopener`（防 tab-nabbing），**刻意不加 nofollow**：
 *   这些是真实工厂的编辑性链接，不是付费或交换位；加了 nofollow 就等于
 *   我们单方面宣告"这条链接没有价值"，反链邀请也就不成立。
 */
function toExternalHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

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
// 🔴 不得声明 revalidate（2026-10-07 实测钉死）：OpenNext 的 cache interception 会**绕开**声明了 revalidate 的路由，改交给 Worker 运行时 SSR ⇒ prerender-manifest 里 initialRevalidateSeconds=3600 ⇒ 每请求现场渲染 ⇒ 撞 Workers 128MB 内存上限 ⇒ `error code: 1102` / HTTP 503 ⇒ Google 抓取失败、crawl budget 崩。只读 staticAssetsIncrementalCache 下 revalidate 本就永不生效（set() 是 no-op），删掉零功能损失；要真 ISR 请改 r2IncrementalCache（见 open-next.config.ts 注释）。
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
    // 🔴 标题长度由 lib/seo/supplierSeo.ts 的 generateSupplierTitle() 按候选链自行管理
    //    （含「绝不在公司名中间截断」铁律）⇒ 不让 lib/pageMeta.ts 再裁一次，
    //    否则 "… | <城市>, <国家>" 的定位段会被分隔符规则切掉。
    trimTitle: false,
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
  const riskColor = riskBand ? LEVEL_COLOR[riskBand] : "#6d6b66";

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
    provided: "border-[#ddd9d0] text-[#3f4650]",
    reviewed: "border-[#171717] text-[#171717]",
    independent: "border-[#171717] text-[#171717] bg-[#f5f3ee]",
    onsite: "border-[#171717] text-white bg-[#171717]",
  };
  /* 最近一次核验日期：取自证据记录，没有记录就显示「暂无核验记录」。
     绝不用 new Date() 顶替 —— 那会把「今天」伪装成核验日期。 */
  const lastVerifiedDate = lastCheckedOf(s.evidence);

  const profileUrl = `${BASE}${p(`${DIRECTORY_PATH}/${slug}`)}`;

  // ===========================================================================
  // PHASE 03：SEO / GEO / AI-search 产物全部由 lib/seo/supplierSeo.ts 推导
  // ===========================================================================
  // 行业代码 → 当前语种可读名称（STATIC_INDUSTRIES 是唯一权威）。
  // 🔴 2026-10-31 修：档案页有两处显示行业 —— 概况格 与 Buyer Snapshot，
  //    此前两处都直接渲染 industry_code（英文页 "food-beverage"、中文页也是代码）。
  //    这里算一次，两处共用；未知代码回退原代码，绝不留空。
  const industries = await listIndustries();
  const industryHit = s.industryCode ? industries.find((i) => i.code === s.industryCode) : undefined;
  const industryName = s.industryCode
    ? industryHit
      ? industryDisplayName(locale, industryHit.name)
      : s.industryCode
    : null;
  const { seo } = buildSupplierSeoData(s, verifiedAudits, verifiedCerts);
  // Buyer Snapshot 的行业行读 seo.industryName（lib/seo/supplierSeo.ts 里默认透传 code），
  // 这里用本地化名称覆盖，避免页面上出现裸行业码。
  if (industryName) seo.industryName = industryName;
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
  // 🔴 2026-10-28（海外采购商视角走查后补的洞）：
  //   官网与注册地址此前是**未登录可见**的 —— 买家拿到官网可以直接绕开平台联系工厂，
  //   核验服务就彻底失去意义。现在这两行的真实值在**服务端就被丢弃**，
  //   公开 HTML 里连字符串都不存在（不是 CSS 隐藏），登录后才由 UnlockGate 之外的
  //   授权接口下发（见下方渲染层的 gated 分支）。
  const snapshotRaw = generateSupplierSnapshot(seo, locale, snapshotLabels, seoOpts);
  const snapshot = snapshotRaw.map((row) =>
    GATED_SNAPSHOT_IDS.has(row.id) ? { ...row, value: "", unknown: false } : row
  );

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

  // ── 2026-10-31：公司概况「锁空气」修复（见 Overview 区块注释）─────────────
  // 只算「有没有值」这一个布尔量，**绝不把值本身放进公开 HTML**；
  // 真值仍由 UnlockedValue 走授权接口取。空值一律渲染「—」（NULL≠0）。
  // 🔴 2026-10-31：存在性**必须单独查**，不能用页面上的 s.* 判断 ——
  //    getSupplierDetail 在 visitor 档会把这几项整体裁掉（CS-12），
  //    s.employees 恒为 undefined ⇒ 早先版本把「101-500 人」渲染成了「—」。
  //    该函数只回布尔、不回值，公开 HTML 里仍然看不到真值。
  const presence = await getSupplierPresenceFlags(slug);

  const hasEmployees = presence.employees;
  const hasExportMarkets = presence.exportMarkets;
  const hasProductionCapacity = presence.productionCapacity;
  const hasMonthlyOutput = presence.monthlyOutput;
  const hasFactorySize = presence.factorySize;
  const hasExportSince = presence.exportSince;
  const anyOverviewLocked =
    hasEmployees ||
    hasExportMarkets ||
    hasProductionCapacity ||
    hasMonthlyOutput ||
    hasFactorySize ||
    hasExportSince;

  // 首屏公司类型（2026-11-14 修）：三级回退，全空则整段不渲染。
  //   business_type 是结构化字段（Manufacturer / Trading company）⇒ 走九语字典；
  //   company_type 是供应商自己填的原文 ⇒ 原样展示（不翻译、不再归类）；
  //   两者都空 ⇒ 不显示，而不是套一个默认值。
  // 🔴 此前这里是 `s.businessType === "Manufacturer" ? sp.manufacturer : sp.tradingCompany`
  //    —— 二选一，空值全部落进 else。实测南京 MAXON 自述 "Wireless communication product
  //    manufacturer"，线上首屏却渲染成 "Trading company"：把「没填」写成了「是贸易商」，
  //    属事实错误。lib/seo/supplierSeo.ts:1018 早就是 `businessType || companyType` 口径，
  //    首屏这一处是漏网的。
  const displayType = (() => {
    const bt = (s.businessType ?? "").trim();
    if (bt === "Manufacturer") return sp.manufacturer;
    if (bt === "Trading company") return sp.tradingCompany;
    return bt || (s.companyType ?? "").trim();
  })();

  return (
    // CS-05b：整页共享同一次 Guest 额度判定（避免"字段 A 解锁、字段 B 锁着"的撕裂）。
    // key={s.id} —— 客户端在两家供应商之间跳转时强制重新判定，不沿用上一家的结果。
    <GuestAccessProvider key={s.id} supplierId={s.id}>
      <main className="container py-10" data-track-page={ANALYTICS_EVENTS.profileView}>
        <JsonLd data={jsonLd} />

        {/* 面包屑（可见 + JSON-LD 一致） */}
        <nav aria-label={t.supplierProfile.directoryBreadcrumb} className="text-sm text-[#6d6b66]">
          <Link href={p("/")} className="hover:text-[#171717]">
            {t.countryHub.breadcrumbHome}
          </Link>
          <span className="mx-2">/</span>
          <Link href={p(DIRECTORY_PATH)} className="hover:text-[#171717]">
            {sp.directoryBreadcrumb}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#171717]">{supplierDisplayName(locale, s)}</span>
        </nav>

        {/* 公开摘要：核心价值直出，会员墙不放在顶部 */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h1 className="text-3xl font-bold text-[#171717]">{supplierDisplayName(locale, s)}</h1>
            <p className="text-[#6d6b66] mt-1">
              {s.city}, {s.countryName ?? s.country.toUpperCase()}
              {displayType ? ` · ${displayType}` : ""}
            </p>
            <p className="mt-3 text-sm text-[#3f4650]">{s.mainProducts.join(" · ")}</p>

            {/* 首屏主 CTA（2026-10-31）：只在「确有未解锁字段」时出现。
                · 与概况区入口同源同文案（sp.freeLockCta），不再是第二套说法；
                · 无可解锁内容 ⇒ 整块不渲染，绝不承诺打不开的东西（同「锁空气」修复口径）。 */}
            {anyOverviewLocked && (
              <div className="mt-4">
                {/* 🔴 必须包在 UnlockGate 里：它是唯一知道「访客 / 已登录 / 已解锁」的判据。
                    直接渲染按钮会让已付费或已登录的用户也看到「免费注册」—— 实测前就先修掉。 */}
                <UnlockGate
                  layer="free"
                  variant="raw"
                  registerHref={registerHref}
                  membershipHref={p("/pricing#founding-buyer")}
                  locked={
                    <Link
                      href={registerHref}
                      className="btn btn-primary text-sm"
                      data-track={ANALYTICS_EVENTS.profileFreeCta}
                      data-track-position="hero"
                      data-track-value={s.slug}
                    >
                      {sp.freeLockCta}
                    </Link>
                  }
                >
                  {null}
                </UnlockGate>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {s.capabilities.map((c) => (
                <span
                  key={c.refType + c.refCode}
                  title={`${c.refType} · ${c.source}`}
                  className={`rounded-full px-3 py-1 text-sm border ${
                    c.verified
                      ? "border-[#171717] text-[#171717] bg-[#f5f3ee]"
                      : "border-[#ddd9d0] text-[#3f4650]"
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

            {/* 工厂照片（2026-10-28）：填左栏底部空白。
                该栏是 md:grid-cols-3 的 col-span-2，右侧状态卡更高，
                左栏文字天然短 ⇒ 不填东西就是一大片空白（买家第一眼的位置）。
                · 只渲染 listPublicFactoryImages 筛过的图（APPROVED + PUBLIC）
                · src 用 ?v=thumbnail：Workers Free 不能跑运行时图片转码
                · 无照片整块不渲染，绝不出现空占位 */}
            {factoryPhotos.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-[#6d6b66]">
                  {tp.photosTitle}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {factoryPhotos.slice(0, 3).map((img) => (
                    <div
                      key={img.id}
                      className="overflow-hidden rounded-lg border border-[#ebe8e1] bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/supplier-image/${img.id}?v=thumbnail`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-24 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                {/* 左栏空间小，放不下每张的来源标签；若这批全是供应商上传，
                    统一在下方标一次（平台拍摄的图会走完整画廊，那里逐张标）。 */}
                {factoryPhotos.slice(0, 3).every((i) => i.source === "supplier") && (
                  <div className="mt-1.5 text-[11px] leading-tight text-[#8c8982]">
                    {sp.selfReported}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 信任摘要卡（公开） */}
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide text-[#6d6b66]">
              {sp.verificationLevel}
            </div>
            <div className="text-2xl font-extrabold text-[#171717] mt-1">
              {v.levelLabel} {level}
            </div>
            <div className="font-medium text-[#171717]">{v.levelsShort[level]}</div>

            {/* CS-21：三标签审核徽章 */}
            <AssessmentTags tags={assessmentTags} locale={locale} />

            {/* CS-22 / CS-A：三态验证徽章（状态由 trustProfile.ts 推导，组件不自判） */}
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-[#6d6b66]">
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

            <div className="mt-4 text-xs uppercase tracking-wide text-[#6d6b66]">
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
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ebe8e1]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.riskScore}%`, background: riskColor }}
                  />
                </div>
              </>
            ) : (
              <div className="text-2xl font-extrabold text-[#6d6b66]">—</div>
            )}
            <p className="mt-1 text-xs text-[#6d6b66]">{sp.scoreDirection}</p>

            {/* PHASE 03 §一：评分是「档案信号」而非独立风险判定，必须在分数**紧邻处**说明。
                这句免责声明比分数本身更重要 —— 一个未核验的供应商也可以有高分，
                不写清楚就是让买家把「资料齐全」误读成「风险已核」。 */}
            <p className="mt-2 text-xs leading-relaxed text-[#8a5410] bg-[#fff4e0] rounded-md px-2 py-1.5">
              {seoCopy.scoreDisclaimer}
            </p>

            <div className="mt-4 text-xs uppercase tracking-wide text-[#6d6b66]">
              {sp.lastChecked}
            </div>
            <div className="text-sm font-medium text-[#171717]">
              {lastVerifiedDate ?? sp.noCheckRecord}
            </div>

            {/* PHASE 03 §一：档案更新时间与「最近核验日期」是两个不同的事实。
                前者是记录被修改的时间，后者是证据的核验日期，不得互相顶替。 */}
            <div className="mt-3 text-xs uppercase tracking-wide text-[#6d6b66]">
              {sp.lastUpdated}
            </div>
            <div className="text-sm font-medium text-[#171717]">
              {dateOnly(s.updatedAt) ?? sp.noCheckRecord}
            </div>

            {/* ⚠️ CS-02：这里标签必须是 "Evidence on file"，不能用 "Evidence reviewed"。
                s.evidenceCount 是**档案里存在多少条证据记录**（事实计数），
                不等于「平台已复核」。存在证据 ≠ 已核验 —— 二者是两条轴。
                旧代码用 v.evidence（"Evidence reviewed"）是错误暗示。 */}
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-[#6d6b66]">{v.evidenceOnFile}</span>
              <span className="font-medium text-[#171717]">{s.evidenceCount ?? 0}</span>
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
          <h2 className="text-xl font-bold text-[#171717]">{seoCopy.snapshotTitle}</h2>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {snapshot.map((row) =>
              row.note ? (
                <div key={row.id} className="sm:col-span-2">
                  <p className="text-xs leading-relaxed text-[#8a5410] bg-[#fff4e0] rounded-md px-2 py-1.5">
                    {row.value}
                  </p>
                </div>
              ) : (
                <div key={row.id} className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
                  <dt className="text-[#6d6b66]">{row.label}</dt>
                  <dd
                    className={`text-right ${row.unknown ? "text-[#8c8982] italic" : "font-medium text-[#171717]"}`}
                  >
                    {GATED_SNAPSHOT_IDS.has(row.id) ? (
                      // 🔒 官网 / 注册地址：真实值未进入本 HTML（服务端已清空），
                      //    这里只给登录引导。文案复用 login.form.submit，不新增字典键。
                      <span className="text-[#b45309]">
                        <span aria-hidden="true">🔒 </span>
                        <Link
                          href={`${p("/login")}?next=${encodeURIComponent(p(`/suppliers/${slug}`))}`}
                          className="underline"
                        >
                          {t.login.form.submit}
                        </Link>
                      </span>
                    ) : row.id === "industrialCluster" && clusterHref ? (
                      <Link
                        href={p(clusterHref)}
                        className="text-[#171717] hover:underline"
                        data-track="supplier_cluster_backlink"
                      >
                        {row.value}
                      </Link>
                    ) : row.id === "website" && toExternalHref(row.value) ? (
                      // 供应商官网：出站链接（dofollow）。反链邀请的对等筹码之一 ——
                      // 我们真的把买家往他们站点送，对方才有理由回链。
                      <a
                        href={toExternalHref(row.value) as string}
                        target="_blank"
                        rel="noopener"
                        className="text-[#171717] underline decoration-[#c9c4b8] underline-offset-2 hover:decoration-[#171717]"
                        data-track="supplier_site_outbound"
                      >
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              )
            )}
          </dl>
          <p className="mt-3 text-xs text-[#6d6b66]">{t.suppliers.trustNote}</p>
        </section>

        {/* ── 买家行动区（2026-10-28 新增）─────────────────────────────
            采购商视角走查暴露的缺口：看完档案想委托核验，**页面上找不到任何入口** ——
            整个档案页没有一个按钮能通向付费服务，这是转化链路上的死结。
            文案全部复用 suppliers.svcTitle / svcLead / svcCta / svcNote
            （这三个键此前只在目录页用，档案页从未渲染），不新增字典 key。
            🔴 刻意不写价格：供应商可见区域一律不出现金额。 */}
        {/* 询价（2026-10-28）：此前全页 8 个按钮都是"卖给买家的验厂服务"，
            没有一个能让买家向这家供应商询价 —— 采购商看完就断了动作。
            放在验厂 CTA 之前：询价是买家的第一自然动作，验厂是第二动作。 */}
        <section className="mt-8">
          <SupplierInquiryForm
            slug={slug}
            supplierName={supplierDisplayName(locale, s)}
            locale={locale}
            auditDeclined={s.auditAvailability === "no"}
          />
        </section>

        {/* 🔴 2026-11-14：供应商**明确拒绝**现场审核（auditAvailability === "no"）时，整块不渲染。
            原先不看这个字段 —— 4 家已填 "no" 的供应商档案上仍然挂着「申请核验 →」，
            买家点进去才发现对方不开放进厂，等于用平台的 CTA 卖给买家一个做不了的服务。
            三态处理是刻意的：
              "yes" / undefined(未询问)  ⇒ 正常显示（70 家广交会抓取档案都是未询问，不能被误杀）
              "no"                       ⇒ 不显示，核验状态改由上方「核验等级 0/4 · 核验范围：无记录」呈现
            零新增文案：不写「该供应商拒绝审核」这种需要翻译、又容易被理解成负面标签的句子。 */}
        {s.auditAvailability !== "no" && (
          <section className="mt-8 card p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-[560px]">
                <h2 className="text-lg font-bold text-[#171717]">{t.suppliers.svcTitle}</h2>
                <p className="mt-1 text-sm text-[#3f4650]">{t.suppliers.svcLead}</p>
                <p className="mt-3 text-xs text-[#6d6b66]">{t.suppliers.svcNote}</p>
              </div>
              <Link
                href={`${p("/factory-audit/request")}?supplier=${encodeURIComponent(slug)}`}
                className="btn btn-primary btn-sm shrink-0"
                data-track="supplier_profile_request_verification"
              >
                {t.suppliers.svcCta} →
              </Link>
            </div>
          </section>
        )}

        {/* Overview：公开字段 + 免费层锁区
            ── 2026-10-31 重构（「锁空气」修复）──────────────────────────────
            改动前：6 个格子**无条件**各挂一个「🔒 创建免费账户」，再加底部 1 条横幅
                    ⇒ 同屏 7 个同义 CTA。
            实测数据（改前）：34 家线上档案里只有 28 家有员工规模、7 家有出口市场、
                    2 家有产能；池内 8,566 家仅 2.4% 填了员工数。
            ⇒ 绝大多数情况是「注册 → 解锁 → 看到 —」，用户付了成本拿到空气；
              同时整块渲染出来全是 "Create free account" 几个字，对搜索引擎等于零信息。
            改动后：
              ① 字段为空 ⇒ 直接渲染「—」，**不上锁、不放 CTA**（NULL≠0，不编数）；
              ② 只有真有值的字段才上锁，锁态只画 🔒 + 占位点，不再嵌链接；
              ③ 整块只保留 1 处解锁入口，且**上移到表格之前**（用户滚过前就看到条件）；
              ④ 全部字段都为空时不出现任何解锁入口（不承诺没有的东西）。 */} 
        {/* 🔴 2026-11-14：整块「有值才渲染」。
            原先 6 个锁区字段全空时仍然渲染 section + 2 个基础格 + 6 个「—」，
            实测这家（厦门翔龙）就是连续 6 个破折号 —— 比不显示更像残档，
            而且和「无记录就不渲染」的 fairRecord 区块自相矛盾。
            判定沿用 anyOverviewLocked（6 个锁区字段任一有值；presence 单独查库，
            不依赖 visitor 档被裁掉的 s.*）。
            企业类型 / 行业 不因此丢失：它们在「买家速览」里已各占一行。 */}
        {anyOverviewLocked && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-[#171717] mb-3">{sp.overviewTitle}</h2>

            <UnlockGate
              layer="free"
              variant="raw"
              registerHref={registerHref}
              membershipHref={p("/pricing#founding-buyer")}
              locked={
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ddd9d0] bg-[#fbfaf7] px-4 py-3">
                  <div className="text-sm text-[#3f4650]">
                    <span className="font-semibold text-[#171717]">{sp.freeLockTitle}.</span>{" "}
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 2026-11-14：与首屏 displayType 统一口径。
                  此前只看 business_type（结构化枚举），该列为空就直接渲染「—」——
                  而供应商在表单里填的 company_type 原文（如「Manufacturer & Trading company」）
                  在同一页的首屏已正常显示，概览格却显示破折号，同一事实两种呈现。
                  三级回退：结构化 business_type → 供应商原文 company_type → 破折号。 */}
              <OverviewTile label={sp.businessTypeLabel}>{displayType || "—"}</OverviewTile>
              <OverviewTile label={sp.industryLabel}>{industryName ?? "—"}</OverviewTile>

              {/* 员工规模（free 层）—— 有值才锁 */}
              {hasEmployees ? (
                <UnlockGate
                  layer="free"
                  variant="raw"
                  registerHref={registerHref}
                  membershipHref={p("/pricing#founding-buyer")}
                  locked={<OverviewTileLocked label={sp.employeesLabel} />}
                >
                  <OverviewTile label={sp.employeesLabel}>
                    <UnlockedValue slug={s.slug} locale={uiLocale} field="employees" />
                  </OverviewTile>
                </UnlockGate>
              ) : (
                <OverviewTile label={sp.employeesLabel}>—</OverviewTile>
              )}

              {/* 出口市场（free 层）—— 有值才锁 */}
              {hasExportMarkets ? (
                <UnlockGate
                  layer="free"
                  variant="raw"
                  registerHref={registerHref}
                  membershipHref={p("/pricing#founding-buyer")}
                  locked={<OverviewTileLocked label={sp.exportMarketsLabel} />}
                >
                  <OverviewTile label={sp.exportMarketsLabel}>
                    <UnlockedValue slug={s.slug} locale={uiLocale} field="exportMarkets" />
                  </OverviewTile>
                </UnlockGate>
              ) : (
                <OverviewTile label={sp.exportMarketsLabel}>—</OverviewTile>
              )}

              {/* CS-12：产能与出口年限（free 层）—— 同样「有值才锁」。
                  这些是工厂在入驻表单里自填的商业情报，不是工商登记事实 ⇒
                  不随页面直出，和 established / employees 同等对待。
                  🔑 空格子绝不上锁：池内这批广交会名录档案这四项基本全空，
                     若照旧渲染锁头，用户解锁后 100% 看到「—」。 */}
              {(
                [
                  ["productionCapacity", sp.capacityProduction, hasProductionCapacity],
                  ["monthlyOutput", sp.capacityMonthly, hasMonthlyOutput],
                  ["factorySize", sp.capacityFactorySize, hasFactorySize],
                  ["exportSince", sp.capacityExportSince, hasExportSince],
                ] as const
              ).map(([field, label, has]) =>
                has ? (
                  <UnlockGate
                    key={field}
                    layer="free"
                    variant="raw"
                    registerHref={registerHref}
                    membershipHref={p("/pricing#founding-buyer")}
                    locked={<OverviewTileLocked label={label} />}
                  >
                    <OverviewTile label={label}>
                      <UnlockedValue slug={s.slug} locale={uiLocale} field={field} />
                    </OverviewTile>
                  </UnlockGate>
                ) : (
                  <OverviewTile key={field} label={label}>
                    —
                  </OverviewTile>
                )
              )}
            </div>
          </section>
        )}

        {/* migration 037：广交会参展记录 —— 举办方官方名录给出的公开事实。
            每条 = 届次 + 期次 + 展馆 + 展位号，英文专有名词保持名录原样（不翻译、不改写）。
            无记录 ⇒ 整块不渲染，绝不出现空占位或 "N/A"（NULL≠0 的同一条铁律）。
            最多列 8 条：池内 95% 只有 1~2 条，极端行有 44 条（一家占多个展位），
            超出部分只报数量，避免把一整屏塞满展位号、挤掉后面的核验说明。 */}
        {s.fairRecord && s.fairRecord.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-[#171717] mb-3">{sp.fairRecordTitle}</h2>
            <div className="card p-6">
              <ul className="flex flex-wrap gap-2">
                {s.fairRecord.slice(0, 8).map((rec) => (
                  <li
                    key={rec}
                    className="rounded-md border border-[#ddd9d0] bg-[#fbfaf7] px-3 py-1.5 text-sm text-[#3f4650]"
                  >
                    {rec}
                  </li>
                ))}
                {s.fairRecord.length > 8 && (
                  <li className="rounded-md border border-[#ddd9d0] bg-[#fbfaf7] px-3 py-1.5 text-sm text-[#6d6b66]">
                    +{s.fairRecord.length - 8}
                  </li>
                )}
              </ul>
              <p className="mt-3 text-xs text-[#6d6b66]">{sp.fairRecordSource}</p>
            </div>
          </section>
        )}

        {/* CS-12：工商登记信息（公开层）。排在"平台核验范围"之前 ——
            这几行是档案的事实底座，读者应先看到"这家是谁"，再看"平台核验了什么"。 */}
        {/* 🔴 2026-10-31：官网与地址已在「买家速览」公开（见 GATED_SNAPSHOT_IDS 注释），
            这里继续置空**不再是为了锁**，而是去重 —— 同一页把同一行地址印两遍只是噪音。
            Row 组件对空值返回 null ⇒ 该行直接不渲染，不会出现「空占位」。 */}
        <SupplierRegistrationPanel
          data={{ ...s, website: "", address: "" }}
          dict={sp}
          showLegalName={supplierNameDiffersFromLegal(locale, s)}
        />

        {/* 平台核验范围（方法论级，公开） */}
        <section className="mt-8 card p-6 bg-[#fbfaf7]">
          <h2 className="text-xl font-bold text-[#171717]">{sp.verifiedByTitle}</h2>
          <p className="text-sm text-[#6d6b66] mt-1 mb-4">{sp.verifiedByLead}</p>
          <ul className="space-y-1 text-sm text-[#3f4650]">
            {scope.length === 0 ? (
              <li>{v.noRecord}</li>
            ) : (
              scope.map((x) => <li key={x}>✓ {x}</li>)
            )}
          </ul>
          <div className="mt-4 text-sm text-[#171717]">
            <span className="text-[#6d6b66]">{sp.lastChecked}: </span>
            <span className="font-medium">{lastVerifiedDate ?? sp.noCheckRecord}</span>
          </div>
          <div className="mt-4 border-t border-[#ebe8e1] pt-3">
            <h3 className="font-semibold text-[#171717] text-sm">{sp.neverClaimedTitle}</h3>
            <p className="text-xs text-[#6d6b66] mt-1">{sp.neverClaimed}</p>
          </div>
        </section>

        {/* 认证（公开层，仅已验证记录，只展示元数据、不提供原始文件） */}
        <CertificationList items={verifiedCerts} dict={ec} />

        {/* 审核记录（公开层，仅已验证记录） */}
        <AuditHistoryPanel items={verifiedAudits} dict={ec} />

        {/* CS-12：工厂自述证书（公开层）。刻意排在平台已核验内容之后 ——
            版本顺序本身就在传递"平台核验过什么"与"工厂自己说了什么"的可信度差异。 */}
        <SupplierSelfReportedCerts data={s} dict={sp} />

        {/* CS-22 / CS-A #7：工厂照片（只渲染 APPROVED + PUBLIC，不加载 original）
            完整画廊只在照片多于 3 张时出现 —— 前 3 张已放在顶部左栏，
            少于等于 3 张时再画一遍就是重复占版面。 */}
        {profileIsPublic && factoryPhotos.length > 3 && (
          <FactoryPhotoGallery
            images={factoryPhotos}
            dict={tp}
            sourceLabels={{ platform: ev.reviewed, supplier: sp.selfReported }}
          />
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
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-[#171717]">{ev.title}</h2>
            <p className="text-sm text-[#6d6b66] mt-1 mb-3">{sp.paidLockLead}</p>
            <ul className="space-y-2 text-sm text-[#3f4650]">
              {s.evidence.slice(0, 2).map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{evidenceLabel(e.type, uiLocale)}</span>
                  {/* paid 层：证据核验状态 */}
                  <UnlockGate
                    layer="paid"
                    registerHref={registerHref}
                    membershipHref={p("/pricing#founding-buyer")}
                    locked={<span className="text-[#8c8982]">🔒</span>}
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
                <li className="text-[#8c8982]">{sp.evidenceEmpty}</li>
              )}
            </ul>
            <p className="text-xs text-[#6d6b66] mt-3">{ev.statusNote}</p>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-bold text-[#171717]">{sp.auditHistory ?? sp.auditStatusLabel}</h2>
            <p className="text-sm text-[#6d6b66] mt-1 mb-3">{sp.paidLockLead}</p>
            <ul className="space-y-2 text-sm text-[#3f4650]">
              <li className="flex justify-between gap-3">
                <span>{sp.inspectionHistoryLabel}</span>
                <UnlockGate
                  layer="paid"
                  registerHref={registerHref}
                  membershipHref={p("/pricing#founding-buyer")}
                  locked={<span className="text-[#8c8982]">🔒</span>}
                >
                  <UnlockedValue
                    slug={s.slug}
                    locale={uiLocale}
                    field="inspectionHistory"
                    className="font-medium text-[#171717]"
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
                  locked={<span className="text-[#8c8982]">🔒</span>}
                >
                  <UnlockedValue
                    slug={s.slug}
                    locale={uiLocale}
                    field="certifications"
                    className="font-medium text-[#171717]"
                  />
                </UnlockGate>
              </li>
            </ul>
            <p className="text-xs text-[#6d6b66] mt-3">{sp.paidLockNote}</p>
          </div>
        </section>

        {/* 付费解锁 CTA（成为 Founding Buyer 后不再显示） */}
        <UnlockGate
          layer="paid"
          variant="raw"
          registerHref={registerHref}
          membershipHref={p("/pricing#founding-buyer")}
          locked={
            <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#171717] bg-[#f5f3ee] px-4 py-3">
              <div className="text-sm text-[#3f4650]">
                <span className="font-semibold text-[#171717]">{sp.paidLockTitle}.</span>{" "}
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
          <span className="text-xs font-semibold uppercase tracking-wide text-[#171717]">
            {rp.badge}
          </span>
          <h2 className="text-2xl font-bold text-[#171717] mt-1">{rp.title}</h2>
          <p className="text-sm text-[#6d6b66] mt-1">{rp.lead}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="font-semibold text-[#171717]">{rp.execTitle}</h3>
              <p className="text-sm text-[#3f4650] mt-1">
                {rp.riskLevel}: {riskBand ? t.risk.ui.level[riskBand] : "—"}
              </p>
              <p className="text-sm text-[#3f4650]">
                {rp.score}: {typeof s.riskScore === "number" ? `${s.riskScore} / 100` : "—"}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-[#171717]">{rp.verificationTitle}</h3>
              <ul className="text-sm text-[#3f4650] mt-1 space-y-1">
                {scope.length === 0 ? (
                  <li>{v.noRecord}</li>
                ) : (
                  scope.map((x) => <li key={x}>✓ {x}</li>)
                )}
              </ul>
              <h3 className="font-semibold text-[#171717] mt-4">{rp.recommendationTitle}</h3>
              <p className="text-sm text-[#3f4650] mt-1">
                {level >= 3 ? sp.recVerified : sp.recUnverified}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-[#ebe8e1] pt-5">
            <h3 className="font-semibold text-[#171717]">{rp.unlockTitle}</h3>
            <p className="text-sm text-[#3f4650] mt-1">{rp.unlockLead}</p>
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
          <p className="text-xs text-[#6d6b66] mt-3">
            {rp.methodologyLead}{" "}
            <Link href={p("/methodology")} className="text-[#171717] underline">
              {rp.methodologyLink}
            </Link>
          </p>
        </section>

        {/* CS-21：采购商审核报告付费下载（占位，不接真实支付） */}
        <AssessmentReportPaywall
          supplierId={s.id}
          tags={assessmentTags}
          locale={locale}
          dict={{
            title: sp.assessmentReportTitle,
            lead: sp.assessmentReportLead,
            priceReady: sp.assessmentReportPriceReady,
            notPublished: sp.assessmentReportNotPublished,
            download: sp.assessmentReportDownload,
            unavailable: sp.assessmentReportUnavailable,
            note: sp.assessmentReportNote,
          }}
        />

        {/* ==================================================================
            FAQ（PHASE 03 §七 / §九）
            两条铁律：
              ① 每一条都由**真实数据**触发（lib/seo/supplierSeo.ts 的 generateSupplierFaq）——
                 没有产品就不问产品，没有城市就不问地点，绝不写通用套话凑数。
              ② 这里渲染出来的就是 FAQPage JSON-LD 的 mainEntity（同一个数组），
                 不存在「Schema 声称有 FAQ、页面上却看不到」的结构化数据造假。
            ================================================================== */}
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-[#171717]">{t.common.faq}</h2>
          <div className="mt-4 space-y-4">
            {faq.map((f) => (
              <div key={f.id} className="card p-5">
                <h3 className="font-semibold text-[#171717]">{f.q}</h3>
                <p className="text-[#3f4650] mt-2 text-sm">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Claim / RFQ */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-semibold text-[#171717]">{sp.claimTitle}</h2>
            <p className="text-sm text-[#3f4650] mt-1">{sp.claimLead}</p>
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
            <h2 className="font-semibold text-[#171717]">{sp.notSatisfiedTitle}</h2>
            <p className="text-sm text-[#3f4650] mt-1">{sp.notSatisfiedLead}</p>
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
              <h2 className="font-semibold text-[#171717]">{tp.shareTitle}</h2>
              <p className="text-sm text-[#6d6b66] mt-1">{tp.shareLead}</p>
              <ShareProfileButton slug={slug} dict={tp} />
            </>
          ) : (
            <>
              <h2 className="font-semibold text-[#171717]">{tp.notPublicTitle}</h2>
              <p className="text-sm text-[#6d6b66] mt-1">{tp.notPublicLead}</p>
            </>
          )}
        </section>

        {/* 浏览埋点：零 UI，页面保持预渲染静态产物 */}
        {profileIsPublic && <ProfileViewTracker slug={slug} />}
      </main>
    </GuestAccessProvider>
  );
}

/** 公司概况的普通格（标签 + 值）。值区可放任意节点（文本 / UnlockedValue）。 */
function OverviewTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-[#6d6b66]">{label}</div>
      <div className="font-semibold">{children}</div>
    </div>
  );
}

/**
 * 公司概况的**锁定态**格。
 *
 * 🔴 2026-10-31：格内不再嵌「创建免费账户」链接。
 *   改动前 6 个格子各挂一个同义链接 + 底部横幅 1 个 = 同屏 7 个 CTA，
 *   用户直接无视（横幅盲区），整块也第一眼像硬付费墙。
 *   现在整块只保留 1 处入口（在表格上方），格内只用 🔒 + 占位点表达「有值但未解锁」。
 *   「••••」是语言无关的遮挡约定 —— 用文字就得新增 9 语词条，不值当。
 */
function OverviewTileLocked({ label }: { label: string }) {
  return (
    <div className="card p-4 opacity-80">
      <div className="text-xs text-[#6d6b66]">{label}</div>
      <div className="font-semibold text-[#8c8982]" aria-hidden="true">
        🔒 ••••
      </div>
    </div>
  );
}
