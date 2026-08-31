#!/usr/bin/env node
/**
 * 用 DeepSeek 批量翻译未翻译的字典条目。
 *
 * 用法：
 *   node scripts/translate-deepseek.cjs                    # 翻译全部 7 语言
 *   node scripts/translate-deepseek.cjs --lang=ar,ja       # 只翻译指定语言
 *   node scripts/translate-deepseek.cjs --ns=risk,container # 只翻译指定命名空间
 *   node scripts/translate-deepseek.cjs --dry              # 只统计不写入
 *   node scripts/translate-deepseek.cjs --batch=40         # 每批条数（默认 30）
 *
 * 前置条件：.env 里 DEEPSEEK_API_KEY 已配置。
 *
 * 设计要点：
 * - 只翻译「与英文完全相同」的条目，已有翻译的不动（可重复运行、可续跑）
 * - 品牌词 / 行业缩写清单（KEEP_EN）直接跳过，永不被翻译
 * - 占位符 {country} {n} {done} 等原样保留，脚本会校验并在不一致时丢弃该批
 * - 每批结果写入 .workbuddy/translate-cache.json，中断后重跑自动跳过已完成批次
 * - 翻译失败只跳过该批，不中断整体流程
 */

const fs = require("fs");
const path = require("path");

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : def;
};
const ONLY_LANGS = arg("lang", "") ? arg("lang", "").split(",") : null;
const ONLY_NS = arg("ns", "") ? arg("ns", "").split(",") : null;
const DRY = argv.includes("--dry");
const BATCH = Number(arg("batch", "30"));

const ROOT = process.cwd();
const D = path.join(ROOT, "i18n", "dictionaries");
const CACHE_PATH = path.join(ROOT, ".workbuddy", "translate-cache.json");

// ---------- 读 .env ----------
const env = {};
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)\s*=\s*"?([^"]*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {}
const API_KEY = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "";

// ---------- 语言配置 ----------
const LANGS = {
  zh: "简体中文",
  es: "西班牙语（西班牙，面向拉美也通用）",
  de: "德语",
  fr: "法语",
  pt: "葡萄牙语（巴西）",
  ja: "日语",
  "zh-TW": "繁体中文（台湾）",
  ar: "阿拉伯语（现代标准阿拉伯语）",
};

// ---------- 不翻译的键（必须与 lock-brand-terms.cjs 保持一致） ----------
const KEEP_EN = new Set([
  "brand.name", "brand.eva", "brand.tagline",
  "nav.rfq",
]);

// ---------- 领域术语表：给模型上下文，避免乱翻 ----------
const GLOSSARY = `术语对照（请严格遵守，不要另译）：
- Factory Audit = 工厂验厂
- Supplier Verification = 供应商核查
- Inspection = 验货 / 检验
- Sourcing = 采购寻源
- Buyer = 买家；Supplier = 供应商/工厂；Auditor = 审核员
- Lead = 线索（销售线索）；RFQ = RFQ（保持英文）
- AQL = AQL（保持英文）；SMETA / BSCI / ISO / IATF / WRAP / Sedex = 保持英文
- man-day = 人天；MOQ = MOQ（保持英文）；FOB = FOB（保持英文）
- PSI / DUPRO / PPI / CLS = 保持英文（验货行业阶段缩写）
- 品牌名 FactoryAuditB2B 永远保持英文`;

// ---------- 工具函数 ----------
function flatten(obj, prefix = "", out = {}) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, p, out);
    else if (typeof v === "string") out[p] = v;
  }
  return out;
}

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) {
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;
function placeholders(s) {
  return (s.match(PLACEHOLDER_RE) || []).sort().join("|");
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}
function saveCache(c) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(c), "utf8");
  } catch {}
}

