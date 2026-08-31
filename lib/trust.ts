// lib/trust.ts — 公司身份与公开验证信息（Trust Center 数据源）
//
// 设计原则（用户明确要求，不可绕过）：
// 1. 品牌名 ≠ 法律主体。FactoryAuditB2B 是平台/品牌，运营主体是另一家注册公司。
//    页面必须把这两件事分开写，不允许让客户误以为品牌名就是法人名。
// 2. 公开验证，不公开全部隐私。法定代表人姓名、完整注册地址、完整统一社会信用
//    代码一律做部分遮挡后再展示。默认不展示，除非管理员显式配置。
// 3. 不配置就不渲染。没有任何真实信息时，Trust Center 只显示「尚未公开」，
//    绝不填占位公司名、假注册号、假日期。
// 4. 不编造 ISO9001、总部、国家数、审核数、客户数。

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

/** 人名/法定代表人：保留首字符，其余以 * 代替 */
export function maskName(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 1) return "*";
  // 中文名：姓 + **；拉丁名：首字母 + ***
  return /[一-龥]/.test(v[0])
    ? v[0] + "**"
    : v[0] + "*".repeat(Math.max(2, v.length - 1));
}

/** 统一社会信用代码 / 注册号：保留前 4 与后 2，中间打点 */
export function maskCode(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 6) return v[0] + "•".repeat(Math.max(1, v.length - 1));
  return `${v.slice(0, 4)}${"•".repeat(Math.min(12, v.length - 6))}${v.slice(-2)}`;
}

/** 注册地址：保留前 8 与后 4，中间省略 */
export function maskAddress(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 14) return v[0] + "•".repeat(Math.max(1, v.length - 1));
  return `${v.slice(0, 8)} … ${v.slice(-4)}`;
}

export interface TrustConfig {
  /** 是否已配置任何身份信息。false 时 Trust Center 不渲染注册区块 */
  configured: boolean;
  legalEntity: string;
  country: string;
  city: string;
  registrationYear: string;
  registrationStatus: string;
  registrationAuthority: string;
  verificationDate: string;
  documentId: string;
  /** 加水印的营业执照图片路径（public 下） */
  licenseImage: string;
  /** 以下三项为遮挡后的公开值，未配置则为空字符串 */
  legalRepresentative: string;
  registrationNumber: string;
  registeredAddress: string;
  contactEmail: string;
}

export function getTrustConfig(): TrustConfig {
  const legalEntity = env("TRUST_LEGAL_ENTITY");
  const config: TrustConfig = {
    configured: Boolean(legalEntity),
    legalEntity,
    country: env("TRUST_COUNTRY") || "China",
    city: env("TRUST_CITY"),
    registrationYear: env("TRUST_REGISTRATION_YEAR"),
    registrationStatus: env("TRUST_REGISTRATION_STATUS"),
    registrationAuthority: env("TRUST_REGISTRATION_AUTHORITY"),
    verificationDate: env("TRUST_VERIFICATION_DATE"),
    documentId: env("TRUST_DOCUMENT_ID"),
    licenseImage: env("TRUST_LICENSE_IMAGE"),
    legalRepresentative: maskName(env("TRUST_LEGAL_REP")),
    registrationNumber: maskCode(env("TRUST_REGISTRATION_NUMBER")),
    registeredAddress: maskAddress(env("TRUST_REGISTERED_ADDRESS")),
    contactEmail: env("TRUST_CONTACT_EMAIL"),
  };
  return config;
}

/** 水印文案：截图出去也能追溯到用途与文档编号 */
export interface WatermarkInfo {
  line1: string;
  line2: string;
  verified: string;
  documentId: string;
}

export function watermarkInfo(cfg: TrustConfig, verifiedLabel: string): WatermarkInfo {
  return {
    line1: "FOR FACTORYAUDITB2B.COM VERIFICATION ONLY",
    line2: "DO NOT REUSE / DO NOT REDISTRIBUTE",
    verified: cfg.verificationDate
      ? `${verifiedLabel}: ${cfg.verificationDate}`
      : verifiedLabel,
    documentId: cfg.documentId ? `Document ID: ${cfg.documentId}` : "",
  };
}

/** 页脚用的运营主体说明。未配置时返回 null，不渲染任何文字。 */
export function operatorLine(): string | null {
  const cfg = getTrustConfig();
  if (!cfg.configured) return null;
  return cfg.legalEntity;
}
