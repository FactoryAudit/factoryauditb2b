/**
 * CS-12 回归验证：档案页「工商登记信息 + 工厂自述证书 + 产能」
 *
 * 纯只读源码级校验（不写数据、不发网络请求、不读数据库）。
 * 运行方式：node scripts/run-regression.mjs cs12-profile-regression CS12_ROOT
 *
 * 守护的五件事：
 *   ① **公开边界**：只放开工商登记级；产能属商业情报必须留在 free 层；paid 层一字未动。
 *   ② **两条证书轴不互通**：工厂自述（public）与平台核验（paid / VERIFIED）永不交叉填充。
 *   ③ **自述必须标注自述**：自述证书区块必须渲染 disclaimer，且不得出现核验态徽章。
 *   ④ **同意书字段不外泄**：phone / contact_visibility 不得进公开查询与公开类型。
 *   ⑤ **字典与断言同源**：九语键集一致，en 叶子数与 cs06a C8 常量一致。
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { PUBLIC_FIELDS, FREE_FIELDS, PAID_FIELDS } from "../lib/suppliers";

// 注意：本脚本会被 esbuild 打包后执行，__dirname 不可靠。
const ROOT = process.env.CS12_ROOT ? path.resolve(process.env.CS12_ROOT) : process.cwd();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

const read = (rel: string): string => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
};

const SUP = "lib/suppliers.ts";
const QUERIES = "lib/queries.ts";
const PANEL = "components/SupplierRegistrationPanel.tsx";
const CERT_LIST = "components/CertificationList.tsx";
const PAGE = "app/[locale]/suppliers/[slug]/page.tsx";
const UNLOCKED = "app/api/suppliers/[slug]/unlocked/route.ts";
const CS06A = "scripts/cs06a-directory-regression.ts";
const DICT_DIR = path.join(ROOT, "i18n", "dictionaries");
const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"] as const;

const publicFields = PUBLIC_FIELDS as readonly string[];
const freeFields = FREE_FIELDS as readonly string[];
const paidFields = PAID_FIELDS as readonly string[];

const REG_FIELDS = [
  "englishName",
  "companyType",
  "website",
  "registrationNumber",
  "address",
  "selfReportedCertificates",
];
const CAPACITY_FIELDS = [
  "productionCapacity",
  "monthlyOutput",
  "factorySize",
  "exportSince",
];
const NEW_COLUMNS = [
  "company_type",
  "english_name",
  "production_capacity",
  "monthly_output",
  "factory_size",
  "export_since",
  "self_reported_certificates",
  "address",
  "website",
  "registration_number",
];

// ---------------------------------------------------------------------------
section("A. 公开边界（用户 2026-09-12 拍板：只放开工商登记级）");
// ---------------------------------------------------------------------------
{
  check(
    "A1 PUBLIC 含 6 项工商登记级字段",
    REG_FIELDS.every((f) => publicFields.includes(f)),
    publicFields.join(",")
  );
  check(
    "A2 产能字段必须留在 FREE 层，不得升为 public（商业情报）",
    CAPACITY_FIELDS.every((f) => freeFields.includes(f)) &&
      !CAPACITY_FIELDS.some((f) => publicFields.includes(f))
  );
  check("A3 FREE 层 = 4 项 basic + 4 项产能 + 5 项 CS-16 联系/属地 = 13", freeFields.length === 13, String(freeFields.length));
  check(
    "A4 🔴 paid 层四项一字未动（付费墙未被本次扩容动过）",
    paidFields.length === 4 &&
      ["evidence", "inspectionHistory", "riskBreakdown", "certifications"].every((f) =>
        paidFields.includes(f)
      ),
    paidFields.join(",")
  );
  check(
    "A5 🔴 未把 paid 的 certifications 降级为 public（CS-05b 不变式）",
    !publicFields.includes("certifications") && !freeFields.includes("certifications")
  );
  check(
    "A6 🔴 自述证书不得进 paid 层（否则会拿到「平台已核验」的口径）",
    !paidFields.includes("selfReportedCertificates")
  );
  check("A7 联系方式字段不在任何可见层（同意书管辖，CS-12 不开放）", !publicFields.includes("phone"));
  check(
    "A8 字段清单仍由 lib/suppliers.ts 单一事实源导出（未在别处复制一份）",
    read(SUP).includes("export const PUBLIC_FIELDS") &&
      read(SUP).includes("export const FREE_FIELDS") &&
      read(SUP).includes("export const PAID_FIELDS")
  );
}

// ---------------------------------------------------------------------------
section("B. 读取层（ROW_SELECT 与归一化）");
// ---------------------------------------------------------------------------
{
  const q = read(QUERIES);
  // 跨行块匹配：参数可能被折行，绝不按单行 token 判定（本项目铁律）
  const rowSelect = (q.match(/ROW_SELECT\s*=\s*`[\s\S]*?`/) ?? [""])[0];
  check("B1 ROW_SELECT 块存在", rowSelect.length > 0);
  check(
    "B2 ROW_SELECT 已含全部 10 个新列",
    NEW_COLUMNS.every((c) => new RegExp(`\\b${c}\\b`).test(rowSelect)),
    NEW_COLUMNS.filter((c) => !new RegExp(`\\b${c}\\b`).test(rowSelect)).join(",")
  );
  check(
    "B3 🔴 ROW_SELECT 不含 phone / contact_visibility / profile_authorized（同意书字段）",
    !/\bphone\b/.test(rowSelect) &&
      !/contact_visibility/.test(rowSelect) &&
      !/profile_authorized/.test(rowSelect)
  );
  check(
    "B4 🔴 SupplierRow 类型里也没有 phone（TS 层阻断误用）",
    !/\bphone\s*:/.test(q)
  );
  check(
    "B5 自述证书归一化：非数组返回 undefined（脏行不得让整站回落静态数据）",
    /function parseSelfReportedCerts[\s\S]*?if \(!Array\.isArray\(raw\)\) return undefined;/.test(q)
  );
  check(
    "B6 自述证书四键与入驻表单序列化形状一致（name/number/issued/expires）",
    /type SelfReportedCertificate\s*=\s*\{[\s\S]*?name: string;[\s\S]*?number: string;[\s\S]*?issued: string;[\s\S]*?expires: string;/.test(
      q
    )
  );
}

// ---------------------------------------------------------------------------
section("C. 展示层（区块落位与自述标注）");
// ---------------------------------------------------------------------------
{
  const page = read(PAGE);
  const panel = read(PANEL);
  const certList = read(CERT_LIST);

  check("C1 档案页渲染登记信息区块", page.includes("<SupplierRegistrationPanel"));
  check("C2 档案页渲染自述证书区块", page.includes("<SupplierSelfReportedCerts"));
  check(
    "C3 自述证书区块排在平台已核验内容之后（版面顺序即可信度差异）",
    page.indexOf("<SupplierSelfReportedCerts") > page.indexOf("<AuditHistoryPanel")
  );
  check(
    "C4 🔴 自述证书区块必须渲染 disclaimer（工厂自述 ≠ 平台核验）",
    panel.includes("selfCertDisclaimer") && panel.includes("id=\"profile-self-certs\"")
  );
  check(
    "C5 🔴 自述证书区块不得出现 verified 核验态徽章（颜色与徽章本身就是断言）",
    !/variant="verified"/.test(panel) && !/statusValid/.test(panel)
  );
  check("C6 登记信息区块带稳定锚点 id（供线上烟雾定位）", panel.includes("id=\"profile-registration\""));
  check(
    "C7 颁发日期与到期日期都渲染（用户明确要求的两个字段）",
    panel.includes("c.issued") && panel.includes("c.expires")
  );
  check(
    "C8 🔴 平台已核验证书清单补渲染颁发日期（issueDate 此前躺在数据里没被用过）",
    certList.includes("c.issueDate") && certList.includes("d.issuedOn")
  );
  check(
    "C9 档案页产能卡片走 free 层门禁（四个字段名齐全）",
    CAPACITY_FIELDS.every((f) => page.includes(`"${f}"`))
  );
}

// ---------------------------------------------------------------------------
section("D. 解锁接口（FREE 层新增字段）");
// ---------------------------------------------------------------------------
{
  const u = read(UNLOCKED);
  check(
    "D1 unlocked 接口在 free 分支内补出 4 项产能字段",
    CAPACITY_FIELDS.every((f) => u.includes(`fields.${f}`))
  );
  check(
    "D2 🔴 产能字段必须在 free 分支内（不得越档下发）",
    (() => {
      // ⚠️ 必须匹配**语句**而非裸 token：本文件 §1b 的注释里也写着 `canAccess(tier, "paid")`，
      //    用 indexOf 找裸 token 会命中注释，导致断言恒假（本轮就踩过一次）。
      const i = u.search(/if \(canAccess\(effectiveTier, "free"\)\)/);
      const j = u.search(/if \(canAccess\(tier, "paid"\)\)/);
      const k = u.indexOf("fields.productionCapacity");
      return i > -1 && j > -1 && k > i && k < j;
    })()
  );
  check(
    "D3 🔴 paid 分支仍只认真实 tier（防篡改 localStorage）",
    u.includes('canAccess(tier, "paid")') && u.includes("fields.certifications")
  );
}

// ---------------------------------------------------------------------------
section("E. 字典与断言同源（九语键集 + en 叶子数）");
// ---------------------------------------------------------------------------
{
  function leaves(o: unknown): number {
    if (Array.isArray(o)) return o.reduce((n: number, x) => n + leaves(x), 0);
    if (o && typeof o === "object") {
      return Object.values(o as Record<string, unknown>).reduce(
        (n: number, x) => n + leaves(x),
        0
      );
    }
    return 1;
  }
  const load = (loc: string) =>
    JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${loc}.json`), "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

  const en = load("en");
  const enKeys = Object.keys(en.supplierProfile ?? {}).sort();
  const enLeaf = leaves(en);

  check(
    "E1 登记信息 7 键 + 自述证书 8 键 + 产能 4 键 全部存在于 en",
    [
      "registrationTitle",
      "registrationLead",
      "regEnglishName",
      "regCompanyType",
      "regRegistrationNo",
      "regWebsite",
      "regAddress",
      "selfCertTitle",
      "selfCertLead",
      "selfCertNone",
      "selfCertName",
      "selfCertNumber",
      "selfCertIssued",
      "selfCertExpires",
      "selfCertDisclaimer",
      // ⚠️ 字典键不可由字段名推导（capacityProduction ≠ capacity + ProductionCapacity），
      //    必须逐字写死 —— 本轮曾用首字母大写拼接，拼出 capacityProductionCapacity 而误报 FAIL。
      "capacityProduction",
      "capacityMonthly",
      "capacityFactorySize",
      "capacityExportSince",
    ].every((k) => enKeys.includes(k)),
    enKeys.length + " keys"
  );
  check("E2 evidenceCenter.issuedOn 已补（CertificationList 依赖）", Boolean(en.evidenceCenter?.issuedOn));

  let mismatch = 0;
  for (const loc of LOCALES) {
    if (loc === "en") continue;
    const keys = Object.keys(load(loc).supplierProfile ?? {}).sort();
    if (JSON.stringify(keys) !== JSON.stringify(enKeys)) mismatch++;
  }
  check("E3 九语 supplierProfile 键集完全一致（getDictionary 无深 fallback）", mismatch === 0, String(mismatch));

  check("E4 en 叶子数 = 2940（与 cs06a C8 同源）", enLeaf === 2940, `实际 ${enLeaf}`);
  check(
    "E5 cs06a 里的 C8 常量已同步为 2940",
    read(CS06A).includes("baseKeys.length === 2940")
  );
}

// ---------------------------------------------------------------------------
section("F. CS-12 零新增埋点（埋点三桶不受影响）");
// ---------------------------------------------------------------------------
{
  const panel = read(PANEL);
  const page = read(PAGE);
  check(
    "F1 新增的两个公开区块不含任何埋点调用（本 CS 只做展示）",
    !panel.includes("trackEvent") && !panel.includes("data-track")
  );
  check(
    "F2 档案页未新增 data-track（既有 profileFreeCta / profilePaidCta 保持原样）",
    (page.match(/data-track=/g) ?? []).length === 3
  );
}

// ---------------------------------------------------------------------------
console.log("\n============================================================");
console.log(`CS-12 档案页回归：${pass} PASS / ${fail} FAIL   （ROOT=${ROOT}）`);
if (fail > 0) {
  console.log("\n失败项：");
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
}
