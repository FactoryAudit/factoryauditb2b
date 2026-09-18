// scripts/e2e-audit-read.mjs —— 校验后台读层（listAudits / getAuditWorkflow 的 SQL 形状，含 supplier_id）
// 走 Management API（本地无 service_role）。验证控制台页面依赖的数据能正确返回，然后清理。

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
const one = (rows, tag) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${tag}: 无结果`);
  return rows[0];
};

const run = async () => {
  const sup = one(
    await mgmtQuery("SELECT id FROM public.suppliers WHERE is_published = true ORDER BY created_at LIMIT 1;", "pick-supplier"),
    "pick-supplier"
  );
  const supplierId = sup.id;

  const auditUuid = randomUUID();
  const auditCode = `AUD-${rid(8)}`;
  await mgmtQuery(
    `INSERT INTO public.audits (id, audit_code, supplier_id, audit_type, status, product, created_by)
     VALUES ('${auditUuid}', '${auditCode}', '${supplierId}', 'announced', 'in_progress', 'Read-layer test', 'e2e-read');`,
    "insert-audit"
  );

  const finding = one(
    await mgmtQuery(
      `INSERT INTO public.audit_findings (audit_id, severity, description, status)
       VALUES ('${auditUuid}', 'major', 'Blocking fire exit', 'open') RETURNING id;`,
      "insert-finding"
    ),
    "insert-finding"
  );
  await mgmtQuery(
    `INSERT INTO public.corrective_actions (finding_id, description, status) VALUES ('${finding.id}', 'Clear exits', 'open');`,
    "insert-cap"
  );
  await mgmtQuery(
    `INSERT INTO public.audit_evidence (audit_id, supplier_id, finding_id, source, filename, verification_status)
     VALUES ('${auditUuid}', '${supplierId}', '${finding.id}', 'cert_body', 'ISO9001.pdf', 'document_reviewed');`,
    "insert-evidence"
  );

  // ── listAudits 形状（含 supplier_id + 供应商名；用原生 JOIN，因为本端点跑裸 SQL 不走 PostgREST 嵌入语法）──
  const list = one(
    await mgmtQuery(
      `SELECT a.id, a.audit_code, a.supplier_id, a.audit_type, a.status, a.product, a.created_at, s.legal_name
       FROM public.audits a LEFT JOIN public.suppliers s ON s.id = a.supplier_id WHERE a.id = '${auditUuid}';`,
      "list-read"
    ),
    "list-read"
  );
  console.log("✅ listAudits 行:", JSON.stringify(list));
  if (!list.supplier_id) throw new Error("listAudits 缺少 supplier_id");
  console.log("✅ supplier_id 透出:", list.supplier_id);

  // ── getAuditWorkflow 形状（audit + findings + caps + evidence）──
  const wf = one(
    await mgmtQuery(
      `SELECT
         a.id, a.audit_code, a.supplier_id, a.status, a.standard_protocol,
         (SELECT count(*) FROM public.audit_findings f WHERE f.audit_id = a.id) AS findings,
         (SELECT count(*) FROM public.corrective_actions c
            WHERE c.finding_id IN (SELECT id FROM public.audit_findings f WHERE f.audit_id = a.id)) AS caps,
         (SELECT count(*) FROM public.audit_evidence e WHERE e.audit_id = a.id) AS evidence
       FROM public.audits a WHERE a.id = '${auditUuid}';`,
      "wf-read"
    ),
    "wf-read"
  );
  console.log("✅ getAuditWorkflow 行:", JSON.stringify(wf));
  if (wf.findings !== 1 || wf.caps !== 1 || wf.evidence !== 1) {
    throw new Error(`workflow 计数异常: findings=${wf.findings} caps=${wf.caps} evidence=${wf.evidence}`);
  }
  console.log("✅ 读层计数正确: findings/caps/evidence = 1/1/1");

  // 清理
  await mgmtQuery(`DELETE FROM public.audits WHERE id = '${auditUuid}';`, "cleanup");
  const orphan = one(
    await mgmtQuery(`SELECT (SELECT count(*) FROM public.audit_findings WHERE audit_id='${auditUuid}') AS f, (SELECT count(*) FROM public.audit_evidence WHERE audit_id='${auditUuid}') AS e;`, "orphan"),
    "orphan"
  );
  console.log("🧹 清理完成；孤儿 findings/evidence:", orphan.f, "/", orphan.e);
  console.log("DONE");
};

run().catch((e) => {
  console.error("E2E 异常:", e.message);
  process.exit(1);
});
