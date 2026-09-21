// STEP 13 CHANGE SET A —— 完整度函数回归（对**生产真实 18 行**求值，不是夹具）
//
// 用法：node scripts/step13-completeness-regression.mjs
// 通过：全部 PASS 且 exit 0；任一 FAIL ⇒ exit 1
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const OUT_DIR = "tmp/step13";
mkdirSync(OUT_DIR, { recursive: true });
const OUT = `${OUT_DIR}/completeness.mjs`;

await esbuild.build({
  entryPoints: ["lib/supplierCompleteness.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: OUT,
  logLevel: "error",
});
const { supplierCompleteness } = await import(pathToFileURL(`${process.cwd()}/${OUT}`).href);

// —— 取生产真实行（PostgREST + service_role，只读 SELECT） ——
const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(
  `${URL_}/rest/v1/suppliers?select=slug,country_code,province,city,industry_code,main_products,verification_level,verification_status,consent_version,profile_authorized,is_published`,
  { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } }
);
const rows = await res.json();
if (!Array.isArray(rows)) {
  console.error("FAIL 无法读取 suppliers：" + JSON.stringify(rows).slice(0, 300));
  process.exit(1);
}

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${extra ? " :: " + extra : ""}`);
  }
};

ok("A1.1 生产行数 = 18", rows.length === 18, `rows=${rows.length}`);

const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));
const calc = (slug) =>
  supplierCompleteness({
    slug,
    countryCode: bySlug[slug].country_code,
    province: bySlug[slug].province,
    city: bySlug[slug].city,
    industryCode: bySlug[slug].industry_code,
    mainProducts: bySlug[slug].main_products ?? [],
    verificationLevel: bySlug[slug].verification_level,
    verificationStatus: bySlug[slug].verification_status,
    consentVersion: bySlug[slug].consent_version,
    profileAuthorized: bySlug[slug].profile_authorized,
    isPublished: bySlug[slug].is_published,
  });

// —— A1 结构 ——
const c0 = calc("guangzhou-sunny-food");
ok("A1.2 total 恒为 7", c0.total === 7, String(c0.total));
ok("A1.3 items 长度 7", c0.items.length === 7, String(c0.items.length));
ok("A1.4 score+missing = total", c0.score + c0.missing.length === 7);
ok("A1.5 状态集合合法", c0.items.every((i) => ["PASS", "MISSING", "UNKNOWN", "REJECTED"].includes(i.state)));

// —— A2 状态语义（禁止一律绿色）——
ok("A2.1 province 缺失 ⇒ UNKNOWN（非 MISSING）", calc("batik-soehadi").items.find((i) => i.key === "province").state === "UNKNOWN");
ok("A2.2 city='unknown' ⇒ UNKNOWN", calc("loomeami").items.find((i) => i.key === "city").state === "UNKNOWN");
ok("A2.3 country='unknown' ⇒ UNKNOWN", calc("supplier").items.find((i) => i.key === "country").state === "UNKNOWN");
ok("A2.4 已核验 ⇒ verification PASS", calc("guangzhou-sunny-food").items.find((i) => i.key === "verification").state === "PASS");
ok("A2.5 未核验 ⇒ verification MISSING", calc("nanjing-mxcomm").items.find((i) => i.key === "verification").state === "MISSING");

// —— A5 发布闸门 ——
ok("A5.1 脏 slug 'supplier' ⇒ 不可发布 + rejected", calc("supplier").publishable === false && calc("supplier").rejected === true);
ok("A5.2 未授权 ⇒ 不可发布（shenzhen-jorigin-packaging）", calc("shenzhen-jorigin-packaging").publishable === false);
ok("A5.3 缺 industry ⇒ 不可发布（guangdong-junchi-sports）", calc("guangdong-junchi-sports-products-co-ltd").publishable === false);
ok("A5.4 city=unknown ⇒ 不可发布（loomeami）", calc("loomeami").publishable === false);
ok(
  "A5.5 blockers 文案含 missing industry",
  calc("guangdong-junchi-sports-products-co-ltd").blockers.includes("missing industry"),
  JSON.stringify(calc("guangdong-junchi-sports-products-co-ltd").blockers)
);
ok("A5.6 资料齐全 ⇒ 可发布（xiamen-jintaijin）", calc("xiamen-jintaijin-polish-tech-co-ltd").publishable === true);
ok("A5.7 资料齐全 ⇒ 可发布（u-w-y）", calc("u-w-y-company-limited").publishable === true);
ok("A5.8 资料齐全 ⇒ 可发布（qingdao-xiuxinyang）", calc("qingdao-xiuxinyang-international-trade-co-ltd").publishable === true);
ok("A5.9 province 缺失**不**阻断发布（batik-soehadi 可发布）", calc("batik-soehadi").publishable === true);
ok(
  "A5.10 测试供应商不可发布（step12-automated-verify-co 缺 industry）",
  calc("step12-automated-verify-co").publishable === false
);

// —— 不得误伤已发布的 9 家 ——
// 新闸门只对「未发布 → 已发布」的跃迁生效。
// 已发布的历史行里有多家 profile_authorized 为 null（早于授权机制），属被接受的既有状态；
// 只要它们没有**字段级**阻断（city / industry / products / country unknown），
// 就说明本轮没有凭空制造 retro-block。
const FIELD_BLOCKERS = ["missing city", "missing industry", "missing main products", "country is unknown"];
const published = rows.filter((r) => r.is_published);
ok("A6.1 已发布 9 家", published.length === 9, String(published.length));
const retroBlocked = published.filter((r) =>
  calc(r.slug).blockers.some((b) => FIELD_BLOCKERS.includes(b))
);
ok(
  "A6.2 已发布供应商不会被新闸门 retro-block（无字段级阻断）",
  retroBlocked.length === 0,
  retroBlocked.map((r) => `${r.slug}:${calc(r.slug).blockers.join("|")}`).join(" ; ")
);
ok(
  "A6.3 已发布行不再追索授权（gate 只管跃迁）",
  published.every((r) => !calc(r.slug).blockers.includes("not authorized (profile_authorized is not true)"))
);

// —— 汇总表（给报告用） ——
const summary = rows.map((r) => {
  const c = calc(r.slug);
  return {
    slug: r.slug,
    score: `${c.score}/${c.total}`,
    publishable: c.publishable,
    published: Boolean(r.is_published),
    blockers: c.blockers,
  };
});
writeFileSync(
  "D:/腾讯ai临时文件/2026-09-14-22-18-10/s13-completeness.json",
  JSON.stringify(summary, null, 2),
  "utf8"
);

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail === 0 ? 0 : 1);
