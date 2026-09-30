import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import {
  listAdminSuppliers,
  requireAdmin,
  countPublicSourceCandidates,
  PUBLIC_SOURCE_BULK_LIMIT,
  type ListSuppliersFilter,
} from "@/lib/adminData";
import BulkClearPanel from "@/components/admin/BulkClearPanel";

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

  // ---- 029：批量「公开来源放行」的作用范围 ----
  // 🔴 候选刻意**不受** authorized 筛选影响：候选定义固定为
  //    「profile_authorized 为 null（从未表态）且尚未放行」。若跟着 authorized=authorized 走，
  //    就会出现「只处理已授权的行」这种自相矛盾的组合。
  //    搜索与发布状态照常生效 —— 管理员靠它们收窄批次。
  const clearable = await countPublicSourceCandidates({ search, published }, true);
  const unclearable = await countPublicSourceCandidates({ search, published }, false);

  // 后台是内部 noindex 工具，按 admin 既有约定用双语常量，不补 9 语字典键
  // （9 语字典的叶子数有闸门守着）。
  const zh = locale === "zh" || locale === "zh-TW";

  const tierLabel: Record<string, string> = a.tier;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171717]">{a.suppliersTitle}</h1>
      <p className="mt-1 text-sm text-[#6d6b66]">{a.suppliersLead}</p>

      {/* 搜索 + 筛选（GET 表单，提交回本页） */}
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[#6d6b66]">{a.searchPlaceholder}</span>
          <input
            name="search"
            defaultValue={search}
            placeholder={a.searchPlaceholder}
            className="mt-1 w-72 rounded-md border border-[#ebe8e1] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#6d6b66]">{a.colPublished}</span>
          <select
            name="published"
            defaultValue={published}
            className="mt-1 rounded-md border border-[#ebe8e1] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
          >
            <option value="all">{a.filterAll}</option>
            <option value="published">{a.colPublished}</option>
            <option value="unpublished">{a.filterUnpublished}</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[#6d6b66]">{a.colAuthorized}</span>
          <select
            name="authorized"
            defaultValue={authorized}
            className="mt-1 rounded-md border border-[#ebe8e1] px-3 py-2 text-sm text-[#171717] focus:border-[#171717] focus:outline-none"
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

      {/* 029：批量放行入口。两步确认（先取条数 → 看到数字 → 再确认才写库）。
          批量写库不可逆，这里的数字是管理员最后的刹车。 */}
      <BulkClearPanel
        filter={{ search, published: published ?? "all" }}
        clearable={clearable}
        unclearable={unclearable}
        limit={PUBLIC_SOURCE_BULK_LIMIT}
        dict={{
          title: zh ? "公开来源批量放行" : "Bulk public-source clearance",
          lead: zh
            ? "对当前筛选下、从未表态授权、也尚未放行的档案，批量标记「已确认来源为公开信息」。已授权的、以及明确拒绝公开的档案都不会被改动。此标记会写入操作人与时间戳，可在审计日志中查询。"
            : "Marks every currently filtered profile whose supplier has never stated an authorization preference and that has not been cleared yet as confirmed to come from public information. Profiles that were authorized — or explicitly declined — are never touched. Each change records your account and a timestamp in the audit log.",
          clear: zh ? "放行 {n} 家" : "Clear {n}",
          unclear: zh ? "撤销放行 {n} 家" : "Revoke {n}",
          confirmClear: zh
            ? "将放行 {n} 家 —— 写入操作人与当前时间，可在审计日志查询。确认继续？"
            : "This will clear {n} profiles and record your account plus the current time in the audit log. Continue?",
          confirmUnclear: zh
            ? "将撤销 {n} 家的放行标记。确认继续？"
            : "This will revoke clearance for {n} profiles. Continue?",
          confirm: zh ? "确认执行" : "Confirm",
          cancel: zh ? "取消" : "Cancel",
          working: zh ? "处理中…" : "Working…",
          error: zh ? "操作失败，请重试。" : "Request failed, please retry.",
          limit: zh
            ? "当前筛选下有 {count} 家，超过单批上限 {limit} 家。请用搜索或发布状态收窄筛选后分批执行。"
            : "The current filter matches {count} profiles, above the per-batch limit of {limit}. Narrow the filter (search or published state) and run in batches.",
          empty: zh ? "当前筛选下没有可处理的档案。" : "Nothing to process under the current filter.",
        }}
      />

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#3f4650]">{a.suppliersEmpty}</p>
          <p className="mt-2 text-xs text-[#6d6b66]">{a.suppliersEmptyHint}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#ebe8e1] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#ebe8e1] bg-[#fbfaf7] text-xs uppercase text-[#6d6b66]">
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
            <tbody className="divide-y divide-[#ebe8e1]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#fbfaf7]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#171717]">{r.legal_name}</div>
                    <div className="font-mono text-xs text-[#8c8982]">{r.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-[#3f4650]">{r.english_name ?? "—"}</td>
                  <td className="px-4 py-3 text-[#3f4650]">
                    {r.country_code} · {r.city}
                    {r.province ? ` · ${r.province}` : ""}
                  </td>
                  <td className="px-4 py-3 text-[#3f4650]">
                    {r.website ? (
                      <a
                        href={r.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#171717] hover:underline"
                      >
                        {r.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#3f4650]">{r.contact_email ?? "—"}</td>
                  <td className="px-4 py-3 text-[#3f4650]">
                    {r.is_published ? a.yes : a.no}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {r.profile_authorized ? (
                        <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-xs text-[#1a7f37]">
                          {a.colAuthorized}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#fdeaea] px-2 py-0.5 text-xs text-[#d4232a]">
                          {a.filterNotAuthorized}
                        </span>
                      )}
                      {/* 029：未授权，但已被管理员以「公开来源」放行。
                          两条通道必须分别可见 —— 否则管理员会误以为这家过不了发布闸门。 */}
                      {r.public_source_cleared === true && (
                        <span className="rounded-full bg-[#eef2fb] px-2 py-0.5 text-xs text-[#2a4d9b]">
                          {zh ? "已放行" : "Cleared"}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#3f4650]">
                    {r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[#3f4650]">
                    {r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={p(`/admin/suppliers/${r.slug}`)}
                      className="text-[#171717] hover:underline"
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
