// lib/supplierCompleteness.ts —— STEP 13 CHANGE SET A1：统一「数据完整度」计算
//
// 为什么要抽出来：
//   STEP 12-B 在 admin/suppliers/[slug] 里用内联 IIFE 算过一次 7 项完整度。
//   STEP 13 的 Lead 列表也要显示完整度 —— 如果再抄一份，就会出现第二套口径。
//   这里做成**纯函数**（无 DB 依赖），详情页 / Lead 列表 / 发布闸门三处共用同一份判定。
//
// 7 项：consent / country / province / city / industry / products / verification
//
// 🔴 状态语义（spec A2：禁止用误导性的绿色"完成"）：
//   PASS     有值且合理
//   MISSING  该有但没有（空 / NULL）
//   UNKNOWN  有值但值是未知占位（"unknown"）或该地理层级尚未确立
//   REJECTED 该记录已被判定为脏数据（非法 slug / 已标记 incomplete）
//
// 🔴 发布闸门（spec A5）：不得自行扩大"必须字段"范围。
//   阻断项 = 现有规则（profile_authorized）+ spec 示例点名的 city / industry / products
//            + country="unknown"（DB 里 country_code NOT NULL，"unknown" 是缺失哨兵值）。
//   consent 只计入完整度得分，**不作阻断**：legacy 已发布供应商本就没有 consent 留痕
//   （STEP 12 刻意不伪造），把它设为阻断等于凭空改变既有发布规则。

/** 脏数据 / 占位 slug 黑名单（与 lib/rfqMatching.ts 同源，STEP 12 已定） */
const DIRTY_SLUGS = new Set(["supplier"]);

export type CompletenessState = "PASS" | "MISSING" | "UNKNOWN" | "REJECTED";

export type CompletenessKey =
  | "consent"
  | "country"
  | "province"
  | "city"
  | "industry"
  | "products"
  | "verification";

export type CompletenessItem = {
  key: CompletenessKey;
  state: CompletenessState;
  /** 展示用原始值（可能为空） */
  value: string;
  labelEn: string;
  labelZh: string;
};

export type SupplierCompleteness = {
  score: number;
  total: number;
  items: CompletenessItem[];
  /** 状态为 PASS 的项 */
  complete: CompletenessKey[];
  /** 状态非 PASS 的项（含 UNKNOWN / REJECTED） */
  missing: CompletenessKey[];
  /** 是否已被标记为脏数据（slug 非法） */
  rejected: boolean;
  /** 是否可发布：已授权 + 零阻断项 + 非脏数据 */
  publishable: boolean;
  /** 阻断原因（英文短语，直接给 Admin 看） */
  blockers: string[];
};

/** 计算完整度所需的最小字段集：Supabase 行 / AdminLeadRow 派生都能构造 */
export type CompletenessInput = {
  slug?: string | null;
  countryCode?: string | null;
  province?: string | null;
  city?: string | null;
  industryCode?: string | null;
  mainProducts?: string[] | null;
  verificationLevel?: string | null;
  verificationStatus?: string | null;
  /** suppliers.consent_version（legacy 行通常为 null） */
  consentVersion?: string | null;
  /** supplier_consents 表里有记录 */
  hasConsentRecord?: boolean;
  profileAuthorized?: boolean | null;
  /**
   * 当前是否已发布。
   * 只影响一处：历史上有若干供应商「已发布但 profile_authorized 为 null」
   * （早于授权机制建立），这是被接受的既有状态；对**已在架上**的行继续报
   * "not authorized" 会让后台看起来像出了新故障。发布闸门本质上管的是
   * 「未发布 → 已发布」这一次跃迁，已在架上的行不在它的管辖范围。
   */
  isPublished?: boolean | null;
};

const UNKNOWN_TOKENS = new Set(["unknown", "n/a", "na", "tbd", "-"]);

function blank(v: unknown): boolean {
  return v == null || String(v).trim() === "";
}

function isUnknownValue(v: unknown): boolean {
  return UNKNOWN_TOKENS.has(String(v ?? "").trim().toLowerCase());
}

/** 字符串类字段的三态判定 */
function tri(v: unknown): CompletenessState {
  if (blank(v)) return "MISSING";
  if (isUnknownValue(v)) return "UNKNOWN";
  return "PASS";
}

const LABEL: Record<CompletenessKey, { en: string; zh: string }> = {
  consent: { en: "Consent", zh: "授权同意" },
  country: { en: "Country", zh: "国家" },
  province: { en: "Province", zh: "省份" },
  city: { en: "City", zh: "城市" },
  industry: { en: "Industry", zh: "行业" },
  products: { en: "Products", zh: "主营产品" },
  verification: { en: "Verification", zh: "核验状态" },
};

