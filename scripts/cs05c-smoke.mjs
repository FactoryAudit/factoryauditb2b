/**
 * CS-05c / CS-05c-r2 线上文案烟雾（生产站点，只读）
 *
 * 回答两个 curl 层面就能回答、但此前**没人自动问**的问题：
 *   1. `/llms.txt` 是否仍残留「up to 5 full profiles per month」这类退役口径
 *   2. 九语供应商详情页上，免费层注册门的 freeLockLead 是否还在承诺 certifications
 *
 * ⚠️ 为什么必须单独一个 smoke：
 *   CS-05c 的 75 条线上烟雾只扫 `/[locale]` 页面，而 `/llms.txt` **不在 locale 前缀下**，
 *   于是「up to 5 full profiles per month」在全绿的情况下活了下来（Pre-check 才发现）。
 *   教训：**独立路由必须有自己的探针。**
 *
 * ⚠️ 转义陷阱（已实测）：
 *   同一句话在 HTML 与 RSC payload 里出现两次，且转义方式不同 ——
 *   fr 的 `l'année` 在 HTML 段是 `l&#x27;année`，在 RSC 段是原始的 `'`。
 *   所以必须**先做 HTML 实体归一化再匹配**，否则「旧文案已消失」会因转义而假 PASS。
 *
 * ⚠️ 为什么不用驱动浏览器：
 *   freeLockLead 渲染在 UnlockGate 的 locked 槽里。SSR 首帧 guest.status = "pending"
 *   → unlocked = false → **锁定槽直接进 HTML**。所以纯 curl 就能读到，无需 localStorage。
 *   （Guest 额度「5 家」的真实行为由 scripts/cs05b-guest-browser-probe.mjs 用 CDP 验证。）
 *
 * 用法：
 *   node scripts/cs05c-smoke.mjs
 *   BASE=https://factoryauditb2b.com node scripts/cs05c-smoke.mjs
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.BASE || "https://factoryauditb2b.com";

const LOCALES = ["en", "zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];

/** locale 路径前缀：英文是默认语言，不带前缀（与 lib/i18n 一致） */
const prefix = (loc) => (loc === "en" ? "" : `/${loc}`);

/** 详情页 slug —— 九语都有该页；取一个稳定存在的 */
const SLUG = "shenzhen-precision-electronics";

/**
 * r2 之前的旧 freeLockLead（**硬编码**，用于「必须消失」断言）。
 * 不复用字典：字典已被修正，旧值只能从这里取，这正是回归的意义。
 */
const OLD_FREE_LOCK_LEAD = {
  en: "Create a free account to view the year established, employee count, export markets and certifications.",
  zh: "注册免费账号，查看成立年份、员工规模、出口市场与认证列表。",
  "zh-TW": "註冊免費帳號，查看成立年份、員工人數、出口市場與認證清單。",
  ja: "無料アカウントを作成すると、設立年・従業員数・輸出市場・認証一覧を確認できます。",
  es: "Crea una cuenta gratuita para ver el año de fundación, el número de empleados, los mercados de exportación y las certificaciones.",
  de: "Erstellen Sie ein kostenloses Konto, um Gründungsjahr, Mitarbeiterzahl, Exportmärkte und Zertifizierungen zu sehen.",
  fr: "Créez un compte gratuit pour voir l'année de création, l'effectif, les marchés d'exportation et les certifications.",
  pt: "Crie uma conta gratuita para ver ano de fundação, número de funcionários, mercados de exportação e certificações.",
  ar: "أنشئ حساباً مجانياً لعرض سنة التأسيس وعدد الموظفين وأسواق التصدير والشهادات.",
};

/** 新的 canonical 口径（`/llms.txt`） */
const LLMS_NEW = "unlimited browsing of basic supplier profiles";
/** 旧口径（必须消失） */
const LLMS_OLD_RE = /up to\s+5\s+full\s+profiles\s+per\s+month/i;

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(t) {
  console.log(`\n=== ${t} ===`);
}

/** HTML 实体归一化 —— 让「同一句话的两种转义」可比 */
function normalize(html) {
  return html
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

async function get(pathname, accept) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      ...(accept ? { Accept: accept } : {}),
    },
    redirect: "follow",
  });
  const body = await res.text();
  return { status: res.status, body, type: res.headers.get("content-type") || "" };
}

/** 从本地字典取「期望的新文案」—— 单一事实源，不在这里再写一份 */
function expectedFreeLockLead(loc) {
  const p = path.join(ROOT, "i18n", "dictionaries", `${loc}.json`);
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  return d?.supplierProfile?.freeLockLead;
}

// ---------------------------------------------------------------------------
section("1. /llms.txt（独立路由，不属 [locale] —— 必须单独探）");
// ---------------------------------------------------------------------------

