"use client";

import { useState } from "react";
import type { IndustrialCluster } from "@/lib/industrialClusters";

// Admin · 产业带（Industrial Cluster）管理
//
// 数据来源：public.industrial_clusters（migration 024）。
// 交互约定（与 RfqStatusSelect 一致）：写操作成功后 window.location.reload()，
// 不用乐观 UI —— 后台是协作真相，宁可等一次网络往返，也不给彼此错误信号。
//
// 文案：后台为单人 noindex 工具，按 admin/layout.tsx 既有约定使用双语常量，
//       不为内部字段标签补 9 语字典键。

export type ClusterDict = {
  title: string;
  lead: string;
  addNew: string;
  edit: string;
  cancel: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  publish: string;
  unpublish: string;
  delete: string;
  confirmDelete: string;
  published: string;
  draft: string;
  empty: string;
  fName: string;
  fSlug: string;
  fCountry: string;
  fCountryCode: string;
  fRegion: string;
  fCity: string;
  fProvince: string;
  fIndustry: string;
  fTags: string;
  fDesc: string;
  fSeoTitle: string;
  fSeoDesc: string;
  fSort: string;
  fPublished: string;
  fFeatured: string;
  slugHint: string;
  duplicateSlug: string;
};

type Draft = {
  id: string | null;
  name: string;
  slug: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  province: string;
  industry: string;
  industryTags: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: string;
  isPublished: boolean;
  featured: boolean;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  slug: "",
  country: "",
  countryCode: "",
  region: "",
  city: "",
  province: "",
  industry: "",
  industryTags: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
  sortOrder: "100",
  isPublished: false,
  featured: false,
};

function toDraft(c: IndustrialCluster): Draft {
  return {
    id: c.id,
    name: c.name ?? "",
    slug: c.slug ?? "",
    country: c.country ?? "",
    countryCode: c.country_code ?? "",
    region: c.region ?? "",
    city: c.city ?? "",
    province: c.province ?? "",
    industry: c.industry ?? "",
    industryTags: (c.industry_tags ?? []).join(", "),
    description: c.description ?? "",
    seoTitle: c.seo_title ?? "",
    seoDescription: c.seo_description ?? "",
    sortOrder: String(c.sort_order ?? 100),
    isPublished: Boolean(c.is_published),
    featured: Boolean(c.featured),
  };
}

