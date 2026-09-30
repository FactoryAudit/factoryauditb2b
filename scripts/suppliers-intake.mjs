#!/usr/bin/env node
/**
 * scripts/suppliers-intake.mjs —— 供应商批量录入（内容侧 / 第 4 批配套）
 *
 * 用途：把人工核验过的公开工商信息批量录入 `suppliers`，**默认 dry-run**。
 *
 * 用法：
 *   node --env-file=.env scripts/suppliers-intake.mjs --file data/suppliers-intake.json          # 预览
 *   node --env-file=.env scripts/suppliers-intake.mjs --file data/suppliers-intake.json --apply  # 写入
 *
 * 设计铁律（每条都有踩过坑的理由）：
 *   1. **默认 dry-run**，必须显式 `--apply` 才写库（白名单式，避免误写生产）。
 *   2. `is_published` 有列级 DEFAULT `true` ⇒ 不显式传 false 会**直接发布**。
 *      本脚本对第一批**强制** `is_published=false`（发布是单独的、经人工审核的动作）。
 *   3. `verification_level` 强制 `unverified`；**绝不**写入任何"已核验"语义。
 *   4. 幂等 + **只补 NULL**：已存在的 slug 只 PATCH 当前为空字段，绝不覆盖非空值。
 *   5. **拒绝个人数据**：出现 phone / contact_person / contact_email / whatsapp 列即报错退出。
 *   6. `slug` 一经发布不可改（改 = 线上页面 404）；本脚本对已存在 slug 只做字段补全。
 *   7. 每条必须有 `source_url`（可追溯证据）；缺失即拒绝该行。
 *
 * 输入格式：JSON 数组 或 CSV（表头见 EXAMPLE_JSON）。
 *   - 数组字段（main_products / certifications / export_markets）用 `|` 分隔。
 *   - CSV 支持双引号包裹与 `""` 转义。
 */

import { readFileSync, existsSync } from "node:fs";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const APPLY = process.argv.includes("--apply");
const SHOW_PAYLOAD = process.argv.includes("--show-payload");
const fileIdx = process.argv.indexOf("--file");
const FILE = fileIdx > -1 ? process.argv[fileIdx + 1] : "data/suppliers-intake.json";

/**
 * 产品词英文化映射表（2026-10-01 起）────────────────────────────────────
 *
 * 站点约定（docs/SUPPLIER-SEO-V1.0-AUDIT.md:71）：`main_products` 是**英文**自由文本数组。
 * 2026-10-01 的 200 家广交会名录批量录入写成了中文，其中 21 家已发布
 * ⇒ 英文站的产品词是中文、搜索 `?q=shoe` 命中 0 家（本条闸门就是为此立的）。
 *
 * 为什么在这里「自动英文化」而不是直接拒绝中文：
 *   data/suppliers-intake-*.json 是**历史溯源记录**，里面保留的是当初抓到的中文原文；
 *   直接报错会让这些文件无法再跑。这里查表替换，既让历史文件可用，又保证落库一定是英文。
 * 🔴 表里没有的词一律**报错**（不猜测）—— 守「不编造」红线。
 */
const PRODUCT_TERMS_FILE = "data/product-terms-zh-en.json";
const PRODUCT_TERMS = (() => {
  try {
    return JSON.parse(readFileSync(PRODUCT_TERMS_FILE, "utf8")).terms ?? {};
  } catch {
    console.error(`⚠ 读不到 ${PRODUCT_TERMS_FILE}，产品词英文化闸门将把所有中文词判为未映射`);
    return {};
  }
})();
/** 中日韩统一表意文字 + 日文假名 + 韩文谚文（与 data 侧一致） */
const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

if (!BASE || !KEY) {
  console.error("❌ 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（用 --env-file=.env 运行）");
  process.exit(2);
}

// ── 允许值域（与线上数据 + lib 口径对齐）────────────────────────────────
const COUNTRIES = new Set(["china", "vietnam", "thailand", "malaysia", "indonesia"]);
/**
 * 已知行业（不在集合内 → 警告，不阻断）。
 * 🔴 真源 = lib/staticData.ts 的 STATIC_INDUSTRIES —— 改那份必须同步这里。
 *    2026-10-01 修正：原清单漏了 toys/footwear/home-appliances/automotive/furniture/cosmetics，
 *    且含一个并不存在的 eyewear（历史遗留），导致整批刷误导性警告。
 */
