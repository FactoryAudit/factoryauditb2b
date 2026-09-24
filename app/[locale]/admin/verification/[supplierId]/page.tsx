import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";
import VerificationWorkbench from "@/components/admin/VerificationWorkbench";

// CS-22 CHANGE SET C —— 单供应商「核验工作台」宿主页

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string; supplierId: string }> };

export default async function AdminVerificationWorkbenchPage({ params }: Props) {
  const { locale: raw, supplierId } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const admin = await requireAdmin();
  if (!admin) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);

  // 取供应商名（仅展示）
  let name = supplierId;
  const db = createAdminClient();
  if (db) {
    const { data } = await db
      .from("suppliers")
      .select("legal_name")
      .eq("id", supplierId)
      .maybeSingle();
    if (data?.legal_name) name = data.legal_name as string;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={p("/admin/verification")}
          className="text-sm text-[#0f4c81] hover:underline"
        >
          ← {a.backToList}
        </Link>
        <span className="font-mono text-xs text-[#94a3b8]">{supplierId}</span>
      </div>
      <div className="mt-2">
        <VerificationWorkbench supplierId={supplierId} supplierName={name} />
      </div>
    </div>
  );
}
