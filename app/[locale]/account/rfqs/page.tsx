import type { Metadata } from "next";
import Link from "next/link";
import AccountGate from "@/components/AccountGate";
import MyRfqList from "@/components/MyRfqList";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { buildPageMetadata } from "@/lib/pageMeta";

// /account/rfqs —— 我的询价单
//
// 为什么现在才建：提交 RFQ 后用户只能干等，看不到状态、看不到匹配结果。
// 询价是这个站最核心的买家动作，提交完石沉大海会直接劝退 ——
// 而运营侧（/admin/rfqs）早就能看到全量询价了，只有买家自己看不到，
// 信息不对称到这个程度是在丢单。
//
// 为什么没有 JsonLd：私有页 + noindex，结构化数据不会被任何搜索引擎消费。
// 理由同 /account/saved。

const PATH = "/account/rfqs";

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
    title: t.account.rfqsMetaTitle,
    description: t.account.rfqsMetaDesc,
    robots: { index: false, follow: false },
  });
}

export default async function AccountRfqsPage({
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
      <nav aria-label="Breadcrumb" className="text-sm text-[#64748b]">
        <Link href={p("/account")} className="hover:text-[#0f4c81]">
          {a.navOverview}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#0f172a]">{a.navRfqs}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold text-[#0f172a]">{a.rfqsTitle}</h1>
      <p className="mt-2 text-[#64748b]">{a.rfqsLead}</p>

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
          <MyRfqList
            labels={{
              loading: a.loading,
              error: a.listError,
              empty: a.rfqsEmpty,
              emptyCta: a.rfqsEmptyCta,
              // 复用后台的状态文案：买家看到的状态词和运营操作的是同一套，
              // 不会出现"买家看到 Reviewing、客服说是 Matching"这种对不上的情况
              statusLabels: t.admin.status,
              productLabel: t.rfq.form.labels.product,
              quantityLabel: t.rfq.form.labels.quantity,
              countryLabel: t.rfq.form.labels.country,
              submittedLabel: a.submittedLabel,
              matchesLabel: a.matchesLabel,
              noMatches: a.noMatches,
            }}
            locale={locale}
          />
        </AccountGate>
      </div>
    </main>
  );
}
