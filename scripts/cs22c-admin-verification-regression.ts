// scripts/cs22c-admin-verification-regression.ts
//
// CS-22 / CS-C（Admin Verification Workbench 后台核验工作台）交付回归。
//
// 跑法：
//   node scripts/run-regression.mjs cs22c-admin-verification-regression CS22C_ROOT
//
// 分层：
//   A 数据模型铁律：答案只存 responses_json（无 answers 表）；验证只写 verification_records/verification_items；
//     证据单一表 supplier_evidence（不引入第二套关联）；Online/On-site 两轴独立记录（不混为一态）；不删除历史。
//   B 功能点 1-10 静态守卫（列表 / Assessment Review / Evidence Review / 单项审核 / Reviewer Note /
//     Review Progress / Online Approval / On-site Approval / Verification ID·verified_at·expires_at / Audit Log）
//   C 禁止项守卫：供应商绝不自授 Verified；save_review/request_more_info 不写 verification_records；
//     证据上传不自动产生 Verified；所有 Admin mutation 经 requireAdmin；互斥状态不合并；revoke 只置 REVOKED 不 DELETE。
//   G 线上库核验：凭证注入后跑（缺凭证整段 SKIP）。
//
// ⚠️ 不得 top-level await；整段包在 async IIFE。剥注释只用 scripts/stripComments。

import fs from "node:fs";
import path from "node:path";
import { stripComments } from "./stripComments";

const ROOT = (process.env.CS22C_ROOT ?? process.cwd()).replace(/\\/g, "/");

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
function exists(p: string): boolean {
  return fs.existsSync(path.join(ROOT, p));
}
function has(p: string, sub: string): boolean {
  return read(p).includes(sub);
}
function code(p: string): string {
  const src = read(p);
  if (p.endsWith(".sql")) {
    return src.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
  }
  return stripComments(src);
}

