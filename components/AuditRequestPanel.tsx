"use client";

import { useState } from "react";
import AuditScopeAdvisor, { type AppliedScope, type AuditScopeDict } from "./AuditScopeAdvisor";
import AuditRequestForm, { type AuditRequestFormDict } from "./AuditRequestForm";
import type { RiskLevel } from "@/lib/riskEngine";

export type DimensionOption = { key: string; label: string };

type Props = {
  auditScopeT: AuditScopeDict;
  formT: AuditRequestFormDict;
  locale: string;
  calculatorHref: string;
  levelLabels: Record<RiskLevel, string>;
  dimensionOptions: DimensionOption[];
  auditTypeLabels: string[];
};

/**
 * 审核申请页的客户端面板：把「范围推荐器」和「申请表」拼在一起。
 * preset 状态在客户端持有，用户点「应用到下方表单」后回填审核类型与需求说明，
 * 仍可手动修改。页面本身保持 Server Component（保留 generateMetadata / JsonLd）。
 */
export default function AuditRequestPanel({
  auditScopeT,
  formT,
  locale,
  calculatorHref,
  levelLabels,
  dimensionOptions,
  auditTypeLabels,
}: Props) {
  const [preset, setPreset] = useState<AppliedScope | null>(null);

  return (
    <>
      <AuditScopeAdvisor
        t={auditScopeT}
        locale={locale}
        calculatorHref={calculatorHref}
        levelLabels={levelLabels}
        dimensionOptions={dimensionOptions}
        auditTypeLabels={auditTypeLabels}
        onApply={setPreset}
      />
      <div className="mt-10">
        <AuditRequestForm t={formT} auditTypeLabels={auditTypeLabels} preset={preset} />
      </div>
    </>
  );
}
