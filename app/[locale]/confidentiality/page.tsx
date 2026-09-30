import type { Metadata } from "next";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import {
  ComplianceSections,
  RelatedPolicies,
  type PolicyLink,
} from "@/components/legal/ComplianceSections";

const PATH = "/confidentiality";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.confidentiality.metaTitle,
    description: t.confidentiality.metaDesc,
  });
}

/**
 * /confidentiality —— 保密声明（CS-23）。
 *
 * 写作边界（用户明确要求，勿越界）：
 *   · 不写具体举报邮箱 / 电话 / 地址（举报渠道只在 /integrity 上出现，且用全站主渠道）。
 *   · **不写任何具体保留天数** —— 「AI 客服会话 90 天」对应的会话表与清理任务
 *     目前**尚未实现**，公开承诺一个不存在的机制属于无据声称（与 v4 同一原则）。
 *     保留期一段改为**直接复用 /privacy 的同一条文案**，保证两页字面一致、
 *     且将来只在 /privacy 一处改。
 *   · 不写 ISO / 渗透测试 / 加密算法细节 / 数据处理方名称 / 绝对化措辞。
 */
export default async function ConfidentialityPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.confidentiality;
  const p = (href: string) => localePath(locale, href);

  // 保留期 = /privacy 的「Data retention」那一条（单一事实源，零新增键）。
  // 语义上这是「保密信息留多久」，与隐私政策的表述必须一致，故复用而非另写。
  const retention = t.legal.privacySections[4];
  const sections = [...c.sections.slice(0, 4), retention, ...c.sections.slice(4)];

  const links: PolicyLink[] = [
    { href: p("/confidentiality"), label: t.footer.confidentiality, current: true },
    { href: p("/integrity"), label: t.footer.integrity },
    { href: p("/trust"), label: t.trust.badge },
    { href: p("/privacy"), label: t.footer.privacy },
    { href: p("/terms"), label: t.footer.terms },
  ];

  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-extrabold text-[#171717]">{c.h1}</h1>
      <p className="text-sm text-[#8c8982] mt-1 mb-6">{c.updated}</p>
      <p className="text-[#3f4650] leading-relaxed mb-8">{c.intro}</p>
      <ComplianceSections sections={sections} />
      <RelatedPolicies title={t.compliance.relatedTitle} links={links} />
    </div>
  );
}
