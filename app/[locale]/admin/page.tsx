import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// 后台不索引
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// 只列真实存在的管理页面，避免死链（项目约定：禁止 href="#" / 空链接）
const MODULES = [
  { label: "Lead Management", href: "/admin/leads", note: "Review enquiries and move status" },
  { label: "Taxonomy", href: "/admin/taxonomy", note: "Countries, industries, audit types, risk weights" },
];

export default async function AdminPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    redirect("/login?error=admin_only");
  }

  // 全部来自真实数据库。此前这里是硬编码的假数字（MRR ¥86,000 等），
  // 会让人误判经营状况，已改为真实统计；无数据来源的一律显示 "—"。
  const [users, suppliers, rfqs, audits, leads] = await Promise.all([
    prisma.user.count(),
    prisma.supplier.count(),
    prisma.rfq.count(),
    prisma.auditRequest.count(),
    prisma.lead.count(),
  ]);

  const KPIS = [
    { label: "Users", value: users.toLocaleString(), note: "" },
    { label: "Suppliers", value: suppliers.toLocaleString(), note: "" },
    { label: "RFQs", value: rfqs.toLocaleString(), note: "" },
    { label: "Audit requests", value: audits.toLocaleString(), note: "" },
    { label: "Leads", value: leads.toLocaleString(), note: "" },
    { label: "MRR", value: "—", note: "No payment gateway connected" },
    { label: "Commission", value: "—", note: "No order tracking yet" },
  ];

  return (
    <div className="container py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#0f172a]">Admin Dashboard</h1>
        <span className="text-sm text-[#64748b]">
          {session.user.email} · <span className="badge badge-verified">{role}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {KPIS.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-2xl font-extrabold text-[#0f4c81]">{k.value}</div>
            <div className="text-xs text-[#64748b]">{k.label}</div>
            {k.note && <div className="text-[11px] text-[#94a3b8] mt-1">{k.note}</div>}
          </div>
        ))}
      </div>
      <h2 className="text-xl font-bold mt-10 mb-3">Management</h2>
      <div className="grid md:grid-cols-3 gap-3">
        {MODULES.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className="card p-4 text-sm hover:border-[#0f4c81] cursor-pointer block"
          >
            <span className="font-semibold text-[#0f172a] block">{m.label}</span>
            <span className="text-xs text-[#64748b] mt-1 block">{m.note}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-[#94a3b8] mt-6">
        RBAC enforced. Numbers above are live counts from the database. Payments, orders and commissions are not wired up yet, so those figures show as unavailable rather than estimates.
      </p>
    </div>
  );
}
