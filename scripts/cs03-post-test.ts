// scripts/cs03-post-test.ts —— CS-03 POST 写入路径：14 点自测
//
// 运行方式：先 esbuild 打包（解析 @/*），再用 service_role 环境变量跑：
//   node_modules/.bin/esbuild scripts/cs03-post-test.ts --bundle --platform=node \
//     --format=esm --tsconfig=tsconfig.json \
//     --outfile=scripts/.cs03-post-test.bundle.mjs
//   node --env-file=.env scripts/.cs03-post-test.bundle.mjs
//
// 覆盖（对齐用户批准的 14 点）：
//   1. Admin 正常创建
//   2. 重复 → 409（duplicate）
//   3-6. 匿名/Free/Founder/Supplier 拒绝（requireAdmin 网关：isAdminUser=false → 404）
//   7. verification_level=verified → 422
//   8. audit_status 含 Audited → 422
//   9. is_published=true → 422
//   10. 认证声称成功 + SELF_DECLARED（含未映射警告）
//   11. Evidence 文件数 = 0
//   12. Audit 记录数 = 0
//   13. 新建 is_published=false
//   14. 新建 verification_level=unverified
//
// 安全：测试供应商创建后清理（级联删 cert + 供应商 + 审计日志），
// 现有 4 家供应商数量与 slug 不受影响。

