import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { requireAdmin, listAdminSuppliers } from "@/lib/adminData";
import AuditCreateForm, { type SupplierOption } from "@/components/admin/AuditCreateForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, title: "New audit | FactoryAuditB2B Admin" };

// Phase 1：后台手动建单。
//
// 为什么不是「选一个已经提交的请求」：
//   运营在微信/电话里谈下的单，客户从未打开过网站。要求运营先教客户填表，
//   等于把已经到手的单推回漏斗最上面。这个页面只做一件事：把谈成的事实
//   按同一套 createAuditRequest 落库，拿到 audit_code，后续派单/报告才有对象。

type Props = { params: Promise<{ locale: string }> };

export default async function AdminAuditNewPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const p = (href: string) => localePath(locale, href);
  const rows = await listAdminSuppliers();

  // 下拉的展示名：英文名优先（国际客户/审核员看得懂），回落法定名。
  // meta 用「城市 · 国家」—— 同名工厂很多，只给名字会选错。
  const suppliers: SupplierOption[] = rows.map((s) => ({
    id: s.id,
    name: s.english_name?.trim() || s.legal_name,
    meta: [s.city, s.country_code].filter(Boolean).join(" · ") || s.slug,
  }));

  return (
    <div>
      <Link href={p("/admin/audits")} className="text-sm text-[#171717] hover:underline">
        ← Audit workbench
      </Link>

      <div className="mt-6 max-w-3xl">
        <h1 className="text-xl font-bold text-[#171717]">New audit</h1>
        <p className="mt-1 text-sm text-[#6d6b66]">
          Record an audit that was agreed outside the website. The request is stored with status{" "}
          <code>requested</code>; assignment comes next on the detail page.
        </p>
      </div>

      <div className="mt-6 max-w-3xl">
        <AuditCreateForm locale={locale} suppliers={suppliers} />
      </div>
    </div>
  );
}
