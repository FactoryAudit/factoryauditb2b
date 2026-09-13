// scripts/cs02d-leads-regression.ts —— CS-02D「假功能 P0 收口」静态回归（只读，fail 时退出码 1）
//
// 本轮修复的假功能（一等 P0）：
//   migration 008 建好了 public.leads（22 列 + RLS + 4 索引），但**零写入方** ——
//   7 个前端表单 POST /api/lead、供应商入驻/认领 POST 各自路由，
//   三条链路全部「只发邮件、一行不落库」，后台永远查不到任何线索。
//
// 本脚本守护的是「写入链路真的存在且形状正确」，真实落库由
// scripts/cs02d-live-leads.mjs 做线上 POST → DB 往返验证（这里不重复）。
//
// 用法：
//   node scripts/run-regression.mjs cs02d-leads-regression CS02D_ROOT

import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.env.CS02D_ROOT ?? process.cwd();

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  [${detail}]` : ""}`);
  }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

const LEADS_LIB = "lib/leads.ts";
const ROUTE_LEAD = "app/api/lead/route.ts";
const ROUTE_REGISTER = "app/api/supplier-register/route.ts";
const ROUTE_CLAIM = "app/api/supplier-claim/route.ts";
const ADMIN_DATA = "lib/adminData.ts";
const ADMIN_LEADS_PAGE = "app/[locale]/admin/leads/page.tsx";
const ADMIN_LAYOUT = "app/[locale]/admin/layout.tsx";
const ADMIN_OVERVIEW = "app/[locale]/admin/page.tsx";
const ADMIN_LEADS_API = "app/api/admin/leads/route.ts";
const MIGRATION_008 = "supabase/cs07/02_migration.sql";

console.log("\n=== A. lib/leads.ts —— public.leads 的唯一写入层 ===");

check("A1 lib/leads.ts 存在（migration 008 注释里点名的文件）", exists(LEADS_LIB));
const lib = exists(LEADS_LIB) ? read(LEADS_LIB) : "";

check("A2 导出 insertLead（唯一写入入口）", /export\s+async\s+function\s+insertLead\s*\(/.test(lib));
check("A3 导出 makeLeadReferenceId / fitPayload / LEAD_KINDS / LEAD_PAYLOAD_MAX_BYTES",
  /export\s+function\s+makeLeadReferenceId/.test(lib) &&
  /export\s+function\s+fitPayload/.test(lib) &&
  /export\s+const\s+LEAD_KINDS/.test(lib) &&
  /export\s+const\s+LEAD_PAYLOAD_MAX_BYTES/.test(lib));

// 短号字符集：32 个字符，去掉易混淆的 0/O/1/I（与 /api/rfq 的 RFQ-XXXXXX 同字符集）
const alphabetMatch = lib.match(/REF_ALPHABET\s*=\s*"([^"]+)"/);
const alphabet = alphabetMatch ? alphabetMatch[1] : "";
check("A4 短号字符集 32 位", alphabet.length === 32, `实际 ${alphabet.length}`);
check("A5 短号字符集不含易混淆的 0/O/1/I", !/[01OI]/.test(alphabet), alphabet);
check("A6 短号形如 LEAD-XXXXXX（6 位）",
  /REF_LEN\s*=\s*6/.test(lib) && /return\s+`LEAD-\$\{out\}`/.test(lib));

// 撞号：靠重试解决，绝不靠取消 UNIQUE
check("A7 撞号重试 >= 2 次", /MAX_REF_ATTEMPTS\s*=\s*(\d+)/.test(lib) &&
  Number((lib.match(/MAX_REF_ATTEMPTS\s*=\s*(\d+)/) as RegExpMatchArray)[1]) >= 2);
check("A8 只认 Postgres 唯一冲突 23505 / duplicate key（不会把别的错误误判成撞号）",
  /23505/.test(lib) && /duplicate key value violates unique constraint/i.test(lib));
check("A9 明确声明绝不放宽 UNIQUE 约束",
  /绝不.{0,4}取消 UNIQUE|不靠取消约束|绝不通过取消/.test(lib));

