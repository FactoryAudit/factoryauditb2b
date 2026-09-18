// scripts/e2e-audit-request.mjs —— 数据层端到端验证（CS-18）
//
// 走 Supabase Management API（与 seed-audit-demo / db-apply-sql 同通道），
// 因为本地 .env 无 SUPABASE_SERVICE_ROLE_KEY，应用层 createAdminClient() 在本地返回 null，
// 审核表对 anon/authenticated 零权限。本脚本用管理通道直接验证两件事：
//   1) 审核请求写入路径（镜像 lib/audits.ts createAuditRequest 的 INSERT 形状 + 约束）
//   2) 报告验真读取路径（镜像 lib/audits.ts getReportByVerificationId 的可见性闸门 + 白名单字段）
//
// 测试用的 requested 审核在确认落地后立即 DELETE（不留噪音数据；status=requested 无子表，CASCADE 安全）。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

function loadEnv(path) {
  try {
    const txt = readFileSync(path, "utf8");
    const env = {};
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
    return env;
  } catch {
    return {};
  }
}
const env = loadEnv(resolve(process.cwd(), ".env"));
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const SITE = env.NEXT_PUBLIC_SUPABASE_URL || "";
const REF = (SITE.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
if (!TOKEN || !REF) {
  console.error("缺少 SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL");
  process.exit(2);
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rid = (n) => Array.from({ length: n }, () => REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]).join("");
const q = (s) => String(s).replace(/'/g, "''");

async function mgmtQuery(sql, tag) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[${tag}] HTTP ${res.status}:`, text.slice(0, 1500));
    throw new Error(`${tag} failed`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const run = async () => {
  // ── 取一个已发布供应商作 FK ──
  const supRows = await mgmtQuery(
    "SELECT id, legal_name FROM public.suppliers WHERE is_published = true ORDER BY created_at LIMIT 1;",
    "pick-supplier"
  );
  if (!Array.isArray(supRows) || supRows.length === 0) {
    console.error("❌ 无可发布供应商（FK 来源缺失）");
    process.exit(1);
  }
  const supplierId = supRows[0].id;
  const supplierName = supRows[0].legal_name;
  console.log("✅ 取到已发布供应商:", supplierName, supplierId);

  // ── 1) 写入一条 requested 审核（镜像 createAuditRequest）──
  const auditUuid = randomUUID();
  const auditCode = `AUD-${rid(8)}`;
  const insertSql = `
    INSERT INTO public.audits
      (id, audit_code, supplier_id, audit_type, product, product_category, standard_protocol,
       preferred_date, previous_audit_available, documents_available, created_by, status)
    VALUES
      ('${auditUuid}', '${auditCode}', '${supplierId}', 'announced', 'Test Bluetooth Module',
       'Electronics', 'ISO 9001', '2026-10-15', true, false, 'e2e-test', 'requested');`;
  await mgmtQuery(insertSql, "insert-audit");
  console.log("✅ 审核请求已写入 (status=requested):", auditCode);

  // ── 读回确认约束通过 + 字段落地 ──
  const back = await mgmtQuery(
    `SELECT audit_code, supplier_id, audit_type, status, product, created_by FROM public.audits WHERE id = '${auditUuid}';`,
    "readback-audit"
  );
  console.log("✅ 读回:", JSON.stringify(back));

  // ── 2) 验真读取路径（镜像 getReportByVerificationId 闸门 + 白名单）──
  const vid = "VFY-2Z7G924S";
  const verifySql = `
    SELECT
      r.report_number, r.verification_id, r.status AS report_status, r.visibility, r.current_version,
      v.public_status,
      s.legal_name AS supplier_name,
      a.audit_type, a.product, a.product_category, a.standard_protocol,
      rv.version, rv.sha256, rv.issued_at
    FROM public.audit_reports r
    LEFT JOIN public.report_verification_records v ON v.verification_id = r.verification_id
    LEFT JOIN public.suppliers s ON s.id = r.supplier_id
    LEFT JOIN public.audits a ON a.id = r.audit_id
    LEFT JOIN public.audit_report_versions rv ON rv.report_id = r.id AND rv.status = 'issued'
    WHERE r.verification_id = '${vid}';`;
  const vrows = await mgmtQuery(verifySql, "verify-read");
  if (!Array.isArray(vrows) || vrows.length === 0) {
    console.error("❌ 验真读取无结果（演示报告 VFY-2Z7G924S 不存在？）");
  } else {
    const r = vrows[0];
    const viewable = r.visibility === "public_verification" && r.report_status === "issued";
    console.log("✅ 验真读取:", JSON.stringify(r));
    console.log(
      viewable
        ? `✅ 可见性闸门通过：public_verification + issued，public_status=${r.public_status}，sha256=${r.sha256 ? "存在" : "缺失"}`
        : `⚠️ 不可公开：visibility=${r.visibility} status=${r.report_status}`
    );
  }

  // ── 清理：删除测试用的 requested 审核（无子表，CASCADE 安全）──
  await mgmtQuery(`DELETE FROM public.audits WHERE id = '${auditUuid}';`, "cleanup-audit");
  console.log("🧹 已清理测试审核:", auditCode);
  console.log("DONE");
};

run().catch((e) => {
  console.error("E2E 异常:", e.message);
  process.exit(1);
});
