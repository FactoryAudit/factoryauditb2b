import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { getSupplierDetail, listSupplierSlugs, lastCheckedOf } from "@/lib/queries";
import {
  levelFromStatus,
  LEVEL_SCOPE,
  normalizeEvidenceStatus,
  evidenceLabel,
  evidenceProvenance,
  type EvidenceProvenance,
} from "@/lib/verification";
import { overallLevel, LEVEL_COLOR } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

const BASE = "https://factoryauditb2b.com";
const DIRECTORY_PATH = "/suppliers";

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
  const s = await getSupplierDetail(slug);
  if (!s) {
    return buildPageMetadata({
      locale,
      path,
      title: t.supplierProfile.metaTitle,
      description: t.supplierProfile.metaDesc,
      robots: { index: false },
    });
  }
  const title = `${s.legalName} — ${t.supplierProfile.metaTitle}`;
  const description = `${s.legalName}, ${s.city}, ${s.countryName ?? s.country.toUpperCase()}. ${s.businessType}. Main products: ${s.mainProducts.join(", ")}. Risk score ${s.riskScore ?? "n/a"} / 100. Verification: ${s.verificationStatus ?? t.supplierProfile.noCheckRecord}.`;
  return buildPageMetadata({
    locale,
    path,
    title,
    description,
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

  // 内容层只有 en/zh 两版：zh-TW 走 zh 文案并在各自函数内繁化，其余语言一律 en。
  const contentLocale = locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh" : "en";
  const s = await getSupplierDetail(slug, contentLocale);
  if (!s) notFound();

  const uiLocale = contentLocale;
  const level = levelFromStatus(s.verificationStatus);
  const scope = LEVEL_SCOPE[level];
  // 风险等级由引擎推导，不在页面重复判定阈值
  const riskBand = overallLevel(s.riskScore ?? 0);

  // 证据状态：只展示「已核验 / 部分核验 / 未核验 / 已过期 / 缺失」，
  // 不提供原始文件下载（PRD §20 + 第三方报告分发限制）。
  const statusLabel: Record<string, string> = {
    VERIFIED: ev.verified,
    PARTIALLY_VERIFIED: ev.partiallyVerified,
    UNVERIFIED: ev.unverified,
    EXPIRED: ev.expired,
    MISSING: ev.missing,
  };

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: s.legalName,
        address: {
          "@type": "PostalAddress",
          addressLocality: s.city,
          addressCountry: s.countryName ?? s.country.toUpperCase(),
        },
        description: `${s.businessType}. Main products: ${s.mainProducts.join(", ")}.`,
        url: profileUrl,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t.countryHub.breadcrumbHome,
            item: `${BASE}${p("/")}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: sp.directoryBreadcrumb,
            item: `${BASE}${p(DIRECTORY_PATH)}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: s.legalName,
            item: profileUrl,
          },
        ],
      },
    ],
  };

  return (
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

          <p className="mt-3 text-sm text-[#a86a13] bg-[#fff4e0] rounded-md px-3 py-2">
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

          <div className="mt-4 text-xs uppercase tracking-wide text-[#64748b]">
            {sp.riskScore}
          </div>
          {typeof s.riskScore === "number" ? (
            <>
              <div className="text-2xl font-extrabold" style={{ color: LEVEL_COLOR[riskBand] }}>
                {s.riskScore} / 100
              </div>
              <div className="text-sm font-medium" style={{ color: LEVEL_COLOR[riskBand] }}>
                {t.risk.ui.level[riskBand]}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.riskScore}%`, background: LEVEL_COLOR[riskBand] }}
                />
              </div>
            </>
          ) : (
            <div className="text-2xl font-extrabold text-[#64748b]">—</div>
          )}
          <p className="mt-1 text-xs text-[#64748b]">{sp.scoreDirection}</p>

          <div className="mt-4 text-xs uppercase tracking-wide text-[#64748b]">
            {sp.lastChecked}
          </div>
          <div className="text-sm font-medium text-[#0f172a]">
            {lastVerifiedDate ?? sp.noCheckRecord}
          </div>

          <div className="mt-3 flex justify-between text-sm">
            <span className="text-[#64748b]">{v.evidence}</span>
            <span className="font-medium text-[#0f172a]">{s.evidenceCount ?? 0}</span>
          </div>
        </div>
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
          <div className="card p-4 opacity-80">
            <div className="text-xs text-[#64748b]">{sp.employeesLabel}</div>
            <div className="font-semibold text-[#94a3b8]">
              🔒 <Link href={p("/register")} className="text-[#0f4c81] underline">{sp.freeLockCta}</Link>
            </div>
          </div>
          <div className="card p-4 opacity-80">
            <div className="text-xs text-[#64748b]">{sp.exportMarketsLabel}</div>
            <div className="font-semibold text-[#94a3b8]">
              🔒 <Link href={p("/register")} className="text-[#0f4c81] underline">{sp.freeLockCta}</Link>
            </div>
          </div>
        </div>

        {/* 免费层解锁说明（先价值后锁定） */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-4 py-3">
          <div className="text-sm text-[#475569]">
            <span className="font-semibold text-[#0f172a]">{sp.freeLockTitle}.</span>{" "}
            {sp.freeLockLead}
          </div>
          <Link
            href={p("/register")}
            className="btn btn-outline text-sm"
            data-track={ANALYTICS_EVENTS.profileFreeCta}
            data-track-value={s.slug}
          >
            {sp.freeLockCta}
          </Link>
        </div>
      </section>

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

      {/* 付费层锁区：证据明细 / 认证明细 / 验货历史 */}
      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-[#0f172a]">{ev.title}</h2>
          <p className="text-sm text-[#64748b] mt-1 mb-3">{sp.paidLockLead}</p>
          <ul className="space-y-2 text-sm text-[#475569]">
            {s.evidence.slice(0, 2).map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <span>{evidenceLabel(e.type, uiLocale)}</span>
                <span className="text-[#94a3b8]">🔒</span>
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
              <span className="text-[#94a3b8]">🔒</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>{sp.certificationsLabel ?? ev.title}</span>
              <span className="text-[#94a3b8]">🔒</span>
            </li>
          </ul>
          <p className="text-xs text-[#64748b] mt-3">{sp.paidLockNote}</p>
        </div>
      </section>

      {/* 付费解锁 CTA */}
      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#0f4c81] bg-[#e6eef6] px-4 py-3">
        <div className="text-sm text-[#475569]">
          <span className="font-semibold text-[#0f172a]">{sp.paidLockTitle}.</span>{" "}
          {sp.paidLockLead}
        </div>
        <Link
          href={p("/membership")}
          className="btn btn-primary text-sm"
          data-track={ANALYTICS_EVENTS.profilePaidCta}
          data-track-value={s.slug}
        >
          {sp.paidLockCta}
        </Link>
      </section>

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
              {rp.riskLevel}: {t.risk.ui.level[riskBand]}
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
        </div>
        <p className="text-xs text-[#64748b] mt-3">
          {rp.methodologyLead}{" "}
          <Link href={p("/methodology")} className="text-[#0f4c81] underline">
            {rp.methodologyLink}
          </Link>
        </p>
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
    </main>
  );
}
