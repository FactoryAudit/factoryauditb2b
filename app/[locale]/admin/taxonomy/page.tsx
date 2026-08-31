import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTaxonomyTree, listAuditTypes, listStandards, getRiskModel } from "@/lib/taxonomy";
import { TAXONOMY_CATEGORIES } from "@/lib/types";
import TaxonomyManager from "@/components/TaxonomyManager";

export const dynamic = "force-dynamic";

// 后台不索引
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminTaxonomyPage() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/login?error=admin_only");
  }

  const [tree, auditTypes, standards, riskModel] = await Promise.all([
    getTaxonomyTree(),
    listAuditTypes(),
    listStandards(),
    getRiskModel(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Taxonomy 中央分类引擎管理</h1>
        <p className="mt-1 text-sm text-gray-600">
          所有业务模块（SEO / 供应商 / RFQ / 验厂 / 审核员 / AI 风险）均从此处消费分类数据（§91 Single Source of Truth）。
        </p>
      </div>

      <TaxonomyManager
        tree={tree}
        categories={TAXONOMY_CATEGORIES}
        riskModel={riskModel}
      />

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">审核/验厂类型（audit_types）</h2>
          <ul className="max-h-72 overflow-auto text-sm">
            {auditTypes.map((a) => (
              <li key={a.code} className="flex justify-between border-b py-1">
                <span>{a.nameZh || a.nameEn}</span>
                <span className="text-gray-500">{a.serviceType}{a.isCertification ? " · 认证" : ""}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">标准（standards）</h2>
          <ul className="max-h-72 overflow-auto text-sm">
            {standards.map((s) => (
              <li key={s.code} className="flex justify-between border-b py-1">
                <span>{s.nameZh || s.nameEn}</span>
                <span className="text-gray-500">{s.owner || ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
