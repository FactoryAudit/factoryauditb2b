// lib/directoryWall.ts —— 供应商目录「登录墙」脱敏层（阶段 1 增量）
//
// 背景（用户 2026-09-30 拍板，方案 A）：
//   /suppliers 未登录时只展示**脱敏样本** —— 真实公司名不出现在公开 HTML 里；
//   登录后由 /api/suppliers/directory（服务端校验 cookie）下发完整档。
//
// 为什么脱敏必须落在**服务端预渲染那一层**：
//   该页是 ● SSG 预渲染（revalidate = 3600，构建期冻结）。服务端一旦读 cookie 就会
//   退化成 ƒ Dynamic —— 仓库已记录这正是 Cloudflare Workers Free（CPU 10ms/req）
//   下 5xx 的主要来源。所以公开 HTML 恒为「未登录视图」，已登录视图由客户端
//   带 cookie 去授权接口取（与本仓已有的 /api/suppliers/[slug]/unlocked 同一模式）。
//
// 🔴 四条硬约束：
//   1. 锁定视图**不渲染公司名**：legalName / englishName 一律置空，卡片只画骨架条。
//      🔴 2026-10-12 修订：锁定态卡片 href **改为指向真实档案页**（原为登录页）。
//        原因：档案页本身公开（index, follow）且已进 sitemap，目录页若不给内链，
//        32 家档案在站内就 0 入口 ⇒ Google 判「无人引用」⇒ 「已发现·尚未编入索引」
//        （线上实测 1286 条的主因之一）。
//        slug 并未因此新增泄露面 —— 它早已出现在本页 JSON-LD 的 itemListElement.url 里。
//        登录引导改由档案页自身的 UnlockGate 与目录页顶部 DirectoryWallBanner 承担。
//   2. legalName 置**空串**（不是占位文字、不是 "Hidden supplier"）。
//      渲染层见到 locked=true 就画骨架条，绝不渲染 legalName。
//      空串同时让「按名称搜索」自然失效："" 不含任何非空子串，故 q 非空时恒不命中。
//   3. 本文件是**纯函数**，不 import 任何服务端模块 —— 服务端与客户端共用同一份规则，
//      规则只有一处，改也只改这里。
//   4. 解锁视图**不由本文件从锁定数据恢复**（锁定数据已丢失真实名）。解锁数据一律
//      从授权接口重新下发，避免"以为恢复了其实没恢复"的静默错误。

import type { DirectoryEntry, DirectoryItem } from "@/components/supplier/DirectoryView";

/** 访问者视图状态（与服务端预渲染的那一份对应） */
export type DirectoryViewerState = "locked" | "unlocked";

export type MaskOptions = {
  /** 登录页路径（已带语言前缀），如 /login、/es/login */
  loginPath: string;
  /** 目录页路径（已带语言前缀），如 /suppliers、/es/suppliers */
  directoryPath: string;
  /** 档案页前缀（已带语言前缀），如 /suppliers/、/es/suppliers/ */
  supplierPathPrefix: string;
  /**
   * 锁定态卡片 CTA 文案。
   * 🔴 2026-10-12：卡片已改指档案页，故调用方传 suppliers.cardCta（"View Supplier"），
   *    而**不再**是 login.form.submit（"Sign in"）—— 后者会与跳转目标自相矛盾。
   */
  lockedCta: string;
  /** 解锁态卡片 CTA 文案（复用 suppliers.cardCta，如 "View Supplier"） */
  unlockedCta: string;
};

/**
 * 通用登录跳转目标：`/login?next=<目录页>`，登录后回到**目录页**。
 *
 * ⚠️ 刻意不带 next=<具体档案地址>：档案地址含 slug，写进 href 会在公开 HTML 里
 *    留下具体档案地址。
 *    🔴 2026-10-12 起，**目录卡片不再使用本函数** —— 卡片 href 已直接指向档案页
 *    （见 lockDirectoryItems 与文件顶部约束 #1）。本函数现在只服务「没有具体档案可跳」
 *    的两处通用引导：
 *      · /suppliers 页顶部 DirectoryWallBanner 的 "Sign in" 主 CTA
 *      · 首页 "View sample record" 链接（→ /login?next=/suppliers）
 */
export function lockedHref(o: Pick<MaskOptions, "loginPath" | "directoryPath">): string {
  return `${o.loginPath}?next=${encodeURIComponent(o.directoryPath)}`;
}

/**
 * 把一组目录项套上登录墙（未登录视图）。
 *
 * 只动五个字段：legalName / englishName（清空）、href（改指档案页）、locked（true）、
 * cta（锁定态文案）。两个名称字段**必须同时清空** —— 展示名 `supplierDisplayName(locale, x)`
 * 在任何语种下都可能取到 englishName，只清 legalName 会让企业自述英文名漏进公开 HTML。
 * 其余公开维度（国家 / 城市 / 行业 / 产品 / 证据计数 / 核验等级 / 风险分数）**保持不变** ——
 * 这些是"脱敏样本"里仍然可看的公开信息，也是目录筛选与 SEO 的成立基础。
 */
export function lockDirectoryItems(
  items: readonly DirectoryItem[],
  o: MaskOptions
): DirectoryEntry[] {
  return items.map((x) => ({
    ...x,
    legalName: "",
    englishName: "",
    // 🔴 2026-10-12：改为指向**真实档案页**（原为登录页）。
    //   档案页本身公开（index,follow）、可索引，且已提交 sitemap；目录页若不给内链，
    //   它在站内就 0 入口 ⇒ Google 判「无人引用」⇒ 「已发现·尚未编入索引」
    //   （线上实测 1286 条的主因之一）。
    //   slug 不算新增泄露面：它早已出现在本页 JSON-LD 的 itemListElement.url 中。
    href: `${o.supplierPathPrefix}${x.slug}`,
    locked: true,
    cta: o.lockedCta,
  }));
}

/**
 * 把一组目录项解开登录墙（已登录视图：真实名称 + 真实档案地址）。
 *
 * 入参必须是**授权接口重新下发**的完整数据，绝不能是锁定数据 —— 锁定数据里
 * legalName 已被清空，从这里"恢复"只会得到空名字。
 */
export function unlockDirectoryItems(
  items: readonly DirectoryItem[],
  o: MaskOptions
): DirectoryEntry[] {
  return items.map((x) => ({
    ...x,
    href: `${o.supplierPathPrefix}${x.slug}`,
    locked: false,
    cta: o.unlockedCta,
  }));
}
