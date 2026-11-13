/**
 * 直接联系通道（手机 / 微信 / WhatsApp 共用一个号码）。
 *
 * 为什么只用一个号码：
 *   用户 2026-11-13 提供的微信二维码与站上已配置的 WhatsApp 号是同一台手机
 *   （NEXT_PUBLIC_WHATSAPP_NUMBER = 8613642606807）。分成两个变量维护，
 *   迟早会出现「改了 WhatsApp 忘了微信」的半失效状态。
 *
 * ⚠️ 二维码是用户提供的微信名片码原件，落在 public/wechat-qr.png（480×480 白底）。
 *    个人名片码长期有效，但用户在微信里「重置二维码」后本图立即失效 —— 换图即可，
 *    不需要改任何代码。不要用群二维码（7 天过期），不要用带时效的参数化二维码。
 */

const RAW = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

/** 纯数字国际格式（如 8613642606807）。未配置时返回空串。 */
export function contactNumber(): string {
  return RAW.replace(/[^\d]/g, "");
}

/** 是否已配置号码。未配置时联系区块只显示邮箱，不渲染点不动的死链。 */
export function contactConfigured(): boolean {
  return contactNumber().length >= 8;
}

/**
 * 国际格式 → 人可读。
 *   8613642606807 → "+86 136 4260 6807"（中国手机按 3-4-4 分组）
 *   其他号码 → "+序号"（不做臆测性分组）
 */
export function contactPhoneDisplay(): string {
  const n = contactNumber();
  if (!n) return "";
  if (n.startsWith("86") && n.length === 13) {
    const rest = n.slice(2);
    return `+86 ${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`;
  }
  return `+${n}`;
}

/** tel: 链接用。E.164 需要前导 +。 */
export function contactTelHref(): string {
  const n = contactNumber();
  return n ? `tel:+${n}` : "";
}

/** 微信二维码资源路径与原始尺寸（写死宽高避免布局抖动）。 */
export const WECHAT_QR_PATH = "/wechat-qr.png";
export const WECHAT_QR_SIZE = 480;
