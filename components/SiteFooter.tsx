import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import WhatsAppLink, { whatsappConfigured } from "@/components/WhatsAppLink";
import SocialLinks from "@/components/SocialLinks";
import { type ServiceMenuDict } from "@/lib/nav";
import { operatorLine } from "@/lib/trust";

export type FooterDict = {
  platform: string;
  buyer: string;
  company: string;
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
  /** CS-23：合规页脚入口标签（9 语，值级新增） */
  confidentiality: string;
  integrity: string;
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
  workWithUs: string;
  workWithUsLead: string;
  workWithUsCountries: string;
};

/**
 * 全站页脚。
 *
 * 版式口径 = 用户定稿 preview (1).html / preview (2).html 的 `.footer`：
 *   深墨底 #1b1b19、四列 `1.4fr 1fr 1fr 1fr`、栏目标题 10px 大写 letterspacing .12em、
 *   链接 12.5px #a9a59c hover #fff、底栏左右分栏（左版权 / 右联系）。
 *
 * 与设计稿的两处**有意偏离**（不照抄的理由）：
 *   1) 设计稿页脚链接指向本站不存在的路由（`/services/verification`、
 *      `/resources/case-studies`、`/resources/reports`、`/signin` 均为别名或不存在），
 *      照抄会造出死链 ⇒ 一律落到本站真实路由。
 *   2) 设计稿页脚没有运营主体 / 信任中心 / WhatsApp / 社媒位。这些是合规与信任要件，
 *      删掉即功能倒退 ⇒ 保留，只换配色与排版。
 */