export default function IndustrialClusterManager({
  rows,
  dict,
}: {
  rows: IndustrialCluster[];
  dict: ClusterDict;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/industrial-clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          slug: draft.slug,
          country: draft.country,
          countryCode: draft.countryCode,
          region: draft.region,
          city: draft.city,
          industry: draft.industry,
          industryTags: draft.industryTags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          description: draft.description,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
          isPublished: draft.isPublished,
          featured: draft.featured,
          province: draft.province,
          sortOrder: Number(draft.sortOrder) || 100,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({
          kind: "err",
          text: data.error === "duplicate_slug" ? dict.duplicateSlug : dict.error,
        });
        return;
      }
      setDraft(null);
      setMsg({ kind: "ok", text: dict.saved });
      window.location.reload();
    } catch {
      setMsg({ kind: "err", text: dict.error });
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(id: string, next: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/industrial-clusters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isPublished: next }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: dict.error });
        return;
      }
      window.location.reload();
    } catch {
      setMsg({ kind: "err", text: dict.error });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: IndustrialCluster) {
    if (!window.confirm(dict.confirmDelete)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/industrial-clusters?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) {
        setMsg({ kind: "err", text: dict.error });
        return;
      }
      window.location.reload();
    } catch {
      setMsg({ kind: "err", text: dict.error });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a]";

  return (
    <div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#0f172a]">{dict.title}</h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setDraft(draft ? null : { ...EMPTY })}
        >
          {draft ? dict.cancel : dict.addNew}
        </button>
      </div>
      <p className="mt-1 text-sm text-[#64748b]">{dict.lead}</p>

      {msg && (
        <p
          className={`mt-3 text-sm ${msg.kind === "ok" ? "text-[#14804a]" : "text-[#d4232a]"}`}
        >
          {msg.text}
        </p>
      )}

      {draft && (
        <div className="card mt-4 space-y-3 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fName} *</span>
              <input
                className={inputCls}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Foshan Furniture Cluster"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fSlug} *</span>
              <input
                className={inputCls}
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="foshan-furniture"
              />
              <span className="mt-1 block text-xs text-[#94a3b8]">{dict.slugHint}</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fCountry}</span>
              <input
                className={inputCls}
                value={draft.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="China"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fCountryCode}</span>
              <input
                className={inputCls}
                value={draft.countryCode}
                onChange={(e) => set("countryCode", e.target.value)}
                placeholder="china"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fRegion}</span>
              <input
                className={inputCls}
                value={draft.region}
                onChange={(e) => set("region", e.target.value)}
                placeholder="Guangdong"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fCity}</span>
              <input
                className={inputCls}
                value={draft.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Foshan"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fProvince}</span>
              <input
                className={inputCls}
                value={draft.province}
                onChange={(e) => set("province", e.target.value)}
                placeholder="Guangdong（中国省份；泰国/越南/印尼可留空）"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fIndustry}</span>
              <input
                className={inputCls}
                value={draft.industry}
                onChange={(e) => set("industry", e.target.value)}
                placeholder="Furniture"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fTags}</span>
              <input
                className={inputCls}
                value={draft.industryTags}
                onChange={(e) => set("industryTags", e.target.value)}
                placeholder="Home Furniture, Outdoor Furniture"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-[#475569]">{dict.fDesc}</span>
            <textarea
              className={inputCls}
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fSeoTitle}</span>
              <input
                className={inputCls}
                value={draft.seoTitle}
                onChange={(e) => set("seoTitle", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[#475569]">{dict.fSort}</span>
              <input
                className={inputCls}
                type="number"
                value={draft.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-[#475569]">{dict.fSeoDesc}</span>
            <textarea
              className={inputCls}
              rows={2}
              value={draft.seoDescription}
              onChange={(e) => set("seoDescription", e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-[#0f172a]">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(e) => set("isPublished", e.target.checked)}
            />
            {dict.fPublished}
          </label>

          <label className="flex items-center gap-2 text-sm text-[#0f172a]">
            <input
              type="checkbox"
              checked={draft.featured}
              onChange={(e) => set("featured", e.target.checked)}
            />
            {dict.fFeatured}
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={busy || !draft.name.trim()}
            >
              {busy ? dict.saving : dict.save}
            </button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>
              {dict.cancel}
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card mt-6 p-6">
          <p className="text-sm text-[#475569]">{dict.empty}</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[#e2e8f0] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] bg-[#f7f9fc] text-xs uppercase text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Name / Slug</th>
                <th className="px-4 py-3">Geo</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Sort</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-[#f7f9fc]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0f172a]">{r.name}</div>
                    <div className="font-mono text-xs text-[#64748b]">{r.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#475569]">
                    {[r.country, r.region, r.city].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#475569]">
                    {r.industry ?? "—"}
                    {r.industry_tags?.length ? (
                      <div className="mt-0.5 text-[#94a3b8]">{r.industry_tags.join(", ")}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8]">{r.sort_order}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.is_published
                          ? "bg-[#e6f4ec] text-[#14804a]"
                          : "bg-[#f1f5f9] text-[#64748b]"
                      }`}
                    >
                      {r.is_published ? dict.published : dict.draft}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-[#0f4c81] hover:underline"
                        onClick={() => setDraft(toDraft(r))}
                      >
                        {dict.edit}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[#0f4c81] hover:underline"
                        disabled={busy}
                        onClick={() => togglePublish(r.id, !r.is_published)}
                      >
                        {r.is_published ? dict.unpublish : dict.publish}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[#d4232a] hover:underline"
                        disabled={busy}
                        onClick={() => remove(r)}
                      >
                        {dict.delete}
                      </button>
                    </div>
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
