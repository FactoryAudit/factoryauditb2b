import { ASSESSMENT_TYPE_LABELS, type AssessmentType } from "@/lib/assessmentShared";
import type { Locale } from "@/i18n/config";

const STYLE: Record<AssessmentType, string> = {
  self_assessment: "bg-[#171717] text-white",
  platform_assessment: "bg-[#16a34a] text-white",
  on_site_audit: "bg-[#b45309] text-white",
};

// 供应商详情页三标签徽章（仅渲染已发布 published 的标签）
// 标签名按 locale 选：中文/繁体用中文名，其余语种回退英文名（页面上不出现中文）。
export default function AssessmentTags({ tags, locale }: { tags: AssessmentType[]; locale: Locale }) {
  if (!tags || tags.length === 0) return null;
  const zhLike = locale === "zh" || locale === "zh-TW";
  return (
    <div className="flex flex-wrap gap-2" data-track="assessment_tags">
      {tags.map((t) => {
        const label = ASSESSMENT_TYPE_LABELS[t];
        return (
          <span
            key={t}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${STYLE[t]}`}
            title={label.en}
          >
            <span aria-hidden>●</span>
            {zhLike ? label.zh : label.en}
          </span>
        );
      })}
    </div>
  );
}
