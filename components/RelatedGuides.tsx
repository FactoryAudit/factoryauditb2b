// components/RelatedGuides.tsx —— Topic Cluster 内链模块
//
// 用途：把「权重高、但没有出口指向指南库」的商业页（/services、/countries、
// /industry、/tools、/audit-guide）接上内容最深的 /guides，补上
// 「支柱页 → 长文」这半条双向内链。
//
// 行为约定：
//   · hub 解析不出指南（或全部失效）⇒ 整块不渲染（绝不输出空标题空列表）。
//   · 标题复用既有字典键 t.common.ui.relatedGuides —— **不新增字典键**，
//     因此不触碰 en 叶子数冻结常量，也不需要 9 语同步。
//   · 失效 slug 在 lib/relatedGuides.ts 里已被剔除（双保险：这里再 filter 一次）。
//   · 页面侧只需传一个字符串（如 hub="service:inspection"），零变量依赖，
//     便于在大量页面里统一挂载。
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { GUIDES } from "@/lib/guides";
import { guidesForHub } from "@/lib/relatedGuides";
import { pickZhPair } from "@/lib/tw";
import { pickGuideDesc } from "@/lib/pickGuideDesc";

export default async function RelatedGuides({
  locale,
  hub,
  className = "mt-10",
}: {
  locale: Locale;
  hub: string;
  className?: string;
}) {
  const wanted = new Set(guidesForHub(hub));
  const items = GUIDES.filter((g) => wanted.has(g.slug));
  if (items.length === 0) return null;

  const t = await getDictionary(locale);
  const lp = (href: string) => localePath(locale, href);

  return (
    <section className={className} data-related-guides={hub}>
      <h2 className="text-2xl font-bold text-[#171717]">{t.common.ui.relatedGuides}</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((g) => (
          <Link
            key={g.slug}
            href={lp(`/guides/${g.slug}`)}
            className="card p-5 hover:border-[#171717]"
          >
            <h3 className="font-semibold text-[#171717]">{pickZhPair(locale, g.titleEn, g.titleZh)}</h3>
            <p className="text-sm text-[#6d6b66] mt-1">{pickGuideDesc(locale, g)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
