/**
 * lib/compliance.ts —— 合规页面的**标识符**（非文案）单一事实源。
 *
 * 为什么邮箱不进 i18n 字典：邮箱地址是**标识符**，9 语通用，翻译它没有意义 ——
 * 与 `SiteFooter.tsx` 底栏邮箱（`support@factoryauditb2b.com` 直接写字面量）同一口径。
 * 放进字典反而会造出 9 份可能漂移的副本。
 *
 * ⚠️ 这是**唯一**的合规联系入口，不要新增「举报专用邮箱」：
 *    仓库里真实存在的域名邮箱只有 support@ / privacy@ / legal@ / admin@ 四个，
 *    编一个 = 对外承诺一个不存在的渠道（用户裁决 2(a)）。
 */
export const COMPLIANCE_EMAIL = "support@factoryauditb2b.com";
