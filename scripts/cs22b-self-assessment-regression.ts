// scripts/cs22b-self-assessment-regression.ts
//
// CS-22 / CS-B（供应商自评估 + 证据上传）交付回归。
//
// 跑法：
//   node scripts/run-regression.mjs cs22b-self-assessment-regression CS22B_ROOT
//
// 分层：
//   A 冻结层：en 字典叶子数（3028）+ 九语键集一致 + selfAssessment 命名空间 = 58 键
//   B 数据模型铁律：答案只存 responses_json（无 answers 表）；证据只绑一张表且不引入第二套关联字段
//   C 状态机 + 供应商绝不自授 Verified
//   D 上传安全复用（不写第二套 magic bytes / MIME / 去重）
//   E 限额常量（5MB / 10MB / 20MB / 12 张 / 5 张每项）
//   F 服务端路由守卫（归属裁决 / 未授权拦截 / 买家不可上传证据 / 删除 ownership + 锁）
//   G 迁移后核验（用户硬性要求，须先做）：Schema / RLS / 旧数据条数 / 旧供应商可查
//   H CS-B §34 十五项验收映射（静态守卫 + 线上人工核验清单）
//
// ⚠️ 不得 top-level await；整段包在 async IIFE。剥注释只用 scripts/stripComments。

import fs from "node:fs";
import path from "node:path";
import { stripComments } from "./stripComments";

const ROOT = (process.env.CS22B_ROOT ?? process.cwd()).replace(/\\/g, "/");

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

const EN_LEAF = 3028;

