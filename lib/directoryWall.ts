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
//   1. 锁定视图里**不得出现 slug** —— slug 本身含公司名（如 guangzhou-sunny-food）。
//      因此锁定态卡片 href 一律指向登录页，且**不携带**具体档案地址（不带 next=档案）。
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
  /** 锁定态卡片 CTA 文案（复用 login.form.submit，如 "Sign in"） */
  lockedCta: string;
  /** 解锁态卡片 CTA 文案（复用 suppliers.cardCta，如 "View Supplier"） */
  unlockedCta: string;
};

/**
 * 锁定态卡片的统一跳转目标：登录后回到**目录页**。
 *
 * ⚠️ 刻意不带 next=<具体档案地址>：档案地址里含 slug，slug 含公司名 ——
 *    把它写进 href 等于在公开 HTML 里把真实名称漏出去。回到目录后，
 *    已登录用户看到的就是完整档，再自己挑即可。
 *    这与用户给首页定的规则一致（首页 "View sample record" → /login?next=/suppliers）。
 */
export function lockedHref(o: Pick<MaskOptions, "loginPath" | "directoryPath">): string {
  return `${o.loginPath}?next=${encodeURIComponent(o.directoryPath)}`;
}

/**
 * 把一组目录项套上登录墙（未登录视图）。
 *
 * 只动四个字段：legalName（清空）、href（改指登录页）、locked（true）、cta（登录文案）。
 * 其余公开维度（国家 / 城市 / 行业 / 产品 / 证据计数 / 核验等级 / 风险分数）**保持不变** ——
 * 这些是"脱敏样本"里仍然可看的公开信息，也是目录筛选与 SEO 的成立基础。
 */
export function lockDirectoryItems(
  items: readonly DirectoryItem[],
  o: MaskOptions
): DirectoryEntry[] {
  const href = lockedHref(o);
  return items.map((x) => ({
    ...x,
    legalName: "",
    href,
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
