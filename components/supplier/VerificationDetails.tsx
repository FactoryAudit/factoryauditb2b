import type { VerificationRecord, VerificationType } from "@/lib/trustProfile";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * CS-A #8 / #9：验证详情 + 验证历史。
 *
 * 用原生 <details> 而不是客户端弹窗：
 *   档案页是预渲染的静态产物，任何 onClick 都会把它拖回客户端渲染。
 *   <details> 零 JS 即可展开，且展开内容仍在 HTML 里 —— 对 SEO 与无障碍都更好。
 *
 * 数据纪律：
 *   · 只渲染**真实存在**的字段：没有 expires_at 就不显示"有效期至"，绝不填占位日期；
 *   · 过期/撤销的记录照样出现在历史里（历史不可删），但不会进入生效徽章。
 */

export type VerificationDetailsDict = {
  detailsTitle: string;
  labelId: string;
  labelMethod: string;
  labelScope: string;
  labelVerifiedAt: string;
  labelExpiresAt: string;
  labelStatus: string;
  methodOnline: string;
  methodOnSite: string;
  stateActive: string;
  stateExpired: string;
  stateRevoked: string;
  statusExpired: string;
  disclaimer: string;
  historyTitle: string;
  historyEmpty: string;
};

/** ISO → YYYY-MM-DD。不是日期就返回 null（绝不用"今天"顶替） */
function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return null;
  return t.toISOString().slice(0, 10);
}

function methodText(type: VerificationType, d: VerificationDetailsDict): string {
  return type === "ON_SITE" ? d.methodOnSite : d.methodOnline;
}

function stateText(status: string, d: VerificationDetailsDict): string {
  if (status === "EXPIRED") return d.stateExpired;
  if (status === "REVOKED") return d.stateRevoked;
  if (status === "ACTIVE") return d.stateActive;
  return status;
}

function scopeList(scope: unknown): string[] {
  if (Array.isArray(scope)) {
    return scope.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  return [];
}

export default function VerificationDetails({
  active,
  history,
  dict,
  badgeState,
}: {
  active: VerificationRecord | null;
  history: VerificationRecord[];
  dict: VerificationDetailsDict;
  badgeState: string;
}) {
  const expired = badgeState === "EXPIRED";
  const scope = active ? scopeList(active.scope) : [];

  return (
    <section className="mt-8 card p-6" id="verification-details" data-verification-panel={badgeState}>
      <h2 className="text-xl font-bold text-[#171717]">{dict.detailsTitle}</h2>

      {!active ? (
        <p className="mt-3 text-sm text-[#6d6b66]">
          {history.length === 0 ? dict.historyEmpty : dict.statusExpired}
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#6d6b66]">{dict.labelId}</dt>
            <dd className="font-mono font-medium text-[#171717]">
              {active.verification_id}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#6d6b66]">{dict.labelMethod}</dt>
            <dd className="text-right font-medium text-[#171717]">
              {methodText(active.verification_type, dict)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#6d6b66]">{dict.labelVerifiedAt}</dt>
            <dd className="font-medium text-[#171717]">
              {dateOnly(active.verified_at) ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#6d6b66]">{dict.labelExpiresAt}</dt>
            <dd className={`font-medium ${expired ? "text-[#b45309]" : "text-[#171717]"}`}>
              {dateOnly(active.expires_at) ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-[#eef2f7] py-1.5">
            <dt className="text-[#6d6b66]">{dict.labelStatus}</dt>
            <dd className="font-medium text-[#171717]">
              {expired ? dict.stateExpired : stateText(active.status, dict)}
            </dd>
          </div>
          {scope.length > 0 && (
            <div className="sm:col-span-2 py-1.5">
              <dt className="text-[#6d6b66] mb-1">{dict.labelScope}</dt>
              <dd>
                <ul className="flex flex-wrap gap-2">
                  {scope.map((s) => (
                    <li
                      key={s}
                      className="rounded-full border border-[#ddd9d0] px-2.5 py-0.5 text-xs text-[#3f4650]"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* 免责声明：与徽章必须同时出现 —— 核验范围没写清楚就是误导 */}
      <p className="mt-4 text-xs leading-relaxed text-[#8a5410] bg-[#fff4e0] rounded-md px-3 py-2">
        {dict.disclaimer}
      </p>

      {/* 验证历史：过期/撤销的记录保留在这里，不因失效而被抹掉 */}
      <details className="mt-4 group">
        <summary
          className="cursor-pointer select-none text-sm font-semibold text-[#171717] hover:underline"
          data-track={ANALYTICS_EVENTS.verificationDetailsView}
        >
          {dict.historyTitle}
          {history.length > 0 ? ` (${history.length})` : ""}
        </summary>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-[#8c8982]">{dict.historyEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eef2f7] pb-2"
              >
                <span className="font-mono text-[#171717]">{r.verification_id}</span>
                <span className="text-[#3f4650]">{methodText(r.verification_type, dict)}</span>
                <span className="text-[#6d6b66]">
                  {dateOnly(r.verified_at) ?? "—"} → {dateOnly(r.expires_at) ?? "—"}
                </span>
                <span
                  className={
                    r.status === "ACTIVE" ? "text-[#15803d]" : "text-[#8c8982]"
                  }
                >
                  {stateText(r.status, dict)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
