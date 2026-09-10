// components/CertificationList.tsx —— 公开侧「认证」区块（spec §5/§7/§18）
//
// 硬约束：
//   1. 只渲染调用方传入的已验证记录（queries 层已按 VERIFIED 过滤）。
//   2. 只展示元数据，**绝不提供原始文件下载**（spec §18：第三方报告默认不公开）。
//   3. 不做任何"证书真实性"的论断 —— 平台只说明"文件已审核"，
//      文案以 disclaimers 为准（spec §3：Certification ≠ Verification）。
//
// 服务端组件，无交互。

import { Badge, type BadgeVariant } from "@/components/Badge";
import { certificateExpiryState, daysUntilDate } from "@/lib/verification";
import type { PublicCertification } from "@/lib/queries";

export type CertificationListDict = {
  sectionCertifications: string;
  noneCertifications: string;
  issuer: string;
  certificateNo: string;
  validUntil: string;
  statusValid: string;
  statusExpiringSoon: string;
  statusExpired: string;
  statusPending: string;
  statusRejected: string;
  daysRemaining: string;
  expiredAgo: string;
  disclaimer: string;
};

function fmt(tpl: string, n: number): string {
  return tpl.replace("{n}", String(n));
}

function stateBadge(
  expiryDate: string | null,
  d: CertificationListDict
): { v: BadgeVariant; t: string } | null {
  const state = certificateExpiryState({
    verificationStatus: "VERIFIED",
    expiryDate,
  });
  switch (state) {
    case "VALID":
      return { v: "verified", t: d.statusValid };
    case "EXPIRING_SOON":
      return { v: "expiring", t: d.statusExpiringSoon };
    case "EXPIRED":
      return { v: "expired", t: d.statusExpired };
    case "REJECTED":
      return { v: "rejected", t: d.statusRejected };
    case "PENDING":
      return { v: "pending", t: d.statusPending };
    default:
      return null;
  }
}

export function CertificationList({
  items,
  dict: d,
}: {
  items: PublicCertification[];
  dict: CertificationListDict;
}) {
  return (
    <section className="mt-8 card p-6" id="certifications">
      <h2 className="text-xl font-bold text-[#0f172a]">{d.sectionCertifications}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[#475569]">{d.noneCertifications}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((c) => {
            const b = stateBadge(c.expiryDate, d);
            const dl = daysUntilDate(c.expiryDate);
            return (
              <li
                key={c.id}
                className="rounded-lg border border-[#e2e8f0] bg-[#f7f9fc] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f172a]">{c.programCode}</span>
                  {b ? <Badge variant={b.v}>{b.t}</Badge> : null}
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {c.issuingBody ? (
                    <div className="flex gap-2">
                      <dt className="text-[#64748b]">{d.issuer}</dt>
                      <dd className="text-[#0f172a]">{c.issuingBody}</dd>
                    </div>
                  ) : null}
                  {c.certificateNo ? (
                    <div className="flex gap-2">
                      <dt className="text-[#64748b]">{d.certificateNo}</dt>
                      <dd className="font-mono text-xs text-[#0f172a]">
                        {c.certificateNo}
                      </dd>
                    </div>
                  ) : null}
                  {c.expiryDate ? (
                    <div className="flex gap-2">
                      <dt className="text-[#64748b]">{d.validUntil}</dt>
                      <dd className="text-[#0f172a]">
                        {c.expiryDate}
                        {dl !== null ? (
                          <span className="ml-2 text-xs text-[#475569]">
                            {dl < 0 ? fmt(d.expiredAgo, -dl) : fmt(d.daysRemaining, dl)}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {c.scope ? (
                  <p className="mt-2 text-xs text-[#475569]">{c.scope}</p>
                ) : null}
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
