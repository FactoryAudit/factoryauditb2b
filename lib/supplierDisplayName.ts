/**
 * lib/supplierDisplayName.ts —— 供应商「展示名」的唯一收口（纯函数，无副作用、无 IO）
 *
 * 背景：`suppliers.legal_name` 是**工商登记名**（32 家已发布里 21 家是中文），而公开档案页的
 *   H1 / `<title>` / 列表卡片 / 国家页 / 行业页 / JSON-LD 一律渲染 `legal_name`
 *   ⇒ 英文站与 es/de/fr/pt/ja/ar 的供应商页 H1 全是中文。
 *   `suppliers.english_name`（企业对外自称的英文名）**早已在库里**，
 *   但实测全仓 `app/` 只有后台编辑器读它 —— 公开页从未消费（= 数据就绪、显示不变）。
 *
 * 规则（与站点「中文页用登记名、其余语种用对外英文名」的口径一致）：
 *   · zh / zh-TW → legalName（登记名）
 *   · 其余 8 语  → englishName（trim 后非空）→ 否则回退 legalName
 *
 * 🔴 绝不编造：englishName 缺失/空白时一律回退登记名，**不做任何转写、音译或翻译**。
 *
 * ⚠️ 声称边界：`english_name` 属「企业自述（对外使用名）」，不等于平台核验结果。
 *    调用方若需要同时展示登记名，请**显式另取 `legalName` 并单独标注**（见
 *    `supplierNameDiffersFromLegal`），不要把两者拼进同一个字符串。
 */

/** 供应商名的展示形态（公开页一律用它，别直接读 legalName）。 */
export interface SupplierNameFields {
  legalName: string;
  englishName?: string | null;
}

/**
 * 按语种取供应商展示名。
 * @param locale 站点语言（en / zh / zh-TW / es / de / fr / pt / ja / ar）
 */
export function supplierDisplayName(locale: string, s: SupplierNameFields): string {
  const legal = (s?.legalName ?? "").trim();
  if (locale === "zh" || locale === "zh-TW") return legal;
  const en = (s?.englishName ?? "").trim();
  return en || legal;
}

/**
 * 该语种下「展示名 ≠ 登记名」时为 true。
 * 供详情页决定是否额外标注一行登记名 —— 只有真的换了名字才标注，
 * 免得在英文站给已经是英文名的供应商多出一行重复信息。
 */
export function supplierNameDiffersFromLegal(locale: string, s: SupplierNameFields): boolean {
  return supplierDisplayName(locale, s) !== (s?.legalName ?? "").trim();
}
