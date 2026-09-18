import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { listSupplierDirectory, type SupplierView } from "@/lib/queries";
import { overallLevel, LEVEL_COLOR, type RiskLevel } from "@/lib/riskEngine";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

const PATH = "/suppliers";
const BASE = "https://factoryauditb2b.com";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string; industry?: string; q?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const { country, industry, q } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  // 过滤态不索引：避免 country/industry/q 组合无限生成重复页面（需求 §20），
  // canonical 仍指向目录首页。
  const isFiltered = Boolean(country || industry || q);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.suppliers.metaTitle,
    description: t.suppliers.metaDesc,
    robots: isFiltered ? { index: false, follow: true } : undefined,
  });
}

/** 分数 + 等级：等级由 overallLevel 推导，文案取字典，不出现 LOW/MODERATE 原始 token */
function riskLabel(score?: number, labels?: Record<RiskLevel, string>) {
  if (typeof score !== "number" || !labels) return "—";
  return `${score} / 100 · ${labels[overallLevel(score)]}`;
}

export default async function SuppliersPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const { country, industry, q: rawQ } = await searchParams;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const s = t.suppliers;
  const sp = t.supplierProfile;
  // PHASE 03（P0）：卡片核验状态与档案页共用同一套等级文案（verification.levelsShort），
  // 不再在目录里另造一份「等级 → 文案」映射。
  const v = t.verification;
  // 服务名复用既有 taxonomy（含 9 语译文），不重复造词
  const si = t.servicesIndex.items;
  const p = (href: string) => localePath(locale, href);

  const all = await listSupplierDirectory();

  // 搜索词：公司名 / 产品 / 城市（不区分大小写）
  const q = rawQ?.trim().slice(0, 80).toLowerCase() ?? "";
  const matchQ = (x: SupplierView) =>
    !q ||
    x.legalName.toLowerCase().includes(q) ||
    x.mainProducts.some((m) => m.toLowerCase().includes(q)) ||
    x.city.toLowerCase().includes(q);

  // 筛选做成链接而不是表单：可被抓取，也让「国家 + 行业 + 关键词」组合形成真实索引路径
  const countries = Array.from(new Set(all.map((x) => x.country))).sort();
  const industries = Array.from(
    new Set(all.map((x) => x.industryCode).filter(Boolean) as string[])
  ).sort();
  const filtered = all.filter(
    (x) =>
      (!country || x.country === country) &&
      (!industry || x.industryCode === industry) &&
      matchQ(x)
  );
  // CS-06a（Bug B 修复）：展示集合必须是**筛选结果**，不是全量前 N 条。
  //   此前这里是 `all.slice(0, FEATURED_MAX)`，导致 country / industry / q 三个筛选
  //   只改了计数标签与 JSON-LD，卡片永远渲染全量 —— 线上表现为
  //   「1 suppliers listed」旁边并排躺着 4 张卡（其中 3 家是中国工厂）。
  //   产品定位是 Explore Global Suppliers（不是 Featured Suppliers），
  //   不应该人为隐藏筛选结果，故**不再截断**：
  //     count 标签 = filtered.length = 实际卡片数 —— 恒等成立。
  //   无筛选时 filtered === all，展示结果与修复前逐字一致。
  //   ⚠️ 已发布供应商超过 ~60 家后，需要以**新的 Change Set**引入
  //      分页 / Load More / 结果排序；本轮明确不做分页。
  const displayed = filtered;

  const linkWith = (next: { country?: string | null; industry?: string | null; q?: string | null }) => {
    const params = new URLSearchParams();
    const c = next.country !== undefined ? next.country : country;
    const i = next.industry !== undefined ? next.industry : industry;
    const query = next.q !== undefined ? next.q : q;
    if (c) params.set("country", c);
    if (i) params.set("industry", i);
    if (query) params.set("q", query);
    const qs = params.toString();
    return p(qs ? `${PATH}?${qs}` : PATH);
  };

  const faqs = [
    { q: s.faq1q, a: s.faq1a },
    { q: s.faq2q, a: s.faq2a },
    { q: s.faq3q, a: s.faq3a },
    { q: s.faq4q, a: s.faq4a },
  ];

  // FAQPage 与 ItemList 并列输出（JsonLd 组件支持数组）
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: s.h1,
      url: `${BASE}${p(PATH)}`,
      numberOfItems: filtered.length,
      itemListElement: filtered.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.legalName,
        url: `${BASE}${p(`/suppliers/${x.slug}`)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <main className="container py-12" data-track-page={ANALYTICS_EVENTS.directoryView}>
      <JsonLd data={jsonLd} />

      {/* Hero
          定位从「付费供应商目录」改为「免费发现 + 付费情报 + 服务」。
          第一 CTA 是 Find Suppliers（发现），Membership 降级为文字链（指令 §8）。 */}
      <section className="mb-6">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {s.heroBadge}
        </span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">{s.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-3xl">{s.lead}</p>
        <p className="mt-2 text-sm font-medium text-[#475569]">{s.freeNote}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* 页内锚点：落到下方供应商目录，不产生新页面也不伪造转化事件 */}
          <a href="#supplier-directory" className="btn btn-primary font-semibold">
            {t.home.ctaPrimary}
          </a>
          <Link
            href={p("/services/supplier-verification")}
            className="btn btn-outline font-semibold"
            data-track={ANALYTICS_EVENTS.verificationCtaClick}
            data-track-value="directory_hero"
          >
            {t.home.verifyCta}
          </Link>
          <Link
            href={p("/pricing#founding-buyer")}
            className="text-sm text-[#0f4c81] hover:underline"
            data-track={ANALYTICS_EVENTS.profilePaidCta}
            data-track-value="directory_hero"
          >
            {s.memberCta}
          </Link>
        </div>

        <p className="mt-3 text-sm text-[#8a5410] bg-[#fff4e0] rounded-md px-3 py-2 max-w-3xl">
          {s.exampleNote}
        </p>
      </section>

      {/* 搜索 + 筛选 */}
      <section className="mb-6">
        <form
          action={p(PATH)}
          method="get"
          className="flex flex-wrap items-center gap-2 mb-4"
          // 提交时上报（而非点击）：带搜索词，用于分析「哪些产品关键词带来流量」。
          // 原 data-track 会在点击表单任意空白处误触发，故改用 data-track-submit。
          data-track-submit={ANALYTICS_EVENTS.directorySearch}
          data-track-field="q"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={s.searchPlaceholder}
            aria-label={s.searchPlaceholder}
            className="flex-1 min-w-[240px] rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none"
          />
          <button type="submit" className="btn btn-primary">
            {s.searchButton}
          </button>
          {q && (
            <Link
              href={linkWith({ q: null })}
              className="text-sm text-[#0f4c81] hover:underline"
            >
              {s.searchClear}
            </Link>
          )}
        </form>

        <div className="flex flex-wrap gap-6 items-start">
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase mb-2">
              {s.filterCountry}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={linkWith({ country: null })}
                className={`rounded-full px-3 py-1 text-sm border ${!country ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                data-track={ANALYTICS_EVENTS.directoryFilter}
                data-track-value="all-countries"
              >
                {s.filterAll}
              </Link>
              {countries.map((c) => (
                <Link
                  key={c}
                  href={linkWith({ country: c })}
                  className={`rounded-full px-3 py-1 text-sm border ${country === c ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                  data-track={ANALYTICS_EVENTS.directoryFilter}
                  data-track-value={c}
                >
                  {c.toUpperCase()}
                </Link>
              ))}
            </div>
          </div>
          {industries.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#64748b] uppercase mb-2">
                {s.filterIndustry}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={linkWith({ industry: null })}
                  className={`rounded-full px-3 py-1 text-sm border ${!industry ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                  data-track={ANALYTICS_EVENTS.directoryFilter}
                  data-track-value="all-industries"
                >
                  {s.filterAll}
                </Link>
                {industries.map((i) => (
                  <Link
                    key={i}
                    href={linkWith({ industry: i })}
                    className={`rounded-full px-3 py-1 text-sm border ${industry === i ? "bg-[#0f4c81] text-white border-[#0f4c81]" : "border-[#cbd5e1] text-[#475569] hover:border-[#0f4c81]"}`}
                    data-track={ANALYTICS_EVENTS.directoryFilter}
                    data-track-value={i}
                  >
                    {i}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Featured 供应商（Hero 的 Find Suppliers 锚点落在这里） */}
      <section id="supplier-directory" className="mb-8 scroll-mt-6">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a]">{s.featuredTitle}</h2>
            <p className="text-sm text-[#64748b] mt-1">{s.featuredLead}</p>
          </div>
          <p className="text-sm text-[#64748b] shrink-0">
            {s.countLabel.replace("{n}", String(filtered.length))}
          </p>
        </div>

        {/* 信任说明（§29）：自述信息 / 证据等级 / 独立核验必须分开表达，
            不能让 Buyer 把「能看到档案」误解成「已被 FactoryAuditB2B 核验」 */}
        <p className="mb-4 text-sm text-[#475569] bg-[#f1f5f9] rounded-md px-3 py-2">
          {s.trustNote}
        </p>

        {displayed.length === 0 ? (
          <p className="text-[#475569] mb-10">{s.empty}</p>
        ) : (
          <section className="grid md:grid-cols-3 gap-5 mb-14">
            {displayed.map((x) => {
              // ★ 等级只由「真实证据」决定，绝不采信 legacy verification_status。
              //   现状：dongguan / ho-chi-minh 零证据却显示 "Business checked"；
              //   shenzhen 显示 "Factory verified" 但库里没有任何 audit 记录。
              //   在没有 supplier_audits 记录的前提下，公开侧最高只能到「文件已审核」，
              //   绝不允许出现 Factory verified / Factory audited。
              //   （Phase 7 的 L0–L6 引擎上线后，这里改为读引擎结果。）
              const hasEvidence = (x.evidenceVerified ?? 0) > 0;
              // PHASE 03（P0 修复）：核验状态必须来自**真实**数据，不得写死。
              //   level 由 queries 层按 CS-02 权威逻辑算出：
              //     publicVerificationLevel(suppliers.verification_level, hasRealEvent)
              //   hasRealEvent = 该供应商存在 VERIFIED 的 supplier_audits 记录。
              //   ?? 0 兜底：字段缺失（如静态兜底 / 详情页路径）一律按未核验显示。
              const level = x.publicVerificationLevel ?? 0;
              return (
                <Link
                  key={x.slug}
                  href={p(`/suppliers/${x.slug}`)}
                  className="card p-5 hover:border-[#0f4c81] transition"
                  data-track={ANALYTICS_EVENTS.profileView}
                  data-track-value={x.slug}
                >
                  <div className="font-semibold text-[#0f172a]">{x.legalName}</div>
                  <div className="text-sm text-[#64748b] mt-1">
                    {x.city}, {x.countryName ?? x.country.toUpperCase()}
                  </div>
                  <div className="text-sm mt-3">{x.mainProducts.join(" · ")}</div>

                  <dl className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{s.businessTypeLabel}</dt>
                      <dd className="font-medium text-[#0f172a] text-right">
                        {x.businessType || "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{s.evidenceLevel}</dt>
                      <dd className="font-medium text-[#0f172a] text-right">
                        {hasEvidence
                          ? s.evidenceDocs.replace("{n}", String(x.evidenceVerified))
                          : s.evidenceNone}
                      </dd>
                    </div>
                    {/* 核验状态独立一行（P0 修复，2026-09-13）。
                        修复前：无条件输出 s.verificationNotYet（"Not yet verified"），
                        于是 guangzhou-sunny-food —— 它已有 1 条 VERIFIED 现场审核记录、
                        verification_level='on_site_audit'、公开等级 Level 3 ——
                        在目录卡上仍显示「未核验」，与它自己的档案页直接矛盾。
                        现在按真实等级显示：
                          level ≥ 1 → t.verification.levelsShort[level]（与档案页同一字典）
                          level = 0 → 继续用 s.verificationNotYet，措辞与修复前逐字一致
                        ⚠️ 等级仍**不**因为「有 N 条证据」而升档（有证据 ≠ 已核验，§8 / §9）。 */}
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{s.verificationLabel}</dt>
                      <dd className="font-medium text-[#0f172a] text-right">
                        {level === 0 ? s.verificationNotYet : v.levelsShort[level]}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]" title={s.riskNote}>
                        {s.riskLabel}
                        <span aria-hidden="true" className="ml-1 text-[#94a3b8]">
                          (?)
                        </span>
                      </dt>
                      <dd
                        className="font-medium text-right"
                        title={s.riskNote}
                        /* 无分数 ⇒ 中性灰（riskLabel 本身会渲染「—」）。
                           绝不用 `overallLevel(x.riskScore ?? 0)` —— 那是 CRITICAL 的红，
                           等于给一家「尚未评分」的企业涂上最高风险色。 */
                        style={{
                          color:
                            typeof x.riskScore === "number"
                              ? LEVEL_COLOR[overallLevel(x.riskScore)]
                              : "#64748b",
                        }}
                      >
                        {riskLabel(x.riskScore, t.risk.ui.level)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748b]">{s.lastEvidence}</dt>
                      <dd className="font-medium text-[#0f172a] text-right">
                        {x.lastChecked ?? sp.noCheckRecord}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-[#64748b]">{s.riskNote}</p>

                  <span className="inline-block mt-4 text-sm text-[#0f4c81] font-medium">
                    {s.cardCta} →
                  </span>
                </Link>
              );
            })}
          </section>
        )}
      </section>

      {/* 服务转化：Supplier Discovery 免费，核验 / 验厂 / 验货 / 寻源为付费服务（§16 / §23） */}
      <section className="card p-8 mb-10">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.svcTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.svcLead}</p>
        <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-[#0f172a]">
          {[si.verification, si.factoryAudit, si.inspection, si.sourcing].map((item) => (
            <li key={item.title} className="flex items-start gap-2">
              <span aria-hidden="true" className="text-[#0f4c81]">
                •
              </span>
              <span>{item.title}</span>
            </li>
          ))}
        </ul>
        {/* 免费发现 ≠ 免费核验，必须显式写清（§23） */}
        <p className="mt-4 text-sm text-[#475569]">{s.svcNote}</p>
        <Link
          href={p("/custom-services")}
          className="btn btn-primary mt-5 inline-block"
          data-track={ANALYTICS_EVENTS.verificationCtaClick}
          data-track-value="directory_service_block"
        >
          {s.svcCta}
        </Link>
      </section>

      {/* Founder Buyer —— 排在服务之后（§38 视觉层级：Discovery 优先于 Membership） */}
      <section className="card p-8 bg-gradient-to-br from-[#0f4c81] to-[#163a5f] text-white mb-10">
        <h2 className="text-2xl font-bold text-white">{s.unlockTitle}</h2>
        <p className="mt-2 max-w-2xl text-white/90">{s.unlockLead}</p>
        <p className="mt-2 text-sm text-white/75">{s.unlockNote}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={p("/register")}
            className="btn bg-white text-[#0f4c81] hover:bg-[#e6eef6] font-semibold"
            data-track={ANALYTICS_EVENTS.profileFreeCta}
            data-track-value="directory_founder_block"
          >
            {s.freeCta}
          </Link>
          <Link
            href={p("/pricing#founding-buyer")}
            className="btn border border-white text-white hover:bg-[#163a5f] font-semibold"
            data-track={ANALYTICS_EVENTS.profilePaidCta}
            data-track-value="directory_founder_block"
          >
            {s.founderCta}
          </Link>
        </div>
      </section>

      {/* 找不到 → RFQ */}
      <section className="card p-8 bg-gradient-to-br from-[#e6eef6] to-[#f7f9fc] mb-10">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.notListedTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.notListedLead}</p>
        <Link
          href={p("/rfq")}
          className="btn btn-primary mt-5 inline-block"
          data-track={ANALYTICS_EVENTS.rfqCtaClick}
          data-track-value="directory_rfq_block"
        >
          {s.notListedCta}
        </Link>
      </section>

      {/* 供应商侧入口（Claim 入口在各 profile 页） */}
      <section className="card p-8">
        <h2 className="text-2xl font-bold text-[#0f172a]">{s.claimTitle}</h2>
        <p className="text-[#475569] mt-2 max-w-2xl">{s.claimLead}</p>
        <Link
          href={p("/join-supplier-network")}
          className="btn btn-outline mt-5 inline-block"
        >
          {s.claimPrimary}
        </Link>
      </section>

      {/* FAQ（指令 §21：只写真实、对 Buyer 有帮助的问题） */}
      <section className="mb-4">
        <h2 className="text-2xl font-bold text-[#0f172a]">{t.common.faq}</h2>
        <div className="mt-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="card p-5">
              <h3 className="font-semibold text-[#0f172a]">{f.q}</h3>
              <p className="text-[#475569] mt-2 text-sm">{f.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link
            href={p("/custom-services")}
            className="text-[#0f4c81] font-medium hover:underline"
            data-track={ANALYTICS_EVENTS.verificationCtaClick}
            data-track-value="directory_faq"
          >
            {s.svcCta} →
          </Link>
        </p>
      </section>
    </main>
  );
}
