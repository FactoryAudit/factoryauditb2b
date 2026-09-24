import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import WhatsAppLink, { whatsappConfigured } from "@/components/WhatsAppLink";
import SocialLinks from "@/components/SocialLinks";
import { SERVICE_MENU, type ServiceMenuDict } from "@/lib/nav";
import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { operatorLine } from "@/lib/trust";

export type FooterDict = {
  platform: string;
  resources: string;
  coverage: string;
  logistics: string;
  allTools: string;
  riskCalculator: string;
  verificationChecklist: string;
  supplierVerification: string;
  factoryAudit: string;
  knowledgeBase: string;
  pricing: string;
  privacy: string;
  terms: string;
  tagline: string;
  copyright: string;
  about: string;
  contact: string;
  coverageOnly: string;
  operatedBy: string;
  registeredBusiness: string;
  trustCenter: string;
  verificationService: string;
  inspectionService: string;
  sourcingService: string;
  improvementService: string;
  allServices: string;
  containerCalculator: string;
  supplierNetwork: string;
  sampleReport: string;
  standardReport: string;
  monitoring: string;
  fieldReports: string;
  caseStudies: string;
  suppliers: string;
  membership: string;
  // Careers / 人才网络入口（/careers）
  workWithUs: string;
  workWithUsLead: string;
  workWithUsCountries: string;
};

