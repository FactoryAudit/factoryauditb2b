import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/adminData";
import { createAdminClient } from "@/lib/supabaseAdmin";

// CS-22 CHANGE SET C —— 后台「待核验队列」列表
// 列出 self_assessment 状态处于提交/审核/待补/回补的供应商。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const QUEUE_STATUSES = ["submitted", "under_review", "action_required", "resubmitted"];

type QueueRow = {
  supplierId: string;
  slug: string;
  name: string;
  status: string;
  submittedAt: string | null;
  hasVerification: boolean;
};

async function listQueue(): Promise<QueueRow[]> {
  const db = createAdminClient();
  if (!db) return [];
  try {
    const { data, error } = await db
      .from("supplier_assessments")
      .select("supplier_id, status, submitted_at, suppliers(slug, legal_name)")
      .eq("assessment_type", "self_assessment")
      .in("status", QUEUE_STATUSES)
      .order("submitted_at", { ascending: false });
    if (error || !data) return [];
    const rows = (data as unknown[]).map((r) => {
      const o = r as {
        supplier_id: string;
        status: string;
        submitted_at: string | null;
        suppliers: { slug: string; legal_name: string } | { slug: string; legal_name: string }[] | null;
      };
      const s = Array.isArray(o.suppliers) ? o.suppliers[0] : o.suppliers;
      return {
        supplierId: o.supplier_id,
        slug: s?.slug ?? "",
        name: s?.legal_name ?? "(unknown)",
        status: o.status,
        submittedAt: o.submitted_at,
      };
    });

    // 是否已有生效验证（标星）
    const ids = rows.map((r) => r.supplierId);
    let verified = new Set<string>();
    if (ids.length > 0) {
      const { data: recs } = await db
        .from("verification_records")
        .select("supplier_id")
        .in("supplier_id", ids)
        .eq("status", "ACTIVE");
      verified = new Set(((recs ?? []) as { supplier_id: string }[]).map((x) => x.supplier_id));
    }
    return rows.map((r) => ({ ...r, hasVerification: verified.has(r.supplierId) }));
  } catch {
    return [];
  }
}

export default async function AdminVerificationQueuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const admin = await requireAdmin();
  if (!admin) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);

  const rows = await listQueue();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">待核验队列 · Verification Queue</h1>
      <p className="mt-1 text-sm text-[#64748b]">
        供应商自评提交后在此审核。点击进入逐项核验工作台。
      </p>

      <div className="mt-4">
        <Link
          href={p("/admin/suppliers")}
          className="text-sm text-[#0f4c81] hover:underline"
        >
          ← {a.backToList}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-4 p-6 text-center text-sm text-[#64748b]">
          队列为空：暂无待核验的自评提交。
        </div>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f9fc] text-left text-xs text-[#475569]">
              <tr>
                <th className="px-3 py-2">供应商 Supplier</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">自评状态 Status</th>
                <th className="px-3 py-2">提交时间 Submitted</th>
                <th className="px-3 py-2">验证 Verification</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.supplierId} className="border-t border-[#e2e8f0]">
                  <td className="px-3 py-2 font-medium text-[#0f172a]">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#64748b]">{r.slug}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-xs font-medium text-[#1d4ed8]">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#64748b]">
                    {r.submittedAt ? r.submittedAt.slice(0, 10) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.hasVerification ? (
                      <span className="rounded bg-[#f0fdf4] px-2 py-0.5 text-[#15803d]">已核验</span>
                    ) : (
                      <span className="text-[#94a3b8]">未核验</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={p(`/admin/verification/${r.supplierId}`)}
                      className="text-xs text-[#0f4c81] hover:underline"
                    >
                      进入工作台 →
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
