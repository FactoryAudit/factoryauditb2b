import type { Metadata } from "next";
import CareersApplyForm from "@/components/careers/CareersApplyForm";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

const PATH = "/careers";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.careers.metaTitle,
    description: t.careers.metaDesc,
  });
}

/**
 * /careers —— 人才网络入口（页脚「Work With Us」直达）。
 *
 * 定位不是「招聘岗位列表」，而是**可调用的人力网络**：
 * 审核员 + 顾问 + 项目人员 + 采购 + IT + 本地合作伙伴。
 * 第一版不建招聘后台：申请连同简历进管理员邮箱，靠结构化主题行做检索。
 */
export default async function Page({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const dict = await getDictionary(locale);
  const c = dict.careers;

  const auditorRoles = [
    c.roleChinaAuditor,
    c.roleThailandAuditor,
    c.roleVietnamAuditor,
    c.roleSocialCompliance,
    c.roleQualityFactory,
    c.roleEnvironmental,
  ];
  const otherRoles = [
    c.roleSupplierVerification,
    c.roleSourcing,
    c.roleProjectCoordinator,
    c.roleSales,
    c.roleItAi,
    c.roleContentSeo,
  ];

  return (
    <main className="container py-12">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-extrabold text-[#0f172a]">{c.heroTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#334155]">{c.heroLead}</p>
        <p className="mt-3 leading-relaxed text-[#64748b]">{c.heroIntro}</p>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-[#0f4c81]">
          {c.heroRegions}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#0f172a]">{c.focusTitle}</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-[#0f172a]">{c.groupAuditors}</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#334155]">
              {auditorRoles.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-[#0f172a]">{c.groupOther}</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#334155]">
              {otherRoles.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <CareersApplyForm
          dict={c}
          locale={locale}
          phSelect={dict.toolsUi?.riskAssessment?.selectOption}
        />
      </section>
    </main>
  );
}
