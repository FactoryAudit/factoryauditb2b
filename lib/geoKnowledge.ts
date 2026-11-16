// lib/geoKnowledge.ts —— GEO / AI Search 问答页的**唯一读取入口**
//
// 数据表：public.geo_knowledge_pages（迁移 060），写入方只有
// scripts/seed-geo-knowledge.mjs。前台三个路由族共用本文件：
//   · app/[locale]/guides/[slug]     → category = guide | comparison
//   · app/[locale]/standards/[slug]  → category = standard
//   · app/[locale]/industry/[slug]   → category = industry
//
// ── 失败方向（这是本次最要紧的设计）─────────────────────────────────────
// 两种"没配"必须分开对待，混在一起就是 2026-11-08 sitemap 事故的同型问题
// （静默产出更少的条目而无人察觉）：
//   · isAdminConfigured() === false  ⇒ 本地未配环境变量，明确视为「本功能未启用」，
//     返回空数组并打 warn。此时页面 404、sitemap 不收录 —— 是预期行为。
//   · 已配置但网络 / SQL 出错       ⇒ **抛出**，让构建失败。
//     绝不返回空数组冒充"本来就没有内容"。
//
// ── 语言回退 ────────────────────────────────────────────────────────────
// 一行 = 一个 (slug, locale)。当前只有 en 正文（9 语字典已冻结，暂不新增译文）。
// 读取时精确匹配 locale，缺失回落 'en' —— 与 lib/pickGuideDesc.ts 同一套策略。
// 后续补译文只需插入 locale='ja' 等行，本文件与页面零改动。

import { createAdminClient, isAdminConfigured } from "./supabaseAdmin";

export const GEO_CATEGORIES = [
  "guide",
  "comparison",
  // 整改清单型指南（第二批中文稿件引入）。与 guide 的区别只是标签更具体，
  // 路由仍归 /guides —— 见下方 GEO_ROUTE_SEGMENT。
  "capa-guide",
  "standard",
  "industry",
] as const;
export type GeoCategory = (typeof GEO_CATEGORIES)[number];

/**
 * category → 路由段。**这是 category 与 URL 的唯一映射表**。
 * 新增 category 必须同步三处：本表 + 迁移里的 CHECK 约束 + 对应路由页。
 */
export const GEO_ROUTE_SEGMENT: Record<GeoCategory, string> = {
  guide: "guides",
  comparison: "guides",
  "capa-guide": "guides",
  standard: "standards",
  industry: "industry",
};

export function isGeoCategory(v: unknown): v is GeoCategory {
  return typeof v === "string" && (GEO_CATEGORIES as readonly string[]).includes(v);
}

export type GeoComparisonTable = { headers: string[]; rows: string[][] };
export type GeoFaq = { question: string; answer: string };

export type GeoKnowledgePage = {
  slug: string;
  /** 文案实际语种（回退发生时可能是 'en'，而页面 locale 是别的语言） */
  locale: string;
  category: GeoCategory;
  targetAudience: string;
  h1Question: string;
  blufSummary: string;
  /** 对比表可见标题；null ⇒ 整块不渲染（不留空 <h2>） */
  comparisonTitle: string | null;
  comparisonTable: GeoComparisonTable | null;
  zeroToleranceTitle: string | null;
  zeroToleranceList: string[];
  faqs: GeoFaq[];
  /** 可选页级 CTA：两者都有效时才覆盖渲染壳的全局默认 CTA */
  ctaLabel: string | null;
  ctaHref: string | null;
  /** ISO 时间串；sitemap 的 lastmod 直接用它，缺失则不传（R60） */
  updatedAt: string | null;
};

/** 该页在站内的规范路径（**不含**语言前缀）。sitemap / 内链共用此函数。 */
export function geoPath(p: Pick<GeoKnowledgePage, "category" | "slug">): string {
  return `/${GEO_ROUTE_SEGMENT[p.category]}/${p.slug}`;
}

// ─────────────────────────── 行 → 领域对象 ───────────────────────────

