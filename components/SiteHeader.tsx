import Link from "next/link";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import AccountMenu, { type AccountMenuDict } from "@/components/AccountMenu";
import { localePath, type Locale } from "@/i18n/config";
import { SERVICE_MENU, type ServiceMenuDict } from "@/lib/nav";

export type NavDict = {
  tools: string;
  suppliers: string;
  services: string;
  resources: string;
  pricing: string;
  rfq: string;
  audits: string;
  inspections: string;
  logistics: string;
  language: string;
  trainingPlans: string;
  about: string;
  postRfq: string;
  requestAudit: string;
  /** aria-label：LOGO 链接（品牌名 + 首页） */
  homeLabel: string;
  /** aria-label：主导航 landmark */
  mainNav: string;
  menu: ServiceMenuDict;
};

export default function SiteHeader({
  locale,
  dict,
  accountDict,
  whatsappLabel,
}: {
  locale: Locale;
  dict: NavDict;
  /** 账号入口文案（t.auth.accountMenu）。单独传是为了不和 nav 混在一起。 */
  accountDict: AccountMenuDict;
  /** WhatsApp 入口文案（t.common.whatsappChat）。与页脚 / AI 客服复用同一份，避免各存一份。 */
  whatsappLabel?: string;
}) {
  const p = (href: string) => localePath(locale, href);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#e2e8f0]">
      <div className="container flex items-center justify-between h-16 gap-4">
        <Link
          href={p("/")}
          className="flex items-center shrink-0"
          aria-label={dict.homeLabel}
        >
          {/* 品牌 LOGO：盾牌 + 工厂 + 放大镜（核验方） */}
          {/* 用原生 img 而不是 next/image，避免 SVG 需要 dangerouslyAllowSVG 配置 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-header.svg"
            alt="FactoryAuditB2B"
            width={160}
            height={32}
            className="h-8 w-auto"
          />
        </Link>

        {/* 第一阶段导航只保留转化主线：Tools / Suppliers / Services / Resources / Pricing。
            Logistics 是占位页，已从主导航移除；培训降级进 Services 下拉。 */}
        <nav aria-label={dict.mainNav} className="hidden lg:flex items-center gap-5 text-sm text-[#0f172a]">
          <Link href={p("/tools")} className="hover:text-[#0f4c81] font-medium">
            {dict.tools}
          </Link>
          <Link href={p("/suppliers")} className="hover:text-[#0f4c81] font-medium">
            {dict.suppliers}
          </Link>

          <div className="relative group">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
              className="flex items-center gap-1 hover:text-[#0f4c81] font-medium py-2"
            >
              {dict.services}
              <span aria-hidden="true" className="text-[10px] leading-none">▼</span>
            </button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full w-[340px] pt-2">
              <ul className="rounded-lg border border-[#e2e8f0] bg-white p-2 shadow-lg">
                {SERVICE_MENU.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={p(item.href)}
                      className="block rounded-md px-3 py-2 hover:bg-[#f1f5f9]"
                    >
                      <span className="block font-medium text-[#0f172a]">{dict.menu[item.key]}</span>
                      <span className="block text-xs text-[#64748b] mt-0.5">{dict.menu[item.descKey]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href={p("/resources")} className="hover:text-[#0f4c81] font-medium">
            {dict.resources}
          </Link>
          <Link href={p("/pricing")} className="hover:text-[#0f4c81] font-medium">
            {dict.pricing}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {/* 账号入口：客户端组件，首帧渲染「未登录态」（与 SSR 一致），
              hydration 后按 /api/me 切换成账号菜单。不读 cookie，不影响 SSG。
              未登录态不再指向 /login —— 询盘主渠道是 WhatsApp，
              登录页仍可通过直接输入 URL 访问（/api/auth/login 后端仍可用），
              只是不再作为公开入口摆在导航栏里。 */}
          <AccountMenu locale={locale} dict={accountDict} whatsappLabel={whatsappLabel} />
          <LocaleSwitcher current={locale} languageLabel={dict.language} />
          <Link href={p("/rfq")} className="btn btn-primary whitespace-nowrap">
            {dict.postRfq}
          </Link>
          <Link href={p("/factory-audit/request")} className="btn btn-accent hidden sm:inline-flex whitespace-nowrap">
            {dict.requestAudit}
          </Link>
        </div>
      </div>
    </header>
  );
}
