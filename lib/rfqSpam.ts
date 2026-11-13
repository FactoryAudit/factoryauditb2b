/**
 * RFQ 反灌水筛查（服务端纯函数，零依赖）。
 *
 * 背景（2026-11-13 实测）：
 *   RFQ-TKBMSR / RFQ-5HNZKW 是同一批灌水 —— 同一家「Shandong Qilu Industrial」
 *   把 eascoutia.com 上 QL-R800 割草机的产品页文案，中英文各发一遍，
 *   country 留空、正文末尾挂产品页外链，并勾选了「允许公开」。
 *   结果两条广告被当成买家需求挂到 /suppliers 的公开列表上。
 *
 * 设计原则（宁可漏、不可误杀）：
 *   · **绝不因为命中规则就丢单**。真实买家也会贴 Alibaba / 规格书链接，
 *     丢一条真实询盘的成本远高于后台多一条待核实记录。
 *   · 命中只做两件事：① 强制 is_public=false（不许自动上公开列表）；
 *     ② 管理员邮件主题加 `[RFQ!]` 标记，进人工判断。
 *   · 唯一会直接丢弃的是「蜜罐字段被填」——那是表单里人眼不可见的隐藏域，
 *     真人填不到，能填到的只有脚本。命中也不报错，直接假成功，
 *     免得爬虫反复重试。
 */

/** 显式 URL（带协议）。刻意不匹配裸域名：邮箱、句点、型号里的点都会误伤。 */
const URL_RE = /\bhttps?:\/\/[^\s<>"'()[\]]+/gi;

/** 从任意文本里抽出链接（去重、小写域名不敏感） */
export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.match(URL_RE) ?? [];
  return Array.from(new Set(found.map((u) => u.replace(/[.,;:]+$/, ""))));
}

export type RfqScreening = {
  /** 是否有可疑信号（true ⇒ 强制不公开 + 邮件加标记） */
  suspicious: boolean;
  /** 人类可读的原因，写进管理员邮件；无信号时为 null */
  reason: string | null;
  /** 正文/字段里出现的链接数（便于判断严重程度） */
  linkCount: number;
};

/**
 * 筛查一条 RFQ 提交。
 *
 * 只读取买家填写的字段，不做任何「猜行业」「猜真假买家」的推断 ——
 * 判定依据只有一条客观事实：正文或产品名里是否带了外部链接。
 */
export function screenRfqSubmission(input: {
  company?: string | null;
  product?: string | null;
  message?: string | null;
}): RfqScreening {
  const messageLinks = extractLinks(input.message);
  const metaLinks = [
    ...extractLinks(input.product),
    ...extractLinks(input.company),
  ];
  const linkCount = messageLinks.length + metaLinks.length;

  if (linkCount === 0) {
    return { suspicious: false, reason: null, linkCount: 0 };
  }

  const where = [
    messageLinks.length ? "正文" : "",
    extractLinks(input.product).length ? "产品名" : "",
    extractLinks(input.company).length ? "公司名" : "",
  ]
    .filter(Boolean)
    .join("/");

  return {
    suspicious: true,
    reason:
      `${where}含 ${linkCount} 条外部链接` +
      (linkCount >= 3 ? "（疑似链接堆砌）" : "（疑似产品页广告）"),
    linkCount,
  };
}

/**
 * 蜜罐字段判据。
 *
 * 表单里有一个 position:absolute; left:-9999px 的输入框，人看不见、Tab 也到不了，
 * 但多数表单填充脚本会把所有 input 填满。有值 ⇒ 一定是脚本。
 */
export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