/**
 * 计算 7 项完整度。
 *
 * 纯函数：不查库、不发网络请求 —— 详情页传 Supabase 行，Lead 列表传内存里的 Supplier 行，
 * 两边口径保证一致（这是抽它的唯一理由）。
 */
export function supplierCompleteness(input: CompletenessInput): SupplierCompleteness {
  const slug = String(input.slug ?? "");
  const rejected = DIRTY_SLUGS.has(slug);

  const products = Array.isArray(input.mainProducts) ? input.mainProducts.filter((p) => !blank(p)) : [];

  // 核验：verification_level 不是 unverified，或有 verification_status 文本，都算已核验
  const vLevel = String(input.verificationLevel ?? "").trim().toLowerCase();
  const vStatus = String(input.verificationStatus ?? "").trim();
  const verificationOk = (vLevel && vLevel !== "unverified") || vStatus.length > 0;

  const consentOk = Boolean(input.hasConsentRecord) || !blank(input.consentVersion);

  const raw: Array<{ key: CompletenessKey; state: CompletenessState; value: string }> = [
    { key: "consent", state: consentOk ? "PASS" : "MISSING", value: consentOk ? "yes" : "" },
    { key: "country", state: tri(input.countryCode), value: String(input.countryCode ?? "") },
    // province：非中国 canonical 尚未确立（STEP 12 有 3 家刻意留空）⇒ 记 UNKNOWN，不作阻断
    {
      key: "province",
      state: blank(input.province) ? "UNKNOWN" : tri(input.province),
      value: String(input.province ?? ""),
    },
    { key: "city", state: tri(input.city), value: String(input.city ?? "") },
    { key: "industry", state: tri(input.industryCode), value: String(input.industryCode ?? "") },
    {
      key: "products",
      state: products.length > 0 ? "PASS" : "MISSING",
      value: products.slice(0, 3).join(", "),
    },
    {
      key: "verification",
      state: verificationOk ? "PASS" : "MISSING",
      value: vLevel && vLevel !== "unverified" ? vLevel : vStatus || "",
    },
  ];

  const items: CompletenessItem[] = raw.map((r) => ({
    key: r.key,
    state: r.state,
    value: r.value,
    labelEn: LABEL[r.key].en,
    labelZh: LABEL[r.key].zh,
  }));

  const complete = items.filter((i) => i.state === "PASS").map((i) => i.key);
  const missing = items.filter((i) => i.state !== "PASS").map((i) => i.key);

  // —— 发布闸门（服务端与 UI 共用同一份判定，前端隐藏按钮不等于拦住写入）——
  const blockers: string[] = [];
  if (rejected) blockers.push("dirty or incomplete record (slug not usable)");
  // 已在架上的历史行不再追索授权（见 CompletenessInput.isPublished 注释）
  if (input.isPublished !== true && input.profileAuthorized !== true) {
    blockers.push("not authorized (profile_authorized is not true)");
  }
  if (tri(input.city) !== "PASS") blockers.push("missing city");
  if (tri(input.industryCode) !== "PASS") blockers.push("missing industry");
  if (products.length === 0) blockers.push("missing main products");
  if (isUnknownValue(input.countryCode)) blockers.push("country is unknown");

  return {
    score: complete.length,
    total: items.length,
    items,
    complete,
    missing,
    rejected,
    publishable: blockers.length === 0,
    blockers,
  };
}

/** 状态 → 展示文案（后台双语常量约定：不新增 9 语字典键，避免再动冻结常量 2940） */
export function completenessStateLabel(state: CompletenessState, zh: boolean): string {
  if (zh) {
    return state === "PASS" ? "已具备" : state === "MISSING" ? "缺失" : state === "UNKNOWN" ? "未知" : "不合格";
  }
  return state === "PASS" ? "PASS" : state === "MISSING" ? "MISSING" : state === "UNKNOWN" ? "UNKNOWN" : "REJECTED";
}

/** 状态 → 颜色（红/灰/琥珀，禁止一律绿色） */
export function completenessStateClass(state: CompletenessState): string {
  if (state === "PASS") return "bg-[#e7f6ec] text-[#1f7a36]";
  if (state === "UNKNOWN") return "bg-[#fdf3d8] text-[#8a5a00]";
  if (state === "REJECTED") return "bg-[#fdeaea] text-[#d4232a]";
  return "bg-[#eef1f5] text-[#64748b]";
}
