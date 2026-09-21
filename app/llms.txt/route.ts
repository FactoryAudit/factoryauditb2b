import { listAuditTypes, listStandards, listCountries, listIndustries } from "@/lib/taxonomy";
import { LOCALES, LOCALE_META, localePath } from "@/i18n/config";
import { COVERAGE_COUNTRIES, COVERAGE_SERVICE_SLUGS, COVERAGE_COUNTRY_SENTENCE } from "@/lib/coverage";
import { GUIDES, guideCategoriesWithGuides, GUIDE_CATEGORY_META } from "@/lib/guides";
import { CASE_STUDIES } from "@/lib/caseStudies";
import { FIELD_REPORTS } from "@/lib/fieldReports";
import { MEMBERSHIP_PRICE_USD } from "@/lib/suppliers";
import { topicsForIndustry } from "@/lib/industryContent";
import { CHEMICALS } from "@/lib/chemicals";

// /llms.txt —— 面向 AI 抓取工具（ChatGPT / Perplexity / Bing Copilot 等）的站点说明文件。
// 完全由中央 taxonomy 引擎驱动，确保与数据库一致（§91 单一事实来源）。
// 注意：这是给机器读的上下文文件，不是 Google 排名工具（PRD §43）。
export const dynamic = "force-static";

const BASE = "https://factoryauditb2b.com";

