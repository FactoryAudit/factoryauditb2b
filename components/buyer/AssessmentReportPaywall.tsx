import Link from "next/link";
import { ASSESSMENT_TYPE_LABELS, type AssessmentType } from "@/lib/assessmentShared";
import { PRICE_ANCHORS } from "@/lib/commercialConfig";
import { localePath, type Locale } from "@/i18n/config";

// 采购商侧「审核报告付费下载」占位（标签①②③）。
// 当前不接真实支付：展示已发布标签对应的报告与价格，锁定态 CTA 引导至联系/定制服务页。
// 真支付上线时，只需把 CTA 换成下单/解锁流程，本组件结构不变。
//
// 文案一律走字典：由服务端（供应商详情页）按 locale 预解析后经 dict 传入，
// 本组件内不再出现任何硬编码文案（项目铁律：永不硬编码文案，一律用 dict key）。

/** 本区块 7 条文案；由服务端从 dict.supplierProfile.assessmentReport* 取好后传入。 */
export type AssessmentReportPaywallDict = {
  title: string;
  lead: string;
  priceReady: string;
  notPublished: string;
  download: string;
  unavailable: string;
  note: string;
};

const ORDER: AssessmentType[] = ["self_assessment", "platform_assessment", "on_site_audit"];

const PRICE: Record<AssessmentType, string> = {
  self_assessment: PRICE_ANCHORS.verification,
  platform_assessment: PRICE_ANCHORS.inspection,
  on_site_audit: PRICE_ANCHORS.audit,
};

const TAG_COLOR: Record<AssessmentType, string> = {
  self_assessment: "border-[#171717] text-[#171717]",
  platform_assessment: "border-[#16a34a] text-[#16a34a]",
  on_site_audit: "border-[#b45309] text-[#b45309]",
};

/** 只替换 {price} 占位符；金额来自公开价单真源，不在文案里硬编码。 */
function fill(template: string, price: string): string {
  return template.replace(/\{price\}/g, price);
}

export default function AssessmentReportPaywall({
  supplierId,
  tags,
  locale,
  dict,
}: {
  supplierId: string;
  tags: AssessmentType[];
  locale: Locale;
  dict: AssessmentReportPaywallDict;
}) {
  const published = new Set(tags);
  const p = (href: string) => localePath(locale, href);
  const zhLike = locale === "zh" || locale === "zh-TW";

  return (
    <section className="mt-10 rounded-xl border border-[#ebe8e1] bg-white p-6">
      <h2 className="text-xl font-bold text-[#171717]">{dict.title}</h2>
      <p className="mt-1 text-sm text-[#6d6b66]">{dict.lead}</p>

      <div className="mt-4 grid grid-cols-1 gap-3">
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
                    {zhLike ? label.zh : label.en}
                  </span>
                  {zhLike && (
                    <span className="text-sm font-medium text-[#171717]">{label.en}</span>
                  )}
                </div>
                <div className="mt-1 text-xs text-[#6d6b66]">
                  {isPublished ? fill(dict.priceReady, PRICE[type]) : dict.notPublished}
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
                  {dict.download}
                </a>
              ) : (
                <span className="rounded-md bg-[#f5f3ee] px-3 py-1.5 text-xs text-[#8c8982]">
                  {dict.unavailable}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[#8c8982]">{fill(dict.note, PRICE_ANCHORS.verification)}</p>
    </section>
  );
}
