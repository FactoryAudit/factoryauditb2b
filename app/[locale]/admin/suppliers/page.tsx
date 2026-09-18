import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { listAdminSuppliers, requireAdmin, type ListSuppliersFilter } from "@/lib/adminData";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function AdminSuppliersPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const sp = await searchParams;
  const search = str(sp.search).trim();
  const published = (str(sp.published) || "all") as ListSuppliersFilter["published"];
  const authorized = (str(sp.authorized) || "all") as ListSuppliersFilter["authorized"];

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);
  const rows = await listAdminSuppliers({ search, published, authorized });

  const tierLabel: Record<string, string> = a.tier;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">{a.suppliersTitle}</h1>
      <p className="mt-1 text-sm text-[#64748b]">{a.suppliersLead}</p>

      {/* 搜索 + 筛选（GET 表单，提交回本页） */}
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[#64748b]">{a.searchPlaceholder}</span>
          <input
            name="search"
            defaultValue={search}
            placeholder={a.searchPlaceholder}
            className="mt-1 w-72 rounded-md border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#64748b]">{a.colPublished}</span>
          <select
            name="published"
            defaultValue={published}
            className="mt-1 rounded-md border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none"
          >
            <option value="all">{a.filterAll}</option>
            <option value="published">{a.colPublished}</option>
            <option value="unpublished">{a.filterUnpublished}</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#64748b]">{a.colAuthorized}</span>
          <select
            name="authorized"
            defaultValue={authorized}
            className="mt-1 rounded-md border border-[#e2e8f0] px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f4c81] focus:outline-none"
          >
            <option value="all">{a.filterAll}</option>
            <option value="authorized">{a.colAuthorized}</option>
            <option value="not_authorized">{a.filterNotAuthorized}</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          {a.viewAll}
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#475569]">{a.suppliersEmpty}</p>
          <p className="mt-2 text-xs text-[#64748b]">{a.suppliersEmptyHint}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f7f9fc] text-xs uppercase text-[#64748b]">
              <tr>
                <th className="px-4 py-3">{a.colName}</th>
                <th className="px-4 py-3">{a.fieldEnglishName}</th>
                <th className="px-4 py-3">{a.colCountry}</th>
                <th className="px-4 py-3">{a.fieldWebsite}</th>
                <th className="px-4 py-3">{a.fieldContactEmail}</th>
                <th className="px-4 py-3">{a.colPublished}</th>
                <th className="px-4 py-3">{a.colAuthorized}</th>
                <th className="px-4 py-3">{a.colCreatedAt}</th>
                <th className="px-4 py-3">{a.colUpdatedAt}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#f7f9fc]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0f172a]">{r.legal_name}</div>
                    <div className="font-mono text-xs text-[#94a3b8]">{r.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-[#475569]">{r.english_name ?? "—"}</td>
                  <td className="px-4 py-3 text-[#475569]">
                    {r.country_code} · {r.city}
                    {r.province ? ` · ${r.province}` : ""}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    {r.website ? (
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0f4c81] hover:underline"
                      >
                        {r.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">{r.contact_email ?? "—"}</td>
                  <td className="px-4 py-3 text-[#475569]">
                    {r.is_published ? a.yes : a.no}
                  </td>
                  <td className="px-4 py-3">
                    {r.profile_authorized ? (
                      <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-xs text-[#1a7f37]">
                        {a.colAuthorized}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#fdeaea] px-2 py-0.5 text-xs text-[#d4232a]">
                        {a.filterNotAuthorized}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    {r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#475569]">
                    {r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={p(`/admin/suppliers/${r.slug}`)}
                      className="text-[#0f4c81] hover:underline"
                    >
                      {a.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
