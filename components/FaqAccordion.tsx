"use client";

// components/FaqAccordion.tsx —— 可折叠 FAQ 手风琴
//
// 参照 Sedex 自评页的 FAQ 交互：默认全部折叠，点开单条展开，再点收起。
// 用原生 <details>/<summary> 实现（零 JS 依赖、SEO 可读、无障碍友好），
// 而不是手写 state —— 内容型 FAQ 不需要复杂交互，native 是最稳的。
//
// 内容来自 lib/assessmentFaq.ts（en/zh 手写，其余回退英文），不走 i18n 字典。

import type { AssessmentFaqContent } from "@/lib/assessmentFaq";

export default function FaqAccordion({ faq }: { faq: AssessmentFaqContent }) {
  if (!faq.groups.length) return null;

  return (
    <div className="max-w-3xl">
      {faq.lead ? (
        <p className="text-[#6d6b66] text-lg mb-8">{faq.lead}</p>
      ) : null}

      <div className="space-y-8">
        {faq.groups.map((g) => (
          <section key={g.group}>
            <h2 className="text-lg font-bold text-[#171717] border-b border-[#ebe8e1] pb-2 mb-4">
              {g.group}
            </h2>
            <div className="space-y-3">
              {g.items.map((item) => (
                <details
                  key={item.q}
                  className="group card overflow-hidden"
                  data-track="faq_item"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 select-none">
                    <span className="font-semibold text-[#171717]">
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[#6d6b66] transition-transform duration-200 group-open:rotate-45"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M8 3v10M3 8h10"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-5 pb-5 -mt-1">
                    <p className="text-sm leading-relaxed text-[#3f4650]">
                      {item.a}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