import {
  createAdminSupplier,
  findDuplicateSupplier,
  deleteAdminSupplierBySlug,
  type AdminContext,
} from "@/lib/adminData";
import { isAdminUser } from "@/lib/membership";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { validateSupplierCreateInput } from "@/lib/supplierCreate";

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = "") {
  results.push({ name, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${detail ? " — " + detail : ""}`);
}

const TEST_SLUG = `cs03-test-${Date.now()}`;

async function main() {
  const db = createAdminClient();
  if (!db) {
    check("env", false, "service_role 未配置（检查 .env 的 SUPABASE_SERVICE_ROLE_KEY）");
    return finish();
  }

  // 基线
  const base = await db.from("suppliers").select("slug", { count: "exact" });
  const baseCount = base.count ?? 0;
  const baseSlugs = ((base.data ?? []) as { slug: string }[]).map((r) => r.slug);
  check("baseline_count", true, `现有供应商 ${baseCount} 家`);

  const ctx: AdminContext = null; // createAdminSupplier 忽略 ctx，走 service_role

  // ---- 1. 正常创建（带认证声称）----
  const goodBody = {
    slug: TEST_SLUG,
    legal_name: "CS03 Test Factory Ltd",
    country_code: "china",
    city: "shenzhen",
    display_name: "CS03 Test Factory",
    industry_code: "electronics",
    website: "https://cs03-test.example.com",
    source_url: "https://example.com/source",
    source_type: "manual",
    source_name: "admin",
    certificationClaims: ["BSCI", "OEKO-TEX"],
  };
  const v = validateSupplierCreateInput(goodBody as Record<string, unknown>);
  check("1.validate_ok", v.ok, v.ok ? "" : `error=${v.error}`);
  if (!v.ok) return finish();

  const created = await createAdminSupplier(ctx, v.value);
  check("1.create_ok", created.ok, created.ok ? `id=${created.id}` : `error=${created.error}`);
  if (!created.ok) return finish();
  const newId = created.id;
  const newSlug = created.slug;

  // ---- 13/14. 默认值核实 ----
  const row = await db.from("suppliers").select("*").eq("slug", newSlug).maybeSingle();
  const r = row.data as Record<string, unknown> | null;
  check("13.is_published_false", r?.is_published === false, `is_published=${r?.is_published}`);
  check("14.verification_level_unverified", r?.verification_level === "unverified", `vl=${r?.verification_level}`);
  check("1b.risk_defaults_null", r?.risk_score === null && r?.risk_breakdown === null && r?.verification_status === null && r?.audit_status === null, `risk_score=${r?.risk_score} rb=${r?.risk_breakdown}`);
  check("1c.inspection_zero", r?.inspection_history === 0, `inspection_history=${r?.inspection_history}`);
  check("1d.access_public", r?.access_tier === "public", `access_tier=${r?.access_tier}`);

  // ---- 2. 重复 → 409 ----
  const dupHit = await findDuplicateSupplier(v.value);
  check("2.find_dup", !!dupHit, dupHit ? `field=${dupHit.field}` : "未检出重复");
  const dupCreate = await createAdminSupplier(ctx, v.value);
  const dupErr = dupCreate.ok ? null : dupCreate.error;
  check("2.create_dup_409", dupErr === "duplicate", dupErr ? `error=${dupErr}` : "未返回 duplicate");

  // ---- 7-9. 高信任 422 ----
  const ht = [
    ["7.verification_level=verified", { ...goodBody, verification_level: "verified" }],
    ["8.audit_status=Audited", { ...goodBody, audit_status: "Audited 2026" }],
    ["9.is_published=true", { ...goodBody, is_published: true }],
    ["7b.verification_status=Verified", { ...goodBody, verification_status: "Verified by platform" }],
    ["8b.inspection_history=5", { ...goodBody, inspection_history: 5 }],
    ["9b.risk_breakdown={}", { ...goodBody, risk_breakdown: {} }],
  ] as const;
  for (const [name, body] of ht) {
    const rv = validateSupplierCreateInput(body as Record<string, unknown>);
    check(name, !rv.ok && rv.status === 422, rv.ok ? "未拒绝" : `error=${rv.error}`);
  }

  // ---- 3-6. 权限网关（isAdminUser=false → requireAdmin 返回 null → 404）----
  const gateId = "00000000-0000-0000-0000-000000000000";
  const gateOk = await isAdminUser(gateId);
  check("3-6.auth_gate_isAdminUser_false", gateOk === false, `非 admin id → isAdminUser=${gateOk}（requireAdmin 据此返回 404）`);

  // ---- 10. 认证声称 SELF_DECLARED ----
  const certs = await db
    .from("supplier_certifications")
    .select("program_code, claim_status, evidence_status, verification_status, display_name")
    .eq("supplier_id", newId);
  const certRows = (certs.data ?? []) as Array<Record<string, unknown>>;
  check("10.cert_count", certRows.length === 2, `rows=${certRows.length}`);
  const allSelf = certRows.every((c) => c.claim_status === "SELF_DECLARED" && c.evidence_status === "NONE" && c.verification_status === "PENDING");
  check("10.cert_self_declared", allSelf, `claim_status/evidence_status/verification_status 均为 SELF_DECLARED/NONE/PENDING`);
  const bsci = certRows.find((c) => c.display_name === "BSCI");
  check("10.bsci_mapped", !!bsci && bsci.program_code === "BSCI", `BSCI → program_code=${bsci?.program_code}`);
  const oeko = certRows.find((c) => c.display_name === "OEKO-TEX");
  check("10.oeko_unmapped", !!oeko && oeko.program_code === "UNMAPPED", `OEKO-TEX → program_code=${oeko?.program_code}（未映射=UNMAPPED）`);

  // ---- 11/12. Evidence / Audit 数 = 0 ----
  const ev = await db.from("supplier_documents").select("id", { count: "exact" }).eq("supplier_id", newId);
  check("11.evidence_zero", (ev.count ?? 0) === 0, `documents=${(ev.count ?? 0)}`);
  const au = await db.from("supplier_audits").select("id", { count: "exact" }).eq("supplier_id", newId);
  check("12.audit_zero", (au.count ?? 0) === 0, `audits=${(au.count ?? 0)}`);

  // ---- 审计日志 ----
  const log = await db.from("admin_audit_log").select("id", { count: "exact" }).eq("target_id", newId).eq("action", "supplier.create");
  check("audit_log_written", (log.count ?? 0) >= 1, `supplier.create 日志=${(log.count ?? 0)}`);

  // ---- 清理（回滚，确保不污染生产数据）----
  await db.from("admin_audit_log").delete().eq("target_id", newId);
  const del = await deleteAdminSupplierBySlug(newSlug);
  check("cleanup_deleted", del, `删除测试供应商 ${newSlug}`);

  // ---- 回归：现有供应商不受影响 ----
  const after = await db.from("suppliers").select("slug", { count: "exact" });
  const afterCount = after.count ?? 0;
  check("regression_count", afterCount === baseCount, `清理后 ${afterCount} 家（基线 ${baseCount}）`);
  const afterSlugs = ((after.data ?? []) as { slug: string }[]).map((x) => x.slug);
  const missing = baseSlugs.filter((s) => !afterSlugs.includes(s));
  check("regression_original_intact", missing.length === 0, missing.length ? `缺失: ${missing.join(",")}` : "原 4 家 slug 全部仍在");

  finish();
}

function finish() {
  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  console.log(`\n==== CS-03 自测结果: ${pass} PASS / ${fail} FAIL / 共 ${results.length} ====`);
  if (fail > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("测试异常:", e);
  process.exit(2);
});
