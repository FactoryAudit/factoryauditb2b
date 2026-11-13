// lib/trustPage.ts —— /trust 页面「信任模块」正文层（2026-11-13）
//
// 为什么内容放这里而不是九语字典：
//   这批是**正文段落**（How to verify us / Who reviews your file / Mini-FAQ），
//   按项目既有约定（lib/aboutContent.ts、lib/industryContent.ts、lib/chemicals.ts）
//   走 en/zh 双语 + zh-TW 就地繁化，其余语种回落英文；
//   只有短字段（标题、按钮）才进九语字典。
//   ⇒ 不新增字典键，en 叶子数冻结常量（3339）不动，也就不牵连 11 个门禁脚本 + RELEASE-RULES。
//
// 🔴 铁律（与 memory「禁无据声称」一致，改这份文件前必须逐条满足）：
//   1. 不写审核员姓名、人数、从业年限、证书编号、客户名、成交数量。
//   2. 不写未取得的第三方认证。SOC 2 / ISO 27001 只允许出现在「将来若取得」的条件句里。
//   3. 不承诺运营者未确认的时限。「一个工作日」沿用 /contact 的既有口径（responseNote）。
//   4. 文件共享边界只写仓库里真实实现的策略（t.trust.evidence[4] + lib/trust.ts 的打码规则）。
//   5. 「谁核验」写运营者本人 —— 平台目前没有在册审核员（auditor_application 5 条全为探针），
//      照抄「lead auditor + QC engineer」就是虚构。
import type { Bi } from "@/lib/aboutContent";

/** 国家企业信用信息公示系统。主体是大陆公司（江门智煜科技有限公司），这是唯一对口的登记机关公示渠道。 */
export const REGISTRY_URL = "https://www.gsxt.gov.cn/";

/**
 * 页面内容的最近复核月份。
 * 🔴 刻意写成常量、不取 `new Date()`：
 *    自动取系统时间会让「最近复核」永远显示当月，是误导；
 *    这里要的是「业务方真的看过这一版」的那个月，每季度人工改一次。
 */
export const CONTENT_REVIEWED: Bi = {
  en: "November 2026",
  zh: "2026 年 11 月",
};

type FaqItem = { q: string; a: string };