// 覆盖国名统一用 COVERAGE_COUNTRY_SENTENCE（派生自 COVERAGE_COUNTRIES）。
// 历史坑：这里曾经硬编码「China, Vietnam and Thailand」，实际已扩到 5 国。

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
    `Buyers use the free tools to assess a supplier, then request an independent verification or an on-site factory audit before placing an order. Coverage is ${COVERAGE_COUNTRY_SENTENCE}.`
  );
  lines.push("");

  lines.push("## Core Sections");
  lines.push(`- [Home](${BASE}/): Platform overview.`);
  lines.push(`- [Free Tools](${BASE}/tools): Eight free supplier and audit utilities. No account required.`);
  lines.push(`- [Supplier Risk Calculator](${BASE}/tools/supplier-risk-calculator): Scores any supplier 0-100 across Company, Quality, Compliance, Production, Supply Chain and Documentation.`);
  lines.push(`- [Supplier Comparison Tool](${BASE}/tools/compare): Rates two to five suppliers side by side across the same eight dimensions and shows where they diverge most. Self-assessment only, not verification.`);
  lines.push(`- [Supplier Verification Checklist](${BASE}/tools/supplier-verification-checklist): 29 checks across 6 stages to complete before placing an order.`);
  lines.push(`- [Supplier Directory](${BASE}/suppliers): Featured suppliers with verification level, risk score and evidence on record. Each listed supplier has a public profile at /suppliers/{slug} showing company, products, capabilities and risk score; verification evidence and risk detail are member content. Coverage is limited; post an RFQ if a supplier is not listed.`);
  // CS-05c-r2：旧文案写的是「up to 5 full profiles per month」—— CS-05a 起该额度已退役，
  // Free Buyer 是**基础层无限浏览**。口径以 membership.freeLead 为准（本文件为机器可读的
  // 站点权威说明，会被 AI 抓取器直接引述，不能停留在已废止的规则上）。
  lines.push(`- [Free Account Registration](${BASE}/register): Free account for buyers — unlocks more supplier fields and unlimited browsing of basic supplier profiles, plus saved profiles and side-by-side comparison. No payment card required.`);
  lines.push(`- [Founding Buyer](${BASE}/pricing#founding-buyer): Founding Buyer membership at $${MEMBERSHIP_PRICE_USD}/year — full supplier database access, verification evidence summaries, factory details, advanced filters and export.`);
  lines.push(`- [Services](${BASE}/services): Supplier verification, factory audit, inspection, sourcing and supplier improvement.`);
  lines.push(`- [Supplier Verification Service](${BASE}/services/supplier-verification): Independent verification of registration, site, capability, quality and compliance.`);
  lines.push(`- [Factory Audit Request](${BASE}/factory-audit/request): Request an on-site audit against your required standard.`);
  lines.push(`- [Product Inspection](${BASE}/services/inspection): Pre-production, during-production, pre-shipment and container loading inspection, quoted per inspection and fulfilled by an independent inspector.`);
  lines.push(`- [Supplier Monitoring](${BASE}/monitoring): Scheduled re-checks of verified facts with alerts when registration status, legal name, address or certificate validity changes. Subscription, quoted per supplier per year.`);
  lines.push(`- [Coverage](${BASE}/countries): Country-specific sourcing risks, verification and audit considerations for ${COVERAGE_COUNTRY_SENTENCE}.`);
  lines.push(`- [Resources](${BASE}/resources): Supplier intelligence guides and tools.`);
  lines.push(`- [Case Studies](${BASE}/case-studies): Anonymised illustrative walk-throughs of verification, audit, inspection and sourcing. Not client testimonials.`);
  lines.push(`- [Field Reports](${BASE}/field-reports): Short anonymised notes from inspection, audit and verification work, showing what is checked on site and how findings are recorded.`);
  lines.push(`- [Methodology](${BASE}/methodology): How supplier risk scores are calculated, including dimension weights and limitations.`);
  lines.push(`- [Pricing](${BASE}/pricing): Services and plans, with indicative ranges for reports, verification and audits.`);
  // CS-01：原「[Sample Report](${BASE}/sample-report)」条目已删除 —— 该页 308 到
  // /standard-report，llms.txt 里保留一个指向重定向的入口没有意义，
  // 且下面已有一条信息更完整的 Standard Report Specimen 条目。
  lines.push(`- [Standard Report Specimen](${BASE}/standard-report): The full standard report template, 13 sections and 8 scored dimensions, readable in full without registration. Downloading a copy requires a short registration.`);
  lines.push(`- [RFQ](${BASE}/rfq): Turn sourcing requirements into a structured RFQ.`);
  lines.push(`- [Join the Supplier Network](${BASE}/join-supplier-network): Free supplier registration for an international buyer-facing profile. No guarantee of orders or certification; status and evidence level are decided by human review.`);
  lines.push(`- [Custom Services](${BASE}/custom-services): Tailored audit, verification and inspection requests.`);
  lines.push(`- [About FactoryAuditB2B](${BASE}/trust): Who operates FactoryAuditB2B (Jiangmen Zhiyu Technology Co., Ltd.), why we understand suppliers, how we verify, and how buyers can request an audit or submit an RFQ.`);
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

  lines.push("## Guide categories");
  for (const c of guideCategoriesWithGuides()) {
    const cm = GUIDE_CATEGORY_META[c];
    lines.push(`- [${cm.nameEn}](${BASE}/guides/category/${c}): ${cm.descEn}`);
  }
  lines.push("");

  lines.push("## Case studies (illustrative)");
  for (const c of CASE_STUDIES) {
    lines.push(`- [${c.titleEn}](${BASE}/case-studies/${c.slug}): ${c.en.summary}`);
  }
  lines.push("");

  lines.push("## Field reports (illustrative)");
  for (const r of FIELD_REPORTS) {
    lines.push(`- [${r.titleEn}](${BASE}/field-reports/${r.slug}): ${r.en.takeaway}`);
  }
  lines.push("");

  // CS-02A：行业索引页 + 行业子主题页（P2–P5）。
  // 子主题清单与页面 generateStaticParams / sitemap 同源，未配置的组合不会出现在这里。
  lines.push("## Industry pages");
  const industries = await listIndustries();
  const enIndustryName = (n: string) => n.split(" / ")[0];
  lines.push(`- [${en.industryPage.breadcrumb}](${BASE}/industry): ${en.industryPage.hubMetaDesc}`);
  for (const i of industries) {
    const nm = enIndustryName(i.name);
    lines.push(
      `- [${nm}](${BASE}/industry/${i.code}): ${en.industryPage.metaDesc.replaceAll("{industry}", nm)}`
    );
    for (const tp of topicsForIndustry(i.code)) {
      lines.push(`- [${tp.title.en}](${BASE}/industry/${i.code}/${tp.slug}): ${tp.metaDesc.en}`);
    }
  }
  lines.push("");

  // CS-02B：化工原料页（最小可用版本，一期 6 个）。清单与页面 generateStaticParams 同源。
  lines.push("## Chemical raw materials");
  lines.push(`- [${en.chemicals.metaTitle}](${BASE}/chemicals): ${en.chemicals.metaDesc}`);
  for (const x of CHEMICALS) {
    lines.push(`- [${x.nameEn} (CAS ${x.cas})](${BASE}/chemicals/${x.slug}): ${x.application.en}`);
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