type GeoRow = {
  slug: string | null;
  locale: string | null;
  category: string | null;
  target_audience: string | null;
  h1_question: string | null;
  bluf_summary: string | null;
  comparison_title: string | null;
  comparison_table: unknown;
  zero_tolerance_title: string | null;
  zero_tolerance_list: unknown;
  faqs: unknown;
  cta_label: string | null;
  cta_href: string | null;
  updated_at: string | null;
};

/**
 * 页级 CTA 链接校验：只接受站内绝对路径。
 * 拒绝协议相对（//evil.com）、带协议/主机、javascript: 等，杜绝种子数据外链注入。
 */
function safeInternalHref(v: unknown): string | null {
  const href = text(v);
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  if (/[:\s]/.test(href.split("?")[0])) return null; // 路径段里不应有冒号或空白
  return href;
}

function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function textList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => text(x)).filter((x): x is string => x !== null);
}

/**
 * jsonb 里的对比表。形状不合法时返回 null 并 warn —— 渲染一张缺格 / 错位的表
 * 比不渲染更糟，且 seed 脚本在写入前已做过列数校验，走到这里说明有人手工改过库。
 */
function normalizeTable(v: unknown, slug: string): GeoComparisonTable | null {
  if (v === null || v === undefined) return null;
  const headers = (v as { headers?: unknown }).headers;
  const rows = (v as { rows?: unknown }).rows;
  if (!Array.isArray(headers) || headers.length === 0 || !Array.isArray(rows) || rows.length === 0) {
    console.warn(`[geoKnowledge] ${slug}: comparison_table 缺 headers/rows，已跳过该表`);
    return null;
  }
  const hs = headers.map((h) => text(h));
  if (hs.some((h) => h === null)) {
    console.warn(`[geoKnowledge] ${slug}: comparison_table.headers 含空值，已跳过该表`);
    return null;
  }
  const normalizedRows: string[][] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length !== hs.length) {
      console.warn(
        `[geoKnowledge] ${slug}: comparison_table 某行单元格数与表头不符（表头 ${hs.length}），已跳过该表`
      );
      return null;
    }
    const cells = r.map((c) => text(c));
    if (cells.some((c) => c === null)) {
      console.warn(`[geoKnowledge] ${slug}: comparison_table 含空单元格，已跳过该表`);
      return null;
    }
    normalizedRows.push(cells as string[]);
  }
  return { headers: hs as string[], rows: normalizedRows };
}

function normalizeFaqs(v: unknown, slug: string): GeoFaq[] {
  if (!Array.isArray(v)) return [];
  const out: GeoFaq[] = [];
  for (const f of v) {
    const q = text((f as { question?: unknown })?.question);
    const a = text((f as { answer?: unknown })?.answer);
    // 问答必须成对：只有一半的条目既不能显示也不能进 FAQPage 结构化数据
    if (!q || !a) {
      console.warn(`[geoKnowledge] ${slug}: faqs 存在缺 question/answer 的条目，已跳过该项`);
      continue;
    }
    out.push({ question: q, answer: a });
  }
  return out;
}

function toPage(row: GeoRow): GeoKnowledgePage | null {
  const slug = text(row.slug);
  const category = row.category;
  const h1 = text(row.h1_question);
  const bluf = text(row.bluf_summary);

  // 缺 slug / category / 正文的行无法成页 —— 直接丢弃并 warn，不渲染半张页面
  if (!slug || !isGeoCategory(category) || !h1 || !bluf) {
    console.warn(
      `[geoKnowledge] 跳过无法成页的行：slug=${row.slug} category=${row.category}` +
        `${!h1 ? "（缺 h1_question）" : ""}${!bluf ? "（缺 bluf_summary）" : ""}`
    );
    return null;
  }

  return {
    slug,
    locale: text(row.locale) ?? "en",
    category,
    targetAudience: text(row.target_audience) ?? "western_buyer",
    h1Question: h1,
    blufSummary: bluf,
    comparisonTitle: text(row.comparison_title),
    comparisonTable: normalizeTable(row.comparison_table, slug),
    zeroToleranceTitle: text(row.zero_tolerance_title),
    zeroToleranceList: textList(row.zero_tolerance_list),
    faqs: normalizeFaqs(row.faqs, slug),
    ctaLabel: text(row.cta_label),
    ctaHref: safeInternalHref(row.cta_href),
    updatedAt: text(row.updated_at),
  };
}

