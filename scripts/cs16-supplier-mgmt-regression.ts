// scripts/cs16-supplier-mgmt-regression.ts
//
// CS-16（Supplier Management V1）交付回归。
//
// 跑法（DB 段可选；不带 .env 则 DB 段自动 SKIP，其余全部照跑）：
//   node scripts/run-regression.mjs cs16-supplier-mgmt-regression CS16_ROOT
//
// 分层：
//   A 冻结层：en 字典叶子数 + 五处断言同源（2938）
//   B 迁移层：cs16/02_migration.sql 结构（13 列 + supplier_consents + audit 扩展 + RLS）
//   C 字段层：lib/suppliers.ts 三层字段（FREE 含 CS-16 联系/属地，certifications 只在 PAID）
//   D 后台编辑：lib/adminData.ts 白名单 + PATCH 发布闸门 + 编辑页渲染
//   E 注册流：app/api/supplier-register 落库草稿 + consent + audit
//   F 详情页标签：SupplierRegistrationPanel 渲染 "Supplier provided" 来源标签
//   G 数据层（可选）：真实 DB 不变量（已发布 ⇒ profile_authorized 非 false）
//
// ⚠️ 不得使用 top-level await：通用运行器打成 cjs。整段包在 async IIFE 内。

import fs from "node:fs";
import path from "node:path";

const ROOT = (process.env.CS16_ROOT ?? process.cwd()).replace(/\\/g, "/");

// 可选：注入 .env（仅用于 G 段 DB 检查）
try {
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore */
}

let pass = 0;
let fail = 0;
let skip = 0;