const KNOWN_INDUSTRIES = new Set([
  "electronics", "textiles", "toys", "footwear", "machinery", "plastics",
  "home-appliances", "food-beverage", "chemicals", "automotive",
  "furniture", "packaging", "cosmetics",
]);
/** 明令禁止出现的列（个人数据 / 越界字段） */
const FORBIDDEN_KEYS = ["phone", "contact_person", "contact_email", "whatsapp", "consent_ip"];
/** 允许写入的列（白名单；其余键一律忽略并告警） */
const ALLOWED_KEYS = new Set([
  "slug", "legal_name", "english_name", "display_name", "country_code", "city", "province",
  "industry_code", "business_type", "company_type", "established", "employees",
  "main_products", "export_markets", "certifications", "website", "address",
  "registration_number", "production_capacity", "monthly_output", "factory_size", "export_since",
  "company_description", "source_url", "source_type", "source_name", "discovered_at",
]);
const REQUIRED_KEYS = ["slug", "legal_name", "country_code", "city", "industry_code", "main_products", "source_url"];
/** 数组类字段（`|` 分隔） */
const ARRAY_KEYS = ["main_products", "export_markets", "certifications"];
const INT_KEYS = ["established", "export_since"];

// ── 解析 ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift()?.map((h) => h.trim()) ?? [];
  return rows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function loadRows() {
  if (!existsSync(FILE)) {
    console.error(`❌ 找不到输入文件：${FILE}`);
    console.error("   模板见 scripts/suppliers-intake.mjs 顶部注释的 EXAMPLE_JSON。");
    process.exit(2);
  }
  const raw = readFileSync(FILE, "utf8").replace(/^\uFEFF/, "");
  if (FILE.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.error("❌ JSON 顶层必须是数组");
      process.exit(2);
    }
    return data;
  }
  return parseCSV(raw);
}

// ── 逐行校验 + 归一化 ───────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_RE = /^https?:\/\/\S+$/i;

