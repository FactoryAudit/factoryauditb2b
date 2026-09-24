import { ASSESSMENT_TYPE_LABELS, type AssessmentType } from "@/lib/assessmentShared";

const STYLE: Record<AssessmentType, string> = {
  self_assessment: "bg-[#0f4c81] text-white",
  platform_assessment: "bg-[#16a34a] text-white",
  on_site_audit: "bg-[#b45309] text-white",
};

// 供应商详情页三标签徽章（仅渲染已发布 published 的标签）
export default function AssessmentTags({ tags }: { tags: AssessmentType[] }) {
  if (!tags || tags.length === 0) return null;
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
            {label.zh}
          </span>
        );
      })}
    </div>
  );
}
