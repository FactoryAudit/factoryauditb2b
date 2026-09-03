"use client";

// components/MyRfqList.tsx —— 我的询价单列表（/account/rfqs）
//
// 为什么现在才建：运营侧（/admin/rfqs）早就能看到全量询价，
// 买家自己却看不到状态和匹配结果 —— 信息不对称到这个程度是在丢单。
// 询价是这个站最核心的买家动作，提交完石沉大海会直接劝退。
//
// 顺带说明：lib/membership.ts 里曾有个 listMyRfqs()，注释写着"给 /account/rfqs 用"
// 但从未被调用（死代码），且它不返回 rfq_matches，比下面的接口少一层数据。
// 已删除 —— 页面统一走 /api/rfq，同一个查询不维护两份。
//
// 数据源：GET /api/rfq（服务端按 session 过滤，只返回自己的）。
// 不新增接口 —— 那个 GET 本来就返回完整的 rfq_matches + suppliers 关联。
//
// 降级：数据库未配置时接口返回 { items: [] }，这里显示空态，不报错。

import { useEffect, useState } from "react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";

type EmbeddedSupplier =
  | { slug?: string; legal_name?: string; city?: string }
  | Array<{ slug?: string; legal_name?: string; city?: string }>
  | null
  | undefined;

type RfqMatch = {
  status?: string | null;
  suppliers?: EmbeddedSupplier;
};

export type MyRfq = {
  reference_id: string;
  product: string;
  quantity: string | null;
  country: string | null;
  status: string;
  created_at: string;
  rfq_matches?: RfqMatch[] | null;
};

type Labels = {
  loading: string;
  error: string;
  empty: string;
  emptyCta: string;
  /** RFQ 状态文案（复用 admin.status：new / reviewing / matched / closed） */
  statusLabels: Record<string, string>;
  /** 表单里的字段名，复用 rfq.form.labels */
  productLabel: string;
  quantityLabel: string;
  countryLabel: string;
  submittedLabel: string;
  matchesLabel: string;
  noMatches: string;
};

// 状态色：与后台列表保持一致，让买家和运营看到的语义是同一套
const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  new: { bg: "#e6eef6", fg: "#0f4c81" },
  reviewing: { bg: "#fef3c7", fg: "#92400e" },
  matched: { bg: "#dcfce7", fg: "#166534" },
  closed: { bg: "#f1f5f9", fg: "#475569" },
};

function statusStyle(status: string) {
  return STATUS_STYLE[status] ?? STATUS_STYLE.new;
}

/**
 * Supabase 的嵌入式关联在"多对一"时返回对象、"一对多"时返回数组，
 * 且空关联会返回 null。这里统一归一化，避免渲染时类型炸裂。
 */
function supplierOf(m: RfqMatch): { slug: string; name: string } | null {
  const raw = m.suppliers;
  // 多对一返回对象、一对多返回数组、无关联返回 null —— 三种都要接住
  const one = Array.isArray(raw) ? raw[0] : raw;
  if (!one || !one.slug) return null;
  return { slug: one.slug, name: one.legal_name ?? one.slug };
}

export default function MyRfqList({
  labels,
  locale,
}: {
  labels: Labels;
  /**
   * 界面语言。
   *
   * ⚠️ 不能由页面传 profileHref 函数进来 —— 服务端组件向客户端组件传函数
   * 会在构建期直接报错（`Functions cannot be passed directly to Client Components`）。
   * 传可序列化的 locale，链接一律在组件内部用 localePath 拼。
   */
  locale: Locale;
}) {
  // 拼链放内部，与全站共用 localePath 这一个事实源
  const profileHref = (slug: string) => localePath(locale, `/suppliers/${slug}`);
  const rfqHref = localePath(locale, "/rfq");
  const [items, setItems] = useState<MyRfq[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/rfq", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { items?: MyRfq[] };
        if (!alive) return;
        setItems(json.items ?? []);
        setErr(false);
      } catch {
        if (!alive) return;
        setErr(true);
        setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (items === null) {
    return <p className="mt-6 text-sm text-[#64748b]">{labels.loading}</p>;
  }

  if (err) {
    return <p className="mt-6 text-sm text-[#b42318]">{labels.error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card mt-6 p-8">
        <p className="text-sm text-[#475569]">{labels.empty}</p>
        <Link href={rfqHref} className="btn btn-primary mt-4 inline-block">
          {labels.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-4">
      {items.map((r) => {
        const st = statusStyle(r.status);
        const matches = (r.rfq_matches ?? [])
          .map(supplierOf)
          .filter((x): x is { slug: string; name: string } => x !== null);

        return (
          <li key={r.reference_id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 参考号用等宽字体：用户要拿它来跟我们沟通，必须好读好抄 */}
              <span className="font-mono text-sm font-semibold text-[#0f172a]">
                {r.reference_id}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: st.bg, color: st.fg }}
              >
                {labels.statusLabels[r.status] ?? r.status}
              </span>
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[#64748b]">{labels.productLabel}</dt>
                <dd className="font-medium text-[#0f172a]">{r.product}</dd>
              </div>
              {r.quantity && (
                <div>
                  <dt className="text-xs text-[#64748b]">{labels.quantityLabel}</dt>
                  <dd className="font-medium text-[#0f172a]">{r.quantity}</dd>
                </div>
              )}
              {r.country && (
                <div>
                  <dt className="text-xs text-[#64748b]">{labels.countryLabel}</dt>
                  <dd className="font-medium text-[#0f172a]">{r.country}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-[#64748b]">{labels.submittedLabel}</dt>
                <dd className="font-medium text-[#0f172a]">
                  {new Date(r.created_at).toLocaleDateString(locale)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-[#e2e8f0] pt-3">
              <div className="text-xs text-[#64748b]">{labels.matchesLabel}</div>
              {matches.length === 0 ? (
                <p className="mt-1 text-sm text-[#475569]">{labels.noMatches}</p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {matches.map((m) => (
                    <li key={m.slug}>
                      <Link
                        href={profileHref(m.slug)}
                        className="text-sm text-[#0f4c81] hover:underline"
                      >
                        {m.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