export default function SiteFooter({
  locale,
  dict,
  menu,
  whatsappLabel,
  industriesLabel,
}: {
  locale: Locale;
  dict: FooterDict;
  /** 服务菜单文案复用 nav.menu，避免页脚与导航各存一份 */
  menu: ServiceMenuDict;
  whatsappLabel?: string;
  /**
   * 「行业」入口文案 —— 复用 t.industryPage.breadcrumb（9 语已有该键）。
   * /industry 此前全站零入链，页脚补一个稳定入口。
   */
  industriesLabel: string;
}) {
  const p = (href: string) => localePath(locale, href);
  /**
   * 运营主体名（恒有值：lib/trust.ts 已用 OPERATOR 真实主体兜底）。
   * 品牌名 ≠ 法律主体 —— 这一段是「海外访客 30 秒内明白你是谁」的落点，
   * 不能因为 TRUST_* 环境变量没配就整段消失（会连带丢掉 Trust Center 入口）。
   */
  const operator = operatorLine(locale);

  return (
    <footer className="bg-[#1b1b19] pt-14 pb-7 text-[#bdb9b0]">
      <div className="container">
        <div className="grid grid-cols-1 gap-x-5 gap-y-[27px] border-b border-white/[.08] pb-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-[38px]">
          {/* 品牌列 */}
          <div className="md:col-span-2 lg:col-span-1">
            {/* 页脚是深色底（#1b1b19），用浅色版 LOGO */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-light.svg"
              alt="FactoryAuditB2B"
              width={180}
              height={36}
              className="mb-3.5 h-9 w-auto"
            />
            <p className="mt-3.5 max-w-[290px] text-[12.5px] leading-[1.65] text-[#929087]">
              {dict.tagline}
            </p>
            <p className="mt-1.5 max-w-[290px] text-[12.5px] leading-[1.65] text-[#929087]">
              {dict.coverageOnly}
            </p>
            {/* 运营主体：品牌名 ≠ 法律主体，未配置时不渲染任何文字（不编造公司名） */}
            {operator && (
              <div className="mt-4 border-t border-white/[.08] pt-4">
                <p className="text-[12.5px] text-[#929087]">
                  {dict.operatedBy.replace("{entity}", operator)}
                </p>
                <p className="mt-1 text-[12.5px] text-[#929087]">{dict.registeredBusiness}</p>
                <Link
                  href={p("/trust")}
                  className="mt-2 inline-block text-[12.5px] text-white underline hover:no-underline"
                >
                  {dict.trustCenter}
                </Link>
              </div>
            )}
          </div>

          {/* Buyer 列 */}
          <div>
            <div className="mb-3.5 text-[10px] uppercase tracking-[.12em] text-white">{dict.buyer}</div>
            <ul className="grid grid-cols-1 list-none gap-2 p-0">
              <li><Link href={p("/suppliers")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.suppliers}</Link></li>
              {/* /industry 此前零入链，这里补一个稳定入口（文案复用 industryPage.breadcrumb） */}
              <li><Link href={p("/industry")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{industriesLabel}</Link></li>
              <li><Link href={p("/rfq")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">RFQ</Link></li>
              <li><Link href={p("/services/supplier-verification")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{menu.verification}</Link></li>
              <li><Link href={p("/factory-audit/request")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{menu.factoryAudit}</Link></li>
              <li><Link href={p("/services/inspection")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{menu.inspection}</Link></li>
              <li><Link href={p("/rfq")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{menu.sourcing}</Link></li>
              <li><Link href={p("/monitoring")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.monitoring}</Link></li>
              <li><Link href={p("/services/supplier-improvement")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{menu.improvement}</Link></li>
              <li><Link href={p("/pricing#founding-buyer")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.membership}</Link></li>
              <li><Link href={p("/join-supplier-network")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.supplierNetwork}</Link></li>
            </ul>
          </div>

          {/* Resources 列 */}
          <div>
            <div className="mb-3.5 text-[10px] uppercase tracking-[.12em] text-white">{dict.resources}</div>
            <ul className="grid grid-cols-1 list-none gap-2 p-0">
              <li><Link href={p("/resources")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.knowledgeBase}</Link></li>
              <li><Link href={p("/tools")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.allTools}</Link></li>
              <li><Link href={p("/case-studies")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.caseStudies}</Link></li>
              <li><Link href={p("/field-reports")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.fieldReports}</Link></li>
              <li><Link href={p("/countries")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.coverage}</Link></li>
              <li><Link href={p("/standard-report")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.standardReport}</Link></li>
              <li><Link href={p("/logistics")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.containerCalculator}</Link></li>
            </ul>
          </div>

          {/* Company 列 */}
          <div>
            <div className="mb-3.5 text-[10px] uppercase tracking-[.12em] text-white">{dict.company}</div>
            <ul className="grid grid-cols-1 list-none gap-2 p-0">
              <li><Link href={p("/trust")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.about}</Link></li>
              {/* CS-23：Trust Center 区块锚点。文案复用既有的 `footer.trustCenter`
                  （本次把它的值从 "About" 改为 "Trust Center"，0 新叶）——
                  锚点与页内 `id="trust-center"` 对应，站内一跳直达。 */}
              <li><Link href={`${p("/trust")}#trust-center`} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.trustCenter}</Link></li>
              <li><Link href={p("/confidentiality")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.confidentiality}</Link></li>
              <li><Link href={p("/integrity")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.integrity}</Link></li>
              <li><Link href={p("/contact")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.contact}</Link></li>
              <li><Link href={p("/careers")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.workWithUs}</Link></li>
              <li><Link href={p("/terms")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.terms}</Link></li>
              <li><Link href={p("/privacy")} className="text-[12.5px] text-[#a9a59c] transition hover:text-white">{dict.privacy}</Link></li>
            </ul>
          </div>
        </div>

        {/* 联系块（CS-24）：把「联系我们」从 Company 列的一条普通链接提升为页脚显眼入口。
            参考口径 = factorychecker.com 的 #contact 区块，但**只取「让访客一眼看到怎么联系」这一层**：
            参考站那是带表单的独立区块（Name/Email/Phone/Message），本站已有 /contact 页承接表单，
            页脚再放一份表单会重复写入路径、且当前 Worker 内存已近上限，故此处只做**指路**：
            标题 + 邮箱（直接可用，零跳转）+ 主按钮（进 /contact 完整表单）+ WhatsApp（已配置时）。
            🔴 0 新字典键：标题与按钮复用 `footer.contact`（9 语已有），
               邮箱是标识符不是文案（与底栏原实现同一先例），故不触碰 en 叶子数常量。 */}
        <div className="border-b border-white/[.08] pb-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[10px] uppercase tracking-[.12em] text-white">{dict.contact}</h2>
              {/* 邮箱与 /contact 页同源（lib/aboutContent.operatorEmail 兜底 support@），
                  此处直接写字面量：与底栏既有实现一致，且邮箱非本地化文案。 */}
              <a
                href="mailto:support@factoryauditb2b.com"
                className="mt-2 block text-[19px] font-medium text-white underline decoration-[#5c584f] underline-offset-4 transition hover:decoration-white"
              >
                support@factoryauditb2b.com
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <Link
                href={p("/contact")}
                className="inline-block rounded-md bg-[#e67635] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#cf6529]"
              >
                {dict.contact}
              </Link>
              {whatsappConfigured() && whatsappLabel && (
                <WhatsAppLink
                  label={whatsappLabel}
                  message="Hi FactoryAuditB2B, I would like to ask about supplier verification."
                  className="inline-block rounded-md border border-white/20 px-4 py-2 text-[13px] font-medium text-[#d6d2ca] transition hover:border-white/40 hover:text-white"
                />
              )}
            </div>
          </div>
        </div>

        {/* 底栏：左版权 / 右社媒（对齐设计稿 `.footer-bottom` 的左右分栏；窄屏转纵向）。
            Follow us 社媒区：三平台 URL 全空 ⇒ SocialLinks 返回 null，隐藏整个区块（禁假链接）。
            邮箱与 WhatsApp 已上移到上面的联系块，此处不再重复渲染（同一页不出现两遍同一通道）。 */}
        <div className="flex flex-col gap-5 pt-[22px] text-[11px] text-[#77736c] lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[620px] leading-relaxed">{dict.copyright}</div>
          <div className="leading-relaxed lg:max-w-[420px] lg:text-right">
            <SocialLinks className="mt-0 justify-start lg:justify-end" />
          </div>
        </div>
      </div>
    </footer>
  );
}
