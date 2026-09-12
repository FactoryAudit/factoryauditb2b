// components/SupplierRegistrationPanel.tsx —— CS-12 公开侧的「工商登记信息 + 工厂自述证书」
//
// 用户 2026-09-12 拍板的公开边界：「只放开工商登记级」。
// 本组件渲染的全部内容都属于该边界：企业自己申报、且能被公开工商/官网渠道核对的登记事实。
//
// 🔴 三条硬约束（改本文件前必读）：
//   1. **绝不渲染任何平台判断**。这里没有核验等级、没有风险结论、没有"已审核"字样。
//   2. **自述证书必须标注自述**。工厂在入驻表单里填的证书，平台一条都没核验过 ——
//      若不加标注，读者会把它当成平台核验结果，这是 P0 级误导（等同于伪造信任）。
//      视觉上也刻意与 CertificationList 的核验态区分：这里用中性灰色，不用平台蓝。
//   3. **空值不渲染空行**。字段缺失就整行不出现，绝不用 "—" / "N/A" 占位堆出一屏假信息
//      （那会让"没填"看起来像"没有"，两者语义不同）。
//
// 服务端组件，无交互。

import type { SupplierView, SelfReportedCertificate } from "@/lib/queries";

export type RegistrationPanelDict = {
  registrationTitle: string;
  registrationLead: string;
  regEnglishName: string;
  regCompanyType: string;
  regRegistrationNo: string;
  regWebsite: string;
  regAddress: string;
  selfCertTitle: string;
  selfCertLead: string;
  selfCertNone: string;
  selfCertName: string;
  selfCertNumber: string;
  selfCertIssued: string;
  selfCertExpires: string;
  selfCertDisclaimer: string;
};

/** 一行「标签 + 值」。值为空时返回 null（不渲染空行）。 */
function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-[#64748b]">{label}</dt>
      <dd className="text-sm font-medium text-[#0f172a] break-words">{value}</dd>
    </div>
  );
}

function certLine(c: SelfReportedCertificate): string {
  return [c.name, c.number, c.issued, c.expires].join("|");
}

export function SupplierRegistrationPanel({
  data,
  dict: d,
}: {
  data: Pick<
    SupplierView,
    "englishName" | "companyType" | "registrationNumber" | "website" | "address"
  >;
  dict: RegistrationPanelDict;
}) {
  const hasRegistration =
    Boolean(data.englishName) ||
    Boolean(data.companyType) ||
    Boolean(data.registrationNumber) ||
    Boolean(data.website) ||
    Boolean(data.address);

  // 全空时整块不渲染 —— 与其显示一个空壳区块，不如不占这份版面。
  if (!hasRegistration) return null;

  return (
    <section className="mt-8">
      <div className="card p-6" id="profile-registration">
        <h2 className="text-xl font-bold text-[#0f172a]">{d.registrationTitle}</h2>
        <p className="mt-1 text-sm text-[#64748b]">{d.registrationLead}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label={d.regEnglishName} value={data.englishName} />
          <Row label={d.regCompanyType} value={data.companyType} />
          <Row label={d.regRegistrationNo} value={data.registrationNumber} />
          <Row label={d.regAddress} value={data.address} />
          <Row label={d.regWebsite} value={data.website} />
        </dl>
      </div>
    </section>
  );
}

/**
 * 工厂**自述**证书（公开层）。
 *
 * 📌 位置刻意排在 CertificationList（平台已核验）与 AuditHistoryPanel 之后：
 *    版面上先呈现"平台核验过什么"，再呈现"工厂自己说了什么"，
 *    顺序本身就在传递可信度差异。
 */
export function SupplierSelfReportedCerts({
  data,
  dict: d,
}: {
  data: Pick<SupplierView, "selfReportedCertificates">;
  dict: RegistrationPanelDict;
}) {
  const certs = data.selfReportedCertificates ?? [];

  return (
    <section className="mt-8">
      <div className="card p-6" id="profile-self-certs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-[#0f172a]">{d.selfCertTitle}</h2>
          {/* 自述标记：中性灰色，绝不用平台蓝/绿色徽章 —— 颜色本身就是一种断言 */}
          <span className="rounded-full border border-[#cbd5e1] bg-[#f1f5f9] px-3 py-1 text-xs font-medium text-[#475569]">
            {d.selfCertLead}
          </span>
        </div>

        {certs.length === 0 ? (
          <p className="mt-3 text-sm text-[#475569]">{d.selfCertNone}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {certs.map((c) => (
              <li
                key={certLine(c)}
                className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#0f172a]">
                    {c.name || d.selfCertName}
                  </span>
                  {c.number ? (
                    <span className="font-mono text-xs text-[#475569]">
                      {d.selfCertNumber} {c.number}
                    </span>
                  ) : null}
                </div>

                {/* 颁发日 / 到期日 —— 用户明确要求工厂注册时必须填的两项 */}
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {c.issued ? (
                    <div className="flex gap-2">
                      <dt className="text-[#64748b]">{d.selfCertIssued}</dt>
                      <dd className="text-[#0f172a]">{c.issued}</dd>
                    </div>
                  ) : null}
                  {c.expires ? (
                    <div className="flex gap-2">
                      <dt className="text-[#64748b]">{d.selfCertExpires}</dt>
                      <dd className="text-[#0f172a]">{c.expires}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 border-t border-[#e2e8f0] pt-3 text-xs text-[#64748b]">
          {d.selfCertDisclaimer}
        </p>
      </div>
    </section>
  );
}
