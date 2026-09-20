import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import VerifySupplierForm from "@/components/VerifySupplierForm";
import {
  isLocale,
  DEFAULT_LOCALE,
  localePath,
  LOCALE_META,
  LOCALES,
  type Locale,
} from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";

const PATH = "/verify-supplier";
const BASE = "https://factoryauditb2b.com";

// STEP-05：Verify Supplier —— 「我已经找到一个供应商，但不知道它是不是真的 / 靠不靠谱」。
//
// 为什么单独做一个入口页，而不是只放进档案页：
//   档案页只能覆盖「供应商已经在我们目录里」的场景。真实买家在
//   Alibaba / 展会 / 邮件里拿到一家工厂时，**根本还没进过我们的站**，就得先
//   判断这家能不能下单。这一页就是这个场景的第一落点。
//
// 本版**刻意不做**（用户明确划界）：
//   · 复杂会员系统    —— 无登录要求，任何人可提交
//   · 自动评分 / 自动结论 —— 不做任何「这家是假的」的机器判定
//   · 支付            —— 无 checkout，转人工报价
//   最小闭环 = 提交 → 收集买家需求 → 入库 → 后台处理 → 转人工核验服务。
//
// 本页是**公开可索引**页（与 claim 表单页不同）：它本身就是一个真实搜索意图
// 的落地页（"how to verify a supplier" / "is this factory real"），
// 而 claim 页是 thin content 且与主 profile 竞争。
//
// 🔴 本页**绝不读 `searchParams`**。原因（实测对照，非推断）：
//   只要页面读了 searchParams，Next 就把该路由排除出静态预渲染：
//     /en/tools（不读）            ⇒ prerender = true
//     /en/suppliers（读）          ⇒ prerender = false
//     /en/verify-supplier（原实现读）⇒ prerender = false
//   本页是 SEO 落地页，必须进静态产物。因此：
//     · `?supplier=<slug>` 的预填改由客户端 useEffect 处理（见 VerifySupplierForm）；
//     · 服务端渲染出的 HTML 是「无人名预填」的干净静态版本；
//     · 档案页的入口链接同时带上 `supplier_name`，即使 JS 不可用，
//       后台也能从 API 收到的 slug 完成关联。
export const dynamic = "force-static";
export const revalidate = 3600;

/** 9 语静态化：与 /suppliers 目录页同构，无动态参数 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

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
    title: t.verifySupplier.metaTitle,
    description: t.verifySupplier.metaDesc,
  });
}

export default async function VerifySupplierPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const vs = t.verifySupplier;
  const p = (href: string) => localePath(locale, href);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: vs.h1,
    url: `${BASE}${p(PATH)}`,
    inLanguage: LOCALE_META[locale].htmlLang,
    description: vs.metaDesc,
  };

  return (
    <main
      className="container py-12 max-w-4xl"
      data-track-page={ANALYTICS_EVENTS.verifySupplierView}
    >
      <JsonLd data={jsonLd} />

      <nav aria-label={vs.breadcrumb} className="text-sm text-[#64748b]">
        <Link href={p("/")} className="hover:text-[#0f4c81]">
          {t.countryHub.breadcrumbHome}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#0f172a]">{vs.breadcrumb}</span>
      </nav>

      <section className="mt-6 mb-8">
        <span className="text-sm font-semibold text-[#0f4c81] uppercase tracking-wide">
          {vs.badge}
        </span>
        <h1 className="text-3xl font-bold text-[#0f172a] mt-2">{vs.h1}</h1>
        <p className="text-[#64748b] mt-2 max-w-3xl">{vs.lead}</p>
      </section>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <section>
          {/* 我们会查什么 —— 说清楚范围，避免用户以为「提交了就一定得出结论」 */}
          <div className="card p-5 mb-6">
            <h2 className="font-semibold text-[#0f172a]">{vs.checksTitle}</h2>
            <p className="text-sm text-[#64748b] mt-1 mb-3">{vs.checksLead}</p>
            <ul className="space-y-2 text-sm text-[#475569]">
              {vs.checks.map((c: string) => (
                <li key={c} className="flex gap-2">
                  <span className="text-[#0f4c81]">✓</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* 规则：不保证结果、不出售核验结论（与 claim 页同口径的信任基石） */}
          <div className="card p-5 bg-[#fff8f0] border-[#f0d9b8]">
            <h2 className="font-semibold text-[#0f172a]">{vs.rulesTitle}</h2>
            <ul className="mt-2 space-y-2 text-sm text-[#475569]">
              {vs.rules.map((r: string) => (
                <li key={r} className="flex gap-2">
                  <span className="text-[#a86a13]">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* 指向既有服务：本页是入口，真正的交付物是这两项 */}
          <div className="card p-5 mt-6">
            <h2 className="font-semibold text-[#0f172a]">{vs.servicesTitle}</h2>
            <p className="text-sm text-[#64748b] mt-1 mb-3">{vs.servicesLead}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={p("/services/verification")} className="btn btn-outline text-sm">
                {vs.serviceVerification}
              </Link>
              <Link href={p("/factory-audit/request")} className="btn btn-outline text-sm">
                {vs.serviceAudit}
              </Link>
            </div>
            <p className="text-xs text-[#64748b] mt-3">{vs.servicesNote}</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[#0f172a] mb-3">{vs.formTitle}</h2>
          <VerifySupplierForm t={vs.form} />
        </section>
      </div>

      {/* 已在我们目录里？直接看档案比提交请求更快 */}
      <section className="mt-10 card p-6">
        <h2 className="font-semibold text-[#0f172a]">{vs.directoryTitle}</h2>
        <p className="text-sm text-[#64748b] mt-1 mb-3">{vs.directoryLead}</p>
        <Link href={p("/suppliers")} className="btn btn-outline text-sm">
          {vs.directoryCta}
        </Link>
      </section>
    </main>
  );
}
