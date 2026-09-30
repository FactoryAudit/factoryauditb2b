// lib/directoryItems.ts —— 目录卡片的**唯一**数据构造点（阶段 1 抽出）
//
// 为什么抽出来：
//   阶段 1 之后，同一批卡片数据有**两个**消费方：
//     ① `app/[locale]/suppliers/page.tsx` —— 服务端预渲染（锁定视图）
//     ② `app/api/suppliers/directory/route.ts` —— 已登录用户取完整档（解锁视图）
//   如果两处各写一份构造逻辑，迟早会出现「页面显示 85 分 · 接口下发 80 分」
//   这类**静默漂移**：不报错、不 5xx，只是两处对同一家供应商说法不同。
//   所以派生值的算法只允许存在于本文件。
//
// 🔴 三条铁律（与抽取前逐字一致，未做任何语义修改）：
//   1. 公开核验等级只由 `publicVerificationLevel` 决定（`?? 0` 兜底），
//      **绝不**采信 legacy `verification_status`，也**绝不**因「有 N 条证据」而升档。
//   2. 风险色只由**真实分数**决定 —— 无分数 ⇒ 中性灰 `#6d6b66`，
//      绝不用 `overallLevel(x.riskScore ?? 0)`（那是 CRITICAL 的红，
//      等于给一家「尚未评分」的企业涂上最高风险色）。
//   3. 缺失值渲染「—」，绝不用 0 顶替（NULL ≠ 0）。
//
// 本文件只产出 `DirectoryItem`（纯数据）。**可见性**（href / locked / cta）
// 由 `lib/directoryWall.ts` 决定 —— 两个关注点不混在一起。

import { listSupplierDirectory, type SupplierView } from "@/lib/queries";
import { overallLevel, LEVEL_COLOR, type RiskLevel } from "@/lib/riskEngine";
import { getVerificationBadgesForSuppliers } from "@/lib/trustProfile";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import type { BadgeState } from "@/components/supplier/VerificationBadge";
import type { DirectoryItem } from "@/components/supplier/DirectoryView";

/** 分数 + 等级：等级由 overallLevel 推导，文案取字典，不出现 LOW/MODERATE 原始 token */
export function riskLabel(score?: number, labels?: Record<RiskLevel, string>): string {
  if (typeof score !== "number" || !labels) return "—";
  return `${score} / 100 · ${labels[overallLevel(score)]}`;
}

/**
 * 由已取到的供应商集合构造目录卡片数据。
 *
 * @param locale 用于取字典（等级文案、证据文案等全部本地化）
 * @param all    调用方已取到的全量已发布供应商。**由调用方传入**而不是本函数内部查，
 *               这样页面可以复用同一份 `all` 去构造 JSON-LD（避免同一次渲染里
 *               对 Supabase 打两次相同的查询）。
 */
export async function buildDirectoryItems(
  locale: Locale,
  all: readonly SupplierView[]
): Promise<DirectoryItem[]> {
  const t = await getDictionary(locale);
  const s = t.suppliers;
  const sp = t.supplierProfile;
  // PHASE 03（P0）：卡片核验状态与档案页共用同一套等级文案（verification.levelsShort），
  // 不再在目录里另造一份「等级 → 文案」映射。
  const v = t.verification;

  // CS-D：目录卡片徽章 —— 单次批量查询推导状态（服务端唯一权威，见 trustProfile.ts）。
  // stage1.8：范围恒为**全量** —— 过滤在客户端，服务端必须把全量徽章一次性给出，
  //   否则客户端过滤会漏掉状态。
  const badgeMap = await getVerificationBadgesForSuppliers(all.map((x) => x.id));

  return all.map((x) => {
    const hasEvidence = (x.evidenceVerified ?? 0) > 0;
    const level = x.publicVerificationLevel ?? 0;
    return {
      slug: x.slug,
      legalName: x.legalName,
      country: x.country,
      countryLabel: x.countryName ?? x.country.toUpperCase(),
      city: x.city,
      industryCode: x.industryCode ?? "",
      mainProducts: x.mainProducts,
      businessType: x.businessType || "—",
      evidenceText: hasEvidence
        ? s.evidenceDocs.replace("{n}", String(x.evidenceVerified))
        : s.evidenceNone,
      // PHASE 03（P0 修复，2026-09-13）：核验状态必须来自真实数据。
      //   修复前 guangzhou-sunny-food 已有 1 条 VERIFIED 现场审核记录
      //   （verification_level='on_site_audit'、公开等级 Level 3），
      //   在目录卡上却仍显示「未核验」，与它自己的档案页直接矛盾。
      //   level ≥ 1 → levelsShort[level]（与档案页同一字典）；level = 0 → verificationNotYet。
      verificationText: level === 0 ? s.verificationNotYet : v.levelsShort[level],
      riskText: riskLabel(x.riskScore, t.risk.ui.level),
      riskColor:
        typeof x.riskScore === "number"
          ? LEVEL_COLOR[overallLevel(x.riskScore)]
          : "#6d6b66",
      lastCheckedText: x.lastChecked ?? sp.noCheckRecord,
      badgeState: (badgeMap.get(x.id) ?? "NONE") as BadgeState,
    };
  });
}

/** 便捷封装：内部取全量已发布供应商后构造（供只关心卡片的调用方使用）。 */
export async function listDirectoryItems(locale: Locale): Promise<DirectoryItem[]> {
  const all = await listSupplierDirectory();
  return buildDirectoryItems(locale, all);
}