// ─────────────────────────── 取数 ───────────────────────────

// 🔴 显式列字段：新增 DB 列必须同步这里，否则 toPage 永远读到 undefined 且 tsc 不报
//    （GeoRow 是手写类型）。2026-11-16 加 cta_label/cta_href 时就踩过这个坑。
const SELECT =
  "slug,locale,category,target_audience,h1_question,bluf_summary," +
  "comparison_title,comparison_table,zero_tolerance_title,zero_tolerance_list,faqs," +
  "cta_label,cta_href,updated_at";

/**
 * 构建期缓存。9 个语言分片 × 3 个路由族会让 generateStaticParams / 页面 / sitemap
 * 反复取同一批行，这里只查一次。
 * 🔴 失败**不缓存** rejected promise（否则一次抖动会被后续所有调用"继承"）。
 */
let cache: Promise<GeoKnowledgePage[]> | null = null;

async function fetchPages(): Promise<GeoKnowledgePage[]> {
  if (!isAdminConfigured()) {
    console.warn(
      "[geoKnowledge] 未配置 Supabase（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY），" +
        "GEO 问答页视为未启用：页面 404、不进 sitemap。"
    );
    return [];
  }

  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("geo_knowledge_pages").select(SELECT).order("slug");
  if (error) {
    // 🔴 已配置却取数失败 = 真故障。抛出让构建失败，绝不退化成「本来就没有页面」。
    throw new Error(`[geoKnowledge] 读取 geo_knowledge_pages 失败：${error.message}`);
  }

  // 本项目未接 Supabase 生成的 Database 类型（其余读取层同理），
  // select() 的返回被推断成 GenericStringError 联合，这里必须先过 unknown。
  const pages = ((data ?? []) as unknown as GeoRow[])
    .map((r) => toPage(r))
    .filter((p): p is GeoKnowledgePage => p !== null);

  return pages;
}

/** 全部行（含各语种），按 category 顺序 + slug 排序。仅供本文件与 sitemap 使用。 */
export function getGeoPagesRaw(): Promise<GeoKnowledgePage[]> {
  if (!cache) {
    cache = fetchPages().catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

function categoryRank(c: GeoCategory): number {
  return GEO_CATEGORIES.indexOf(c);
}

/**
 * 按 locale 解析后的页面列表：同一 slug 取精确语种，缺失回落 'en'。
 * generateStaticParams 与列表渲染都用它。
 */
export async function listGeoPages(locale?: string): Promise<GeoKnowledgePage[]> {
  const rows = await getGeoPagesRaw();
  const bySlug = new Map<string, GeoKnowledgePage[]>();
  for (const p of rows) {
    const bucket = bySlug.get(p.slug);
    if (bucket) bucket.push(p);
    else bySlug.set(p.slug, [p]);
  }

  const out: GeoKnowledgePage[] = [];
  for (const bucket of bySlug.values()) {
    const exact = locale ? bucket.find((p) => p.locale === locale) : undefined;
    // 回退顺序：精确语种 → en → 该 slug 的第一行（data 里存在但仍成页）
    const picked = exact ?? bucket.find((p) => p.locale === "en") ?? bucket[0];
    out.push(picked);
  }

  return out.sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.slug.localeCompare(b.slug));
}

/**
 * 取单页。传 categories 可限定路由族（例如 /guides 只认 guide|comparison）——
 * 这样同一 slug 不会在两类路径下各渲染一次。
 */
export async function getGeoPage(
  slug: string,
  locale?: string,
  categories?: readonly GeoCategory[]
): Promise<GeoKnowledgePage | null> {
  const all = await listGeoPages(locale);
  const hit = all.find((p) => p.slug === slug);
  if (!hit) return null;
  if (categories && !categories.includes(hit.category)) return null;
  return hit;
}

/** 同一路由族内除自己以外的页面，用于页尾互链（避免新增页面成为孤岛）。 */
export async function listRelatedGeoPages(
  self: Pick<GeoKnowledgePage, "category" | "slug">,
  locale?: string
): Promise<GeoKnowledgePage[]> {
  const all = await listGeoPages(locale);
  return all.filter((p) => !(p.category === self.category && p.slug === self.slug));
}
