// lib/orderCopy.ts —— 服务 code → 字典文案的映射（CS-17 Commerce V1）
//
// 为什么要单独一个文件：
//   下单页与订单详情页都要显示"服务名 + 计价单位"，且必须按 locale 走字典
//   （项目铁律：永不硬编码文案）。映射写两遍必然漂移，所以集中在这里。
//
// 为什么用结构化类型而不是 Dictionary 全类型：
//   只需要 checkout 命名空间里的这几个键，传全量字典会把页面与整个 dict 类型焊死；
//   结构化类型让这个函数可以单独被回归脚本调用。

type CheckoutCopy = {
  svcVerificationBasic: string;
  svcVerificationPro: string;
  svcFactoryAudit: string;
  svcInspection: string;
  svcMonitoring: string;
  svcCustom: string;
  unitPerSupplier: string;
  unitManDay: string;
  unitQuoted: string;
  quoted: string;
};

const SERVICE_KEYS = {
  verification_basic: "svcVerificationBasic",
  verification_pro: "svcVerificationPro",
  factory_audit: "svcFactoryAudit",
  inspection: "svcInspection",
  monitoring: "svcMonitoring",
  custom: "svcCustom",
} as const;

const UNIT_KEYS = {
  verification_basic: "unitPerSupplier",
  verification_pro: "unitPerSupplier",
  factory_audit: "unitManDay",
  inspection: "unitManDay",
  monitoring: "unitQuoted",
  custom: "unitQuoted",
} as const;

export type ServiceCodeKey = keyof typeof SERVICE_KEYS;

export function isServiceCodeKey(code: string): code is ServiceCodeKey {
  return Object.prototype.hasOwnProperty.call(SERVICE_KEYS, code);
}

/** 服务名（按 locale）。未登记的 code 原样返回，不静默吞掉。 */
export function serviceLabel(t: { checkout: CheckoutCopy }, code: string): string {
  if (!isServiceCodeKey(code)) return code;
  return t.checkout[SERVICE_KEYS[code]];
}

/** 计价单位（按 locale）。 */
export function unitLabel(t: { checkout: CheckoutCopy }, code: string): string {
  if (!isServiceCodeKey(code)) return "";
  return t.checkout[UNIT_KEYS[code]];
}
