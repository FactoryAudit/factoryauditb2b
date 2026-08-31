"use client";

import { useState } from "react";
import type { TaxonomyTreeNode } from "@/lib/taxonomy";

type Category = { code: string; labelEn: string; labelZh: string };
type RiskRule = { dimension: string; weight: number; enabled: boolean; description: string | null };

export default function TaxonomyManager({
  tree,
  categories,
  riskModel,
}: {
  tree: TaxonomyTreeNode[];
  categories: Category[];
  riskModel: RiskRule[];
}) {
  const [form, setForm] = useState({
    code: "",
    parentCode: "",
    category: categories[0]?.code ?? "",
    labelEn: "",
    labelZh: "",
    isLeaf: true,
  });
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submitNode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node: {
            code: form.code.trim(),
            parentCode: form.parentCode || null,
            category: form.category,
            labelEn: form.labelEn.trim(),
            labelZh: form.labelZh.trim() || null,
            isLeaf: form.isLeaf,
          },
        }),
      });
      const data = await res.json();
      setMsg(res.ok ? `已保存节点 ${form.code}` : `失败: ${data.error}`);
      if (res.ok) {
        setForm({ ...form, code: "", labelEn: "", labelZh: "" });
        setTimeout(() => location.reload(), 600);
      }
    } catch (e) {
      setMsg("网络错误 " + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function del(code: string) {
    if (!confirm(`确认删除节点 ${code} 及其子节点？`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/taxonomy?code=${encodeURIComponent(code)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) location.reload();
    else setMsg("删除失败");
  }

  async function saveWeight(dimension: string, weight: number) {
    setBusy(true);
    await fetch("/api/admin/taxonomy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ risk: { dimension, weight } }),
    });
    setBusy(false);
    setMsg(`已更新权重 ${dimension} = ${weight}`);
  }

  function renderTree(nodes: TaxonomyTreeNode[], depth = 0) {
    return (
      <ul className={depth === 0 ? "space-y-1" : "ml-4 space-y-1 border-l pl-2"}>
        {nodes.map((n) => (
          <li key={n.code}>
            <div className="flex items-center gap-2 py-0.5 text-sm">
              <span className="font-mono text-xs text-gray-400">{n.code}</span>
              <span>{n.labelZh || n.labelEn}</span>
              <span className="text-xs text-gray-400">{n.category}</span>
              <button
                className="text-xs text-red-600 hover:underline disabled:opacity-40"
                disabled={busy}
                onClick={() => del(n.code)}
              >
                删除
              </button>
            </div>
            {n.children?.length ? renderTree(n.children, depth + 1) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">分类树（taxonomy_nodes）</h2>
        <div className="max-h-[28rem] overflow-auto">{renderTree(tree)}</div>
      </section>

      <section className="space-y-6">
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">新增 / 编辑节点</h2>
          <form onSubmit={submitNode} className="space-y-2 text-sm">
            <input required placeholder="code（唯一，如 NODE_XXX）" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full rounded border px-2 py-1" />
            <div className="flex gap-2">
              <select value={form.parentCode} onChange={(e) => setForm({ ...form, parentCode: e.target.value })}
                className="flex-1 rounded border px-2 py-1">
                <option value="">（一级类目，无父节点）</option>
                {tree.map((t) => (
                  <option key={t.code} value={t.code}>{t.labelZh || t.labelEn}</option>
                ))}
              </select>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="flex-1 rounded border px-2 py-1">
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>{c.labelZh}</option>
                ))}
              </select>
            </div>
            <input required placeholder="英文标签" value={form.labelEn}
              onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
              className="w-full rounded border px-2 py-1" />
            <input placeholder="中文标签" value={form.labelZh}
              onChange={(e) => setForm({ ...form, labelZh: e.target.value })}
              className="w-full rounded border px-2 py-1" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isLeaf}
                onChange={(e) => setForm({ ...form, isLeaf: e.target.checked })} />
              叶子节点（不可再展开）
            </label>
            <button disabled={busy}
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50">
              {busy ? "保存中…" : "保存节点"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">风险权重模型（可配置）</h2>
          <table className="w-full text-sm">
            <tbody>
              {riskModel.map((r) => (
                <tr key={r.dimension} className="border-b">
                  <td className="py-1">{r.dimension}</td>
                  <td className="py-1">
                    <input type="number" step="0.1" defaultValue={r.weight}
                      onBlur={(e) => saveWeight(r.dimension, parseFloat(e.target.value) || 1)}
                      className="w-20 rounded border px-2 py-0.5" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {msg && <p className="col-span-2 text-sm text-green-700">{msg}</p>}
    </div>
  );
}
