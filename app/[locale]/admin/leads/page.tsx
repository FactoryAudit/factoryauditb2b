import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LeadStatusSelect from "@/components/admin/LeadStatusSelect";

// 后台不索引
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// 后台时间统一用 ISO，避免服务端/客户端 locale 差异导致水合不一致
function fmt(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default async function AdminLeadsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    redirect("/login?error=admin_only");
  }

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const byStatus = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="container py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#0f172a]">Lead Management</h1>
        <Link href="/admin" className="btn btn-outline">
          Back to Admin
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(byStatus)
          .sort((a, b) => b[1] - a[1])
          .map(([s, n]) => (
            <span
              key={s}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-[#f1f5f9] text-[#475569]"
            >
              {s}: {n}
            </span>
          ))}
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#0f4c81] text-white">
          Total: {leads.length}
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f1f5f9] text-[#64748b]">
            <tr>
              <th className="p-3 text-left whitespace-nowrap">Date (UTC)</th>
              <th className="p-3 text-left">Tool / Source</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Country</th>
              <th className="p-3 text-left">Sourcing</th>
              <th className="p-3 text-left">Score</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-[#e2e8f0] align-top">
                <td className="p-3 whitespace-nowrap text-[#64748b] text-xs">{fmt(lead.createdAt)}</td>
                <td className="p-3">{lead.tool || "—"}</td>
                <td className="p-3">{lead.firstName || "—"}</td>
                <td className="p-3">{lead.company || "—"}</td>
                <td className="p-3">
                  <a href={`mailto:${lead.email}`} className="text-[#0f4c81] hover:underline">
                    {lead.email}
                  </a>
                </td>
                <td className="p-3">{lead.country || "—"}</td>
                <td className="p-3 text-[#475569]">{lead.sourcing || "—"}</td>
                <td className="p-3">{lead.score ?? "—"}</td>
                <td className="p-3">
                  <LeadStatusSelect leadId={lead.id} initialStatus={lead.status} />
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[#64748b]">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-[#0f172a] mt-10 mb-4">Messages</h2>
      {leads.filter((l) => l.message).length === 0 && (
        <p className="text-[#64748b]">No messages yet.</p>
      )}
      {leads
        .filter((l) => l.message)
        .map((lead) => (
          <div key={`msg-${lead.id}`} className="card p-4 mt-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-[#0f172a]">{lead.firstName || "Lead"}</span>
              <span className="text-[#64748b]">·</span>
              <span className="text-[#64748b]">{lead.email}</span>
              <span className="text-[#64748b]">·</span>
              <span className="text-[#64748b]">{lead.tool || "—"}</span>
              <span className="text-[#94a3b8] text-xs ml-auto">{fmt(lead.createdAt)}</span>
            </div>
            <p className="text-sm text-[#475569] whitespace-pre-wrap">{lead.message}</p>
          </div>
        ))}
    </div>
  );
}
