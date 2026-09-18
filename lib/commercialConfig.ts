// lib/commercialConfig.ts —— V2.2 商业/价格单一真源
//
// 为什么存在：
//   之前公开展示价格散落在 i18n 字典（en.json 等）与各页面 JSX 里，
//   出现「Pricing 页 $99 验货 / Inspection 页 $99 / 首页另一套」的漂移
//   （V2.2 Phase 01 扫描确认：commerce.ts 验货 = $99，与 spec 的 $199 冲突）。
//
// 本文件是全站**公开展示价**的单一事实源。规则：
//   1. 所有公开页面读取这里的数字；字典（i18n）只放展示文案，不放裸数字决策。
//   2. 与订单金额真源 lib/commerce.ts 保持数值一致：
//      - commerce.ts.inspection.unitAmountMinor = 19900 ⇔ COMMERCIAL.inspection.startingUsd = 199
//      - commerce.ts.verification_* / factory_audit 同理。
//      历史订单的 amount_minor 落库即定，不受本文件影响（spec §67/§68）。
//   3. 币种一期只有 USD。
//   4. 本文件不 import 任何 DB/网络模块，可被回归脚本直接扫描（spec §39/§70）。
//
// 改一次价格 → 改这里 + 同步 dict 展示串（Phase 05 一致性脚本会报警）。

export const COMMERCIAL = {
  /** 计价币种（一期仅 USD） */
  currency: "USD",

  /** Pricing 版本号。订单表 pricing_version 字段同源，历史订单不受影响。 */
  pricingVersion: "2026-09",

  /** Founding Buyer 会员（可选买家效率工具，非服务，spec §57/§58） */
  membershipAnnualUsd: 99,

  /** 供应商验证（文档/基础尽调，spec §四） */
  supplierVerification: {
    minUsd: 99,
    maxUsd: 129,
  },

  /** 现场工厂审核（spec §四） */
  factoryAudit: {
    startingUsd: 399,
    billing: "per_man_day_plus_travel" as const,
  },

  /** 产品验货（spec §七/§三十六：统一 From USD 199 / man-day） */
  inspection: {
    startingUsd: 199,
    billing: "per_man_day_plus_travel" as const,
  },

  /** 采购服务佣金（spec §九：3–5% + 最低服务费） */
  sourcing: {
    commissionMinPct: 3,
    commissionMaxPct: 5,
    minimumFee: true,
  },

  /** 供应商持续监控（按每家/每年报价，spec §十） */
  monitoring: {
    billing: "quoted_per_supplier_per_year" as const,
  },

  /** 供应商改进（整改/培训/复审/合规，custom 报价，spec §十一） */
  supplierImprovement: {
    billing: "custom_quoted" as const,
  },
} as const;

export type CommercialConfig = typeof COMMERCIAL;

/**
 * 公开展示锚点文案（英文原值，页面按 locale 取字典键）。
 * 仅作集中参考，避免各页自行拼 "$199" 造成漂移。
 */
export const PRICE_ANCHORS = {
  verification: `USD ${COMMERCIAL.supplierVerification.minUsd}–${COMMERCIAL.supplierVerification.maxUsd}`,
  audit: `USD ${COMMERCIAL.factoryAudit.startingUsd}+`,
  inspection: `USD ${COMMERCIAL.inspection.startingUsd}+`,
  membership: `USD ${COMMERCIAL.membershipAnnualUsd}/year`,
  sourcing: `${COMMERCIAL.sourcing.commissionMinPct}–${COMMERCIAL.sourcing.commissionMaxPct}%`,
} as const;
