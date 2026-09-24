import Link from "next/link";
import { ASSESSMENT_TYPE_LABELS, type AssessmentType } from "@/lib/assessmentShared";
import { PRICE_ANCHORS } from "@/lib/commercialConfig";
import { localePath, type Locale } from "@/i18n/config";

// 采购商侧「审核报告付费下载」占位（标签①②③）。
// 当前不接真实支付：展示已发布标签对应的报告与价格，锁定态 CTA 引导至联系/定制服务页。
// 真支付上线时，只需把 CTA 换成下单/解锁流程，本组件结构不变。

const ORDER: AssessmentType[] = ["self_assessment", "platform_assessment", "on_site_audit"];

const PRICE: Record<AssessmentType, string> = {
  self_assessment: PRICE_ANCHORS.verification,
  platform_assessment: PRICE_ANCHORS.inspection,
  on_site_audit: PRICE_ANCHORS.audit,
};

const TAG_COLOR: Record<AssessmentType, string> = {
  self_assessment: "border-[#0f4c81] text-[#0f4c81]",
  platform_assessment: "border-[#16a34a] text-[#16a34a]",
  on_site_audit: "border-[#b45309] text-[#b45309]",
};

export default function AssessmentReportPaywall({
  supplierId,
  tags,
  locale,
}: {
  supplierId: string;
  tags: AssessmentType[];
  locale: Locale;
}) {
  const published = new Set(tags);
  const p = (href: string) => localePath(locale, href);

  return (
    <section className="mt-10 rounded-xl border border-[#e2e8f0] bg-white p-6">
      <h2 className="text-xl font-bold text-[#0f172a]">审核报告下载 · Assessment Reports</h2>
      <p className="mt-1 text-sm text-[#64748b]">
        采购商可付费下载以下已发布的审核报告（单份报告，PDF / 自包含 HTML）。
      </p>

      <div className="mt-4 grid gap-3">
        {ORDER.map((type) => {
          const label = ASSESSMENT_TYPE_LABELS[type];
          const isPublished = published.has(type);
          return (
            <div
              key={type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#eef2f7] p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TAG_COLOR[type]}`}>
                    {label.zh}
                  </span>
                  <span className="text-sm font-medium text-[#0f172a]">{label.en}</span>
                </div>
                <div className="mt-1 text-xs text-[#64748b]">
                  {isPublished ? `价格 ${PRICE[type]} · 报告已生成` : "该标签尚未发布，暂无可下载报告"}
                </div>
              </div>

              {isPublished ? (
                <a
                  href={`/api/assessment-report/${supplierId}/${type}`}
                  className="btn btn-primary btn-sm"
                  data-track="assessment_report_paywall_cta"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  下载报告 / Download
                </a>
              ) : (
                <span className="rounded-md bg-[#f1f5f9] px-3 py-1.5 text-xs text-[#94a3b8]">
                  未发布 / Unavailable
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[#94a3b8]">
        付费下载功能即将上线；当前点击「付费下载」将转至定制服务咨询。价格以 {PRICE_ANCHORS.verification} 等公开价单为准。
      </p>
    </section>
  );
}
