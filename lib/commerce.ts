// lib/commerce.ts —— 商业化层：服务价目表 + 订单号 + 金额（服务端单一事实源）
//
// ─────────────────────────────────────────────────────────────────────────────
// 为什么必须有这个文件（CS-17 Commerce V1）
// ─────────────────────────────────────────────────────────────────────────────
//   在此之前，全站只能收「线索」（leads / rfqs），**一分钱也收不到**：
//   定价页写着 "Online payment is not open yet."，会员按钮降级到 /custom-services。
//   商业化 = 让"我要买"这个动作有落点：订单号 + 金额 + 收款方式 + 后台核销。
//
//   本文件是这四件事的**服务端单一事实源**：
//     · 价目表在这里 —— 前端只能传 serviceCode + quantity，**永远不能传金额**
//       （传金额 = 任何人都能把 $399 的审核改成 $1）
//     · 订单号在这里生成 —— 与 leads 的 LEAD-XXXXXX 同一字符集，运营能口述引用
//     · 金额一律用最小单位整数（美分）—— 浮点存金额是对账事故之源
//
// 铁律：
//   1. **缺失 = 缺失，绝不用 0 顶替**（与 risk_score 同一纪律）。
//      需人工报价的服务 `unitAmountMinor = null`，落库 amount_minor 也是 NULL，
//      渲染「Quoted」，绝不写成 0 —— 0 会被读成"免费"，那是另一个方向的资损。
//   2. 币种一期只有 USD。不预置多币种字段的"以后会用"，避免误配。
//   3. 本文件不 import 任何数据库/网络模块 —— 它要能被回归脚本直接打包扫描。
//
// 价格事实来源（不是拍脑袋，全部取自线上既有定价文案）：
//   i18n/dictionaries/en.json pricing 段：
//     · reportPreview.options.basic        $99
//     · reportPreview.options.professional $129
//     · pricing.plans[].Factory Audit      From $399（"Per man-day plus travel"）
//     · pricing.reports[].Product inspection USD 199+（"Quoted per man-day plus travel"）// V2.2 §7/§36 统一为 $199
//     · pricing.reports[].Supplier due diligence report USD 99 – 129
//   ⇒ 因此：审核/验货按 man-day 计（可带数量），报告类按份计（数量恒为 1）。

/** 订单状态。状态机：pending_payment → paid | cancelled；paid → refunded */
export type OrderStatus = "pending_payment" | "paid" | "cancelled" | "refunded";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_payment",
  "paid",
  "cancelled",
  "refunded",
];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}

