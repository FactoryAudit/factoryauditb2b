import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/adminData";
import SupplierCreateForm from "@/components/admin/SupplierCreateForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

export default async function AdminSupplierNewPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);

  // create 子命名空间必须存在；缺失时给出可读回退，避免整页崩
  const c = (a.create ?? {}) as Record<string, string>;

  return (
    <div>
      <Link
        href={p("/admin/suppliers")}
        className="text-sm text-[#0f4c81] hover:underline"
      >
        ← {a.backToList}
      </Link>

      <div className="mt-6">
        <SupplierCreateForm
          locale={locale}
          dict={{
            title: c.title ?? "Add supplier",
            lead:
              c.lead ??
              "New suppliers start unpublished and unverified. You review and publish them later.",
            slugLabel: c.slugLabel ?? "Slug (URL id)",
            slugHint:
              c.slugHint ?? "Lowercase letters, numbers and hyphens. Must be unique.",
            suggest: c.suggest ?? "Suggest",
            legalNameLabel: c.legalNameLabel ?? "Legal name",
            cityLabel: c.cityLabel ?? "City",
            countryLabel: c.countryLabel ?? "Country code",
            countryHint: c.countryHint ?? "Lowercase slug, e.g. china, vietnam.",
            displayNameLabel: c.displayNameLabel ?? "Display name",
            displayNameHint:
              c.displayNameHint ?? "Public name. Falls back to legal name if empty.",
            industryLabel: c.industryLabel ?? "Industry code",
            businessTypeLabel: c.businessTypeLabel ?? "Business type",
            establishedLabel: c.establishedLabel ?? "Established (year)",
            employeesLabel: c.employeesLabel ?? "Employees",
            websiteLabel: c.websiteLabel ?? "Website",
            websiteHint: c.websiteHint ?? "Optional. Must start with http:// or https://.",
            mainProductsLabel: c.mainProductsLabel ?? "Main products",
            mainProductsHint:
              c.mainProductsHint ?? "Optional. Separate with commas or new lines.",
            phoneLabel: c.phoneLabel ?? "Phone",
            addressLabel: c.addressLabel ?? "Address",
            regNoLabel: c.regNoLabel ?? "Registration number",
            sourceTitle: c.sourceTitle ?? "Source",
            sourceUrlLabel: c.sourceUrlLabel ?? "Source URL",
            sourceTypeLabel: c.sourceTypeLabel ?? "Source type",
            sourceNameLabel: c.sourceNameLabel ?? "Source name",
            sourceHint: c.sourceHint ?? "Where this record came from. No fabrication.",
            certTitle: c.certTitle ?? "Certification claims",
            certHint:
              c.certHint ??
              "Self-declared only. Recorded as pending review; no documents uploaded.",
            certPlaceholder: c.certPlaceholder ?? "e.g. BSCI, ISO 9001, SMETA",
            addCert: c.addCert ?? "Add certification",
            removeCert: c.removeCert ?? "Remove",
            submit: c.submit ?? "Create supplier",
            submitting: c.submitting ?? "Creating...",
            success: c.success ?? "Supplier created",
            newId: c.newId ?? "New supplier ID",
            viewLink: c.viewLink ?? "View / edit",
            dupTitle: c.dupTitle ?? "Possible duplicate",
            dupFound: c.dupFound ?? "Looks like {slug} already exists. Review before creating.",
            dupField: c.dupField ?? "Matched on: {field}",
            errGeneric: c.errGeneric ?? "Could not create supplier.",
            statusUnpublished: c.statusUnpublished ?? "Starts unpublished",
            statusUnverified: c.statusUnverified ?? "Starts unverified",
          }}
        />
      </div>
    </div>
  );
}