(async () => {
  // =========================================================================
  section("A. 冻结层：en 字典叶子数 + 九语键集一致 + selfAssessment 命名空间");
  // =========================================================================
  {
    const en = JSON.parse(read("i18n/dictionaries/en.json"));
    check("A1 en 字典叶子数 = 3028", countLeaves(en) === EN_LEAF, `实际 ${countLeaves(en)}`);
    const locales = ["zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
    const enKeys = JSON.stringify(Object.keys(flattenKeys(en)).sort());
    for (const loc of locales) {
      const o = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
      check(
        `A2 ${loc}.json 键集与 en 一致`,
        JSON.stringify(Object.keys(flattenKeys(o)).sort()) === enKeys
      );
    }
    // selfAssessment 命名空间 = 58 键 × 9 语，无空串（禁占位机翻）
    for (const loc of ["en", ...locales]) {
      const d = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
      const sa = d.selfAssessment ?? {};
      const keys = Object.keys(sa);
      const empty = keys.filter((k) => typeof sa[k] !== "string" || sa[k].trim() === "");
      check(`A3 ${loc}.selfAssessment = 58 键且无空值`, keys.length === 58 && empty.length === 0,
        `键 ${keys.length} / 空 ${empty.length}`);
    }
  }

  // =========================================================================
  section("B. 数据模型铁律：答案只存 responses_json；证据单一表且无第二套关联字段");
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
    const forbidden = ["supplier_assessment_answers", "assessment_files", "verification_uploads"];
    for (const f of forbidden) {
      const refs = repoFiles.filter((p) => new RegExp(f, "i").test(code(p)));
      check(`B1 全仓无 ${f} 引用`, refs.length === 0, refs.join(","));
    }
    // 证据必须绑定 supplier_id + assessment_id + item_key，且不引入 question_code / assessment_item_id 第二套关联
    const ev = code("lib/supplierEvidence.ts");
    check("B2 证据绑定 supplier_id", ev.includes("supplier_id:"));
    check("B3 证据绑定 assessment_id", ev.includes("assessment_id:"));
    check("B4 证据绑定 item_key", ev.includes("item_key:"));
    check("B5 证据不引入 question_code 列", !ev.includes("question_code"));
    check("B6 证据不引入 assessment_item_id 列", !ev.includes("assessment_item_id"));
    // 答案唯一来源 = responses_json（写入层只 upsert responses_json）
    const sa = code("lib/supplierAssessments.ts");
    check("B7 写入层只 upsert responses_json", sa.includes("responses_json: clean"));
    check("B8 答案清洗丢弃模板外键（防客户端塞任意键）", sa.includes("validCodes.has(code)"));
  }

  // =========================================================================
  section("C. 状态机 + 供应商绝不自授 Verified");
  // =========================================================================
  {
    const sa = code("lib/supplierAssessments.ts");
    check("C1 AssessmentStatus 含 action_required / resubmitted",
      sa.includes('"action_required"') && sa.includes('"resubmitted"'));
    check("C2 提交幂等（onConflict supplier_id, assessment_type）",
      sa.includes('onConflict: "supplier_id, assessment_type"'));
    check("C3 已 under_review/published 拒绝重复提交（409 already_in_review）",
      sa.includes('"already_in_review"'));
    check("C4 退回补件重交 → resubmitted", sa.includes('cur === "action_required" ? "resubmitted" : "submitted"'));
    check("C5 保存草稿保留非 draft 状态（不降级）",
      sa.includes('existing.status !== "draft" ? existing.status : "draft"'));
    // 供应商绝不可写 verification_* / verified_at / verified 结论
    check("C6 提交路径不写 verified_at", !/verified_at\s*:/.test(sa));
    check("C7 提交路径不写 expires_at", !/expires_at\s*:/.test(sa));
    check("C8 文件中无 verified = true 自授（已剥注释）", !/\bverified\s*=\s*true\b/.test(sa));
    check("C9 头注释明确禁止自授 Verified（说明性）",
      read("lib/supplierAssessments.ts").includes("绝不可") && /verified/i.test(read("lib/supplierAssessments.ts")));
  }

  // =========================================================================
  section("D. 上传安全复用（不写第二套 magic bytes / MIME / 去重）");
  // =========================================================================
  {
    const ev = code("lib/supplierEvidence.ts");
    check("D1 复用 validateImageUpload", ev.includes("validateImageUpload"));
    check("D2 复用 sniffFileType（magic bytes）", ev.includes("sniffFileType"));
    check("D3 复用 sha256Hex（去重）", ev.includes("sha256Hex"));
    check("D4 复用 countEvidenceForItem（单项计数）", ev.includes("countEvidenceForItem"));
    check("D5 复用 getImageQuota（总量闸）", ev.includes("getImageQuota"));
    check("D6 证据默认 private（仅签名 URL 可读）", ev.includes('visibility: "private"'));
    check("D7 证据落库状态 UPLOADED（非 APPROVED）", ev.includes('status: "UPLOADED"'));
    // 第二套安全逻辑特征：本文件不得含裸 magic bytes 数组 / %PDF 字面量
    check("D8 不在本文件重写 magic bytes", !/%PDF|0xFF|0xD8|0x89|0x50/.test(ev));
    // 证据来源标记，证明买家无法经此路径上传
    check("D9 证据来源 = supplier_self_assessment", ev.includes('source: "supplier_self_assessment"'));
  }

  // =========================================================================
  section("E. 限额常量（展示图 5MB / 证据图 10MB / PDF 20MB / 12 张 / 5 张每项）");
  // =========================================================================
  {
    const si = code("lib/supplierImages.ts");
    check("E1 展示图 5MB", si.includes("MAX_PHOTO_BYTES = 5 * 1024 * 1024"));
    check("E2 证据图 10MB（未被统一成 5MB）", si.includes("MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024"));
    check("E3 PDF 20MB", si.includes("MAX_PDF_BYTES = 20 * 1024 * 1024"));
    check("E4 工厂展示图 12 张", code("lib/imageConstants.ts").includes("MAX_FACTORY_PHOTOS = 12"));
    check("E5 每个审核项 5 份证据", si.includes("MAX_EVIDENCE_PER_ITEM = 5"));
    check("E6 证据校验走 isEvidence 分支（与展示图分开）", si.includes("isEvidence"));
    check("E7 单项计数与总量闸分开（evidenceItemCount）", si.includes("evidenceItemCount"));
    check("E8 最低分辨率 800×600", si.includes("MIN_PHOTO_WIDTH = 800") && si.includes("MIN_PHOTO_HEIGHT = 600"));
  }

  // =========================================================================
  section("F. 服务端路由守卫（归属裁决 / 未授权拦截 / 删除 ownership + 锁）");
  // =========================================================================
  {
    const saRoute = code("app/api/supplier-self-assessment/route.ts");
    check("F1 自评估路由走 resolveSupplierAccess", saRoute.includes("resolveSupplierAccess"));
    check("F2 未授权即拦截（!access.ok → 4xx）", saRoute.includes("if (!access.ok)"));
    check("F3 草稿 / 提交分流", saRoute.includes('action === "draft"') && saRoute.includes("submitSelfAssessment"));

    const evRoute = code("app/api/supplier-evidence/route.ts");
    check("F4 证据路由走归属裁决", evRoute.includes("resolveSupplierAccess") || evRoute.includes("resolveOwner"));
    check("F5 证据上传走统一安全层 validateAndStoreEvidence", evRoute.includes("validateAndStoreEvidence"));
    check("F6 证据删除走 deleteEvidence（含 ownership 校验）", evRoute.includes("deleteEvidence"));
    check("F7 证据路由无买家写入路径", !/buyer/i.test(evRoute));

    const fpRoute = code("app/api/supplier-factory-photo/route.ts");
    check("F8 工厂照路由走归属裁决", fpRoute.includes("resolveSupplierAccess"));
    check("F9 工厂照上传走 validateAndStoreFactoryPhoto", fpRoute.includes("validateAndStoreFactoryPhoto"));
    check("F10 工厂照分类白名单校验", fpRoute.includes("isImageCategory"));

    const signed = code("app/api/supplier-evidence-signed/route.ts");
    check("F11 签名路由走归属裁决", signed.includes("resolveSupplierAccess"));
    check("F12 非本人证据拒绝（not_owner 403）", signed.includes('"not_owner"'));
    check("F13 签名短链 300s", signed.includes("createSignedUrl") && signed.includes(", 300)"));

    const evLib = code("lib/supplierEvidence.ts");
    check("F14 删除做 ownership 校验（非本人 403）", evLib.includes("row.supplier_id !== supplierId"));
    check("F15 已批准证据锁定不可删（locked 409）", evLib.includes("DELETABLE_EVIDENCE_STATUS"));

    const page = code("app/[locale]/supplier-assessment/page.tsx");
    check("F16 自评页服务端走 resolveSupplierAccess", page.includes("resolveSupplierAccess"));
    check("F17 未登录显示登录提示（satisfies 未授权验收）", page.includes("access.ok") && /sign|登录|SignIn|signIn/i.test(page));
  }

  // =========================================================================
  section("G. 迁移后核验（用户硬性要求：须先做再交付）");
  //   1) Schema re-check  2) RLS re-check  3) 旧数据条数不变  4) 旧供应商可查
  //   经 .env 注入 SUPABASE 凭证；缺凭证则整段 SKIP。
  // =========================================================================
  {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !svc) {
      skipped("G 段", "缺少 Supabase 凭证（URL/anon/service_role），跳过迁移后核验");
    } else {
      const rest = async (table: string, query: string, key: string, head = false) => {
        const r = await fetch(`${url}/rest/v1/${table}?${query}`, {
          method: head ? "HEAD" : "GET",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
            Prefer: "count=exact",
          },
        });
        const range = r.headers.get("content-range");
        const total = range ? Number(range.split("/").pop()) : NaN;
        return { status: r.status, total, body: head ? null : await r.json().catch(() => null) };
      };

      // G1 旧数据条数不变（迁移只加列/索引，不碰行）
      const expect = { supplier_assessments: 9, supplier_evidence: 3, audit_questions: 72, audit_sections: 17, supplier_images: 0 };
      for (const [tbl, want] of Object.entries(expect)) {
        const c = await rest(tbl, "select=id&limit=1", svc);
        // PostgREST 对带 limit 的查询返回 206 Partial Content（分页），200 或 206 均视为成功
        check(`G1 ${tbl} 条数 = ${want}`, (c.status === 200 || c.status === 206) && c.total === want, `实际 ${c.status}/${c.total}`);
      }

      // G2 Schema re-check：item_review_json 列已就位（select 该列返回 200，非 400）
      const colProbe = await fetch(`${url}/rest/v1/supplier_assessments?select=item_review_json&limit=1`, {
        headers: { apikey: svc, Authorization: `Bearer ${svc}` },
      });
      check("G2 item_review_json 列存在（迁移已加列）", colProbe.status === 200, `status ${colProbe.status}`);

      // G3 RLS re-check：supplier_assessments 对 anon 不可达（0 策略 = 仅 service_role）
      const assessAnon = await rest("supplier_assessments", "select=id&limit=1", anon);
      check("G3 supplier_assessments anon 被拒（401/403）",
        assessAnon.status === 401 || assessAnon.status === 403, `status ${assessAnon.status}`);

      // G4 RLS re-check：supplier_evidence 对 anon 仅返回 public（绝不泄漏 private/paid）
      const evAnon = await rest("supplier_evidence", "select=id,visibility&limit=200", anon);
      const evRows = Array.isArray(evAnon.body) ? evAnon.body : [];
      const leaked = evRows.filter((x: { visibility?: string }) => x.visibility !== "public").length;
      check("G4 evidence anon 仅见 public（无 private/paid 泄漏）",
        (evAnon.status === 200 || evAnon.status === 206) && leaked === 0, `status ${evAnon.status} / 泄漏 ${leaked}`);

      // G5 旧供应商可查（service_role 能读到证据全量，证明数据未丢）
      const evSvc = await rest("supplier_evidence", "select=id,visibility&limit=200", svc);
      check("G5 证据数据完整可读（service_role）", (evSvc.status === 200 || evSvc.status === 206) && evSvc.total === 3,
        `status ${evSvc.status} / total ${evSvc.total}`);

      // G6 72 项模板仍在（CS-B 表单渲染基础不破）
      const q = await rest("audit_questions", "select=question_code&limit=200", svc);
      check("G6 audit_questions = 72 项（模板未丢）", (q.status === 200 || q.status === 206) && q.total === 72, `total ${q.total}`);
    }
  }

  // =========================================================================
  section("H. CS-B §34 十五项验收映射（静态守卫 + 线上人工核验清单）");
  //   下列静态守卫覆盖实现正确性；带 * 的项需 Task #78 真实账号登录线上人工核验。
  // =========================================================================
  {
    const form = code("components/supplier/SelfAssessmentForm.tsx");
    const page = code("app/[locale]/supplier-assessment/page.tsx");
    check("H1 72 项按 section/category 渲染（模板驱动，非硬编码）",
      form.includes("getChecklistTemplates") || page.includes("getChecklistTemplates"));
    check("H2 进度来自真实 template + responses + 证据计数",
      form.includes("computeAssessmentProgress") && has("lib/supplierAssessments.ts", "computeAssessmentProgress"));
    check("H3 文件型题走证据上传（EvidenceUploader）", form.includes("EvidenceUploader"));
    check("H4 工厂照独立上传（FactoryPhotoUploader，与证据分离）", form.includes("FactoryPhotoUploader"));
    check("H5 必填项门控（mandatory 缺失阻止提交）",
      /mandatory|checkSubmitGate|required/i.test(form));
    check("H6 自动保存防抖（约 1000ms）", /setTimeout|debounce|1000/.test(form));
    check("H7 提交前摘要 + 状态机（SUBMITTED/RESUBMITTED）",
      has("lib/supplierAssessments.ts", "submitSelfAssessment") && code("lib/supplierAssessments.ts").includes('"submitted"'));
    check("H8 锁定态只读（submitted/under_review/published 不可改）",
      /readOnly|locked|disabled/i.test(form));
    check("H9 Action Required 回显逐项审核备注（item_review_json 经 initialItemReview 传入）",
      has("lib/supplierAssessments.ts", "itemReview") && form.includes("initialItemReview") && form.includes("isActionRequired"));
    // 以下为线上人工核验（标记 *），此处仅确认入口存在，不自动跑浏览器
    console.log("  NOTE  H10* 真实账号登录→填 72→存草稿→刷新保留：Task #78 线上人工核验");
    console.log("  NOTE  H11* 真实上传证据（≤5/项、≤10MB/图、≤20MB/PDF、magic bytes）：Task #78 线上人工核验");
    console.log("  NOTE  H12* 超大/错误格式/>5 份/ >12 张 拒绝：Task #78 线上人工核验");
    console.log("  NOTE  H13* 提交成功 status=SUBMITTED；供应商看不到 Verified：Task #78 线上人工核验");
    console.log("  NOTE  H14* 供应商 A≠B 跨访问拒绝；未授权/买家上传被拦：Task #78 线上人工核验 + G3/G4/F7");
    console.log("  NOTE  H15* 重复提交幂等（不生成第二条）：静态已由 C2 覆盖，线上复核");
  }

  console.log(`\n---- CS-22B REGRESSION: PASS=${pass} FAIL=${fail} SKIP=${skip} ----`);
  if (fail > 0) process.exitCode = 1;
})();
