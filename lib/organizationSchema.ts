// lib/organizationSchema.ts — 全站统一的 Organization JSON-LD
//
// 为什么单独抽一个文件：
//   Organization 是 E-E-A-T（专业度/信任度）的核心结构化数据，Google 用它判断
//   "这家公司是不是真实存在的实体"。全站 20 处 Organization 以前都只有 name + url，
//   信息量太薄，等于告诉 Google "我们只知道有个名字"。
//
// 设计铁律（与 lib/trust.ts 完全一致，不可绕过）：
//   1. **不编造**。营业执照号、法定代表人、注册地址、新加坡实体这些，
//      登记细节一律从 TRUST_* 环境变量读取；没配置就**不输出该字段**，绝不填占位值；
//      法律主体名（legalName）除外 —— 它有 OPERATOR 真实兜底，恒输出。写假的企业信息进结构化数据 = 向 Google 提交虚假主体，风险比不写更大。
//   2. **品牌名 ≠ 法律主体**。FactoryAuditB2B 是平台名，法律主体是另一家公司，
//      两者分开用 name 与 legalName 表达，不让客户误认。
//   3. **脱敏后再公开**。注册号/法人名/地址走 lib/trust.ts 的 mask* 函数。
//   4. 只写能确定的真实信息：域名、logo、覆盖国家（lib/coverage.ts 唯一事实源）、
//      服务领域、客服邮箱（已实测可收发的 support@factoryauditb2b.com）。
//
// 配置方式（二选一，都支持）：
//   · 写进 .env → 构建期内联作为兜底值
//   · `wrangler secret put TRUST_XXX` → 运行时覆盖，**无需重新构建**（OpenNext 的
//     init.js 用 ??= 让 Worker secret 优先级高于 .env，见 MEMORY.md）

import { COVERAGE_COUNTRIES } from "@/lib/coverage";
import { getTrustConfig } from "@/lib/trust";
import { activeSocialLinks } from "@/lib/social";

export const ORG_NAME = "FactoryAuditB2B";
export const ORG_URL = "https://factoryauditb2b.com";

/** 服务领域：只列站点确实在做的业务，不追热词 */
const KNOWS_ABOUT = [
  "Factory audit",
  "Supplier verification",
  "Pre-shipment inspection",
  "Container loading supervision",
  "Social compliance audit",
  "BSCI audit",
  "SMETA audit",
  "Supplier risk assessment",
  "Third-party factory inspection",
];

export type OrganizationOptions = {
  /** 覆盖默认描述（各页可按语境微调，但不得夸大） */
  description?: string;
};

/**
 * 生成 Organization Schema。
 *
 * 必输出：类型、@id、名称、网址、logo、描述、服务地区、服务领域、联系点。
 * 条件输出：法律主体名、成立年份、地址、注册号、邮箱 —— 全部依赖 TRUST_* 配置。
 */