/** 允许的状态流转。拒绝 paid → pending_payment 这类"把已付款订单退回未付"的误操作。 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// ---------- 订单号 ----------

// 与 lib/leads.ts 完全一致的字符集：去掉易混淆的 0/O/1/I。
// 订单号要出现在邮件标题、电汇附言、微信沟通里 —— 必须能口述，不能用 UUID。
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REF_LEN = 6;

/** 生成对外订单号：ORD-XXXXXX */
export function makeOrderReferenceId(): string {
  let out = "";
  for (let i = 0; i < REF_LEN; i++) {
    out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `ORD-${out}`;
}

// ---------- 价目表 ----------

export type ServiceCode =
  | "verification_basic"
  | "verification_pro"
  | "factory_audit"
  | "inspection"
  | "monitoring"
  | "custom";

export type ServiceItem = {
  code: ServiceCode;
  nameEn: string;
  nameZh: string;
  /** 单价（USD 美分）。null = 需人工报价，落库 amount_minor 为 NULL */
  unitAmountMinor: number | null;
  /**
   * 可否按数量下单。
   *   审核 / 验货按 man-day 计价 ⇒ true（quantity = man-days）
   *   报告类按份计价 ⇒ false（quantity 恒为 1）
   */
  quantifiable: boolean;
  /** 计价口径（英文，页面按 locale 取字典键 checkout.unit.<code>） */
  unitEn: string;
  unitZh: string;
};

/** 单笔订单的数量上限。防误填 99999 man-days。 */
export const MAX_QUANTITY = 30;

export const SERVICE_CATALOG: readonly ServiceItem[] = [
  {
    code: "verification_basic",
    nameEn: "Supplier verification — basic report",
    nameZh: "供应商核验 — 基础报告",
    unitAmountMinor: 9900,
    quantifiable: false,
    unitEn: "per supplier",
    unitZh: "每家供应商",
  },
  {
    code: "verification_pro",
    nameEn: "Supplier verification — professional due diligence",
    nameZh: "供应商核验 — 专业尽调报告",
    unitAmountMinor: 12900,
    quantifiable: false,
    unitEn: "per supplier",
    unitZh: "每家供应商",
  },
  {
    code: "factory_audit",
    nameEn: "On-site factory audit",
    nameZh: "现场验厂审核",
    unitAmountMinor: 39900,
    quantifiable: true,
    unitEn: "per man-day plus travel",
    unitZh: "每人天，另加差旅",
  },
  {
    code: "inspection",
    nameEn: "Product inspection",
    nameZh: "产品验货",
    // V2.2 §7/§36：统一为 From USD 199 / man-day（原为 $99，与 spec 冲突）。
    // 历史订单的 amount_minor 落库即定，不受此处改动影响（spec §67/§68）。
    unitAmountMinor: 19900,
    quantifiable: true,
    unitEn: "per man-day plus travel",
    unitZh: "每人天，另加差旅",
  },
  {
    code: "monitoring",
    nameEn: "Supplier monitoring",
    nameZh: "供应商持续监控",
    unitAmountMinor: null,
    quantifiable: false,
    unitEn: "quoted per supplier per year",
    unitZh: "按每家供应商每年报价",
  },
  {
    code: "custom",
    nameEn: "Custom scope",
    nameZh: "定制服务范围",
    unitAmountMinor: null,
    quantifiable: false,
    unitEn: "quoted per project",
    unitZh: "按项目报价",
  },
];

export function findService(code: string): ServiceItem | null {
  return SERVICE_CATALOG.find((s) => s.code === code) ?? null;
}

/**
 * 数量归一：不可计数的服务恒为 1；越界/非法一律夹到 [1, MAX_QUANTITY]。
 *
 * 为什么不直接报错：数量不是安全边界（金额与服务端算），
 * 但也不能让 NaN 流进数据库 —— 夹取比拒绝更符合"不因输入怪而丢单"。
 */
export function normalizeQuantity(item: ServiceItem, raw: unknown): number {
  if (!item.quantifiable) return 1;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_QUANTITY, Math.round(n)));
}

export type Priced = {
  /** 总金额（USD 美分）。需人工报价时为 null */
  amountMinor: number | null;
  requiresQuote: boolean;
  quantity: number;
};

export function priceOrder(item: ServiceItem, rawQuantity: unknown): Priced {
  const quantity = normalizeQuantity(item, rawQuantity);
  if (item.unitAmountMinor === null) {
    return { amountMinor: null, requiresQuote: true, quantity };
  }
  return {
    amountMinor: item.unitAmountMinor * quantity,
    requiresQuote: false,
    quantity,
  };
}

/**
 * 金额展示。
 *
 * 为什么写 "USD 399" 而不是 "$399"：
 *   全站价格符号有 locale 顺序差异（en/zh/ja `$99`、es/de/fr `99 $`、pt `US$ 99`），
 *   但订单页必须**在跨语言沟通里零歧义**（客户会把订单号+金额抄进电汇单）。
 *   "USD 399" 在任何语言下都是同一个事实，不依赖符号位置。
 *   null ⇒ 返回 null，由调用方渲染「Quoted」—— 绝不当 0。
 */
export function formatUsdMinor(minor: number | null | undefined): string | null {
  if (typeof minor !== "number" || !Number.isFinite(minor)) return null;
  const whole = minor % 100 === 0;
  const value = whole ? String(minor / 100) : (minor / 100).toFixed(2);
  return `USD ${value}`;
}
