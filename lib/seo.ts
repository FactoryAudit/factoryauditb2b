// 程序化 SEO —— 基于 taxonomy 生成静态页矩阵（§STEP 10）
// 维度：Country × AuditType（isAudit）。页面由中央 taxonomy 引擎驱动。
// V2.0 轻量化：数据源改静态（getSeoMatrix），不再 import Prisma。
import { getSeoMatrix } from "./taxonomy";

export type SeoAuditGuidePage = {
  country: string;
  countryName: string;
  auditType: string;
  auditTypeName: string;
  url: string;
  title: string;
  description: string;
};

export async function listSeoAuditGuidePages(): Promise<SeoAuditGuidePage[]> {
  const { countries, auditTypes } = await getSeoMatrix();
  const pages: SeoAuditGuidePage[] = [];
  for (const c of countries) {
    for (const a of auditTypes) {
      pages.push({
        country: c.code,
        countryName: c.name,
        auditType: a.code,
        auditTypeName: a.nameEn,
        url: `/audit-guide/${c.code}/${a.code}`,
        title: `${a.nameEn} Audit in ${c.name} | FactoryAuditB2B`,
        description: `Find ${a.nameEn} (${a.nameZh || ""}) audit, inspection and certified suppliers in ${c.name}. Verified factory directory, RFQ and auditor matching.`,
      });
    }
  }
  return pages;
}