export function organizationSchema(
  options: OrganizationOptions = {},
): Record<string, unknown> {
  const cfg = getTrustConfig();

  const org: Record<string, unknown> = {
    // 🔴 @type 在末尾按"是否真有地址"决定（见下方 assignTypes）：
    //    ProfessionalService 是 LocalBusiness 的子类型，schema.org / Google 对
    //    LocalBusiness 系要求 address。未配置 TRUST_* 时若仍声明 ProfessionalService，
    //    会因缺必填 address 导致**全站每页** schema 校验报错（审计 1,844 例即此）。
    //    故：有真实地址 → ["Organization","ProfessionalService"]；无 → 仅 "Organization"。
    // @id 让其他 Schema（WebSite / WebPage / Service）能用 publisher 引用同一个实体，
    // 避免 Google 把"品牌"和"网站"识别成两个不相关对象。
    "@id": `${ORG_URL}#organization`,
    name: ORG_NAME,
    url: ORG_URL,
    logo: {
      "@type": "ImageObject",
      url: `${ORG_URL}/logo.svg`,
      caption: ORG_NAME,
    },
    // 视觉标识（与 OG/Twitter 同款），供 ProfessionalService 富结果/知识图谱引用
    image: `${ORG_URL}/logo.svg`,
    // 专业服务类型（模板 1：Organization + ProfessionalService 双类型）
    serviceType: "Third-Party B2B Factory Audit & Quality Inspection Services",
    slogan: "Verify before you pay.",
    description:
      options.description ??
      "FactoryAuditB2B helps global buyers discover and verify reliable " +
        "manufacturers across Asia, and helps suppliers demonstrate their " +
        "real capabilities with verified evidence.",
    // 覆盖国家取自 lib/coverage.ts —— 唯一事实源，新增国家会自动同步，无需改这里
    areaServed: COVERAGE_COUNTRIES.map((c) => ({
      "@type": "Country",
      name: c.name,
    })),
    knowsAbout: KNOWS_ABOUT,
    // 社媒档案：帮助搜索引擎/AI 把社交账号关联到本品牌实体（未开通的平台不出现）
    ...(activeSocialLinks().length > 0
      ? { sameAs: activeSocialLinks().map((s) => s.url) }
      : {}),
  };

  // ---- 联系点：只输出真实存在的渠道 ----
  const email = cfg.contactEmail || "support@factoryauditb2b.com";
  const whatsapp = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").trim();
  const contactPoints: Record<string, unknown>[] = [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email,
      availableLanguage: ["en", "zh"],
    },
  ];
  if (whatsapp) {
    contactPoints.push({
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: `+${whatsapp}`,
      contactOption: "TollFree",
      availableLanguage: ["en", "zh"],
    });
  }
  org.contactPoint = contactPoints;

  // ---- 法律主体：品牌名 ≠ 法律主体 ----
  //   cfg.legalEntity 含 OPERATOR 真实兜底（lib/trust.ts），故无条件输出：
  //   全站每一页都必须能回答「你是谁」，不能因为 TRUST_* 没配就只剩一个品牌名。
  if (cfg.legalEntity) {
    org.legalName = cfg.legalEntity;
  }

  // ---- 以下为登记细节，仅在有真实配置时逐项输出（不编造） ----
  if (cfg.configured) {
    if (cfg.registrationYear) {
      org.foundingDate = cfg.registrationYear;
    }
    // 🔴 地址只在有真实登记地址或城市时输出。
    //    cfg.country 默认值 "China" 恒非空，若把它计入条件，会输出一个只含国家的
    //    残缺 address —— 而 ProfessionalService(=LocalBusiness 子类型) 的 address
    //    是必填语义，残缺值比不输出更容易被判失败。
    if (cfg.city || cfg.registeredAddress) {
      org.address = {
        "@type": "PostalAddress",
        // registeredAddress 已过 maskAddress 脱敏；未配置则为空串，此时只给到城市/国家
        ...(cfg.registeredAddress ? { streetAddress: cfg.registeredAddress } : {}),
        ...(cfg.city ? { addressLocality: cfg.city } : {}),
        addressCountry: cfg.country || undefined,
      };
    }
    if (cfg.registrationNumber) {
      // 统一社会信用代码用 identifier 表达，值已过 maskCode 脱敏
      org.identifier = {
        "@type": "PropertyValue",
        name: "Business registration number",
        value: cfg.registrationNumber,
      };
    }
    if (cfg.registrationAuthority) {
      org.identifier = {
        ...((org.identifier as Record<string, unknown>) ?? {}),
        "@type": "PropertyValue",
        name: "Business registration number",
        value: cfg.registrationNumber || undefined,
        ...(cfg.registrationAuthority
          ? { identifierAuthority: cfg.registrationAuthority }
          : {}),
      };
    }
  }

  // 🔴 @type 依"是否真有 address"决定：ProfessionalService(=LocalBusiness 子类型)
  //    在无地址时会被 schema.org / Google 判为缺必填字段，导致全站每页报错。
  const hasAddress = !!org.address;
  org["@type"] = hasAddress
    ? ["Organization", "ProfessionalService"]
    : "Organization";

  return org;
}

/**
 * 配套：WebSite Schema（含站内搜索），与 Organization 用 publisher 关联。
 * 只在需要时调用，避免每页都塞。
 */
export function websiteSchema(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": `${ORG_URL}#website`,
    url: ORG_URL,
    name: ORG_NAME,
    publisher: { "@id": `${ORG_URL}#organization` },
    inLanguage: "en",
  };
}