export const TP = {
  reviewedLabel: { en: "Last reviewed", zh: "最近复核" } as Bi,

  // ── 工作单 P0-2：平台自己也要可被独立核验 ────────────────────────────────
  verifyUs: {
    title: { en: "How to verify us", zh: "如何核验我们" } as Bi,
    body: {
      en: "FactoryAuditB2B is operated by Jiangmen Zhiyu Technology Co., Ltd. (江门智煜科技有限公司), a company registered in mainland China. You do not have to take our word for that. Open the National Enterprise Credit Information Publicity System — gsxt.gov.cn, the registry run by China's market regulator — and search the exact Chinese company name shown above. The domain, its TLS certificate and the public WHOIS record are checkable the same way. We publish what can be checked, and we display no security badges we cannot substantiate.",
      zh: "FactoryAuditB2B 由在中国大陆注册的「江门智煜科技有限公司」运营。这一点不需要你相信我们：打开国家企业信用信息公示系统（gsxt.gov.cn，中国市场监督管理总局的官方公示渠道），按上面的公司中文全称检索即可。域名、TLS 证书与公开的 WHOIS 记录同样可以自行核对。我们只公布能被核对的信息，也不展示任何无法自证的认证标识。",
    },
    registryCta: { en: "Open the public registry", zh: "打开公示系统" } as Bi,
    future: {
      en: "If we obtain a third-party attestation — for example SOC 2 or ISO 27001 — we will publish the scope, issue date, certification body and online verification link on this page before asking anyone to rely on it.",
      zh: "如果将来取得第三方认证（例如 SOC 2 或 ISO 27001），我们会先在本页公布认证范围、签发日期、认证机构与在线验证链接，再请任何人据此判断。",
    },
  },

  // ── 工作单 P0-5：把「我们有经验」换成「谁在办你的案子」────────────────────
  who: {
    title: { en: "Who reviews your file", zh: "谁审核你的案子" } as Bi,
    body: {
      en: "Your file is not passed to an anonymous pool. It is handled by the operator of FactoryAuditB2B — the same person who answers your enquiry and joins the factory video walkthrough. Before work starts you are told who is handling your case, and you can ask for a short video call with that person. We do not publish auditor headcounts or credentials we cannot evidence.",
      zh: "你的案子不会被丢进一个匿名池子。它由 FactoryAuditB2B 的运营者本人处理——就是回复你询盘、并参加工厂视频走访的那个人。开工前你会知道是谁在办你的案子，也可以要求和这个人做一次简短视频通话。我们不公布无法自证的审核员人数或资历。",
    },
  },

  // ── 工作单 P0-6：样本报告（站内已有 /standard-report，不另做 PDF）─────────
  sample: {
    title: { en: "See what a report actually looks like", zh: "先看看报告长什么样" } as Bi,
    body: {
      en: "The standard supplier due diligence report is published in full: 13 sections, eight scored dimensions and evidence grading on every finding. Read it without registering; register once only if you want the downloadable specimen. Nothing in it is a real client file.",
      zh: "标准供应商尽职调查报告已全文公开：13 个章节、8 个评分维度，每条结论都带证据分级。不注册也能直接读；只有需要下载样张时才需要注册一次。样张不含任何真实客户档案。",
    },
    cta: { en: "Open the specimen report", zh: "打开样张" } as Bi,
  },

  // ── 工作单 P0-4：Mini-FAQ（三问，答案全部从站内既有口径改写，不新增事实）──
  faq: {
    title: { en: "Three questions buyers ask before sending a file", zh: "买家在发资料前最常问的三件事" } as Bi,
    items: {
      en: [
        {
          q: "What do I receive at the end of a verification?",
          a: "A written report: what was checked, what was found, the source and date behind each item, and an explicit list of what we could not confirm. Every finding carries an evidence level, so a document review is never presented as an on-site verification.",
        },
        {
          q: "Can I see the documents you reviewed, or only your summary?",
          a: "Only where the owner allows it. Third-party audit reports are reviewed and cited, never re-distributed; the report names the finding, the date and the issuer. Suppliers decide whether a file is public, buyer-visible, restricted or private, and we do not publish confidential documents without authorisation.",
        },
        {
          q: "What happens if you find something negative about a supplier?",
          a: "You get it in plain language, including what it means for your decision. We do not soften findings, and payment does not change the outcome — a paid verification can still come back with problems. If a problem is material, we tell you before you place an order.",
        },
      ],
      zh: [
        {
          q: "核验结束后我会拿到什么？",
          a: "一份书面报告：查了什么、查到了什么、每条信息的来源与日期，以及一份明确列出「没能确认」的清单。每条结论都带证据层级，文件审阅不会被写成现场核验。",
        },
        {
          q: "我能看到你们审过的原始文件吗，还是只有结论？",
          a: "只有在文件所有者授权时才提供。第三方审核报告只做审阅与引用，不转发原件；报告中写明结论、日期与出具机构。供应商可决定文件是公开、仅买家可见、受限还是私有；未经授权我们不公开保密文件。",
        },
        {
          q: "如果查出供应商的问题，会怎样？",
          a: "我们会用直白的话告诉你，包括它对这笔采购意味着什么。我们不会软化结论，付款也不改变结果——付费核验同样可能查出一堆问题。如果问题很关键，我们会在你下单前就说。",
        },
      ] as FaqItem[],
    } as { en: FaqItem[]; zh: FaqItem[] },
  },

  // ── 工作单 P0-3：页尾 CTA 的「说清楚」那句（按钮沿用 ABOUT.cta 既有文案）──
  ctaButton: {
    en: "Submit a supplier for a scoped quote",
    zh: "提交供应商，索取核验报价",
  } as Bi,
  ctaLine: {
    en: "Tell us the supplier name, location and what you need checked. You will receive a plain-language proposal within one business day, stating exactly what we will check and what it costs.",
    zh: "告诉我们供应商名称、所在地，以及你需要核查什么。一个工作日内你会收到一份说人话的方案：明确写清我们查什么、收多少钱。",
  } as Bi,
};
