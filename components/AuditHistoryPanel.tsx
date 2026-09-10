// components/AuditHistoryPanel.tsx —— 公开侧「审核记录」区块（spec §12/§18）
//
// 硬约束：
//   1. 只渲染已验证（VERIFIED）的审核记录，由 queries 层过滤。
//   2. 只展示元数据：类型 / 标准 / 日期 / 审核方 / 结果 / 不符合项数量。
//      **不提供原始报告文件**（spec §18：审核报告默认不公开）。
//   3. 审核结果只陈述事实，不做"供应商可靠"之类推断。
//
// 服务端组件，无交互。

import { Badge, type BadgeVariant } from "@/components/Badge";
import type { PublicAudit } from "@/lib/queries";

export type AuditHistoryPanelDict = {
  sectionAudits: string;
  noneAudits: string;
  auditDate: string;
  auditBy: string;
  auditResult: string;
  resultPass: string;
  resultPassWithFindings: string;
  resultFail: string;
  resultPending: string;
  levelSelf: string;
  levelPlatform: string;
  levelOnsite: string;
  levelThirdParty: string;
  disclaimer: string;
};

/** 审核类型 → 展示名（与录入端的 5 级核验体系共用文案） */
function auditTypeLabel(t: string, d: AuditHistoryPanelDict): string {
  switch (t) {
    case "self_assessment":
      return d.levelSelf;
    case "platform_assessment":
      return d.levelPlatform;
    case "on_site_audit":
      return d.levelOnsite;
    case "third_party_audit":
      return d.levelThirdParty;
    default:
      return t;
  }
}

function resultOf(
  r: string | null,
  d: AuditHistoryPanelDict
): { v: BadgeVariant; t: string } | null {
  switch (r) {
    case "pass":
      return { v: "verified", t: d.resultPass };
    case "pass_with_findings":
      return { v: "expiring", t: d.resultPassWithFindings };
    case "fail":
      return { v: "rejected", t: d.resultFail };
    case "pending":
      return { v: "pending", t: d.resultPending };
    default:
      return null;
  }
}

export function AuditHistoryPanel({
  items,
  dict: d,
}: {
  items: PublicAudit[];
  dict: AuditHistoryPanelDict;
}) {
  return (
    <section className="mt-8 card p-6" id="audit-history">
      <h2 className="text-xl font-bold text-[#0f172a]">{d.sectionAudits}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[#475569]">{d.noneAudits}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((a) => {
            const b = resultOf(a.result, d);
            const by = [a.auditorName, a.auditorOrg].filter(Boolean).join(", ");
            return (
              <li
                key={a.id}
                className="rounded-lg border border-[#e2e8f0] bg-[#f7f9fc] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f172a]">
                    {auditTypeLabel(a.auditType, d)}
                    {a.standardCode ? (
                      <span className="ml-2 font-mono text-xs text-[#475569]">
                        {a.standardCode}
                      </span>
                    ) : null}
                  </span>
                  {b ? <Badge variant={b.v}>{b.t}</Badge> : null}
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-[#64748b]">{d.auditDate}</dt>
                    <dd className="text-[#0f172a]">{a.auditDate}</dd>
                  </div>
                  {by ? (
                    <div className="flex gap-2">
                      <dt className="text-[#64748b]">{d.auditBy}</dt>
                      <dd className="text-[#0f172a]">{by}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 border-t border-[#e2e8f0] pt-3 text-xs text-[#64748b]">
        {d.disclaimer}
      </p>
    </section>
  );
}