function normalize(row, idx) {
  const errs = [];
  const warns = [];
  const out = {};
  const label = `#${idx + 1}${row.slug ? ` (${row.slug})` : ""}`;

  for (const k of Object.keys(row)) {
    if (FORBIDDEN_KEYS.includes(k)) errs.push(`禁止字段 ${k}（不采集个人数据）`);
    else if (!ALLOWED_KEYS.has(k)) warns.push(`忽略未知列 ${k}`);
  }
  for (const k of REQUIRED_KEYS) {
    const v = row[k];
    if (v === undefined || v === null || String(v).trim() === "") errs.push(`必填缺失 ${k}`);
  }
  const slug = String(row.slug ?? "").trim();
  if (slug && (!SLUG_RE.test(slug) || slug.length > 80)) errs.push(`slug 非法：${slug}`);
  const cc = String(row.country_code ?? "").trim().toLowerCase();
  if (cc && !COUNTRIES.has(cc)) errs.push(`country_code 不在 5 国值域：${cc}`);
  const ic = String(row.industry_code ?? "").trim().toLowerCase();
  if (ic && !KNOWN_INDUSTRIES.has(ic)) warns.push(`industry_code 未在已知集合：${ic}`);
  const src = String(row.source_url ?? "").trim();
  if (src && !URL_RE.test(src)) errs.push(`source_url 非 http(s)：${src}`);

  for (const k of ALLOWED_KEYS) {
    if (!(k in row)) continue;
    let v = row[k];
    if (v === undefined || v === null || String(v).trim() === "") continue;
    if (ARRAY_KEYS.includes(k)) {
      const arr = String(v).split("|").map((s) => s.trim()).filter(Boolean);
      if (arr.length) out[k] = arr;
    } else if (INT_KEYS.includes(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = Math.trunc(n);
    } else {
      out[k] = String(v).trim();
    }
  }
  if (!out.main_products?.length) errs.push("main_products 为空");
  if (!out.source_url) errs.push("source_url 为空");

  // ── 产品词英文化闸门 ────────────────────────────────────────────────────
  // 逐词查表替换（已英文的原样保留）；查不到的**报错**，绝不猜测。
  if (out.main_products?.length) {
    const mapped = [];
    const unmapped = [];
    for (const t of out.main_products) {
      if (!CJK_RE.test(t)) {
        mapped.push(t);
        continue;
      }
      const en = PRODUCT_TERMS[t];
      if (typeof en === "string" && en.trim()) mapped.push(en.trim());
      else unmapped.push(t);
    }
    out.main_products = mapped;
    if (unmapped.length) {
      errs.push(
        `main_products 含无法英文化的词（须先补进 ${PRODUCT_TERMS_FILE} 再跑）：${unmapped.join(" / ")}`
      );
    }
  }

  // 强制覆盖：第一批一律未发布、未核验
  out.is_published = false;
  out.verification_level = "unverified";

  return { label, slug, payload: out, errs, warns };
}

// ── Supabase REST ──────────────────────────────────────────────────────
const hdrs = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const rest = (p) => `${BASE.replace(/\/$/, "")}/rest/v1${p}`;

async function getBySlug(slug) {
  const r = await fetch(rest(`/suppliers?slug=eq.${encodeURIComponent(slug)}&select=*`), { headers: hdrs });
  if (!r.ok) throw new Error(`GET ${slug} → ${r.status} ${await r.text()}`);
  return r.json();
}
async function insert(row) {
  const r = await fetch(rest("/suppliers"), { method: "POST", headers: hdrs, body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`INSERT → ${r.status} ${await r.text()}`);
  return r.json();
}
async function patch(slug, body) {
  const r = await fetch(rest(`/suppliers?slug=eq.${encodeURIComponent(slug)}`), {
    method: "PATCH",
    headers: hdrs,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${slug} → ${r.status} ${await r.text()}`);
  return r.json();
}

/** 只补 NULL / 空串 / 空数组的字段 */
function nullOnlyPatch(existing, payload) {
  const patchBody = {};
  const filled = [];
  for (const [k, v] of Object.entries(payload)) {
    if (k === "slug") continue;
    const cur = existing[k];
    const isEmpty =
      cur === null ||
      cur === undefined ||
      (typeof cur === "string" && cur.trim() === "") ||
      (Array.isArray(cur) && cur.length === 0);
    if (isEmpty) {
      patchBody[k] = v;
      filled.push(k);
    }
  }
  return { patchBody, filled };
}

// ── 主流程 ──────────────────────────────────────────────────────────────
(async () => {
  const rows = loadRows();
  console.log(`输入：${FILE}｜行数 ${rows.length}｜模式 ${APPLY ? "APPLY（写库）" : "DRY-RUN（预览）"}\n`);

  const ready = [];
  let bad = 0;
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const r = normalize(rows[i], i);
    if (r.slug && seen.has(r.slug)) r.errs.push(`文件内 slug 重复：${r.slug}`);
    if (r.slug) seen.add(r.slug);
    for (const w of r.warns) console.log(`  ⚠ ${r.label} ${w}`);
    if (r.errs.length) {
      bad++;
      console.log(`  ✗ ${r.label} ${r.errs.join("; ")}`);
    } else {
      ready.push(r);
      // 英文化闸门的结果必须**可见**：dry-run 时把最终 main_products 打出来，
      // 否则「闸门跑过了」和「闸门真的替换了」在输出上无法区分。
      if (SHOW_PAYLOAD) {
        console.log(`  · ${r.slug}  main_products = ${JSON.stringify(r.payload.main_products)}`);
      }
    }
  }
  console.log(`\n校验：通过 ${ready.length}｜不通过 ${bad}\n`);
  if (bad > 0) {
    console.error("❌ 存在不合规行，拒绝写入（未触碰数据库）");
    process.exit(1);
  }
  if (ready.length === 0) {
    console.error("❌ 无可用行");
    process.exit(1);
  }

  let inserted = 0;
  let patched = 0;
  let noop = 0;
  for (const r of ready) {
    const existing = await getBySlug(r.slug);
    if (existing.length === 0) {
      console.log(`  + INSERT ${r.slug}`);
      if (APPLY) await insert(r.payload);
      inserted++;
      continue;
    }
    const { patchBody, filled } = nullOnlyPatch(existing[0], r.payload);
    if (filled.length === 0) {
      console.log(`  = SKIP   ${r.slug}（无空字段可补）`);
      noop++;
      continue;
    }
    console.log(`  ~ PATCH  ${r.slug} → 补 ${filled.join(", ")}`);
    if (APPLY) await patch(r.slug, patchBody);
    patched++;
  }

  console.log(
    `\n汇总：INSERT ${inserted}｜PATCH ${patched}｜SKIP ${noop}｜合计 ${ready.length}`
  );
  if (!APPLY) console.log("（DRY-RUN：未写库。确认无误后加 --apply）");
  else console.log("✅ 已写入。注意：`is_published` 仍为 false —— 需人工审核后再单独发布。");
})().catch((e) => {
  console.error("❌ 运行失败：", e.message);
  process.exit(1);
});
