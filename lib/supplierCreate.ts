// lib/supplierCreate.ts —— 供应商创建：纯校验 + 归一化辅助（无 DB、无 next 依赖）
//
// 这一层刻意保持"纯函数"：
//   - 方便在 Node 测试脚本里直接 import（不需要 Next 运行时）
//   - 所有"高信任字段保护"规则集中在这里，路由层只负责 HTTP 翻译
//
// 安全铁律（CS-03）：
//   高信任字段（verification_level / verification_status 含 Verified /
//   audit_status 含 Audited / inspection_history>0 / risk_breakdown / is_published=true）
//   一旦客户端提交，直接 422 显式拒绝 —— 绝不静默降级。
//   新建供应商永远以 is_published=false / verification_level=unverified 起步，
//   这些硬编码默认值在 lib/adminData.createAdminSupplier 里落地（不在本文件）。

import { clamp } from "./rateLimit";

// ---------- 类型 ----------

export type SupplierCreateInput = {
  slug: string;
  legal_name: string;
  country_code: string;
  city: string;
  industry_code: string | null;
  business_type: string | null;
  established: number | null;
  employees: string | null;
  display_name: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  registration_number: string | null;
  source_url: string | null;
  source_type: string | null;
  source_name: string | null;
  /** 原材料里写的是"声称"的认证显示名；落地为 supplier_certifications SELF_DECLARED */
  certificationClaims: string[];
};

export type ValidationOk = { ok: true; value: SupplierCreateInput };
export type ValidationErr = { ok: false; error: string; status: number };
export type ValidationResult = ValidationOk | ValidationErr;

// ---------- 归一化辅助 ----------

/** 生成 slug 建议：小写、字母数字与连字符，折叠空白与重复连字符。 */
export function slugify(input: string): string {
  const s = clamp(input, 200) ?? "";
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // 去变音
    .replace(/[^a-z0-9]+/g, "-") // 非字母数字 → 连字符
    .replace(/^-+|-+$/g, "") // 去首尾连字符
    .replace(/-{2,}/g, "-") // 折叠
    .slice(0, 120);
}

/** 认证/来源名归一：去首尾空白、折叠内部空白、小写（仅用于别名匹配，不写库）。 */
export function normalizeName(s: string): string {
  return (clamp(s, 200) ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** 提取网址主域名（用于去重，不匹配协议/路径/www）。失败返回 null。 */
export function domainOf(url: string | null): string | null {
  const raw = clamp(url, 400);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// ---------- 校验 ----------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_RE = /^[a-z][a-z-]{1,63}$/;
const WEBSITE_RE = /^https?:\/\/.+/i;

/**
 * 校验并产出"白名单化"的创建输入。
 *
 * 返回结构：
 *   - ok:true  → value（只有被允许的字段，高信任字段一律被剥离）
 *   - ok:false → { error, status }；status 400=格式/必填，422=高信任伪造
 *
 * 注意：verification_level 不在白名单里（统一写 unverified），
 * 但若客户端强行传 verification_level != 'unverified' → 422。
 */
export function validateSupplierCreateInput(
  body: Record<string, unknown>
): ValidationResult {
  // ---- 高信任字段：显式 422 拒绝（在任何白名单处理之前）----
  if (
    typeof body.verification_level === "string" &&
    body.verification_level !== "unverified"
  ) {
    return { ok: false, error: "high_trust_verification_level", status: 422 };
  }
  if (
    typeof body.verification_status === "string" &&
    /verified/i.test(body.verification_status)
  ) {
    return { ok: false, error: "high_trust_verification_status", status: 422 };
  }
  if (
    typeof body.audit_status === "string" &&
    /audited/i.test(body.audit_status)
  ) {
    return { ok: false, error: "high_trust_audit_status", status: 422 };
  }
  const inspRaw = body.inspection_history;
  if (inspRaw !== undefined && inspRaw !== null && inspRaw !== "") {
    const insp = Number(inspRaw);
    if (Number.isFinite(insp) && insp > 0) {
      return { ok: false, error: "high_trust_inspection_history", status: 422 };
    }
  }
  if (body.risk_breakdown !== undefined && body.risk_breakdown !== null && body.risk_breakdown !== "") {
    return { ok: false, error: "high_trust_risk_breakdown", status: 422 };
  }
  if (body.is_published === true) {
    return { ok: false, error: "high_trust_is_published", status: 422 };
  }

  // ---- 必填 ----
  const slug = clamp(body.slug, 120);
  const legal_name = clamp(body.legal_name, 200);
  const country_code = clamp(body.country_code, 64);
  const city = clamp(body.city, 120);

  if (!slug) return { ok: false, error: "invalid_slug", status: 400 };
  if (!legal_name) return { ok: false, error: "invalid_legal_name", status: 400 };
  if (!country_code) return { ok: false, error: "invalid_country_code", status: 400 };
  if (!city) return { ok: false, error: "invalid_city", status: 400 };

  // ---- 格式 ----
  if (!SLUG_RE.test(slug)) return { ok: false, error: "invalid_slug_format", status: 400 };
  if (!COUNTRY_RE.test(country_code))
    return { ok: false, error: "invalid_country_format", status: 400 };

  const website = clamp(body.website, 400);
  if (website && !WEBSITE_RE.test(website))
    return { ok: false, error: "invalid_website", status: 400 };

  // ---- 选填（白名单化）----
  const established = toIntOrNull(body.established);

  // ---- 认证声称：原材料，逐个裁剪，最多 50 条 ----
  let certificationClaims: string[] = [];
  if (Array.isArray(body.certificationClaims)) {
    certificationClaims = (body.certificationClaims as unknown[])
      .map((c) => clamp(c, 120))
      .filter((c): c is string => !!c)
      .slice(0, 50);
  } else if (typeof body.certificationClaims === "string" && body.certificationClaims.trim()) {
    certificationClaims = body.certificationClaims
      .split(/[,\n]/)
      .map((c) => clamp(c.trim(), 120))
      .filter((c): c is string => !!c)
      .slice(0, 50);
  }

  const value: SupplierCreateInput = {
    slug,
    legal_name,
    country_code,
    city,
    industry_code: clamp(body.industry_code, 64),
    business_type: clamp(body.business_type, 64),
    established: established !== null && established >= 0 ? established : null,
    employees: clamp(body.employees, 64),
    display_name: clamp(body.display_name, 200),
    address: clamp(body.address, 400),
    website: website ?? null,
    phone: clamp(body.phone, 64),
    registration_number: clamp(body.registration_number, 120),
    source_url: clamp(body.source_url, 400),
    source_type: clamp(body.source_type, 64),
    source_name: clamp(body.source_name, 200),
    certificationClaims,
  };

  return { ok: true, value };
}
