"use client";

// components/SavedSuppliersList.tsx —— 收藏夹列表（/account/saved）
//
// 为什么是客户端组件：收藏夹需要"点一下就移除"的交互，
// 用服务端渲染 + form action 会让整个页面刷新，体验割裂。
//
// 数据来源：/api/saved-suppliers（只返回 public 层字段 ——
// 收藏夹里不该出现付费内容，否则等于绕过了 UnlockGate）。
//
// 降级：数据库未配置时接口返回空数组，这里显示空态，不报错。

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { overallLevel, LEVEL_COLOR } from "@/lib/riskEngine";
import { localePath, type Locale } from "@/i18n/config";

export type SavedItem = {
  slug: string;
  legalName: string;
  country: string;
  city: string;
  riskScore: number | null;
  verificationStatus: string | null;
  savedAt: string;
};

type Labels = {
  empty: string;
  emptyCta: string;
  remove: string;
  error: string;
  loading: string;
  /** 风险等级文案字典（t.risk.ui.level），由页面传入，避免组件硬编码英文 */
  riskLevels: Record<string, string>;
  /** 无核验记录时的占位文案 */
  noCheckRecord: string;
};

type Props = {
  labels: Labels;
  /**
   * 界面语言，用于在组件内部拼站内链接。
   *
   * ⚠️ 这里曾经是 `profileHref: (slug: string) => string`（由页面传函数进来），
   * 结果是构建直接炸：`Functions cannot be passed directly to Client Components`。
   * —— 服务端组件不能把**函数**当 props 传给客户端组件，因为要跨 RSC 边界序列化，
   * 函数序列化不了（除非标 "use server"，但那是给 action 用的，不是给拼字符串用的）。
   *
   * 正解：传可序列化的 locale 字符串，链接在组件内部用 localePath 拼。
   * 附带好处是全站链接拼法统一走 localePath 这一个事实源。
   */
  locale: Locale;
};

export default function SavedSuppliersList({ labels, locale }: Props) {
  // 拼链放在组件内部：localePath 是纯函数，客户端可以安全调用
  const profileHref = (slug: string) => localePath(locale, `/suppliers/${slug}`);
  const directoryHref = localePath(locale, "/suppliers");
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-suppliers", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { items?: SavedItem[] };
      setItems(json.items ?? []);
      setErr(false);
    } catch {
      setErr(true);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(slug: string) {
    setBusy(slug);
    try {
      const res = await fetch(`/api/saved-suppliers?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // 本地移除，不重新拉全量列表（省一次往返，交互更跟手）
        setItems((prev) => (prev ?? []).filter((x) => x.slug !== slug));
      }
    } catch {
      // 失败保持原样：用户的收藏不会凭空消失，只是这次没删掉
    } finally {
      setBusy(null);
    }
  }

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
        <Link href={directoryHref} className="btn btn-primary mt-4 inline-block">
          {labels.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {items.map((x) => {
        const level =
          typeof x.riskScore === "number"
            ? labels.riskLevels[overallLevel(x.riskScore)]
            : null;
        return (
          <li key={x.slug} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={profileHref(x.slug)}
                className="font-semibold text-[#0f172a] hover:text-[#0f4c81]"
              >
                {x.legalName}
              </Link>
              {typeof x.riskScore === "number" && (
                <span
                  className="shrink-0 text-sm font-medium"
                  style={{ color: LEVEL_COLOR[overallLevel(x.riskScore)] }}
                >
                  {x.riskScore}/100{level ? ` · ${level}` : ""}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#64748b]">
              {x.city}, {x.country} · {x.verificationStatus ?? labels.noCheckRecord}
            </p>
            <button
              type="button"
              onClick={() => remove(x.slug)}
              disabled={busy === x.slug}
              className="mt-3 text-xs text-[#64748b] underline hover:text-[#b42318] disabled:opacity-50"
            >
              {busy === x.slug ? "…" : labels.remove}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
