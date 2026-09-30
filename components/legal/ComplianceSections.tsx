import Link from "next/link";

/**
 * 合规类页面共用渲染件（CS-23）。
 *
 * 版式来源：`app/[locale]/privacy/page.tsx` 与 `terms/page.tsx` 的骨架**逐字复制** ——
 *   容器 `container py-12 max-w-3xl`、h1 `text-3xl font-extrabold text-[#171717]`、
 *   段落 h2 `text-lg font-bold text-[#171717] mb-1`、正文 `text-[#3f4650] leading-relaxed`。
 * 这样做是为了让新页与既有法务页在**任何语种**下视觉一致，不引入第二套版式。
 *
 * 为什么抽成组件而不是三份内联：三个新页面 + /privacy + /terms 都要用「段落列表」
 * 与「页间互链」，复制 5 份必然漂移（改一处漏四处）。这里只做**渲染**，
 * 不读字典、不查库、不判断权限 ⇒ 预渲染安全，零数据泄漏面。
 */

export type ComplianceSection = { h: string; b: string };

/** 段落列表：h2 + 正文，与 /privacy 的 `privacySections.map` 完全同构 */
export function ComplianceSections({ sections }: { sections: ComplianceSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <section key={`${i}-${s.h}`}>
          <h2 className="text-lg font-bold text-[#171717] mb-1">{s.h}</h2>
          <p className="text-[#3f4650] leading-relaxed">{s.b}</p>
        </section>
      ))}
    </div>
  );
}

export type PolicyLink = { href: string; label: string; current?: boolean };

/**
 * 页间互链（合规五页共用：confidentiality / integrity / trust / privacy / terms）。
 *
 * 当前页渲染成 `<span aria-current="page">` **而不是链接** —— 指向自己的链接
 * 既是爬虫噪声，也会让用户以为"点一下会去哪"。key 用 href（站内路径唯一）。
 */
export function RelatedPolicies({ title, links }: { title: string; links: PolicyLink[] }) {
  return (
    <nav className="mt-12 border-t border-[#ebe8e1] pt-6" aria-label={title}>
      <h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8c8982]">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2 list-none p-0">
        {links.map((l) =>
          l.current ? (
            <li key={l.href}>
              <span
                aria-current="page"
                className="inline-block rounded-full border border-[#e07a49] bg-[#f7e7de] px-3 py-1.5 text-xs font-semibold text-[#1b1b19]"
              >
                {l.label}
              </span>
            </li>
          ) : (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-block rounded-full border border-[#ebe8e1] bg-white px-3 py-1.5 text-xs text-[#3f4650] transition hover:border-[#e07a49] hover:text-[#1b1b19]"
              >
                {l.label}
              </Link>
            </li>
          )
        )}
      </ul>
    </nav>
  );
}
