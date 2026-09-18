// scripts/seed-audit-demo.mjs —— 写一条「已签发 + 可公开验真」的演示审核报告（CS-18 闭环演示）
//
// 走 Supabase Management API（scripts/db-apply-sql.mjs 同一通道），因为本地 .env 不含
// SUPABASE_SERVICE_ROLE_KEY（生产才在 Workers Secrets 里）。这样不依赖 service_role。
//
// 生成显式 UUID，单事务内链式 INSERT（audits → audit_reports → 版本 → 验真记录）。
// SHA-256 由规范化报告文本在本地算出后写入，真实可验。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";

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

const auditUuid = randomUUID();
const reportUuid = randomUUID();
const auditCode = `AUD-${rid(8)}`;
const reportNumber = `FAB-AUD-${new Date().getFullYear()}-${rid(6)}`;
const verificationId = `VFY-${rid(8)}`;
const issuedAt = new Date().toISOString();
const supplierSub = "(SELECT id FROM public.suppliers WHERE is_published = true ORDER BY created_at LIMIT 1)";

// 指纹在签发时算一次并固化（页面只读取，不重算）。用稳定文本（不含子查询），保证可复现。
const hashInput = [
  `report:${reportNumber}`,
  `verify:${verificationId}`,
  `audit_type:announced`,
  `version:1.0`,
  `issued_at:${issuedAt}`,
  "§Scope\nFactory premises, production lines, warehouse, social compliance documentation.",
  "§Findings\n1 critical, 2 major, 3 minor findings identified and documented.",
  "§CAP\nAll major findings closed with verified evidence prior to issuance.",
].join("\n");
const hash = createHash("sha256").update(hashInput, "utf8").digest("hex");

const sql = `
BEGIN;
INSERT INTO public.audits (id, audit_code, supplier_id, audit_type, product, product_category, standard_protocol, status, created_by)
  VALUES ('${auditUuid}', '${auditCode}', ${supplierSub}, 'announced', 'Bluetooth earphones', 'Electronics', 'ISO 9001 + Social Compliance', 'report_issued', 'demo-seed');
INSERT INTO public.audit_reports (id, audit_id, supplier_id, report_number, verification_id, status, visibility, current_version)
  VALUES ('${reportUuid}', '${auditUuid}', ${supplierSub}, '${reportNumber}', '${verificationId}', 'issued', 'public_verification', 1);
INSERT INTO public.audit_report_versions (report_id, version, status, sha256, issued_at, issued_by)
  VALUES ('${reportUuid}', '1.0', 'issued', '${hash}', '${issuedAt}', 'FactoryAuditB2B');
INSERT INTO public.report_verification_records (report_id, verification_id, public_status)
  VALUES ('${reportUuid}', '${verificationId}', 'valid');
COMMIT;
`;

const run = async () => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log("HTTP " + res.status);
  if (!res.ok) {
    console.log(text.slice(0, 2000));
    process.exit(1);
  }
  console.log("✅ 演示报告已签发");
  console.log("report_number   :", reportNumber);
  console.log("verification_id :", verificationId);
  console.log("sha256          :", hash);
  console.log(
    "verify URL       :",
    `${env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://factoryauditb2b.com"}/verify/report/${verificationId}`
  );
};
run().catch((e) => {
  console.error("seed 异常:", e.message);
  process.exit(1);
});