(async () => {
  // =========================================================================
  section("A. 数据模型铁律：答案=responses_json；验证只写 verification_records/items；证据单表；两轴独立；不删历史");
  // =========================================================================
  {
    const repoFiles: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        const rel = `${dir}/${f}`;
        const st = fs.statSync(path.join(ROOT, rel));
        if (st.isDirectory()) {
          if (!["node_modules", ".git", ".next", ".open-next", ".wrangler", "scripts"].includes(f)) walk(rel);
        } else if (/\.(ts|tsx|sql)$/.test(f)) repoFiles.push(rel);
      }
    };
    walk("lib");
    walk("app");
    walk("components");
    walk("supabase");

    // 禁止新建 assessment answers 表 / 第二套证据关联 / 第二套验证表
    const forbiddenTables = ["supplier_assessment_answers", "assessment_answers", "verification_uploads", "assessment_files"];
    for (const f of forbiddenTables) {
      const refs = repoFiles.filter((p) => new RegExp(f, "i").test(code(p)));
      check(`A1 全仓无 ${f} 引用`, refs.length === 0, refs.join(","));
    }

    // verification_items 锚定 assessment_id（CS-22/03 语义）
    const tp = code("lib/trustProfile.ts");
    check("A2 verification_items 写 assessment_id", tp.includes("assessment_id: assessmentId"));
    check("A3 verification_items 写 item_key + supplier_answer",
      tp.includes("item_key: it.item_key") && tp.includes("supplier_answer: it.supplier_answer"));
    check("A4 verification_items 写证据计数 evidence_count", tp.includes("evidence_count: evidenceCounts.get"));

    // Online / On-site 两轴独立：createVerification 单 type，绝不一并写两行
    // 插入行用变量 input.type（单值），决不在同一 insert 里出现 ONLINE/ON_SITE 字面量
    check("A5 createVerification 单 type（不混轴）",
      tp.includes("verification_type: input.type") &&
      !tp.includes('verification_type: "ONLINE"') && !tp.includes('verification_type: "ON_SITE"'));

    // 不删除历史：trustProfile 无 DELETE；revoke 只置 REVOKED
    check("A6 trustProfile 无 DELETE（保留历史）", !/from\("verification_records"\)[\s\S]{0,120}\.delete\(/.test(tp));
    check("A7 revoke 只置 REVOKED（非删除）", tp.includes('status: "REVOKED"'));
  }

  // =========================================================================
  section("B. 功能点 1-10 静态守卫");
  // =========================================================================
  {
    const queuePage = code("app/[locale]/admin/verification/page.tsx");
    const workbenchPage = code("app/[locale]/admin/verification/[supplierId]/page.tsx");
    const reviewRoute = code("app/api/admin/supplier-assessment-review/[supplierId]/route.ts");
    const signedRoute = code("app/api/admin/supplier-evidence-signed/route.ts");
    const wb = code("components/admin/VerificationWorkbench.tsx");
    const tp = code("lib/trustProfile.ts");

    // 1. Admin Supplier Verification 列表
    check("B1 队列页列出提交/审核/待补/回补状态",
      queuePage.includes('["submitted", "under_review", "action_required", "resubmitted"]'));
    check("B2 队列页链接到工作台 /admin/verification/${supplierId}",
      queuePage.includes('`/admin/verification/${r.supplierId}`'));
    check("B3 队列页标记是否已核验（hasVerification）",
      queuePage.includes("hasVerification") && queuePage.includes('eq("status", "ACTIVE")'));
    check("B4 工作台 host 页渲染 VerificationWorkbench",
      workbenchPage.includes("VerificationWorkbench") && workbenchPage.includes("supplierId={supplierId}"));

    // 2. Assessment Review：GET 拉齐模板+答案+逐项审核；组件渲染 72
    check("B5 路由 GET 拉模板 getChecklistTemplates",
      reviewRoute.includes("getChecklistTemplates()"));
    check("B6 路由 GET 拉自评 getSupplierSelfAssessment",
      reviewRoute.includes("getSupplierSelfAssessment(supplierId)"));
    check("B7 路由 GET 返回 itemReview + responses + records + items",
      reviewRoute.includes("itemReview:") && reviewRoute.includes("responses:") &&
      reviewRoute.includes("records,") && reviewRoute.includes("items,"));
    check("B8 组件按模板渲染 72 题（getChecklistTemplates 驱动）",
      wb.includes("templates.map") && wb.includes("sec.questions.map"));

    // 3. Evidence Review：路由聚合 supplier_evidence；组件签名预览
    check("B9 路由 readEvidence 按 item_key 聚合 supplier_evidence",
      reviewRoute.includes('from("supplier_evidence")') && reviewRoute.includes("grouped[key]"));
    check("B10 组件点击预览证据走 supplier-evidence-signed",
      wb.includes('`/api/admin/supplier-evidence-signed?id='));
    check("B11 签名路由查 supplier_evidence 并签 300s 短链",
      signedRoute.includes('from("supplier_evidence")') && signedRoute.includes("createSignedUrl") && signedRoute.includes(", 300)"));

    // 4. Item-level Approve/Reject/Need More Info
    check("B12 单项状态白名单（APPROVED/REJECTED/NEED_MORE_INFO/PENDING）",
      reviewRoute.includes('"APPROVED", "REJECTED", "NEED_MORE_INFO", "PENDING"'));
    check("B13 组件三项按钮 Approve/Reject/Need More Info",
      wb.includes('"APPROVED"') && wb.includes('"REJECTED"') && wb.includes('"NEED_MORE_INFO"'));
    check("B14 组件本地决策 setDecision 写入 decisions",
      wb.includes("function setDecision") && wb.includes("setDecisions"));

    // 5. Reviewer Note
    check("B15 路由 parseReview 清洗 note（≤2000）",
      reviewRoute.includes("note.slice(0, 2000)"));
    check("B16 组件 per-item 文本域 Reviewer note 绑定 setNote",
      wb.includes('placeholder="Reviewer note') && wb.includes("onChange={(e) => setNote"));
    check("B17 路由 approveVerification 把 note 写入 verification_items.reviewer_note",
      reviewRoute.includes("reviewerNote: r?.note ?? null"));

    // 6. Review Progress
    check("B18 组件计算进度 decided/total/flagged",
      wb.includes("progress.decided") && wb.includes("progress.total") && wb.includes("progress.flagged"));
    check("B19 进度非 APPROVED 计为已标记",
      wb.includes("if (d.status !== \"APPROVED\") flagged += 1"));

    // 7. Online Verification Approval → ONLINE 记录
    check("B20 路由 approve_online → ONLINE",
      reviewRoute.includes('const type: VerificationType = action === "approve_onsite" ? "ON_SITE" : "ONLINE";'));
    check("B21 组件 Approve Online 按钮触发 approve_online",
      wb.includes('act("approve_online")'));
    check("B22 createVerification ONLINE 写入 ACTIVE + FAB2B-OV ID",
      tp.includes('verification_type: input.type') && tp.includes('status: "ACTIVE"') &&
      tp.includes('prefix = type === "ON_SITE" ? "FAB2B-OS" : "FAB2B-OV"'));

    // 8. On-site Verification Approval → ON_SITE 记录
    check("B23 路由 approve_onsite → ON_SITE",
      reviewRoute.includes('action === "approve_onsite" ? "ON_SITE" : "ONLINE"'));
    check("B24 组件 Approve On-site 按钮触发 approve_onsite",
      wb.includes('act("approve_onsite")'));
    check("B25 ON_SITE 生成 FAB2B-OS ID（与 ONLINE 不同前缀）",
      tp.includes('"FAB2B-OS"'));

    // 9. Verification ID / verified_at / expires_at
    check("B26 记录写 verification_id（UNIQUE 对外 ID）",
      tp.includes("verification_id: verificationId"));
    check("B27 记录写 verified_at + expires_at（默认 365 天）",
      tp.includes("verified_at: verifiedAt.toISOString()") && tp.includes("expires_at: expiresAt.toISOString()") &&
      tp.includes("DEFAULT_VALIDITY_DAYS = 365"));
    check("B28 组件展示 verification_id / verified_at / expires_at",
      wb.includes("r.verification_id") && wb.includes("r.verified_at") && wb.includes("r.expires_at"));

    // 10. Admin Audit Log
    check("B29 createVerification 写审计 ONLINE/ON_SITE_VERIFICATION_APPROVED",
      tp.includes('"ONLINE_VERIFICATION_APPROVED"') && tp.includes('"ON_SITE_VERIFICATION_APPROVED"'));
    check("B30 路由 save_review 写 ASSESSMENT_REVIEW_SAVED",
      reviewRoute.includes('"ASSESSMENT_REVIEW_SAVED"'));
    check("B31 路由 request_more_info 写 ASSESSMENT_NEEDS_MORE_INFO",
      reviewRoute.includes('"ASSESSMENT_NEEDS_MORE_INFO"'));
    check("B32 审计走复用 admin_audit_log（不新建表）",
      tp.includes('from("admin_audit_log").insert'));
  }

  // =========================================================================
  section("C. 禁止项守卫：不自动 Verified / 所有 Admin mutation 鉴权 / 不混轴 / 不删历史");
  // =========================================================================
  {
    const reviewRoute = code("app/api/admin/supplier-assessment-review/[supplierId]/route.ts");
    const saLib = code("lib/supplierAssessments.ts");
    const evLib = code("lib/supplierEvidence.ts");
    const signedRoute = code("app/api/admin/supplier-evidence-signed/route.ts");
    const queuePage = code("app/[locale]/admin/verification/page.tsx");
    const workbenchPage = code("app/[locale]/admin/verification/[supplierId]/page.tsx");

    // 供应商绝不自授 Verified：提交/保存路径不写 verification_records
    check("C1 自评估提交层不写 verification_records",
      !/verification_records\s*:/.test(saLib) && !/createVerification/.test(saLib));
    check("C2 自评估提交层不写 verified_at / expires_at",
      !/verified_at\s*:/.test(saLib) && !/expires_at\s*:/.test(saLib));

    // save_review / request_more_info 不创建验证记录：persistReview 函数体内不得出现 createVerification
    const persistBlock = reviewRoute.slice(
      reviewRoute.indexOf("async function persistReview"),
      reviewRoute.indexOf("async function approveVerification")
    );
    check("C3 路由 persistReview 不调用 createVerification（只更新自评）",
      !/createVerification/.test(persistBlock));
    check("C4 路由 save_review/request_more_info 分支不写 verification_records",
      reviewRoute.includes('const res = await persistReview(supplierId, review, action, admin);') &&
      !/persistReview[\s\S]{0,400}from\("verification_records"\)/.test(reviewRoute));

    // 证据上传不自动产生 Verified：supplierEvidence 不碰 verification_records / createVerification
    check("C5 证据层不创建验证记录（不自动 Verified）",
      !/verification_records/.test(evLib) && !/createVerification/.test(evLib));

    // 所有 Admin mutation 服务端鉴权
    check("C6 审核路由 GET/POST 首行 requireAdmin",
      reviewRoute.includes("const admin = await requireAdmin();") &&
      (reviewRoute.match(/await requireAdmin\(\)/g) || []).length >= 2);
    check("C7 证据签名路由 requireAdmin", signedRoute.includes("await requireAdmin()"));
    check("C8 队列页 + 工作台 host 页 requireAdmin",
      queuePage.includes("await requireAdmin()") && workbenchPage.includes("await requireAdmin()"));

    // 未授权即拒（401）
    check("C9 路由未授权返回 401",
      reviewRoute.includes('return bad("unauthorized", 401);') && signedRoute.includes('{ ok: false, error: "unauthorized" }, { status: 401 }'));

    // Online/On-site 不合并为单一状态（action 单值，非数组）
    check("C10 批准动作单值（不一次写两轴）",
      reviewRoute.includes('action === "approve_online" || action === "approve_onsite"'));

    // 不删历史（已 A6/A7 覆盖，这里再确认 revoke 路径无 delete）
    check("C11 撤销路径无 DELETE（保留历史）",
      /async function revokeVerification[\s\S]*?\}/.test(code("lib/trustProfile.ts")) &&
      !/revokeVerification[\s\S]{0,600}\.delete\(/.test(code("lib/trustProfile.ts")));
  }

  // =========================================================================
  section("G. 线上库核验（经 .env 注入 SUPABASE 凭证；缺凭证整段 SKIP）");
  //   1) verification_records 可达  2) 无禁止表  3) admin_audit_log 可达且有 action 列
  //   4) verification_records anon 拒  5) supplier_assessments service_role 可读
  //   6) verification_items 含 assessment_id 列  7) supplier_evidence 含 assessment_id/item_key
  // =========================================================================
  {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !svc) {
      skipped("G 段", "缺少 Supabase 凭证（URL/anon/service_role），跳过线上库核验");
    } else {
      const head200 = async (table: string, key: string, cols = "id") => {
        const r = await fetch(`${url}/rest/v1/${table}?select=${cols}&limit=1`, {
          method: "GET",
          headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", Prefer: "count=exact" },
        });
        const range = r.headers.get("content-range");
        const total = range ? Number(range.split("/").pop()) : NaN;
        return { status: r.status, total };
      };
      const notFound = async (table: string, key: string) => {
        const r = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
          headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
        });
        return r.status;
      };

      // G1 verification_records 可达
      const vr = await head200("verification_records", svc);
      check("G1 verification_records 可达（svc）", vr.status === 200 || vr.status === 206, `status ${vr.status}`);

      // G2 禁止表不存在（404）
      const forbidden = ["supplier_assessment_answers", "assessment_answers", "verification_uploads"];
      for (const t of forbidden) {
        const s = await notFound(t, svc);
        check(`G2 禁止表 ${t} 不存在（非 200）`, s !== 200, `status ${s}`);
      }

      // G3 admin_audit_log 可达且有 action 列
      const al = await head200("admin_audit_log", svc, "action");
      check("G3 admin_audit_log 可达且有 action 列", al.status === 200 || al.status === 206, `status ${al.status}`);

      // G4 verification_records anon 被拒
      const vrAnon = await fetch(`${url}/rest/v1/verification_records?select=id&limit=1`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}`, Accept: "application/json" },
      });
      check("G4 verification_records anon 被拒（401/403）",
        vrAnon.status === 401 || vrAnon.status === 403, `status ${vrAnon.status}`);

      // G5 supplier_assessments service_role 可读（审核底座）
      const sa = await head200("supplier_assessments", svc, "item_review_json");
      check("G5 supplier_assessments 可读（svc, 含 item_review_json 列）",
        sa.status === 200 || sa.status === 206, `status ${sa.status}`);

      // G6 verification_items 含 assessment_id 列
      const vi = await head200("verification_items", svc, "assessment_id,item_key");
      check("G6 verification_items 含 assessment_id + item_key 列",
        vi.status === 200 || vi.status === 206, `status ${vi.status}`);

      // G7 supplier_evidence 含 assessment_id + item_key 列
      const ev = await head200("supplier_evidence", svc, "assessment_id,item_key,file_path");
      check("G7 supplier_evidence 含 assessment_id + item_key + file_path 列",
        ev.status === 200 || ev.status === 206, `status ${ev.status}`);
    }
  }

  console.log(`\n---- CS-22C REGRESSION: PASS=${pass} FAIL=${fail} SKIP=${skip} ----`);
  if (fail > 0) process.exitCode = 1;
})();
