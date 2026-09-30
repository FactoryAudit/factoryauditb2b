"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * 行业枢纽页的「行业详情预览」区（版式 = 用户定稿 preview (2).html 的 section#detail
 * 里的 .detailWrap = .tabs + .detail）。
 *
 * 设计稿用内联 JS 点击标签切换右侧深色卡；本站改为客户端组件持有选中态，
 * 全部文案/链接由服务端**预先解析成字符串**后传入 —— 组件本身不读字典、不查数据，
 * 因此可安全预渲染，也不存在把会员内容塞进 RSC payload 的问题（这里全是公开数据）。
 *
 * 数据全部真实，零编造：
 *   · 行业名/编号 ← lib/taxonomy.ts listIndustries()
 *   · 关联审核项  ← lib/taxonomy.ts getSeoMatrix() 的真实 auditTypes（按行业子主题的
 *                   programCodes 把相关项顶到前面，与 /industry/[slug] 页同一套排序规则）
 *   · 行业指南    ← lib/industryContent.ts topicsForIndustry()（只有已配置内容的行业才有）
 *   · 标题/说明/按钮 ← 9 语字典既有键，零新增、不动 en 叶子数闸门
 *
 * 🔴 与设计稿的差异：设计稿每张卡的「典型产品 / 核验重点」是它对 8 个行业的样板填充，
 *    本站 13 个行业里只有 food-beverage / chemicals 配了真实子主题。按 §44 质量门
 *    「没有就整块不渲染，绝不套模板话术」，第二列仅在确有其内容时出现。
 */

export type PreviewIndustry = {
  code: string;
  no: string;
  name: string;
  href: string;
  /** 深色卡正文（真实键 industryPage.whyLead） */
  intro: string;
  /** 紧凑标签行（真实审核项名，取同一列表的前几项 —— 设计稿也是「标签 + 列表」同源） */
  chips: string[];
  /** 第二列标题（industryPage.relatedAudit）；为空串则该列不渲染 */
  auditHeading: string;
  auditNames: string[];
  /** 第三列标题（industryPage.topicsTitle 已代入行业名）；为空则该列不渲染 */
  topicsHeading: string | null;
  topicTitles: string[];
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaGhostLabel: string;
  ctaGhostHref: string;
};

type Props = {
  /** 深色卡左上角的 kicker 前缀（industryPage.breadcrumb） */
  kickerLabel: string;
  items: PreviewIndustry[];
};

export default function IndustryPreview({ kickerLabel, items }: Props) {
  const [activeCode, setActiveCode] = useState(items[0]?.code ?? "");
  const active = items.find((x) => x.code === activeCode) ?? items[0];
  if (!active) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[.8fr_1.2fr]">
      {/* .tabs —— 13 个真实行业。窄屏两列，避免 13 条竖排把深色卡顶到屏外。 */}
      <div role="tablist" aria-label={kickerLabel} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {items.map((x) => {
          const on = x.code === activeCode;
          return (
            <button
              key={x.code}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="industry-preview-panel"
              onClick={() => setActiveCode(x.code)}
              className={`flex min-w-0 items-center justify-between gap-3 rounded-[12px] border px-[16px] py-[15px] text-left text-[14px] font-bold transition ${
                on
                  ? "border-[#e07a49] bg-white text-[#171717] shadow-[0_8px_24px_rgba(0,0,0,.04)]"
                  : "border-[#ddd9d0] bg-white text-[#55524d] hover:border-[#c9c3b8]"
              }`}
            >
              <span className="min-w-0 break-words">{x.name}</span>
              <span aria-hidden="true" className="flex-none text-[12px] font-extrabold tracking-[.1em] text-[#e07a49]">
                {x.no}
              </span>
            </button>
          );
        })}
      </div>

      {/* .detail —— 深色卡。justify-between 是设计稿自带的高度分配机制：
          内容少时余量自然落到「标题组」与「操作区」之间，读作构图留白。 */}
      <article
        id="industry-preview-panel"
        role="tabpanel"
        className="flex min-h-[530px] flex-col justify-between rounded-[18px] bg-[#1d1d1b] p-[26px] text-white lg:p-[36px]"
      >
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#ffb29b]">
            {kickerLabel} {active.no}
          </span>
          <h3 className="my-3 text-[28px] font-extrabold leading-[1.08] tracking-[-1px] lg:text-[38px]">
            <Link href={active.href} className="hover:text-[#ffb29b]">
              {active.name}
            </Link>
          </h3>
          <p className="max-w-[700px] text-[15px] leading-relaxed text-white/[.74] lg:text-[16px]">{active.intro}</p>

          {active.chips.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {active.chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-white/[.16] px-[10px] py-[5px] text-[12px] text-white/[.82]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          <div className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {active.auditHeading && active.auditNames.length > 0 && (
              <div className="border-t border-white/[.12] pt-[15px]">
                <h4 className="mb-2 text-[14px] font-bold">{active.auditHeading}</h4>
                <ul className="m-0 list-disc space-y-1 pl-[18px] text-[13px] text-white/[.68]">
                  {active.auditNames.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {active.topicsHeading && active.topicTitles.length > 0 && (
              <div className="border-t border-white/[.12] pt-[15px]">
                <h4 className="mb-2 text-[14px] font-bold">{active.topicsHeading}</h4>
                <ul className="m-0 list-disc space-y-1 pl-[18px] text-[13px] text-white/[.68]">
                  {active.topicTitles.map((tp) => (
                    <li key={tp}>{tp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mt-[30px] flex flex-wrap gap-2.5">
          <Link href={active.ctaPrimaryHref} className="btn btn-primary">
            {active.ctaPrimaryLabel}
          </Link>
          <Link
            href={active.ctaGhostHref}
            className="btn border-white/[.22] bg-transparent text-white hover:border-white/[.45]"
          >
            {active.ctaGhostLabel}
          </Link>
        </div>
      </article>
    </div>
  );
}
