import { listAuditTypes, listStandards, listCountries } from "@/lib/taxonomy";
import { LOCALES, LOCALE_META, localePath } from "@/i18n/config";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICE_SLUGS } from "@/lib/coverage";
import { GUIDES } from "@/lib/guides";
import { CASE_STUDIES } from "@/lib/caseStudies";

// /llms.txt —— 面向 AI 抓取工具（ChatGPT / Perplexity / Bing Copilot 等）的站点说明文件。
// 完全由中央 taxonomy 引擎驱动，确保与数据库一致（§91 单一事实来源）。
// 注意：这是给机器读的上下文文件，不是 Google 排名工具（PRD §43）。
export const dynamic = "force-static";

const BASE = "https://factoryauditb2b.com";

import enDict from "@/i18n/dictionaries/en.json";

export async function GET() {
  const [auditTypes, standards, countries] = await Promise.all([
    listAuditTypes(),
    listStandards(),
    listCountries(),
  ]);

  const lines: string[] = [];
  const en = enDict;
  lines.push("# FactoryAuditB2B");
  lines.push("");
  lines.push(`> ${en.brand.tagline}`);
  lines.push("");
  lines.push(
    `> ${en.brand.eva} ${en.brand.positioning}`
  );
  lines.push("");
  lines.push(
    "This site is publicly indexable. Each page exposes structured data (JSON-LD). The catalog of audit & certification programs below is the single source of truth used across the site."
  );
  lines.push("");
  lines.push("## What this site is for");
  lines.push(
    "Buyers use the free tools to assess a supplier, then request an independent verification or an on-site factory audit before placing an order. Coverage in Phase 1 is China, Vietnam and Thailand."
  );
  lines.push("");

  lines.push("## Core Sections");
  lines.push(`- [Home](${BASE}/): Platform overview.`);
  lines.push(`- [Free Tools](${BASE}/tools): Seven free supplier and audit utilities. No account required.`);
  lines.push(`- [Supplier Risk Calculator](${BASE}/tools/supplier-risk-calculator): Scores any supplier 0-100 across Company, Quality, Compliance, Production, Supply Chain and Documentation.`);
  lines.push(`- [Supplier Verification Checklist](${BASE}/tools/supplier-verification-checklist): 29 checks across 6 stages to complete before placing an order.`);
  lines.push(`- [Supplier Directory](${BASE}/suppliers): Featured suppliers with verification level, risk score and evidence on record. Coverage is limited; post an RFQ if a supplier is not listed.`);
  lines.push(`- [Services](${BASE}/services): Supplier verification, factory audit, inspection, sourcing and supplier improvement.`);
  lines.push(`- [Supplier Verification Service](${BASE}/services/supplier-verification): Independent verification of registration, site, capability, quality and compliance.`);
  lines.push(`- [Factory Audit Request](${BASE}/factory-audit/request): Request an on-site audit against your required standard.`);
  lines.push(`- [Product Inspection](${BASE}/services/inspection): Pre-production, during-production, pre-shipment and container loading inspection, quoted per inspection and fulfilled by an independent inspector.`);
  lines.push(`- [Coverage](${BASE}/countries): Country-specific sourcing risks, verification and audit considerations for China, Vietnam and Thailand.`);
  lines.push(`- [Resources](${BASE}/resources): Supplier intelligence guides and tools.`);
  lines.push(`- [Case Studies](${BASE}/case-studies): Anonymised illustrative walk-throughs of verification, audit, inspection and sourcing. Not client testimonials.`);
  lines.push(`- [Methodology](${BASE}/methodology): How supplier risk scores are calculated, including dimension weights and limitations.`);
  lines.push(`- [Pricing](${BASE}/pricing): Services and plans, with indicative ranges for reports, verification and audits.`);
  lines.push(`- [RFQ](${BASE}/rfq): Turn sourcing requirements into a structured RFQ.`);
  lines.push(`- [Custom Services](${BASE}/custom-services): Tailored audit, verification and inspection requests.`);
  lines.push(`- [Trust Center](${BASE}/trust): Who operates FactoryAuditB2B, business registration, what we verify, verification levels, evidence policy and data protection.`);
  lines.push(`- [Container Load Calculator](${BASE}/logistics): Calculates how many cartons fit in a 20GP, 40GP, 40HQ, 45HQ, reefer or open-top container, and how many containers a shipment needs, with volume and payload utilisation.`);
  lines.push("");

  lines.push("## Country coverage pages");
  for (const c of COVERAGE_COUNTRIES) {
    lines.push(`- [${c.name}](${BASE}/countries/${c.slug}): ${c.en.hook}`);
  }
  lines.push("");

  lines.push("## Country services");
  for (const x of COVERAGE_SERVICE_SLUGS) {
    lines.push(`- [${x.country.name} ${x.service.nameEn}](${BASE}/services/${x.slug}): ${x.service.quickAnswer}`);
  }
  lines.push("");

  lines.push("## Guides");
  for (const g of GUIDES) {
    lines.push(`- [${g.titleEn}](${BASE}/guides/${g.slug}): ${g.en.quickAnswer}`);
  }
  lines.push("");

  lines.push("## Case studies (illustrative)");
  for (const c of CASE_STUDIES) {
    lines.push(`- [${c.titleEn}](${BASE}/case-studies/${c.slug}): ${c.en.summary}`);
  }
  lines.push("");

  // 多语言入口：英文为默认语言且不带前缀，其余语言带前缀
  lines.push("## Languages");
  lines.push(
    "The site is published in nine languages. English is the default and lives at URLs without a prefix; every other language uses a prefix. All language versions carry hreflang annotations and are listed in sitemap.xml."
  );
  for (const l of LOCALES) {
    const meta = LOCALE_META[l];
    lines.push(
      `- [${meta.english} (${meta.name})](${BASE}${localePath(l, "/")}): ${meta.english} edition.`
    );
  }
  lines.push("");

  lines.push("## Audit & Certification Programs Covered");
  lines.push(auditTypes.map((a) => a.code).join(", "));
  lines.push("");

  lines.push("## Standards & Certifications");
  lines.push(standards.map((s) => s.code).join(", "));
  lines.push("");

  lines.push("## Manufacturing Countries Covered");
  lines.push(countries.map((c) => `${c.name} (${c.code})`).join(", "));
  lines.push("");

  lines.push("## Notes for AI crawlers");
  lines.push(
    "- Verification status levels: UNVERIFIED < IDENTITY_VERIFIED < DOCUMENT_VERIFIED < FACTORY_VERIFIED."
  );
  lines.push(
    "- SMETA, BSCI, ICTI and similar are audits/assessments performed by scheme-approved audit companies; this platform does not issue the underlying certificates."
  );
  lines.push("- Risk scores are decision-support only and never a substitute for official third-party verification.");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
