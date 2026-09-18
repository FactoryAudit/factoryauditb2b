// scripts/e2e-audit-workflow.mjs —— 审核工作流数据层端到端验证（CS-18 / §47 状态机 + §29/§30/§25-28）
//
// 走 Supabase Management API（与 seed / db-apply-sql 同通道）。本地无 service_role，
// 应用层 createAdminClient() 返回 null，故直接用管理通道验证 lib/auditWorkflow.ts 的 SQL 形状与约束：
//   · §47 合法状态链 requested→…→closed 全部可落地（DB CHECK 不拦）
//   · 附 finding（severity CHECK）+ CAP（finding_id FK）+ evidence（source CHECK + supplier_id FK）
//   · getAuditWorkflow 的 JOIN 全景读回正确
//   · 清理：DELETE audits 级联清掉 children

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

// 镜像 lib/audits.ts 的状态机（用于纯 JS 校验，不依赖 DB）
const TRANSITIONS = {
  requested: ["quotation_sent", "cancelled"],
  quotation_sent: ["pending_approval", "cancelled"],
  pending_approval: ["scheduled", "cancelled"],
  scheduled: ["auditor_assigned", "cancelled"],
  auditor_assigned: ["in_progress", "cancelled"],
  in_progress: ["findings_review", "cancelled"],
  findings_review: ["cap_required", "report_draft"],
  cap_required: ["report_draft", "findings_review"],
  report_draft: ["report_issued", "findings_review"],
  report_issued: ["closed"],
  closed: [],
  cancelled: [],
};
const canTransition = (cur, nxt) => cur === nxt || (TRANSITIONS[cur] || []).includes(nxt);

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
  // JS 状态机守卫自检
  console.log("🔒 状态机守卫自检：");
  console.log("   requested→quotation_sent :", canTransition("requested", "quotation_sent") ? "✅允许" : "❌拒绝");
  console.log("   requested→in_progress    :", canTransition("requested", "in_progress") ? "❌误允许" : "✅拒绝");
  console.log("   report_issued→closed     :", canTransition("report_issued", "closed") ? "✅允许" : "❌拒绝");

  const sup = one(
    await mgmtQuery("SELECT id FROM public.suppliers WHERE is_published = true ORDER BY created_at LIMIT 1;", "pick-supplier"),
    "pick-supplier"
  );
  const supplierId = sup.id;

  const auditUuid = randomUUID();
  const auditCode = `AUD-${rid(8)}`;
  await mgmtQuery(
    `INSERT INTO public.audits (id, audit_code, supplier_id, audit_type, status, created_by)
     VALUES ('${auditUuid}', '${auditCode}', '${supplierId}', 'announced', 'requested', 'e2e-wf');`,
    "insert-audit"
  );
  console.log("✅ 初始 requested 审核已写入:", auditCode);

  // §47 合法链（镜像 advanceAuditStatus 允许的跃迁）
  const chain = [
    "quotation_sent",
    "pending_approval",
    "scheduled",
    "auditor_assigned",
    "in_progress",
    "findings_review",
    "report_draft",
    "report_issued",
    "closed",
  ];
  for (const next of chain) {
    await mgmtQuery(`UPDATE public.audits SET status = '${next}', updated_at = now() WHERE id = '${auditUuid}';`, `adv-${next}`);
    const r = one(await mgmtQuery(`SELECT status FROM public.audits WHERE id = '${auditUuid}';`, `read-${next}`), `read-${next}`);
    if (r.status !== next) throw new Error(`状态推进失败: 期望 ${next} 实得 ${r.status}`);
    console.log(`   → ${next} ✅`);
  }

  // 重新拉回 requested 以便挂 finding/CAP/evidence（closed 之后仍可挂，但语义上我们在 in_progress 阶段挂）
  await mgmtQuery(`UPDATE public.audits SET status = 'in_progress', updated_at = now() WHERE id = '${auditUuid}';`, "reset-wip");

  // §29 finding（severity CHECK）
  const finding = one(
    await mgmtQuery(
      `INSERT INTO public.audit_findings (audit_id, severity, description, objective_evidence, status)
       VALUES ('${auditUuid}', 'major', 'Fire exits blocked on 2F', 'Photo taken onsite', 'open') RETURNING id;`,
      "insert-finding"
    ),
    "insert-finding"
  );
  console.log("✅ finding 已写入 (severity=major):", finding.id);

  // §30 CAP（finding_id FK）
  const cap = one(
    await mgmtQuery(
      `INSERT INTO public.corrective_actions (finding_id, description, status) VALUES ('${finding.id}', 'Relocate storage, clear exits', 'open') RETURNING id;`,
      "insert-cap"
    ),
    "insert-cap"
  );
  console.log("✅ corrective_action 已写入 (finding FK):", cap.id);

  // §25-§28 evidence（source CHECK + supplier_id FK）
  const ev = one(
    await mgmtQuery(
      `INSERT INTO public.audit_evidence (audit_id, supplier_id, finding_id, source, filename, verification_status)
       VALUES ('${auditUuid}', '${supplierId}', '${finding.id}', 'cert_body', 'ISO9001.pdf', 'document_reviewed') RETURNING id;`,
      "insert-evidence"
    ),
    "insert-evidence"
  );
  console.log("✅ evidence 已写入 (source=cert_body):", ev.id);

  // 全景读回（镜像 getAuditWorkflow 的 JOIN）
  const wf = one(
    await mgmtQuery(
      `SELECT
         a.audit_code, a.status, a.audit_type,
         (SELECT count(*) FROM public.audit_findings f WHERE f.audit_id = a.id) AS findings,
         (SELECT count(*) FROM public.corrective_actions c
            WHERE c.finding_id IN (SELECT id FROM public.audit_findings f WHERE f.audit_id = a.id)) AS caps,
         (SELECT count(*) FROM public.audit_evidence e WHERE e.audit_id = a.id) AS evidence
       FROM public.audits a WHERE a.id = '${auditUuid}';`,
      "workflow-view"
    ),
    "workflow-view"
  );
  console.log("✅ 工作流全景:", JSON.stringify(wf));

  // 清理（级联）
  await mgmtQuery(`DELETE FROM public.audits WHERE id = '${auditUuid}';`, "cleanup");
  const orphans = one(
    await mgmtQuery(
      `SELECT
         (SELECT count(*) FROM public.audit_findings WHERE audit_id = '${auditUuid}') AS f,
         (SELECT count(*) FROM public.audit_evidence WHERE audit_id = '${auditUuid}') AS e;`,
      "orphan-check"
    ),
    "orphan-check"
  );
  console.log("🧹 已清理主记录；孤儿检查 findings/evidence:", orphans.f, "/", orphans.e, "(应均为 0)");
  console.log("DONE");
};

run().catch((e) => {
  console.error("E2E 异常:", e.message);
  process.exit(1);
});
