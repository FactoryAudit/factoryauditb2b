import type { ToolFaqContent } from "@/lib/toolFaqs";

/**
 * 薄工具页的「答案前置 + FAQ」段落（服务端渲染，纯展示）。
 * 内容来自 lib/toolFaqs.ts（en/zh 手写、其余回退英文），不走 i18n 字典。
 * 查不到内容时返回 null，页面不报错。
 */
export default function ToolFaqSection({
  faq,
  faqTitle,
}: {
  faq: ToolFaqContent;
  faqTitle: string;
}) {
  const hasContent = Boolean(faq.quickAnswer) || faq.faqs.length > 0;
  if (!hasContent) return null;

  return (
    <section className="mt-14 max-w-3xl">
      {faq.quickAnswer ? (
        <div className="mb-8 rounded-xl border border-[#e5e2dc] bg-[#f5f3ee] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6d6b66] mb-2">
            {faq.quickAnswerTitle}
          </h2>
          <p className="text-[#171717]">{faq.quickAnswer}</p>
        </div>
      ) : null}

      <h2 className="text-2xl font-bold text-[#171717] mb-4">{faqTitle}</h2>
      <div className="space-y-4">
        {faq.faqs.map((f) => (
          <div key={f.q} className="card p-5">
            <div className="font-semibold text-[#171717]">{f.q}</div>
            <p className="text-sm text-[#3f4650] mt-1">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
