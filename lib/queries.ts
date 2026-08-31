import { prisma } from "./db";
import { MOCK_SUPPLIERS } from "./data";
import { getSupplierCapabilitiesResolved } from "./taxonomy";

export type SupplierCapabilityView = {
  refType: string;
  refCode: string;
  label: string;
  verified: boolean;
  source: string;
};

// 与页面当前消费的供应商形状保持一致（mainProducts/exportMarkets/certifications 为数组）
export type SupplierView = {
  slug: string;
  legalName: string;
  country: string;
  countryName?: string;
  city: string;
  industryCode?: string;
  businessType: string;
  established?: number;
  employees?: string;
  mainProducts: string[];
  exportMarkets: string[];
  verificationStatus?: string;
  riskScore?: number;
  riskLevel?: string;
  certifications: string[];
  auditStatus?: string;
  inspectionHistory: number;
  /** 证据条数（SupplierEvidence），目录页显示「可用证据」 */
  evidenceCount: number;
  /** 其中已核验的条数 */
  evidenceVerified: number;
};

function splitCsv(v?: string | null): string[] {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function toView(row: {
  slug: string;
  legalName: string;
  countryCode: string;
  city: string;
  industryCode?: string | null;
  businessType: string;
  established?: number | null;
  employees?: string | null;
  mainProducts?: string | null;
  exportMarkets?: string | null;
  verificationStatus?: string | null;
  riskScore?: number | null;
  riskLevel?: string | null;
  certifications?: string | null;
  auditStatus?: string | null;
  inspectionHistory?: number | null;
  countryName?: string;
  evidenceCount?: number;
  evidenceVerified?: number;
}): SupplierView {
  return {
    slug: row.slug,
    legalName: row.legalName,
    country: row.countryCode,
    countryName: row.countryName,
    city: row.city,
    industryCode: row.industryCode ?? undefined,
    businessType: row.businessType,
    established: row.established ?? undefined,
    employees: row.employees ?? undefined,
    mainProducts: splitCsv(row.mainProducts),
    exportMarkets: splitCsv(row.exportMarkets),
    verificationStatus: row.verificationStatus ?? undefined,
    riskScore: row.riskScore ?? undefined,
    riskLevel: row.riskLevel ?? undefined,
    certifications: splitCsv(row.certifications),
    auditStatus: row.auditStatus ?? undefined,
    inspectionHistory: row.inspectionHistory ?? 0,
    evidenceCount: row.evidenceCount ?? 0,
    evidenceVerified: row.evidenceVerified ?? 0,
  };
}

/**
 * 供应商目录：带证据统计与国家名。
 * 注意：返回真实条数，不补 mock 数字，也不显示平台规模 —— 收录量小就把
 * 「找不到？发 RFQ」做成主入口（PRD §57/§58）。
 */
export async function listSupplierDirectory(): Promise<SupplierView[]> {
  const rows = await prisma.supplier.findMany({
    orderBy: [{ riskScore: "asc" }, { legalName: "asc" }],
    include: {
      country: { select: { name: true } },
      evidence: { select: { id: true, status: true } },
    },
  });
  return rows.map((r) =>
    toView({
      ...r,
      countryName: r.country.name,
      evidenceCount: r.evidence.length,
      evidenceVerified: r.evidence.filter((e) => (e.status ?? "").toUpperCase() === "VERIFIED").length,
    })
  );
}

/** 供应商详情：基本信息 + 证据 + 能力标签（能力标签按 locale 取名，避免英文页出现中文） */
export async function getSupplierDetail(
  slug: string,
  locale: "en" | "zh" | "zh-TW" = "en"
) {
  const row = await prisma.supplier.findUnique({
    where: { slug },
    include: {
      country: { select: { name: true } },
      evidence: { orderBy: { date: "desc" } },
    },
  });
  if (!row) return null;
  const view = toView({
    ...row,
    countryName: row.country.name,
    evidenceCount: row.evidence.length,
    evidenceVerified: row.evidence.filter((e) => (e.status ?? "").toUpperCase() === "VERIFIED").length,
  });
  const capabilities = await getSupplierCapabilitiesResolved(row.id, locale);
  return {
    ...view,
    evidence: row.evidence.map((e) => ({
      id: e.id,
      type: e.type,
      status: e.status,
      source: e.source,
      date: e.date,
      note: e.note,
    })),
    capabilities,
  };
}

export async function listSuppliers(): Promise<SupplierView[]> {
  const rows = await prisma.supplier.findMany({ orderBy: { createdAt: "asc" } });
  if (!rows.length) return MOCK_SUPPLIERS as SupplierView[];
  return rows.map(toView);
}

export async function getSupplierBySlug(slug: string): Promise<SupplierView | null> {
  const row = await prisma.supplier.findUnique({ where: { slug } });
  if (!row) return (MOCK_SUPPLIERS as SupplierView[]).find((s) => s.slug === slug) ?? null;
  return toView(row);
}

export async function listSupplierSlugs(): Promise<{ country: string; slug: string }[]> {
  const rows = await prisma.supplier.findMany({ select: { countryCode: true, slug: true } });
  if (!rows.length) return (MOCK_SUPPLIERS as SupplierView[]).map((s) => ({ country: s.country, slug: s.slug }));
  return rows.map((r) => ({ country: r.countryCode, slug: r.slug }));
}

// STEP 4: 供应商能力标签（消费 taxonomy engine）—— 解析出可读名称
export async function getSupplierCapabilities(slug: string): Promise<SupplierCapabilityView[]> {
  const row = await prisma.supplier.findUnique({ where: { slug }, select: { id: true } });
  if (!row) return [];
  return getSupplierCapabilitiesResolved(row.id);
}