async function callDeepSeek(messages, maxTokens = 4000) {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
      stream: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJson(text) {
  // 模型可能用 ```json 包裹
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

// ---------- 主流程 ----------
async function main() {
  // dry run 不需要 key，先允许它跑完统计
  if (!API_KEY && !DRY) {
    console.error("✗ 未配置 DEEPSEEK_API_KEY。请在 .env 里填写后重跑。");
    console.error("  获取地址：https://platform.deepseek.com/api_keys");
    process.exit(1);
  }
  if (DRY) console.log("DRY RUN 模式：只统计，不调用 API、不写入文件\n");

  const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
  const enFlat = flatten(en);
  const cache = loadCache();

  const targets = Object.keys(LANGS).filter((l) => !ONLY_LANGS || ONLY_LANGS.includes(l));

  let grandTotal = 0;
  let grandDone = 0;

  for (const lang of targets) {
    const file = path.join(D, `${lang}.json`);
    const dict = JSON.parse(fs.readFileSync(file, "utf8"));
    const flat = flatten(dict);

    // 找出「仍是英文」且「不在保留清单」的条目
    const pending = [];
    for (const p of Object.keys(enFlat)) {
      if (KEEP_EN.has(p)) continue;
      if (ONLY_NS && !ONLY_NS.includes(p.split(".")[0])) continue;
      const cur = flat[p];
      const key = `${lang}::${p}`;
      if (cache[key] != null) continue; // 已翻过
      if (cur === undefined || cur === enFlat[p]) {
        // 跳过纯符号/数字/单字母（没有翻译意义）
        if (!/[A-Za-z]{3,}/.test(enFlat[p])) continue;
        pending.push({ path: p, text: enFlat[p] });
      }
    }

    if (pending.length === 0) {
      console.log(`[${lang}] 无需翻译，跳过`);
      continue;
    }

    console.log(`\n[${lang}] ${LANGS[lang]} — 待翻译 ${pending.length} 条`);
    grandTotal += pending.length;
    if (DRY) continue;

    const batches = [];
    for (let i = 0; i < pending.length; i += BATCH) {
      batches.push(pending.slice(i, i + BATCH));
    }

    let done = 0;
    let failed = 0;

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      const payload = {};
      for (const item of batch) payload[item.path] = item.text;

      const system = `你是专业 B2B 外贸与供应链领域的本地化译员，正在把 FactoryAuditB2B（供应商核查 / 工厂验厂 / 产品验货平台）的界面文案翻译成${LANGS[lang]}。

要求：
1. 只输出 JSON，key 与输入完全一致，value 是译文。不要输出任何解释、不要代码块以外的文字。
2. 保留所有 {占位符}，形如 {country} {n} {done} {total}，原样不动。
3. 保留换行符 \\n、HTML 实体、数字、单位、URL、邮箱。
4. 语气：专业、克制、直接。不要营销腔，不要堆砌形容词。
5. 长度与英文大致相当，不要过度扩写。
6. 这是给海外采购商和工厂看的 B2B 界面，用词要符合行业习惯。

${GLOSSARY}`;

      const user = JSON.stringify(payload, null, 1);

      try {
        const raw = await callDeepSeek(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          Math.max(2000, batch.length * 120)
        );
        const out = extractJson(raw);

        let applied = 0;
        for (const item of batch) {
          const t = out[item.path];
          if (typeof t !== "string" || !t.trim()) continue;
          // 占位符校验：不一致说明模型篡改了结构，丢弃
          if (placeholders(t) !== placeholders(item.text)) continue;
          setPath(dict, item.path, t);
          cache[`${lang}::${item.path}`] = t;
          applied++;
        }
        done += applied;
        const skipped = batch.length - applied;
        if (skipped > 0) failed += skipped;
        process.stdout.write(`\r  批次 ${bi + 1}/${batches.length}  成功 ${done}  跳过 ${failed}   `);
        saveCache(cache);
        fs.writeFileSync(file, JSON.stringify(dict, null, 2), "utf8");
      } catch (e) {
        failed += batch.length;
        process.stdout.write(`\r  批次 ${bi + 1}/${batches.length}  失败: ${String(e.message).slice(0, 80)}   `);
        // 遇到 402（余额不足）或 401（key 无效）直接停，继续跑也没意义
        if (/HTTP 40[12]/.test(e.message)) {
          console.log("\n✗ API key 无效或余额不足，停止。请检查后重跑。");
          saveCache(cache);
          process.exit(1);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      // 轻微限速，避免触发 RPM
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`\n[${lang}] 完成：成功 ${done} 条，跳过/失败 ${failed} 条`);
    grandDone += done;
  }

  console.log(`\n${"=".repeat(50)}`);
  if (DRY) {
    console.log(`DRY RUN：共 ${grandTotal} 条待翻译（未写入）`);
  } else {
    console.log(`完成：共翻译 ${grandDone} / ${grandTotal} 条`);
    console.log(`缓存：${CACHE_PATH}（重跑会自动跳过已完成条目）`);
  }
}

main().catch((e) => {
  console.error("运行出错:", e);
  process.exit(1);
});
