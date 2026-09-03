import type { Metadata } from "next";
import Link from "next/link";
import AccountGate from "@/components/AccountGate";
import SavedSuppliersList from "@/components/SavedSuppliersList";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

// /account/saved —— 我的收藏夹
//
// 为什么现在才建：组件（SavedSuppliersList）和数据接口（/api/saved-suppliers）
// 上一轮就写好了，但页面没建 —— 组件零引用、菜单里也不敢放入口。
// 结果就是"收藏"按钮能用，用户却没地方看自己收藏了什么，
// 等于功能不存在。收藏是买家留存的核心动作，这条链必须通。
//
// 为什么没有 JsonLd：这是登录后才能看到内容的私有页，
// 且 robots 已设为 noindex —— 结构化数据不会被任何搜索引擎消费，
// 写进去只是往 HTML 里塞死重量。首页 /account 那份是历史遗留，不强求一致。

const PATH = "/account/saved";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  return buildPageMetadata({
    locale,
    path: PATH,
    title: t.account.savedMetaTitle,
    description: t.account.savedMetaDesc,
    // 账号相关页面一律不参与搜索索引
    robots: { index: false, follow: false },
  });
}

export default async function AccountSavedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getDictionary(locale);
  const a = t.account;
  const p = (href: string) => localePath(locale, href);

  return (
    <main className="container max-w-4xl py-12">
      {/* 返回账号总览。子页面之间也要能互相跳，否则用户只能靠浏览器后退 */}
      <nav aria-label="Breadcrumb" className="text-sm text-[#64748b]">
        <Link href={p("/account")} className="hover:text-[#0f4c81]">
          {a.navOverview}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#0f172a]">{a.navSaved}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-[#0f172a]">{a.savedTitle}</h1>
      <p className="mt-2 text-[#64748b]">{a.savedLead}</p>

      <div className="mt-8">
        <AccountGate
          t={{
            signInTitle: a.signInTitle,
            signInLead: a.signInLead,
            signInCta: a.panel.signInCta,
            registerCta: a.panel.registerCta,
            noAccount: a.panel.noAccount,
          }}
          signInHref={p("/login")}
          registerHref={p("/register")}
        >
          <SavedSuppliersList
            labels={{
              empty: a.savedEmpty,
              emptyCta: a.savedEmptyCta,
              remove: a.remove,
              error: a.listError,
              loading: a.loading,
              riskLevels: t.risk.ui.level,
              noCheckRecord: t.supplierProfile.noCheckRecord,
            }}
            // 只传 locale，链接由组件内部用 localePath 拼 —— 不能传函数给客户端组件
            locale={locale}
          />
        </AccountGate>
      </div>
    </main>
  );
}
