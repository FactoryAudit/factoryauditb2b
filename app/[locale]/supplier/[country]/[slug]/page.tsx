import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { getSupplierDetail, listSupplierSlugs } from "@/lib/queries";
import {
  levelFromStatus,
  LEVEL_SCOPE,
  NOT_COVERED,
  normalizeEvidenceStatus,
  evidenceLabel,
  evidenceProvenance,
  type EvidenceProvenance,
} from "@/lib/verification";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const BASE = "https://factoryauditb2b.com";

export async function generateStaticParams() {
  return await listSupplierSlugs();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; country: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, country, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const path = `/supplier/${country}/${slug}`;
  const s = await getSupplierDetail(slug);
  if (!s) {
    return buildPageMetadata({
      locale,
      path,
      title: "Supplier Profile",
      description: "Supplier profile on FactoryAuditB2B.",
      robots: { index: false },
    });
  }
  return buildPageMetadata({
    locale,
    path,
    title: `${s.legalName} — Supplier Profile`,
    description: `${s.legalName}, ${s.city}, ${s.countryName ?? s.country.toUpperCase()}. ${s.businessType}. Risk score ${s.riskScore ?? "n/a"}. Verification: ${s.verificationStatus ?? "unverified"}.`,
  });
}

export default async function SupplierProfile({
  params,
}: {
  params: Promise<{ locale: string; country: string; slug: string }>;
}) {
  const { locale: raw, country, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const sp = t.supplierProfile;
  const ev = t.evidence;
  const v = t.verification;
  const rp = t.reportPreview;
  const p = (href: string) => localePath(locale, href);

  const s = await getSupplierDetail(slug, locale === "zh" || locale === "zh-TW" ? "zh" : "en");
  if (!s) notFound();

  const uiLocale = locale === "zh" || locale === "zh-TW" ? "zh" : "en";
  const level = levelFromStatus(s.verificationStatus);
  const scope = LEVEL_SCOPE[level];

  // 证据状态：只展示「已核验 / 部分核验 / 未核验 / 已过期 / 缺失」，
  // 不提供原始文件下载（PRD §20 + 第三方报告分发限制）。
  const statusLabel: Record<string, string> = {
    VERIFIED: ev.verified,
    PARTIALLY_VERIFIED: ev.partiallyVerified,
    UNVERIFIED: ev.unverified,
    EXPIRED: ev.expired,
    MISSING: ev.missing,
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.legalName,
    address: {
      "@type": "PostalAddress",
      addressLocality: s.city,
      addressCountry: s.countryName ?? s.country.toUpperCase(),
    },
    description: `${s.businessType}. Main products: ${s.mainProducts.join(", ")}.`,
    url: `${BASE}${p(`/supplier/${country}/${slug}`)}`,
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
  /* 最近一次核验日期：取自证据记录，没有记录就显示 —，不编造日期 */
  const lastVerifiedDate = s.evidence.find((e) => e.date)?.date ?? null;

  const updated = new Date().toISOString().slice(0, 10);

  return (
    <main className="container py-10">
      <JsonLd data={jsonLd} />

      <Link href={p("/suppliers")} className="text-sm text-[#0f4c81]">
        ← {sp.backToDirectory}
      </Link>

      {/* Trust summary */}
      <section className="mt-4 grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <h1 className="text-3xl font-bold text-[#0f172a]">{s.legalName}</h1>
          <p className="text-[#64748b] mt-1">
            {s.city}, {s.countryName ?? s.country.toUpperCase()} ·{" "}
            {s.businessType === "Manufacturer" ? sp.manufacturer : sp.tradingCompany}
            {s.established ? ` · ${sp.established.replace("{year}", String(s.established))}` : ""}
          </p>
          <p className="mt-3 text-sm text-[#a86a13] bg-[#fff4e0] rounded-md px-3 py-2">
            {sp.featuredNote}
          </p>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-[#64748b]">
            {sp.verificationLevel}
          </div>
          <div className="text-2xl font-extrabold text-[#0f4c81] mt-1">
            LEVEL {level}
          </div>
          <div className="font-medium text-[#0f172a]">{v.levelsShort[level]}</div>

          <div className="mt-4 text-xs uppercase tracking-wide text-[#64748b]">
            {sp.riskScore}
          </div>
          <div className="text-2xl font-extrabold text-[#0f172a]">
            {typeof s.riskScore === "number" ? `${s.riskScore} / 100` : "—"}
          </div>
          <div className="text-sm text-[#475569]">
            {(s.riskLevel ?? "").replaceAll("_", " ")}
          </div>

          <div className="mt-4 text-xs text-[#64748b]">
            {sp.lastUpdated}: {updated}
          </div>
        </div>
      </section>

      {/* 平台核验：必须和「供应商自述」分开，让买家看清是谁做的核验 */}
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
          <span className="text-[#64748b]">{v.lastVerified}: </span>
          <span className="font-medium">{lastVerifiedDate ?? "—"}</span>
        </div>
        <div className="mt-4 border-t border-[#e2e8f0] pt-3">
          <h3 className="font-semibold text-[#0f172a] text-sm">{sp.neverClaimedTitle}</h3>
          <p className="text-xs text-[#64748b] mt-1">{sp.neverClaimed}</p>
        </div>
      </section>

      {/* Overview */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-[#0f172a] mb-3">{sp.overviewTitle}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-xs text-[#64748b]">{sp.businessTypeLabel}</div>
            <div className="font-semibold">{s.businessType}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-[#64748b]">{sp.employeesLabel}</div>
            <div className="font-semibold">{s.employees ?? "—"}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-[#64748b]">{sp.auditStatusLabel}</div>
            <div className="font-semibold">{s.auditStatus ?? sp.noAudit}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-[#64748b]">{sp.inspectionHistoryLabel}</div>
            <div className="font-semibold">
              {sp.inspections.replace("{n}", String(s.inspectionHistory))}
            </div>
          </div>
        </div>
      </section>

      {/* Certifications & Evidence */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-[#0f172a]">{ev.title}</h2>
        <p className="text-sm text-[#64748b] mt-1 mb-4">{ev.lead}</p>
        {s.certifications.length === 0 ? (
          <p className="text-sm text-[#475569]">{sp.noCertifications}</p>
        ) : (
          <table className="w-full text-sm border border-[#e2e8f0] rounded-lg overflow-hidden">
            <thead className="bg-[#f1f5f9] text-left">
              <tr>
                <th className="px-4 py-2 font-semibold text-[#0f172a]">Item</th>
                <th className="px-4 py-2 font-semibold text-[#0f172a]">Status</th>
              </tr>
            </thead>
            <tbody>
              {s.certifications.map((c) => {
                const cap = s.capabilities.find(
                  (x) => x.refType === "STANDARD" && x.refCode.toUpperCase() === c.toUpperCase()
                );
                const reviewed = Boolean(cap?.verified);
                return (
                  <tr key={c} className="border-t border-[#e2e8f0]">
                    <td className="px-4 py-2 font-medium text-[#0f172a]">{c}</td>
                    <td className="px-4 py-2 text-[#475569]">
                      {reviewed ? ev.reviewed : ev.provided}
                      <span className="block text-xs text-[#64748b]">{ev.restricted}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-xs text-[#64748b] mt-2">{ev.statusNote}</p>
      </section>

      {/* What we verified / Evidence on record */}
      <section className="mt-10 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">{sp.whatVerifiedTitle}</h2>
          <p className="text-sm text-[#64748b] mt-1 mb-4">{sp.provenanceLead}</p>
          {s.evidence.length === 0 ? (
            <p className="text-sm text-[#475569]">{sp.evidenceEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {s.evidence.map((e) => {
                const st = normalizeEvidenceStatus(e.status);
                const prov = evidenceProvenance(e.status, e.source);
                return (
                  <li key={e.id} className="card p-3">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-[#0f172a]">
                        {evidenceLabel(e.type, uiLocale)}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${provenanceStyle[prov]}`}
                      >
                        {provenanceLabel[prov]}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748b] mt-1">{statusLabel[st]}</div>
                    {e.date && (
                      <div className="text-xs text-[#64748b] mt-1">
                        {v.lastVerified}: {e.date}
                      </div>
                    )}
                    {e.note && <div className="text-xs text-[#64748b] mt-1">{e.note}</div>}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-[#64748b] mt-3">{sp.provNote}</p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#0f172a]">{sp.scopeTitle}</h2>
          <ul className="mt-3 space-y-1 text-sm text-[#475569]">
            {scope.length === 0 ? (
              <li>{v.noRecord}</li>
            ) : (
              scope.map((x) => <li key={x}>✓ {x}</li>)
            )}
          </ul>
          <h3 className="mt-6 font-semibold text-[#0f172a]">{sp.notCoveredTitle}</h3>
          <p className="text-xs text-[#64748b] mt-1 mb-2">{sp.notCoveredLead}</p>
          <ul className="space-y-1 text-sm text-[#475569]">
            {NOT_COVERED.map((x) => (
              <li key={x}>✕ {x}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-[#0f172a]">{sp.capabilitiesTitle}</h2>
        <p className="text-sm text-[#64748b] mt-1 mb-4">{sp.capabilitiesLead}</p>
        {s.capabilities.length === 0 ? (
          <p className="text-sm text-[#475569]">{sp.capabilitiesEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
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
        )}
      </section>

      {/* Products */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-[#0f172a]">{sp.productsTitle}</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {s.mainProducts.map((x) => (
            <span key={x} className="rounded-full px-3 py-1 text-sm border border-[#cbd5e1] text-[#475569]">
              {x}
            </span>
          ))}
        </div>
      </section>

      {/* Report preview */}
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
              {rp.riskLevel}: {(s.riskLevel ?? "—").replaceAll("_", " ")}
            </p>
            <p className="text-sm text-[#475569]">
              {rp.score}: {typeof s.riskScore === "number" ? `${s.riskScore} / 100` : "—"}
            </p>

            <h3 className="font-semibold text-[#0f172a] mt-4">{rp.keyRisksTitle}</h3>
            <ul className="text-sm text-[#475569] mt-1 space-y-1">
              {s.evidence.filter((e) => normalizeEvidenceStatus(e.status) !== "VERIFIED").length ===
              0 ? (
                <li>{sp.evidenceEmpty}</li>
              ) : (
                s.evidence
                  .filter((e) => normalizeEvidenceStatus(e.status) !== "VERIFIED")
                  .map((e) => (
                      <li key={e.id}>
                        ⚠ {evidenceLabel(e.type, uiLocale)}: {statusLabel[normalizeEvidenceStatus(e.status)]}
                      </li>
                    ))
              )}
            </ul>
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
              {level <= 2
                ? "Verify the factory address and request recent quality and audit records before placing a large order."
                : "Request an independent on-site factory audit before releasing a significant deposit."}
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
          <Link href={p("/custom-services")} className="btn btn-outline mt-4 inline-block">
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
