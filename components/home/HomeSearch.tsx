"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 首页 Hero 的 4 标签搜索框。
 *
 * 文案全部来自 **已存在且已翻译 9 语** 的 `common.heroSearch`（21 键），零新增字典键。
 * 行为刻意与设计稿一致：**切标签只换占位符，不改查询语义**；提交只带 `q`
 * （`/suppliers` 客户端过滤真正读取的参数）。标签值作为 `type` 一并带上，便于将来扩展，
 * 但当前 `/suppliers` 不消费它 —— 不假装它有作用。
 */
export type HomeSearchDict = {
  tabSupplier: string;
  tabProduct: string;
  tabAudit: string;
  tabInspector: string;
  placeholderSupplier: string;
  placeholderProduct: string;
  placeholderAudit: string;
  placeholderInspector: string;
  search: string;
  combinedHint: string;
};

const TABS = ["tabSupplier", "tabProduct", "tabAudit", "tabInspector"] as const;
type TabKey = (typeof TABS)[number];

const PLACEHOLDER: Record<TabKey, keyof HomeSearchDict> = {
  tabSupplier: "placeholderSupplier",
  tabProduct: "placeholderProduct",
  tabAudit: "placeholderAudit",
  tabInspector: "placeholderInspector",
};

export default function HomeSearch({ t }: { t: HomeSearchDict }) {
  const [tab, setTab] = useState<TabKey>("tabSupplier");
  const [q, setQ] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/suppliers?q=${encodeURIComponent(term)}` : "/suppliers");
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="mt-7 rounded-[13px] border border-[#d8d3c9] bg-white/80 p-2 shadow-[0_14px_38px_rgba(50,45,38,.06)]"
    >
      <div className="flex flex-wrap gap-1.5 px-0.5 pb-2 pt-0.5" role="tablist">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-[7px] px-3 py-2 text-xs font-bold transition ${
              tab === k ? "bg-[#171717] text-white" : "text-[#817d74] hover:text-[#171717]"
            }`}
          >
            {t[k]}
          </button>
        ))}
      </div>

      <input type="hidden" name="type" value={tab.replace("tab", "").toLowerCase()} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 items-center gap-2.5 rounded-[9px] border border-[#ebe8e1] bg-white px-3.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="flex-none text-[#858077]"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16L21 21" strokeLinecap="round" />
          </svg>
          <input
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t[PLACEHOLDER[tab]]}
            autoComplete="off"
            aria-label={t[PLACEHOLDER[tab]]}
            className="h-12 w-full border-0 bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#9b978f]"
          />
        </div>
        <button
          type="submit"
          className="h-12 min-w-[105px] rounded-[9px] bg-[#e07a49] px-4 font-bold text-white transition hover:bg-[#c96235]"
        >
          {t.search}
        </button>
      </div>

      <p className="px-1.5 pt-2 text-[11.5px] text-[#888279]">{t.combinedHint}</p>
    </form>
  );
}
