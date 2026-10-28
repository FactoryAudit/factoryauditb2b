import type { Metadata } from "next";
import CertificateManager from "@/components/supplier/CertificateManager";
import { resolveSupplierAccess } from "@/lib/supplierAccess";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";
import { STATIC_PROGRAMS } from "@/lib/staticData";

const PATH = "/supplier-certificates";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ supplier?: string; email?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  // 供应商内部工具页：不进索引
  return buildPageMetadata({
    locale,
    path: PATH,
    title: "Certificates",
    description: "Declare and upload your management-system certificates.",
    robots: { index: false, follow: false },
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const sp = await searchParams;
  const dict = await getDictionary(locale);

  const access = await resolveSupplierAccess({
    claimedSupplierId: (sp.supplier || "").trim() || null,
    email: (sp.email || "").trim() || null,
  });

  // 可申报的项目清单：认证类 + 审核类（BSCI / SMETA 这类虽不发证，但买家会问）
  const showZh = locale === "zh" || locale === "zh-TW";
  const programs = STATIC_PROGRAMS.filter((x) => x.isCertification || x.isAudit).map((x) => ({
    code: x.code,
    label: showZh ? x.nameZh : x.nameEn,
  }));

  if (!access.ok) {
    return (
      <main className="container py-10">
        <div className="card p-6 max-w-xl mx-auto text-center">
          <p className="text-[#2b2b2b]">Please sign in to your supplier account to continue.</p>
          <a className="btn-primary inline-block mt-4 px-6 py-3" href={localePath(locale, "/account")}>
            Sign in
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="container py-10" data-track-page="supplier_certificates">
      <section className="max-w-3xl mx-auto text-center mb-8">
        <span className="text-sm font-semibold text-[#171717] uppercase tracking-wide">Supplier Portal</span>
        <h1 className="text-3xl font-extrabold text-[#171717] mt-2">
          {locale === "zh" || locale === "zh-TW" ? "证书申报" : "Certificates"}
        </h1>
        <p className="text-[#6d6b66] mt-3">
          {locale === "zh" || locale === "zh-TW"
            ? "填写你实际持有的管理体系证书，并上传扫描件。平台核验发证机构登记库之后，状态才会变为 Verified。"
            : "Declare the management-system certificates you actually hold and attach the certificate copy. Status becomes Verified only after we check the issuer's registry."}
        </p>
      </section>

      <div className="max-w-4xl mx-auto mb-6">
        <a
          className="btn-secondary inline-block px-4 py-2 text-sm"
          href={localePath(locale, "/supplier-dashboard")}
        >
          {(dict.supplierDashboard as Record<string, string> | undefined)?.pageTitle ?? "Supplier Dashboard"}
        </a>
      </div>

      <div className="max-w-4xl mx-auto">
        <CertificateManager
          supplierId={access.identity.supplierId}
          email={access.identity.email}
          locale={locale}
          programs={programs}
        />
      </div>
    </main>
  );
}