// payload：超限显式标记，绝不静默截断
check("A10 payload 上限 = 16KB", /LEAD_PAYLOAD_MAX_BYTES\s*=\s*16\s*\*\s*1024/.test(lib));
check("A11 超限时写入 _truncated + _keys（显式标记）",
  /_truncated/.test(lib) && /_keys/.test(lib));
check("A12 明确声明绝不静默截断", /绝不静默截断|不静默丢/.test(lib));

// 只能走 service_role
check("A13 只走 createAdminClient（service_role，绕 RLS）",
  /import\s+\{\s*createAdminClient\s*\}\s+from\s+"@\/lib\/supabaseAdmin"/.test(lib));
check("A14 绝不 import 浏览器端 supabaseClient",
  !/from\s+"@\/lib\/supabaseClient"/.test(lib) && !/NEXT_PUBLIC_SUPABASE/.test(lib));

// 三类 kind 与 migration CHECK 一致
const kindMatch = read(MIGRATION_008).match(/leads_kind_check\s*\n?\s*CHECK\s*\(kind IN \(([^)]+)\)\)/i)
  ?? read(MIGRATION_008).match(/CHECK\s*\(\s*kind\s+IN\s*\(([^)]+)\)/i);
const ddlKinds = kindMatch
  ? kindMatch[1].split(",").map((s) => s.trim().replace(/'/g, "")).sort()
  : [];
check("A15 LEAD_KINDS 与 migration 008 的 leads_kind_check 完全一致",
  ddlKinds.length === 3 &&
  ddlKinds.join(",") === "buyer_lead,supplier_application,supplier_claim",
  ddlKinds.join(","));
check("A16 三个 kind 字面量都在 lib/leads.ts 里",
  ddlKinds.every((k) => lib.includes(`"${k}"`)), ddlKinds.join(","));

console.log("\n=== B. /api/lead —— 从「只发邮件」升级为「落库 + 发邮件」 ===");
const leadRoute = read(ROUTE_LEAD);
check("B1 引入 insertLead", /import\s+\{\s*insertLead\s*\}\s+from\s+"@\/lib\/leads"/.test(leadRoute));
check("B2 以 buyer_lead 落库", /kind:\s*"buyer_lead"/.test(leadRoute));
check("B3 payload 无损兜底（lead + result 全量入库）",
  /payload:\s*\{\s*lead,\s*result:\s*risk\s*\}/.test(leadRoute));
check("B4 响应返回 referenceId + stored",
  /referenceId/.test(leadRoute) && /stored:\s*saved\.stored/.test(leadRoute));
check("B5 旧键 leadId 仍在（向后兼容，既有前端与回归脚本读它）",
  /leadId:\s*id/.test(leadRoute));
check("B6 落库失败不阻断：邮件仍在 insertLead 之后执行",
  leadRoute.indexOf("await insertLead(") < leadRoute.indexOf("notifyAdminNewLead("));
check("B7 失败方向仍返回 ok:true（数据库抖动不该让用户看到失败）",
  /NextResponse\.json\(\{\s*ok:\s*true/.test(leadRoute));
check("B8 已清掉「去数据库 / 不落库」的旧注释",
  !/去数据库/.test(leadRoute) && !/不再写\s+Prisma/.test(leadRoute));
check("B9 限流仍在最前（解析 body 之前）",
  leadRoute.indexOf("checkRateLimit(") < leadRoute.indexOf("await req.json()"));
check("B10 管理员邮件用短号做标识（可直接反查库）",
  /id:\s*referenceId\s*\?\?\s*id/.test(leadRoute));

console.log("\n=== C. /api/supplier-register —— 入驻申请 / 认证咨询都落库 ===");
const regRoute = read(ROUTE_REGISTER);
const regInsertCount = (regRoute.match(/await insertLead\(/g) ?? []).length;
check("C1 引入 insertLead", /import\s+\{\s*insertLead\s*\}\s+from\s+"@\/lib\/leads"/.test(regRoute));
check("C2 两个分支（入驻申请 + 认证咨询）都落库", regInsertCount === 2, `实际 ${regInsertCount}`);
check("C3 kind = supplier_application", /kind:\s*"supplier_application"/.test(regRoute));
check("C4 旧键 supplierId 仍在（向后兼容）", /supplierId:\s*id/.test(regRoute));
check("C5 旧键 requestId 仍在（认证咨询分支）", /requestId,/.test(regRoute));
check("C6 已清掉「无数据库」的旧注释", !/无数据库/.test(regRoute));

console.log("\n=== D. /api/supplier-claim —— 认领申请落库（语义红线） ===");
const claimRoute = read(ROUTE_CLAIM);
check("D1 引入 insertLead", /import\s+\{\s*insertLead\s*\}\s+from\s+"@\/lib\/leads"/.test(claimRoute));
check("D2 kind = supplier_claim", /kind:\s*"supplier_claim"/.test(claimRoute));
check("D3 旧键 claimId 仍在（向后兼容）", /claimId:\s*id/.test(claimRoute));
check("D4 语义红线仍在：claim 只代表收到申请，绝不等同 verified",
  /不代表|绝不.{0,6}(?:等同|等于).{0,10}(?:verified|核验)|绝不触发任何 Trust/i.test(claimRoute));
check("D5 已清掉「无数据库」的旧注释", !/无数据库/.test(claimRoute));

console.log("\n=== E. 后台可见性（落库必须能被看到，否则等于不存在） ===");
const adminData = read(ADMIN_DATA);
check("E1 adminData 导出 listAdminLeads", /export\s+async\s+function\s+listAdminLeads/.test(adminData));
check("E2 AdminStats 含 newLeads / totalLeads",
  /newLeads:\s*number/.test(adminData) && /totalLeads:\s*number/.test(adminData));
check("E3 getAdminStats 真的查 leads 表（近 7 天 + 全量）",
  (adminData.match(/from\("leads"\)/g) ?? []).length >= 2);
check("E4 /admin/leads 页面存在", exists(ADMIN_LEADS_PAGE));
const leadsPage = exists(ADMIN_LEADS_PAGE) ? read(ADMIN_LEADS_PAGE) : "";
check("E5 /admin/leads 页面有 requireAdmin 闸门（API 可绕过 layout，页面也要自己拦）",
  /await requireAdmin\(\)/.test(leadsPage));
check("E6 /admin/leads 页面 noindex", /robots:\s*\{\s*index:\s*false/.test(leadsPage));
check("E7 后台导航已挂 /admin/leads", read(ADMIN_LAYOUT).includes('"/admin/leads"'));
check("E8 概览页展示线索数（能看到才叫落库）",
  /statNewLeads/.test(read(ADMIN_OVERVIEW)) && /statTotalLeads/.test(read(ADMIN_OVERVIEW)));
check("E9 概览页展示最近线索列表", /a\.recentLeads/.test(read(ADMIN_OVERVIEW)));

console.log("\n=== F. /api/admin/leads —— 状态流转 ===");
const adminLeadsApi = exists(ADMIN_LEADS_API) ? read(ADMIN_LEADS_API) : "";
check("F1 路由存在", exists(ADMIN_LEADS_API));
check("F2 自带 requireAdmin（不依赖 layout）", /await requireAdmin\(\)/.test(adminLeadsApi));
check("F3 非 admin 返 404（不暴露后台存在）",
  /ok:\s*false,\s*error:\s*"not_found"/.test(adminLeadsApi) && /status:\s*404/.test(adminLeadsApi));
check("F4 status 走枚举白名单", /STATUSES\.has\(status\)/.test(adminLeadsApi));
check("F5 白名单用 new Set<string> 显式标注泛型（否则 .has(string) 报 TS2345）",
  /new\s+Set<string>\(/.test(adminLeadsApi));
// 白名单必须与 migration CHECK 同源
const ddlStatuses = (read(MIGRATION_008).match(/CHECK\s*\(\s*status\s+IN\s*\(([^)]+)\)/i)?.[1] ?? "")
  .split(",").map((s) => s.trim().replace(/'/g, "")).sort();
check("F6 LEAD_STATUSES 与 migration 008 的 leads_status_check 完全一致",
  ddlStatuses.length === 5 && ddlStatuses.join(",") === "contacted,lost,new,quoted,won",
  ddlStatuses.join(","));
check("F7 adminData 导出 LEAD_STATUSES 且 API 直接复用（单一事实源，不手写第二份）",
  /export\s+const\s+LEAD_STATUSES/.test(adminData) && /LEAD_STATUSES\s*\}?\s*from\s*"@\/lib\/adminData"/.test(adminLeadsApi));

console.log("\n=== G. 写入方唯一性 —— 不许出现第二个地方直接写 leads ===");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".git" || e.name === ".open-next") continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const allTs = walk("app").concat(walk("components")).concat(walk("lib"));
// 排除脚本自身与 lib/leads.ts（唯一写入方）
const writers = allTs.filter(
  (f) => f !== "lib/leads.ts" && /from\("leads"\)\.insert|from\("leads"\)\s*\n?\s*\.insert/.test(read(f))
);
check("G1 leads 表的 insert 只出现在 lib/leads.ts（写入方唯一）", writers.length === 0, writers.join(","));
const leadsImporters = allTs.filter((f) => /from\s+"@\/lib\/leads"/.test(read(f)));
check("G2 只有 3 个路由 import lib/leads（lead / supplier-register / supplier-claim）",
  leadsImporters.length === 3, leadsImporters.join(","));

console.log("\n=== H. 前端入口没有被删（修复 ≠ 拆功能） ===");
const LEAD_CALLERS = [
  "components/HeroSearch.tsx",
  "components/AuditRequestForm.tsx",
  "components/CustomServiceForm.tsx",
  "components/InspectionRequestForm.tsx",
  "components/SampleReportForm.tsx",
  "components/StandardReportDownloadForm.tsx",
  "components/tools/SupplierRiskCalculator.tsx",
];
for (const c of LEAD_CALLERS) {
  const ok = exists(c) ? read(c).includes('"/api/lead"') : false;
  check(`H ${c.replace("components/", "")} 仍在 POST /api/lead（现在真的会落库）`, ok);
}
check("H8 SupplierRegistrationForm 优先展示落库短号 referenceId",
  /data\.referenceId\s*\|\|\s*data\.supplierId/.test(read("components/SupplierRegistrationForm.tsx")));

console.log("\n=== I. 字典同步（9 新键 × 9 语） ===");
const ADMIN_KEYS = [
  "navLeads", "leadsTitle", "leadsLead", "leadsEmpty",
  "statNewLeads", "statTotalLeads", "recentLeads", "colKind", "colTool",
];
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;
function adminKeys(loc: string): string[] {
  const d = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
  return Object.keys(d.admin ?? {});
}
const enAdmin = adminKeys("en");
const missingEn = ADMIN_KEYS.filter((k) => !enAdmin.includes(k));
check("I1 en.admin 9 个新键齐备", missingEn.length === 0, missingEn.join(","));
let keyMismatch = 0;
for (const loc of LOCALES) {
  const keys = adminKeys(loc);
  if (keys.length !== enAdmin.length || ADMIN_KEYS.some((k) => !keys.includes(k))) keyMismatch++;
}
check("I2 九语 admin 键集与 en 完全一致（getDictionary 无深 fallback）", keyMismatch === 0, String(keyMismatch));
let emptyVal = 0;
for (const loc of LOCALES) {
  const admin = JSON.parse(read(`i18n/dictionaries/${loc}.json`)).admin;
  for (const k of ADMIN_KEYS) {
    if (typeof admin[k] !== "string" || admin[k].trim() === "") emptyVal++;
  }
}
check(`I3 九语 × ${ADMIN_KEYS.length} 键值全部非空`, emptyVal === 0, String(emptyVal));

console.log("\n============================================================");
console.log(`CS-02D leads 回归：${pass} PASS / ${fail} FAIL`);
console.log("============================================================");
if (fail > 0) process.exit(1);
