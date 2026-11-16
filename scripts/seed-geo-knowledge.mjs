#!/usr/bin/env node
/**
 * scripts/seed-geo-knowledge.mjs —— 把 data/geo/seed-geo-*.json upsert 进
 * public.geo_knowledge_pages（GEO/AI Search 问答页）。
 *
 * 数据源：data/geo/ 下所有 seed-geo-*.json（当前 en 5 篇 + zh 2 篇）。
 * 新增语种只需往 data/geo/ 放一个 seed-geo-<locale>.json，本脚本零改动。
 *
 * 用法：
 *   node --env-file-if-exists=.env scripts/seed-geo-knowledge.mjs
 *   node --env-file-if-exists=.env scripts/seed-geo-knowledge.mjs --dry-run
 *
 * 为什么直连 PostgREST 而不用 supabase-js：
 *   与 seed-suppliers-direct.mjs 同因 —— supabase-js 在 INSERT/UPSERT 前会用
 *   OpenAPI schema 做客户端校验，刚跑完 DDL 时 PostgREST 的 schema cache 往往还没刷新，
 *   会报 "Could not find the table in the schema cache"，而服务端其实已经能用。
 *   直连 /rest/v1 绕开这层缓存。
 *
 * 幂等：on_conflict=(slug,locale) + resolution=merge-duplicates。
 *
 * 🔴 三条硬约束（违反即中止，不做部分写入）：
 *   1. 结构校验先于任何网络请求：任一页不合法 ⇒ 整批不写。
 *   2. 空串 / 纯空白字符串一律拒收（R76：空串会穿透 ?? null 落到数据库里）。
 *   3. 写完必须回读核对：seed 里每个 slug 都要在库中、category 要对得上，
 *      否则 exit 1。绝不「写成功了」就报成功。
 *
 * 🔴 写库 ≠ 上线：本站前台全部预渲染，必须重新构建部署才会出现在线上。
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const TABLE = "geo_knowledge_pages";
const DATA_DIR = resolve(process.cwd(), "data/geo");
const DRY_RUN = process.argv.includes("--dry-run");

/** 所有 seed-geo-*.json，按文件名排序保证写入顺序稳定。 */
const SRCS = readdirSync(DATA_DIR)
  .filter((f) => /^seed-geo-.*\.json$/.test(f))
  .sort()
  .map((f) => resolve(DATA_DIR, f));

if (SRCS.length === 0) {
  console.error(`❌ ${DATA_DIR} 下没有 seed-geo-*.json`);
  process.exit(1);
}

/** 读取并合并全部种子文件。重复 (slug,locale) 由后续统一校验捕获。 */
function loadAll() {
  const merged = [];
  for (const src of SRCS) {
    let raw;
    try {
      raw = JSON.parse(readFileSync(src, "utf8"));
    } catch (e) {
      throw new Error(`读不到或解析失败：${src}\n   ${e.message}`);
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(`种子文件必须是非空 JSON 数组：${src}`);
    }
    merged.push(...raw);
  }
  return merged;
}

// 与迁移 060 + 061 的 CHECK 约束、lib/geoKnowledge.ts 的 GEO_CATEGORIES 三处同源。
// 未在此列出的 category 一律整批拒收 —— 不静默降级成 'guide'，避免内容被错误归类。
const CATEGORIES = ["guide", "comparison", "capa-guide", "standard", "industry"];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

