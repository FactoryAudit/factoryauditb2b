import type { Metadata } from "next";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import {
  ComplianceSections,
  RelatedPolicies,
  type PolicyLink,
} from "@/components/legal/ComplianceSections";
import { COMPLIANCE_EMAIL } from "@/lib/compliance";

const PATH = "/integrity";

/**
 * 引用的承诺文件 —— 取 `supplierNetwork.docs` 的**既有真实条目**（不新增、不改写）：
 *   [3] Supplier Anti-Bribery & Integrity Commitment（供应商反贿赂与廉洁承诺）
 *   [4] Conflict of Interest Declaration（利益冲突申报）
 *   [5] Auditor Integrity & Confidentiality Commitment（审核员廉洁与保密承诺）
 * 这三份文档名已在 `/join-supplier-network` 公开列出，故此处引用是**零编造**。
 */
const COMMITMENT_DOC_INDEXES = [3, 4, 5] as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.integrity.metaTitle,
    description: t.integrity.metaDesc,
  });
}

/**
 * /integrity —— 廉洁与商业行为准则（CS-23）。
 *
 * 写作边界（用户明确要求，勿越界）：
 *   · 举报渠道**只能用真实存在的全站主渠道**，不得编造专用邮箱或表单。
 *   · 不写具体罚款金额、不写法律条文编号、不写「100% / 绝对」类绝对化措辞。
 *   · 违规后果只写到「调离项目 / 收回权限 / 重新评估合作关系 / 最重终止合作」。
 */
export default async function IntegrityPage({ params }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const c = t.integrity;
  const p = (href: string) => localePath(locale, href);

  const links: PolicyLink[] = [
    { href: p("/integrity"), label: t.footer.integrity, current: true },
    { href: p("/confidentiality"), label: t.footer.confidentiality },
    { href: p("/trust"), label: t.trust.badge },
    { href: p("/privacy"), label: t.footer.privacy },
    { href: p("/terms"), label: t.footer.terms },
  ];

  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-extrabold text-[#171717]">{c.h1}</h1>
      <p className="text-sm text-[#8c8982] mt-1 mb-6">{c.updated}</p>
      <p className="text-[#3f4650] leading-relaxed mb-8">{c.intro}</p>

      <ComplianceSections sections={c.sections} />

      {/* 支撑本准则的承诺文件（引用既有公开文档名，不新增、不改写） */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-[#171717] mb-1">{c.docsTitle}</h2>
        <p className="text-[#3f4650] leading-relaxed">{c.docsLead}</p>
        <ul className="mt-3 flex flex-wrap gap-2 list-none p-0">
          {COMMITMENT_DOC_INDEXES.map((i) => (
            <li key={i}>
              <span className="inline-block rounded-full border border-[#ebe8e1] bg-white px-3 py-1.5 text-xs text-[#3f4650]">
                {t.supplierNetwork.docs[i]}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#8c8982]">{t.supplierNetwork.docsNote}</p>
      </section>

      {/* 举报渠道：只有一个真实入口，不拆分、不暗示还有别的表 */}
      <section className="mt-10 rounded-lg border border-[#ebe8e1] bg-[#fbfaf7] p-6">
        <h2 className="text-lg font-bold text-[#171717] mb-1">{c.reportTitle}</h2>
        <p className="text-[#3f4650] leading-relaxed">{c.reportBody}</p>
        <a
          href={`mailto:${COMPLIANCE_EMAIL}`}
          className="mt-3 inline-block font-semibold text-[#1b1b19] underline decoration-[#e07a49] hover:decoration-2"
        >
          {COMPLIANCE_EMAIL}
        </a>
      </section>

      <RelatedPolicies title={t.compliance.relatedTitle} links={links} />
    </div>
  );
}
