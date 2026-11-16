import type { Metadata } from "next";
import Link from "next/link";
import SupplierProfileForm, { type SupplierProfileValues } from "@/components/portal/SupplierProfileForm";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

// /portal/profile —— 供应商自助「完善档案」
//
// 这些字段会进入 13 章尽职调查报告（后台「从档案预填」直接带出）。
// 供应商自己能确定的事实在这里填；涉诉/税务/现场核验由平台核验后录。

const PATH = "/portal/profile";

export const dynamic = "force-dynamic";

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
    title: t.account.h1,
    description: t.account.lead,
    robots: { index: false, follow: false },
  });
}

export default async function SupplierProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const p = (href: string) => localePath(locale, href);
  const zh = locale === "zh" || locale === "zh-TW";

  const access = await resolveSupplierAccess({ claimedSupplierId: null, email: null });
  if (!access.ok) {
    return (
      <div className="rounded-xl border border-[#ecebe7] bg-white p-8 text-center">
        <p className="text-[#3f4650]">
          {access.code === "not_owner"
            ? zh
              ? "此账号未关联任何供应商。"
              : "This account is not linked to a supplier."
            : zh
            ? "请先登录供应商账号。"
            : "Please sign in to your supplier account."}
        </p>
        <Link href={p("/portal")} className="btn btn-primary mt-4 inline-block text-sm">
          {zh ? "返回工作台" : "Back to workspace"}
        </Link>
      </div>
    );
  }

  const { supplierId, email } = access.identity;
  const db = createAdminClient();

  let v: SupplierProfileValues = {
    legal_name: "",
    english_name: "",
    company_type: "",
    business_type: "",
    registration_number: "",
    established: "",
    address: "",
    city: "",
    province: "",
    industry_code: "",
    employees: "",
    legal_representative: "",
    registered_capital: "",
    business_scope: "",
    production_workers: "",
    factory_size: "",
    monthly_output: "",
    production_capacity: "",
    export_since: "",
    main_products: "",
    export_markets: "",
    reference_customers: "",
    contact_person: "",
    phone: "",
    whatsapp: "",
    website: "",
    company_description: "",
  };

  if (db) {
    const { data: row } = await db
      .from("suppliers")
      .select(
        "legal_name, english_name, company_type, business_type, registration_number, established, address, city, province, industry_code, employees, legal_representative, registered_capital, business_scope, production_workers, factory_size, monthly_output, production_capacity, export_since, main_products, export_markets, reference_customers, contact_person, phone, whatsapp, website, company_description"
      )
      .eq("id", supplierId)
      .maybeSingle();

    if (row) {
      v = {
        legal_name: row.legal_name ?? "",
        english_name: row.english_name ?? "",
        company_type: row.company_type ?? "",
        business_type: row.business_type ?? "",
        registration_number: row.registration_number ?? "",
        established: row.established === null ? "" : String(row.established),
        address: row.address ?? "",
        city: row.city ?? "",
        province: row.province ?? "",
        industry_code: row.industry_code ?? "",
        employees: row.employees ?? "",
        legal_representative: row.legal_representative ?? "",
        registered_capital: row.registered_capital ?? "",
        business_scope: row.business_scope ?? "",
        production_workers: row.production_workers ?? "",
        factory_size: row.factory_size ?? "",
        monthly_output: row.monthly_output ?? "",
        production_capacity: row.production_capacity ?? "",
        export_since: row.export_since === null ? "" : String(row.export_since ?? ""),
        main_products: (row.main_products ?? []).join(", "),
        export_markets: (row.export_markets ?? []).join(", "),
        reference_customers: row.reference_customers ?? "",
        contact_person: row.contact_person ?? "",
        phone: row.phone ?? "",
        whatsapp: row.whatsapp ?? "",
        website: row.website ?? "",
        company_description: row.company_description ?? "",
      };
    }
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <Link
          href={p("/portal")}
          className="inline-flex items-center gap-1 text-[#6d6b66] hover:text-[#171717]"
        >
          <span aria-hidden="true">←</span>
          {zh ? "返回工作台" : "Back to workspace"}
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-[22px] font-extrabold text-[#171717]">
          {zh ? "完善档案" : "Company profile"}
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[#6d6b66]">
          {zh
            ? "这些信息会进入你的尽职调查报告。填得越完整，买家看到的档案越可信 —— 但我们不会替你编造任何一项。"
            : "This information feeds your due-diligence report. The more you fill in, the more credible your listing — but we never invent anything on your behalf."}
        </p>
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-[#f1f7f3] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#2e7d4f]">
          <span aria-hidden="true" className="mt-0.5">
            ✓
          </span>
          <span>
            {zh
              ? "填写档案完全免费，也不影响你的档案是否发布 —— 发布由平台审核决定。"
              : "Filling this in is free and does not affect whether your listing is published — that is a platform review decision."}
          </span>
        </p>
      </header>

      <SupplierProfileForm supplierId={supplierId} email={email} initial={v} zh={zh} />
    </div>
  );
}