if (!URL_BASE || !KEY) {
  console.error("❌ 缺少环境变量：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// ─────────────────────────── 校验 ───────────────────────────

/** 非空字符串（trim 后）。空串 / 纯空白 / 非字符串一律视为缺失。 */
function isText(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validateTextList(list, label, { allowEmpty }) {
  if (list === undefined || list === null) {
    return allowEmpty ? [] : [`${label}: 缺失`];
  }
  if (!Array.isArray(list)) return [`${label}: 不是数组`];
  if (list.length === 0) return allowEmpty ? [] : [`${label}: 空数组`];
  const bad = list.findIndex((x) => !isText(x));
  if (bad >= 0) return [`${label}[${bad}]: 空串或非字符串`];
  return [];
}

/**
 * 校验并转成入库行（camelCase → snake_case）。
 * 返回 { row, errors }；errors 非空则 row 不可用。
 */
function toRow(page, index) {
  const errors = [];
  const at = `#${index} ${page?.slug ?? "(no slug)"}`;

  if (!page || typeof page !== "object") return { row: null, errors: [`${at}: 不是对象`] };

  if (!isText(page.slug)) errors.push(`${at}: slug 缺失`);
  else if (!SLUG_RE.test(page.slug)) {
    errors.push(`${at}: slug "${page.slug}" 不是 kebab-case（只允许小写字母/数字/连字符）`);
  }
  if (!isText(page.locale)) errors.push(`${at}: locale 缺失`);
  if (!isText(page.category)) errors.push(`${at}: category 缺失`);
  else if (!CATEGORIES.includes(page.category)) {
    errors.push(`${at}: category "${page.category}" 不在 ${CATEGORIES.join("/")}`);
  }
  if (!isText(page.h1Question)) errors.push(`${at}: h1Question 缺失`);
  if (!isText(page.blufSummary)) errors.push(`${at}: blufSummary 缺失`);

  // ── 对比表：headers 与每行单元格数必须严格一致 ──
  let comparisonTable = null;
  if (page.comparisonTable != null) {
    const t = page.comparisonTable;
    const heads = t?.headers;
    const rows = t?.rows;
    if (!Array.isArray(heads) || heads.length === 0) {
      errors.push(`${at}: comparisonTable.headers 缺失或为空`);
    } else if (heads.some((h) => !isText(h))) {
      errors.push(`${at}: comparisonTable.headers 含空串`);
    } else if (!Array.isArray(rows) || rows.length === 0) {
      errors.push(`${at}: comparisonTable.rows 缺失或为空`);
    } else {
      rows.forEach((r, ri) => {
        if (!Array.isArray(r)) {
          errors.push(`${at}: comparisonTable.rows[${ri}] 不是数组`);
          return;
        }
        if (r.length !== heads.length) {
          // 列数不齐会渲染出缺格 / 错位的表，宁可整批不写
          errors.push(
            `${at}: comparisonTable.rows[${ri}] 有 ${r.length} 格，表头是 ${heads.length} 列`
          );
        }
        if (r.some((c) => !isText(c))) {
          errors.push(`${at}: comparisonTable.rows[${ri}] 含空串单元格`);
        }
      });
      if (errors.length === 0) comparisonTable = { headers: heads, rows };
    }
  }

  errors.push(...validateTextList(page.zeroToleranceList, `${at}: zeroToleranceList`, { allowEmpty: true }));

  let faqs = [];
  if (page.faqs != null) {
    if (!Array.isArray(page.faqs)) errors.push(`${at}: faqs 不是数组`);
    else {
      page.faqs.forEach((f, fi) => {
        if (!isText(f?.question)) errors.push(`${at}: faqs[${fi}].question 缺失`);
        if (!isText(f?.answer)) errors.push(`${at}: faqs[${fi}].answer 缺失`);
      });
      if (page.faqs.length === 0) errors.push(`${at}: faqs 为空数组`);
      faqs = page.faqs.map((f) => ({ question: f.question, answer: f.answer }));
    }
  }

  if (errors.length > 0) return { row: null, errors };

  const row = {
    slug: page.slug.trim(),
    locale: page.locale.trim(),
    category: page.category.trim(),
    // 缺失即落默认值，不用空串（R76）
    target_audience: isText(page.targetAudience) ? page.targetAudience.trim() : "western_buyer",
    h1_question: page.h1Question.trim(),
    bluf_summary: page.blufSummary.trim(),
    // 可见标题：缺失 → NULL → 页面对应块整块不渲染（绝不留空 <h2>）
    comparison_title: isText(page.comparisonTitle) ? page.comparisonTitle.trim() : null,
    comparison_table: comparisonTable,
    zero_tolerance_title: isText(page.zeroToleranceTitle) ? page.zeroToleranceTitle.trim() : null,
    zero_tolerance_list: page.zeroToleranceList ?? [],
    faqs,
  };
  return { row, errors: [] };
}

// ─────────────────────────── 主流程 ───────────────────────────

function main() {
  console.log(`数据源（${SRCS.length} 个）：`);
  SRCS.forEach((s) => console.log(`   · ${s.replace(process.cwd() + "/", "")}`));

  let raw;
  try {
    raw = loadAll();
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  const errors = [];
  const rows = [];
  const seen = new Set();
  raw.forEach((page, i) => {
    const { row, errors: e } = toRow(page, i);
    errors.push(...e);
    if (!row) return;
    const key = `${row.slug}::${row.locale}`;
    if (seen.has(key)) errors.push(`#${i}: (slug, locale) 重复 —— ${key}`);
    seen.add(key);
    rows.push(row);
  });

  if (errors.length > 0) {
    // 结构错误一律整批中止：部分写入会让线上出现「一半页面在、一半不在」
    console.error(`❌ 结构校验失败（${errors.length} 条），未写入任何数据：`);
    errors.forEach((e) => console.error(`   · ${e}`));
    process.exit(1);
  }

  console.log(`✅ 结构校验通过：${rows.length} 页`);
  rows.forEach((r) =>
    console.log(
      `   · ${r.slug.padEnd(52)} ${r.category.padEnd(11)} ` +
        `表 ${r.comparison_table ? r.comparison_table.rows.length + "行" : "—"} · ` +
        `零容忍 ${r.zero_tolerance_list.length} · FAQ ${r.faqs.length}`
    )
  );

  if (DRY_RUN) {
    console.log("🟡 --dry-run：已跳过写库。");
    return;
  }

  console.log(`\n→ upsert 到 ${TABLE} …`);
  return fetch(`${URL_BASE}/rest/v1/${TABLE}?on_conflict=slug,locale`, {
    method: "POST",
    headers: {
      ...H,
      // merge-duplicates = 冲突时 UPDATE；return=representation 让服务端把落库结果回给我们核对
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  })
    .then(async (res) => {
      const body = await res.text();
      if (!res.ok) {
        throw new Error(`PostgREST ${res.status} ${res.statusText}\n${body.slice(0, 1200)}`);
      }
      let written = [];
      try {
        written = JSON.parse(body);
      } catch {
        throw new Error(`响应不是 JSON：${body.slice(0, 400)}`);
      }
      if (!Array.isArray(written) || written.length !== rows.length) {
        throw new Error(
          `回写条数不符：发出 ${rows.length} 条，服务端返回 ${Array.isArray(written) ? written.length : "非数组"}`
        );
      }
      console.log(`✅ upsert 完成：${written.length} 条`);
      return verify();
    })
    .catch((e) => {
      console.error(`❌ 写库失败：${e.message}`);
      process.exit(1);
    });
}

/** 回读核对：每个 seed slug 都必须在库中，且 category / 块数量对得上。 */
async function verify() {
  const expected = loadAll();
  const res = await fetch(
    `${URL_BASE}/rest/v1/${TABLE}?select=slug,locale,category,updated_at,` +
      `comparison_table,zero_tolerance_list,faqs&order=slug`,
    { headers: H }
  );
  if (!res.ok) throw new Error(`回读失败 ${res.status}：${(await res.text()).slice(0, 400)}`);
  const live = await res.json();

  const byKey = new Map(live.map((r) => [`${r.slug}::${r.locale}`, r]));
  const problems = [];
  for (const p of expected) {
    const key = `${p.slug}::${p.locale ?? "en"}`;
    const hit = byKey.get(key);
    if (!hit) {
      problems.push(`库中查无此行：${key}`);
      continue;
    }
    if (hit.category !== p.category) {
      problems.push(`${key}: category 库里是 ${hit.category}，seed 是 ${p.category}`);
    }
    const liveRows = Array.isArray(hit.comparison_table?.rows) ? hit.comparison_table.rows.length : 0;
    const seedRows = Array.isArray(p.comparisonTable?.rows) ? p.comparisonTable.rows.length : 0;
    if (liveRows !== seedRows) problems.push(`${key}: 对比表行数 库里 ${liveRows}，seed ${seedRows}`);
    const liveFaq = Array.isArray(hit.faqs) ? hit.faqs.length : 0;
    if (liveFaq !== (p.faqs?.length ?? 0)) problems.push(`${key}: FAQ 数 库里 ${liveFaq}`);
  }

  if (problems.length > 0) {
    console.error("❌ 回读核对未通过：");
    problems.forEach((p) => console.error(`   · ${p}`));
    process.exit(1);
  }

  // 库里多出来的行只提示不删除 —— 可能是运营手工加的，静默删库是不可接受的
  const seedKeys = new Set(expected.map((p) => `${p.slug}::${p.locale ?? "en"}`));
  const extra = live.filter((r) => !seedKeys.has(`${r.slug}::${r.locale}`));
  if (extra.length > 0) {
    console.log(`\nℹ️ 库中另有 ${extra.length} 行不在本次 seed 里（未改动）：`);
    extra.forEach((r) => console.log(`   · ${r.slug}::${r.locale}`));
  }

  console.log(`\n✅ 回读核对通过：${expected.length} 页全部就位（库内共 ${live.length} 行）`);
  console.log("🔴 写库 ≠ 上线：前台为预渲染，需重新构建部署才会出现在线上。");
}

main();
