// CS-14 永久回归：供应商扩量发布（5 家真实入驻申请上线）
//
// 运行：node scripts/run-regression.mjs cs14-supplier-expansion-regression
//   数据层断言需要 .env 里的 SUPABASE_SERVICE_ROLE_KEY；脚本自读 .env，
//   缺 key 时数据层打印 SKIP（不计 FAIL），代码层断言照常跑。
//
// 分层：
//   A 发布状态（DB + RLS 双层口径）
//   B 授权留痕（profile_authorized / contact_visibility）
//   C 排除红线（拒绝授权者与测试邮件绝不可被发布）
//   D 不编造（risk_score / verification_level / 无核验事件）
//   E 逐字来源（申请邮件原文写入的字段）
//   F 可索引门控（10 家逐一）
//   G 代码不变式（阈值、脚本纪律、sitemap 门控、产文非空）
//   H 缺失分数不得被渲染成「0 分」（2026-09-15 线上事故的永久防线）
import { readFileSync, readdirSync } from "node:fs";
import {
  determineSupplierIndexability,
  generateSupplierTitle,
  generateSupplierDescription,
  generateSupplierSnapshot,
  supplierSeoDataFromView,
  type SupplierSeoData,
} from "../lib/seo/supplierSeo";

let pass = 0;
let fail = 0;
let skip = 0;

function check(ok: boolean, label: string) {
  if (ok) pass++;
  else fail++;
  console.log((ok ? "  PASS  " : "  FAIL  ") + label);
}
function checkSkip(label: string) {
  skip++;
  console.log("  SKIP  " + label);
}
function countOf(hay: string, needle: string): number {
  return hay.split(needle).length - 1;
}

/** 剥掉注释 —— 注释里**引用**旧写法（比如「绝不能用 `risk_score ?? 0`」）不构成"还在用它"。
 *  `(^|[^:])` 前缀守卫：URL 里的 `https://` 不能被当成行注释切掉。
 *  与 cs06a / cs05c / cs05b 同一实现，避免每个脚本各写一版。 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ——— 环境（自读 .env，覆盖 process.env） ———
const fileEnv: Record<string, string> = {};
try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    fileEnv[m[1]] = v;
  }
} catch {
  /* 无 .env */
}
const ENV = { ...process.env, ...fileEnv };
const URL_ = ENV.NEXT_PUBLIC_SUPABASE_URL || "";
const SVC = ENV.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const HAS_DB = Boolean(URL_ && SVC);

// ——— 期望常量 ———
const NEW_SLUGS = [
  "nanjing-mxcomm",
  "xiamen-jings-eyewear",
  "shenzhen-jorigin-packaging",
  "shandong-loyal-industrial",
  "jiangsu-liquid-damper",
];
// CS-15：shenzhen-jorigin-packaging 已下架（is_published=false，且授权撤回为
// profile_authorized=false / contact_visibility='private'）。
// 这是**真实状态变更**，不是回归退化 —— 断言改写为匹配新事实，且保留断言条数
// （把「已发布」换成「已下架且授权已撤回」，仍是 5 条）。
const WITHDRAWN_SLUGS = ["shenzhen-jorigin-packaging"];
const PUBLISHED_NEW_SLUGS = NEW_SLUGS.filter((s) => !WITHDRAWN_SLUGS.includes(s));
const EXPECTED_TOTAL = 10;
const EXPECTED_PUBLISHED = 9;
const COUNTRY_NAME: Record<string, string> = {
  china: "China",
  vietnam: "Vietnam",
  thailand: "Thailand",
  malaysia: "Malaysia",
  philippines: "Philippines",
};