{
  const r = await get("/llms.txt");
  const body = normalize(r.body);

  check("/llms.txt HTTP 200", r.status === 200, `实际 ${r.status}`);
  check("/llms.txt Content-Type 是 text/plain", /text\/plain/i.test(r.type), r.type);
  check("/llms.txt 内容非空（> 1000 字符）", body.length > 1000, `实际 ${body.length}`);

  const oldHit = body.match(LLMS_OLD_RE);
  check(
    "/llms.txt 不含旧口径「up to 5 full profiles per month」",
    !oldHit,
    oldHit ? oldHit[0] : ""
  );
  check("/llms.txt 全文不含 per month 这一计量说法", !/per\s+month/i.test(body));
  check(`/llms.txt 含新口径「${LLMS_NEW}」`, body.includes(LLMS_NEW));

  // 站点权威说明里 Free 相关行不得出现「N 家 / N profiles」的数字承诺
  const freeLine = body.split("\n").find((l) => /Free Account Registration/i.test(l)) || "";
  check(
    "/llms.txt 免费账号条目不出现数字化的档案配额",
    !/\b\d+\s*(full\s+)?(profiles?|suppliers?)\b/i.test(freeLine),
    freeLine.slice(0, 140)
  );
}

// ---------------------------------------------------------------------------
section("2. 九语供应商详情页：注册门 freeLockLead 已去 certifications");
// ---------------------------------------------------------------------------

for (const loc of LOCALES) {
  const url = `${prefix(loc)}/suppliers/${SLUG}`;
  const r = await get(url);

  if (r.status !== 200) {
    check(`${loc} 详情页 HTTP 200`, false, `实际 ${r.status} @ ${url}`);
    continue;
  }

  const html = normalize(r.body);
  const expected = expectedFreeLockLead(loc);
  const old = OLD_FREE_LOCK_LEAD[loc];

  check(`${loc} 详情页 HTTP 200`, true);

  check(
    `${loc} 页面含新的 freeLockLead（= 字典当前值）`,
    typeof expected === "string" && expected.length > 0 && html.includes(expected),
    (expected || "").slice(0, 120)
  );

  check(
    `${loc} 页面已无旧的 freeLockLead（承诺 certifications 那句）`,
    !html.includes(old),
    old.slice(0, 120)
  );

  // 兜底：整个页面不得在**免费层注册门**语境里再抛认证承诺。
  //   注意不能直接扫 "certification" —— 页面别处（付费层说明、能力标签、
  //   JSON-LD）合法地提到认证。这里只盯注册门那一段。
  const lead = typeof expected === "string" ? expected : "";
  check(
    `${loc} 免费层注册门文案本身不含认证类词汇`,
    lead.length > 0 && !/(certificat|Zertifizier|认证|認證|認証|الشهادات|شهادة)/i.test(lead),
    lead.slice(0, 120)
  );
}

// ---------------------------------------------------------------------------
section("3. 结构性守护：Guest 5 家 / Free 无限 / Paid 认证");
// ---------------------------------------------------------------------------

{
  // Guest 额度是**纯客户端**逻辑，curl 看不到；此处只确认详情页仍可匿名访问，
  // 真实额度行为由 scripts/cs05b-guest-browser-probe.mjs（CDP）负责。
  const r = await get(`/suppliers/${SLUG}`);
  check("供应商详情页仍可匿名访问（Guest 未被整体挡在门外）", r.status === 200, `实际 ${r.status}`);

  const html = normalize(r.body);
  check(
    "详情页仍渲染免费层注册门（freeLockTitle 存在 → 门还在，只是文案换了）",
    /Free account unlocks more company details/i.test(html)
  );

  // ⚠️ 必须**框定在免费层注册门那一段**内判定，不能扫整页：
  //    同一个页面上付费层合法地写着 "Upgrade to Founding Buyer"（付费门 CTA）
  //    与 "View membership"。整页扫描会把付费层的正确文案当成免费层的越界
  //    —— CS-05c 期间同类误报已出现两次，修法一律是收窄探针，不是放宽断言。
  //    实测距离：freeLockTitle → "Create free account" +366 字符；
  //              最近的付费 CTA（View membership）在 +4023 字符处。
  const titleIdx = html.search(/Free account unlocks more company details/i);
  const freeGate = titleIdx >= 0 ? html.slice(titleIdx, titleIdx + 900) : "";

  check(
    "免费层注册门 CTA 是「创建免费账号」",
    /Create free account/i.test(freeGate),
    freeGate.slice(0, 160)
  );
  check(
    "免费层注册门内不出现升级 / 付款 / 买额度语义（付费层文案未越界）",
    freeGate.length > 0 && !/Upgrade to|Buy credits|Subscribe|Pay\b/i.test(freeGate),
    freeGate.slice(0, 160)
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`CS-05c 线上烟雾：${pass} PASS / ${fail} FAIL   （BASE=${BASE}）`);
if (fail) {
  console.log("\n失败项：");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("全部通过 ✓");