export default function SiteFooter({
  locale,
  dict,
  menu,
  whatsappLabel,
}: {
  locale: Locale;
  dict: FooterDict;
  /** 服务菜单文案复用 nav.menu，避免页脚与导航各存一份 */
  menu: ServiceMenuDict;
  whatsappLabel?: string;
}) {
  const p = (href: string) => localePath(locale, href);
  /** 未配置运营主体时不显示这一段，也不显示空的 Trust Center 入口 */
  const operator = operatorLine();

  return (
    <footer className="bg-[#0f172a] text-[#cbd5e1]">
      <div className="container py-12 grid md:grid-cols-5 gap-8 text-sm">
        <div>
          {/* 页脚是深色底（#0f172a），用浅色版 LOGO */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-light.svg"
            alt="FactoryAuditB2B"
            width={180}
            height={36}
            className="h-9 w-auto mb-3"
          />
          <p className="leading-relaxed">{dict.tagline}</p>
          <p className="leading-relaxed mt-2 text-[#94a3b8]">{dict.coverageOnly}</p>
          {/* 运营主体：品牌名 ≠ 法律主体，未配置时不渲染任何文字（不编造公司名） */}
          {operator && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[#94a3b8]">{dict.operatedBy.replace("{entity}", operator)}</p>
              <p className="text-[#94a3b8] mt-1">{dict.registeredBusiness}</p>
              <Link href={p("/trust")} className="inline-block mt-2 text-white underline hover:no-underline">
                {dict.trustCenter}
              </Link>
            </div>
          )}
        </div>

        <div>
          <div className="text-white font-semibold mb-3">{dict.platform}</div>
          <ul className="space-y-2">
            <li>
              <Link href={p("/tools")} className="hover:text-white">
                {dict.allTools}
              </Link>
            </li>
            <li>
              <Link href={p("/tools/supplier-risk-calculator")} className="hover:text-white">
                {dict.riskCalculator}
              </Link>
            </li>
            <li>
              <Link href={p("/tools/supplier-verification-checklist")} className="hover:text-white">
                {dict.verificationChecklist}
              </Link>
            </li>
            <li>
              <Link href={p("/suppliers")} className="hover:text-white">
                {dict.suppliers}
              </Link>
            </li>
            <li>
              <Link href={p("/rfq")} className="hover:text-white">
                RFQ
              </Link>
            </li>
            <li>
            {/* V2.2 §48/§52：Membership 已合并进 Pricing（Founding Buyer 选项）。
                内部导航统一指向 /pricing#founding-buyer，不再单独维护 /membership。 */}
            <Link href={p("/pricing#founding-buyer")} className="hover:text-white">
              {dict.membership}
            </Link>
            </li>
            <li>
              <Link href={p("/join-supplier-network")} className="hover:text-white">
                {dict.supplierNetwork}
              </Link>
            </li>
            <li>
              <Link href={p("/pricing")} className="hover:text-white">
                {dict.pricing}
              </Link>
            </li>
            <li>
              <Link href={p("/monitoring")} className="hover:text-white">
                {dict.monitoring}
              </Link>
            </li>
            {/* CS-01：这里原本还有一个 /sample-report 链接。该页已 308 到
                /standard-report，再留一条会变成「点进去先跳一次」，且页脚出现两条
                指向同一目标的链接。已删除，保留下方 /standard-report 条目。 */}
            <li>
              <Link href={p("/standard-report")} className="hover:text-white">
                {dict.standardReport}
              </Link>
            </li>
            <li>
              <Link href={p("/logistics")} className="hover:text-white">
                {dict.containerCalculator}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-white font-semibold mb-3">{dict.allServices}</div>
          <ul className="space-y-2">
            {SERVICE_MENU.map((item) => (
              <li key={item.key}>
                <Link href={p(item.href)} className="hover:text-white">
                  {menu[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/*
          「Work With Us」—— 人才网络入口，与「所有服务」并排成列。
          定位不是「招聘岗位」，而是可调用的人力网络（审核员 / 顾问 / 项目 / 采购 / IT /
          本地合作伙伴）。
        */}
        <div>
          <div className="text-white font-semibold mb-3">{dict.workWithUs}</div>
          <Link href={p("/careers")} className="group block">
            <div className="text-[#cbd5e1] group-hover:text-white group-hover:underline">
              {dict.workWithUsLead}
            </div>
            <div className="mt-1 text-xs text-[#94a3b8]">{dict.workWithUsCountries}</div>
          </Link>
        </div>

        {/*
          Resources 与 Coverage 同一行（桌面端两栏，移动端自动堆叠）：
          避免宽度被三列分得太窄。
        */}
        <div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-white font-semibold mb-3">{dict.resources}</div>
              <ul className="space-y-2">
                <li>
                  <Link href={p("/resources")} className="hover:text-white">
                    {dict.knowledgeBase}
                  </Link>
                </li>
                <li>
                  <Link href={p("/case-studies")} className="hover:text-white">
                    {dict.caseStudies}
                  </Link>
                </li>
                <li>
                  <Link href={p("/field-reports")} className="hover:text-white">
                    {dict.fieldReports}
                  </Link>
                </li>
                <li>
                  <Link href={p("/about")} className="hover:text-white">
                    {dict.about}
                  </Link>
                </li>
                <li>
                  <Link href={p("/contact")} className="hover:text-white">
                    {dict.contact}
                  </Link>
                </li>
                <li>
                  <Link href={p("/privacy")} className="hover:text-white">
                    {dict.privacy}
                  </Link>
                </li>
                <li>
                  <Link href={p("/terms")} className="hover:text-white">
                    {dict.terms}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-3">{dict.coverage}</div>
              <ul className="space-y-2">
                {COVERAGE_COUNTRIES.map((c) => (
                  <li key={c.code}>
                    <Link href={p(`/countries/${c.slug}`)} className="hover:text-white">
                      {locale === "zh" ? c.nameZh : c.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {whatsappConfigured() && whatsappLabel && (
                <WhatsAppLink
                  label={whatsappLabel}
                  message="Hi FactoryAuditB2B, I would like to ask about supplier verification."
                  className="mt-3 inline-block rounded bg-[#25D366] px-3 py-2 text-xs font-medium text-[#0a3320] hover:opacity-90"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-[#94a3b8]">
        {/* 域名邮箱做信任背书。邮箱地址本身是标识符、不是文案，9 语通用，故不进词典。
            WhatsApp 是询盘主渠道（见 Coverage 栏），这里给不装 WhatsApp 的访客留一条路。 */}
        <a
          href="mailto:support@factoryauditb2b.com"
          className="mb-3 inline-block text-[#cbd5e1] underline decoration-[#94a3b8] hover:text-white hover:decoration-white"
        >
          support@factoryauditb2b.com
        </a>
        <SocialLinks className="mb-4 justify-center" />
        {dict.copyright}
      </div>
    </footer>
  );
}