type Row = Record<string, unknown>;
async function q(path: string, key: string): Promise<Row[] | null> {
  try {
    const r = await fetch(`${URL_}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? (j as Row[]) : null;
  } catch {
    return null;
  }
}

function toSeoData(s: Row, evidenceOnFile: number): SupplierSeoData {
  return {
    slug: String(s.slug),
    legalName: String(s.legal_name || ""),
    englishName: (s.english_name as string) || undefined,
    countryCode: String(s.country_code || ""),
    countryName: COUNTRY_NAME[String(s.country_code)] || String(s.country_code || ""),
    city: String(s.city || ""),
    industryCode: (s.industry_code as string) || undefined,
    businessType: String(s.business_type || ""),
    website: (s.website as string) || undefined,
    registrationNumber: (s.registration_number as string) || undefined,
    address: (s.address as string) || undefined,
    companyType: (s.company_type as string) || undefined,
    mainProducts: Array.isArray(s.main_products) ? (s.main_products as string[]) : [],
    verificationLevel: 0,
    verificationScope: [],
    hasRealVerificationEvent: false,
    verifiedCertifications: [],
    profileScore: typeof s.risk_score === "number" ? (s.risk_score as number) : null,
    hasScoreBreakdown: s.risk_breakdown != null,
    profileUpdatedAt: (s.updated_at as string) || null,
    lastChecked: null,
    evidenceOnFile,
  };
}

const run = async () => {
  console.log("=== CS-14 供应商扩量发布回归 ===\n");

  // ============ A 发布状态 ============
  console.log("--- A 发布状态 ---");
  const svcRows = HAS_DB ? await q("suppliers?select=*", SVC) : null;
  const anonRows = HAS_DB && ANON ? await q("suppliers?select=slug,is_published", ANON) : null;

  if (!svcRows) {
    checkSkip("A 层：无 SERVICE_ROLE_KEY 或无 .env，数据层跳过");
    for (let i = 1; i <= 14; i++) checkSkip(`A${i}（需 DB）`);
  } else {
    const published = svcRows.filter((r) => r.is_published === true);
    check(svcRows.length === EXPECTED_TOTAL, `A1 全库供应商 == ${EXPECTED_TOTAL}（实测 ${svcRows.length}）`);
    check(published.length === EXPECTED_PUBLISHED, `A2 is_published=true == ${EXPECTED_PUBLISHED}（实测 ${published.length}）`);

    if (anonRows) {
      check(anonRows.length === EXPECTED_PUBLISHED, `A3 anon 可见 == ${EXPECTED_PUBLISHED}（RLS 闸门放行，实测 ${anonRows.length}）`);
      check(
        anonRows.every((r) => r.is_published === true),
        "A4 anon 可见行全部 is_published=true（未发布行未泄漏）"
      );
    } else {
      checkSkip("A3/A4（无 anon key）");
      checkSkip("A4（无 anon key）");
    }

    const slugs = svcRows.map((r) => String(r.slug));
    check(new Set(slugs).size === slugs.length, "A5 slug 无重复");
    for (const sl of NEW_SLUGS) {
      const row = svcRows.find((r) => r.slug === sl);
      if (WITHDRAWN_SLUGS.includes(sl)) {
        // CS-15 下架：断言"确实已下架且授权已撤回"，防止有人悄悄把它重新发布
        check(
          Boolean(row) && row!.is_published === false && row!.profile_authorized === false,
          `A6 ${sl} 已下架且授权已撤回（CS-15）`
        );
      } else {
        check(Boolean(row) && row!.is_published === true, `A6 ${sl} 在库且已发布`);
      }
    }
  }

  // ============ B 授权留痕 ============
  console.log("\n--- B 授权留痕（同意书字段）---");
  const queriesSrc = readFileSync("lib/queries.ts", "utf8");
  const rowSelect = (queriesSrc.match(/const ROW_SELECT = `([\s\S]*?)`;/) || [])[1] || "";
  check(!/profile_authorized/.test(rowSelect), "B1 🔴 ROW_SELECT 不含 profile_authorized（授权字段不进公开查询）");
  check(!/contact_visibility/.test(rowSelect), "B2 🔴 ROW_SELECT 不含 contact_visibility");
  check(!/\bphone\b/.test(rowSelect), "B3 🔴 ROW_SELECT 不含 phone（公开边界只含工商登记级）");
  check(rowSelect.length > 50, "B4 ROW_SELECT 提取成功（非空守卫：避免正则失效导致假 PASS）");

  if (!svcRows) {
    for (let i = 5; i <= 7; i++) checkSkip(`B${i}（需 DB）`);
  } else {
    const news = PUBLISHED_NEW_SLUGS.map((sl) => svcRows.find((r) => r.slug === sl)).filter(Boolean) as Row[];
    check(
      news.length === PUBLISHED_NEW_SLUGS.length,
      `B5 ${PUBLISHED_NEW_SLUGS.length} 家新发布行都能取到（CS-15 后 shenzhen-jorigin-packaging 已下架，不计入）`
    );
    check(
      news.every((r) => r.profile_authorized === true),
      `B6 ${PUBLISHED_NEW_SLUGS.length} 家 profile_authorized=true（来源：申请邮件 Authorize Company Profile: yes）`
    );
    check(
      news.every((r) => r.contact_visibility === "platform"),
      `B7 ${PUBLISHED_NEW_SLUGS.length} 家 contact_visibility='platform'（联系方式不下公开）`
    );
  }

  // ============ C 排除红线 ============
  console.log("\n--- C 排除红线 ---");
  // 从发布脚本的 PLAN 反查：被排除者绝不可出现在已发布集合
  const scriptSrc = readFileSync("scripts/cs14-publish-suppliers.mjs", "utf8");
  check(
    !/yake/i.test(scriptSrc),
    "C1 发布脚本未把 Yake Technology（授权=no）列入 PLAN"
  );
  check(
    !/CS02D|SMOKE TEST/i.test(scriptSrc),
    "C2 发布脚本未把测试邮件（CS02D / CS-08 SMOKE）列入 PLAN"
  );
  check(
    !/lydia/i.test(scriptSrc),
    "C3 发布脚本未把 Lydia Design Studio（美国，不在 5 国覆盖）列入 PLAN"
  );
  check(
    /NEW_SLUGS|new Set|PLAN/.test(scriptSrc) && countOf(scriptSrc, "slug:") === 5,
    "C4 发布脚本 PLAN 恰好 5 家（防后续被顺手扩量）"
  );
  if (!svcRows) {
    checkSkip("C5（需 DB）");
  } else {
    const bad = svcRows.filter(
      (r) => r.is_published === true && /yake|smoke test|cs02d|lydia design/i.test(String(r.legal_name || ""))
    );
    check(bad.length === 0, `C5 已发布集合中无拒绝授权者/测试数据/超覆盖国（实测 ${bad.length} 条）`);
  }

  // ============ D 不编造 ============
  console.log("\n--- D 不编造 ---");
  if (!svcRows) {
    for (let i = 1; i <= 4; i++) checkSkip(`D${i}（需 DB）`);
  } else {
    const news = NEW_SLUGS.map((sl) => svcRows.find((r) => r.slug === sl)).filter(Boolean) as Row[];
    check(
      news.every((r) => r.risk_score === null || r.risk_score === undefined),
      "D1 5 家新发布 risk_score 全为 NULL（无来源不编造评分）"
    );
    check(
      news.every((r) => r.verification_level === "unverified"),
      "D2 5 家 verification_level 仍为 unverified（未伪造核验等级）"
    );
    const audits = await q("supplier_audits?select=supplier_id,verification_status", SVC);
    const verifiedIds = new Set(
      (audits || []).filter((a) => a.verification_status === "VERIFIED").map((a) => String(a.supplier_id))
    );
    check(
      news.every((r) => !verifiedIds.has(String(r.id))),
      "D3 5 家均无 VERIFIED 审核记录（publicVerificationLevel 必为 0）"
    );
    check(verifiedIds.size === 1, `D4 全库 VERIFIED 记录仍为 1 条（实测 ${verifiedIds.size}）`);
  }

  // ============ E 逐字来源 ============
  console.log("\n--- E 逐字来源（申请邮件原文）---");
  if (!svcRows) {
    for (let i = 1; i <= 6; i++) checkSkip(`E${i}（需 DB）`);
  } else {
    const by = (sl: string) => svcRows.find((r) => r.slug === sl) as Row;
    check(by("nanjing-mxcomm").industry_code === "electronics", "E1 nanjing-mxcomm.industry_code == 'electronics'（工业无线/以太网设备）");
    check(by("shandong-loyal-industrial").established === 2005, "E2 shandong-loyal.established == 2005");
    check(
      JSON.stringify(by("shandong-loyal-industrial").export_markets) === JSON.stringify(["Worldwide"]),
      "E3 shandong-loyal.export_markets == ['Worldwide']"
    );
    check(
      String(by("shandong-loyal-industrial").address || "").startsWith("No. 689, Meili North Road"),
      "E4 shandong-loyal.address 逐字来自邮件"
    );
    check(
      by("xiamen-jings-eyewear").registration_number === "91350206302967241N",
      "E5 xiamen-jings.registration_number == 91350206302967241N"
    );
    check(by("xiamen-jings-eyewear").address === "Xiamen, Fujian, China", "E6 xiamen-jings.address 逐字来自邮件");
  }

  // ============ F 可索引门控 ============
  console.log("\n--- F 可索引门控（全部 10 家）---");
  if (!svcRows) {
    checkSkip("F 层（需 DB）");
  } else {
    const ev = await q("supplier_evidence?select=supplier_id", SVC);
    const evCount: Record<string, number> = {};
    (ev || []).forEach((e) => {
      const k = String(e.supplier_id);
      evCount[k] = (evCount[k] || 0) + 1;
    });
    let allIn = true;
    for (const r of svcRows.filter((x) => x.is_published === true)) {
      const cn = COUNTRY_NAME[String(r.country_code)] || "";
      const v = determineSupplierIndexability({
        legalName: String(r.legal_name || ""),
        city: String(r.city || ""),
        countryName: cn,
        mainProducts: Array.isArray(r.main_products) ? (r.main_products as string[]) : [],
        verificationLevel: 0,
        hasRealVerificationEvent: false,
        website: (r.website as string) || undefined,
        registrationNumber: (r.registration_number as string) || undefined,
        address: (r.address as string) || undefined,
        profileScore: typeof r.risk_score === "number" ? (r.risk_score as number) : null,
        evidenceOnFile: evCount[String(r.id)] || 0,
      });
      if (!v.indexable) {
        allIn = false;
        console.log(`         ↳ ${r.slug} NOINDEX reason=${v.reason}`);
      }
    }
    check(allIn, "F1 全部已发布供应商通过可索引门控（否则会进 sitemap 却被 noindex）");
  }

  // ============ G 代码不变式 ============
  console.log("\n--- G 代码不变式 ---");
  // TITLE_MAX / DESC_MAX 未导出（刻意：只在本层用）⇒ 从源码取值断言，不为了测试改生产代码
  const seoSrc = readFileSync("lib/seo/supplierSeo.ts", "utf8");
  const titleMax = Number((seoSrc.match(/const TITLE_MAX\s*=\s*(\d+)/) || [])[1]);
  const descMax = Number((seoSrc.match(/const DESC_MAX\s*=\s*(\d+)/) || [])[1]);
  check(titleMax === 85, `G1 TITLE_MAX 未被改动 == 85（实测 ${titleMax}）`);
  check(descMax === 200, `G2 DESC_MAX 未被改动 == 200（实测 ${descMax}）`);
  check(Number.isFinite(titleMax) && Number.isFinite(descMax), "G2b 两个阈值常量都成功从源码取出（防正则失效假 PASS）");

  const publishSrc = readFileSync("scripts/cs14-publish-suppliers.mjs", "utf8");
  check(/拒绝覆盖/.test(publishSrc), "G3 发布脚本含「非空守卫」（只填 NULL，绝不覆盖）");
  check(
    /const APPLY = process\.argv\.includes\("--apply"\)/.test(publishSrc) && /DRY-RUN/.test(publishSrc),
    "G4 发布脚本默认 dry-run，需 --apply 才写入"
  );
  check(/risk_score/.test(publishSrc) && /绝不编造|留 NULL/.test(publishSrc), "G5 发布脚本显式声明不写 risk_score");

  const sitemapSrc = readFileSync("app/sitemap.ts", "utf8");
  check(/determineSupplierIndexability/.test(sitemapSrc), "G6 sitemap 仍走 determineSupplierIndexability 门控");
  check(/listSupplierSitemapRows/.test(sitemapSrc), "G7 sitemap 仍用 listSupplierSitemapRows（不退回硬编码）");

  // 产文非空（用真实行构造，确保发布后 title/desc 不会空）
  if (svcRows) {
    const news = NEW_SLUGS.map((sl) => svcRows.find((r) => r.slug === sl)).filter(Boolean) as Row[];
    let ok = true;
    for (const r of news) {
      const d = toSeoData(r, 0);
      const t = generateSupplierTitle(d, "en");
      const desc = generateSupplierDescription(d, "en");
      if (!t.trim() || !desc.trim()) {
        ok = false;
        console.log(`         ↳ ${r.slug} title/desc 为空`);
      }
      if (desc.length > descMax) {
        ok = false;
        console.log(`         ↳ ${r.slug} desc 超长 ${desc.length} > ${descMax}`);
      }
    }
    check(ok, "G8 5 家新发布 title/description 均非空且 desc 不超长");
    check(
      news.every((r) => {
        const z = generateSupplierDescription(toSeoData(r, 0), "en");
        return /Not independently verified by FactoryAuditB2B\./.test(z);
      }),
      "G9 未核验新家 desc 均含「未经独立核验」合规句"
    );
  } else {
    checkSkip("G8/G9（需 DB）");
    checkSkip("G9（需 DB）");
  }

  // ============ H 缺失分数不得被渲染成「0 分」 ============
  // 线上事故（2026-09-15）：lib/queries.ts `rowToView` 写了 `row.risk_score ?? 0`，
  // 把「平台尚未评分」（NULL）填成 0。0 在 V1.1 分桶里是**最差一档**（CRITICAL），
  // 于是 5 家真实工厂的 meta description 公开写着
  // 「Supplier profile score 0 out of 100」—— 对真实企业的诋毁性陈述。
  // 本层是该缺陷的永久防线：源码级（禁止 `?? 0` 打底）+ 行为级（走生产适配器复现路径）。
  console.log("\n--- H 缺失分数不得被渲染成「0 分」 ---");
  // 源码级判定一律**先剥注释**：上面这些解释文字本身就引用了旧写法，
  // 不剥注释会稳定假 FAIL（本脚本 H4/H5 第一版就踩了这个坑）。
  const qSrc = stripComments(readFileSync("lib/queries.ts", "utf8"));
  const seoAdapterSrc = stripComments(readFileSync("lib/seo/supplierSeo.ts", "utf8"));

  const typeofRiskHits = countOf(qSrc, 'typeof row.risk_score === "number"');
  check(
    typeofRiskHits >= 2,
    `H1 rowToView 与 rowToMatrix 都以 typeof 判定分数（实测 ${typeofRiskHits} 处，需 >= 2）`
  );
  check(
    !/risk_score\s*\?\?\s*0/.test(qSrc),
    "H2 lib/queries.ts 不存在 `risk_score ?? 0`（0 = 最差等级，绝不可顶替缺失）"
  );
  check(
    !/overallLevel\([^)]*\?\?\s*0\)/.test(qSrc),
    "H3 lib/queries.ts 不存在 `overallLevel(x ?? 0)` 兜底"
  );
  check(
    !/overallLevel\([^)]*\?\?\s*0\)/.test(seoAdapterSrc),
    "H4 supplierSeo.ts 不存在 `overallLevel(x ?? 0)` 兜底"
  );

  // H5 渲染层全扫：app/ · components/ · lib/ 下任何文件都不得用 `?? 0` 给分数打底。
  //    这是缺陷最可能的复发点（页面里随手一个 `score ?? 0` 就会重新公开断言「0 分」）。
  function walk(dir: string, out: string[]): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  }
  const scanRoots = ["app", "components", "lib"];
  const offenders: string[] = [];
  for (const root of scanRoots) {
    for (const f of walk(root, [])) {
      if (/scripts\//.test(f)) continue;
      const src = stripComments(readFileSync(f, "utf8"));
      if (/riskScore\s*\?\?\s*0/.test(src) || /risk_score\s*\?\?\s*0/.test(src)) {
        offenders.push(f);
      }
    }
  }
  check(
    offenders.length === 0,
    `H5 app/·components/·lib/ 无任何 \`riskScore ?? 0\` 打底（违规文件：${offenders.join(", ") || "无"}）`
  );

  // H6-H10 行为级：走**生产适配器**（supplierSeoDataFromView），复现事故当时的确切链路。
  const viewNoScore = {
    slug: "h-noscore-probe",
    legalName: "H NoScore Probe Co., Ltd.",
    country: "china",
    city: "Jinan",
    businessType: "Manufacturer",
    verificationLevel: "unverified",
    mainProducts: ["Valves"],
  };
  const adapterOut = supplierSeoDataFromView(viewNoScore, {
    verifiedAudits: [],
    verifiedCertifications: [],
  });
  check(
    adapterOut.seo.profileScore === null,
    `H6 适配器把「无分数」映射成 null（实测 ${String(adapterOut.seo.profileScore)}）`
  );
  check(
    adapterOut.seo.profileScoreBand === undefined,
    `H7 无分数时不打底等级（实测 ${String(adapterOut.seo.profileScoreBand)}，必须 undefined）`
  );

  const descNoScore = generateSupplierDescription(adapterOut.seo, "en");
  check(
    !/\/\s*100/.test(descNoScore),
    "H8 无分数时 description 不含「/ 100」评分句"
  );
  check(
    !/score\s+0\b/i.test(descNoScore),
    "H9 无分数时 description 绝不出现「score 0」"
  );

  const snapNoScore = generateSupplierSnapshot(adapterOut.seo, "en", {});
  const scoreRow = snapNoScore.find((r) => r.id === "profileScore");
  check(
    Boolean(scoreRow) &&
      scoreRow!.unknown === true &&
      !/\/\s*100/.test(scoreRow!.value),
    `H10 无分数时快照评分行是「无资料」占位（实测 value="${scoreRow ? scoreRow.value : "缺行"}" unknown=${scoreRow ? scoreRow.unknown : "?"}）`
  );

  // H11 阴性对照：有分数时必须**照常**输出评分句。
  //     防止「把功能整个关掉」也算通过 —— 修的是 NULL 处理，不是评分显示本身。
  const adapterWithScore = supplierSeoDataFromView(
    { ...viewNoScore, riskScore: 96 },
    { verifiedAudits: [], verifiedCertifications: [] }
  );
  check(
    adapterWithScore.seo.profileScore === 96 &&
      /\/\s*100/.test(
        generateSupplierSnapshot(adapterWithScore.seo, "en", {}).find(
          (r) => r.id === "profileScore"
        )?.value ?? ""
      ),
    "H11 有分数时仍照常显示评分（阴性对照：证明修复没有把评分功能一并关掉）"
  );

  // H12 真实数据：5 家新发布供应商的 description 一律不含「/ 100」
  if (svcRows) {
    const news = NEW_SLUGS.map((sl) => svcRows.find((r) => r.slug === sl)).filter(Boolean) as Row[];
    const bad = news.filter((r) => /\/\s*100/.test(generateSupplierDescription(toSeoData(r, 0), "en")));
    check(
      bad.length === 0,
      `H12 5 家新发布供应商 description 均无「/ 100」（违规：${bad.map((r) => r.slug).join(", ") || "无"}）`
    );
  } else {
    checkSkip("H12（需 DB）");
  }

  console.log(`\n=== CS-14 结果: ${pass} PASS / ${fail} FAIL / ${skip} SKIP ===`);
  if (fail > 0) process.exitCode = 1;
};

void run().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