function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? "  :: " + extra : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? "  :: " + extra : ""}`);
  }
}
function skipped(name: string, why: string) {
  skip++;
  console.log(`  SKIP  ${name}  :: ${why}`);
}
function section(t: string) {
  console.log("\n=== " + t + " ===");
}
function read(p: string): string {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}
function has(p: string, sub: string): boolean {
  return read(p).includes(sub);
}
function countLeaves(obj: unknown): number {
  if (obj === null || typeof obj !== "object") return 1;
  if (Array.isArray(obj)) return obj.reduce<number>((a, x) => a + countLeaves(x), 0);
  return Object.values(obj as Record<string, unknown>).reduce<number>((a, x) => a + countLeaves(x), 0);
}
function flattenKeys(obj: unknown, prefix = ""): Record<string, true> {
  const out: Record<string, true> = {};
  if (obj === null || typeof obj !== "object") {
    out[prefix] = true;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => Object.assign(out, flattenKeys(v, `${prefix}[${i}]`)));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    Object.assign(out, flattenKeys(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

const EN_LEAF = 2938;

(async () => {
  // =========================================================================
  section("A. 冻结层：en 字典叶子数 + 五处断言同源");
  // =========================================================================
  {
    const en = JSON.parse(read("i18n/dictionaries/en.json"));
    check("A1 en 字典叶子数 = 2938", countLeaves(en) === EN_LEAF, `实际 ${countLeaves(en)}`);
    check("A2 cs06a C8 常量 = 2938", has("scripts/cs06a-directory-regression.ts", "baseKeys.length === 2938"));
    check("A3 cs08 G4 常量 = 2938", has("scripts/cs08-form-regression.ts", "leafCounts[0] === 2938"));
    check("A4 cs12 E4 常量 = 2938", has("scripts/cs12-profile-regression.ts", "enLeaf === 2938"));
    check("A5 cs13 F1i 常量 = 2938", has("scripts/cs13-supplier-seo-regression.ts", "EN_LEAF_COUNT = 2938"));
    check("A6 verify-opennext-bundle 常量 = 2938", has("scripts/verify-opennext-bundle.mjs", "cnt !== 2938") && has("scripts/verify-opennext-bundle.mjs", "(期望 2938)"));
    const locales = ["zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
    const enKeys = JSON.stringify(Object.keys(flattenKeys(en)).sort());
    for (const loc of locales) {
      const o = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
      const ok = JSON.stringify(Object.keys(flattenKeys(o)).sort()) === enKeys;
      check(`A7 ${loc}.json 键集与 en 一致`, ok);
    }
  }

  // =========================================================================
  section("B. 迁移层：supabase/cs16/02_migration.sql");
  // =========================================================================
  {
    const mig = read("supabase/cs16/02_migration.sql");
    const newCols = [
      "province",
      "contact_person",
      "contact_email",
      "whatsapp",
      "company_description",
      "authorized_at",
      "authorized_by",
      "consent_version",
      "consent_ip",
      "consent_user_agent",
      "updated_by",
      "unpublished_at",
      "unpublished_by",
    ];
    const missing = newCols.filter(
      (c) => !mig.includes(`ADD COLUMN IF NOT EXISTS ${c} `) && !mig.includes(`ADD COLUMN IF NOT EXISTS ${c}\n`)
    );
    check("B1 suppliers 新增 13 列齐全", missing.length === 0, missing.join(","));
    check("B2 建表 supplier_consents", mig.includes("CREATE TABLE IF NOT EXISTS public.supplier_consents"));
    check("B3 supplier_consents RLS 开启", mig.includes("ALTER TABLE public.supplier_consents ENABLE ROW LEVEL SECURITY"));
    check("B4 supplier_consents 收回写权限（含 MAINTAIN）", mig.includes("REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.supplier_consents FROM authenticated"));
    check("B5 supplier_consents 仅授权 SELECT", mig.includes("GRANT  SELECT ON public.supplier_consents TO authenticated"));
    check("B6 admin_audit_log 扩展 ip_address", mig.includes("ip_address text"));
    check("B7 admin_audit_log 扩展 notes", mig.includes("notes      text"));
    check("B8 末尾 NOTIFY pgrst（防 PGRST205）", mig.includes("NOTIFY pgrst, 'reload schema'"));
    check("B9 仅加结构不删不改（含 BEGIN/COMMIT）", mig.includes("BEGIN;") && mig.includes("COMMIT;") && !/DROP\s+TABLE/i.test(mig));
  }

  // =========================================================================
  section("C. 字段层：lib/suppliers.ts 三层字段");
  // =========================================================================
  {
    const sup = read("lib/suppliers.ts");
    const freeBlock = sup.slice(sup.indexOf("FREE_FIELDS = ["), sup.indexOf("] as const", sup.indexOf("FREE_FIELDS = [")));
    check("C1 FREE 含 province（CS-16 属地）", freeBlock.includes('"province"'));
    check("C2 FREE 含 contactPerson/contactEmail/whatsapp/companyDescription（CS-16 联系）", ["contactPerson", "contactEmail", "whatsapp", "companyDescription"].every((f) => freeBlock.includes(`"${f}"`)));
    check("C3 FREE 绝不含 certifications（防误放公开层）", !freeBlock.includes('"certifications"'));
    check("C4 PAID 含 certifications", sup.includes('"certifications"') && sup.includes("PAID_FIELDS = ["));
    const m = freeBlock.match(/"[a-zA-Z]+"/g);
    check("C5 FREE 字段数 = 13（与 cs05c B4 同源）", m ? m.length === 13 : false, `实际 ${m ? m.length : 0}`);
  }

  // =========================================================================
  section("D. 后台编辑：白名单 + 发布闸门 + 渲染");
  // =========================================================================
  {
    const admin = read("lib/adminData.ts");
    check("D1 updateAdminSupplier 白名单 website 可为 null", /website:\s*string\s*\|\s*null/.test(admin));
    for (const f of ["english_name", "company_type", "registration_number", "province", "contact_person", "contact_email", "whatsapp", "company_description", "authorized_at", "authorized_by", "consent_version", "updated_by", "unpublished_at", "unpublished_by"]) {
      check(`D2 白名单含 ${f}`, admin.includes(`${f}:`));
    }

    const route = read("app/api/admin/suppliers/route.ts");
    check("D3 PATCH 发布闸门：未授权返回 422 not_authorized", route.includes('"not_authorized"') && route.includes("profile_authorized"));
    check("D4 PATCH 始终写 updated_by（服务端，非客户端）", route.includes("updated_by"));
    check("D5 PATCH 白名单写 english_name/company_type 等新字段", route.includes("patch.english_name") && route.includes("patch.company_type") && route.includes("patch.company_description"));

    const editor = read("components/admin/SupplierEditor.tsx");
    check("D6 编辑页 Publish 在未授权时禁用", editor.includes("canPublish") && editor.includes("publishBlocked"));
    check("D7 编辑页渲染 Authorization 历史块（consent 留痕）", editor.includes("consentHistoryNote") || editor.includes("consentIp") || editor.includes("consentUserAgent"));

    const page = read("app/[locale]/admin/suppliers/[slug]/page.tsx");
    check("D8 编辑页注入 auth / countryOptions / 全量 dict", page.includes("getLatestSupplierConsent") && page.includes("COVERAGE_COUNTRIES") && page.includes("countryOptions"));
  }

  // =========================================================================
  section("E. 注册流：落库草稿 + consent + audit");
  // =========================================================================
  {
    const reg = read("app/api/supplier-register/route.ts");
    check("E1 注册路由导入 service_role 客户端", reg.includes("createAdminClient"));
    check("E2 定义 createSupplierDraft（落库草稿）", reg.includes("async function createSupplierDraft"));
    check("E3 草稿 is_published=false（覆盖默认 true）", reg.includes("is_published: false"));
    check("E4 草稿 profile_authorized = 勾选值", reg.includes("profile_authorized: consentGiven"));
    check("E5 写 supplier_consents（consent_given）", reg.includes('from("supplier_consents").insert') && reg.includes("consent_given"));
    check("E6 写 admin_audit_log action=consent_submitted", reg.includes('action: "consent_submitted"'));
    check("E7 服务端取 UA（不信任客户端）", reg.includes('req.headers.get("user-agent")'));
    check("E8 草稿创建不阻断成功响应（best-effort）", reg.includes("createSupplierDraft({") && reg.includes("draft?.slug"));
  }

  // =========================================================================
  section("F. 详情页标签：Supplier-provided information");
  // =========================================================================
  {
    const panel = read("components/SupplierRegistrationPanel.tsx");
    check("F1 RegistrationPanelDict 含 provProvided", panel.includes("provProvided: string"));
    check("F2 面板渲染 d.provProvided（来源标签）", panel.includes("{d.provProvided}"));
    check("F3 详情页把 sp（含 provProvided）传给面板", has("app/[locale]/suppliers/[slug]/page.tsx", "SupplierRegistrationPanel data={s} dict={sp}"));
  }

  // =========================================================================
  section("G. 数据层（可选）：真实 DB 不变量");
  // =========================================================================
  {
    const { createAdminClient } = await import("../lib/supabaseAdmin");
    const db = createAdminClient();
    if (!db) {
      skipped("G1 已发布 ⇒ profile_authorized 非 false", "未配置 SUPABASE_SERVICE_ROLE_KEY，跳过 DB 段");
    } else {
      const { data, error } = await db
        .from("suppliers")
        .select("slug, is_published, profile_authorized")
        .eq("is_published", true);
      if (error) {
        check("G1 查询 suppliers 成功", false, error.message);
      } else {
        const rows = data as Array<{ slug: string; is_published: boolean; profile_authorized: boolean | null }>;
        const bad = rows.filter((r) => r.is_published === true && r.profile_authorized === false);
        check("G1 已发布供应商的 profile_authorized 绝不为 false（发布闸门不变量）", bad.length === 0, bad.map((b) => b.slug).join(","));
        const grandfathered = rows.filter((r) => r.profile_authorized === null).length;
        check("G2 存在祖父化种子（profile_authorized=NULL 仍发布）", grandfathered >= 1, `NULL 数=${grandfathered}`);
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`CS-16 回归结果：PASS=${pass}  FAIL=${fail}  SKIP=${skip}`);
  if (fail > 0) process.exit(1);
})();
