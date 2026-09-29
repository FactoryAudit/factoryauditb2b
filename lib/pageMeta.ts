// 统一页面 metadata 工具：保证每个页面都有正确的 canonical / hreflang / OG / robots。
// 修复 SEO-AUDIT P0-1：此前 16 个页面继承根 layout 的 canonicalFor(locale, "/")，全部指向首页。
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { hreflangFor, canonicalFor } from "@/i18n/hreflang";
import { COVERAGE_COUNTRY_SENTENCE } from "@/lib/coverage";

// 全局品牌分享图（1200x630，供 Open Graph / Twitter Card 使用）。
// 此前 openGraph 没有 images，社交分享与富媒体展示缺失。
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: `FactoryAuditB2B: supplier verification and factory audit in ${COVERAGE_COUNTRY_SENTENCE}`,
};

type MetaInput = {
  locale: Locale;
  path: string; // 去掉语言前缀的路径，如 /pricing
  title: string; // 最终 title（可含品牌，也可不含）
  description: string;
  robots?: Partial<Metadata["robots"]>; // 例如 { index: false }
  withBrand?: boolean; // 是否自动追加 "| FactoryAuditB2B"
};

// ── meta description 长度闸门（工单 SEO-20260918-FAB 任务 2.1）─────────────────
// 预算按**实际书写系统**决定，而不是按 locale 统一写死一个字符数：
//   · CJK（汉字 / 假名 / 谚文）单字宽约 20px ⇒ 汉字 70–90 字已是中文／日文的实用
//     上限（与工单口径一致）；拉丁字母均宽约 5.8px ⇒ 158 字 ≈ 920px。
//   · 因此「把描述统一补到 120–160 字符」对 zh / zh-TW / ja 是**错的**——
//     那会把它们撑到被截断（实测该三语当前为 43–81 字，本身合规）。
//   · 判定「算 CJK 还是算拉丁」用**占比**（见下方 isCjkDominant），不用「含 1 个汉字」。
// 超预算时的收尾顺序：① 句末标点 → ② 词边界 → ③ 剥掉悬空标点。
//   背景：化工页此前对正文直接 `.slice(0, 200)`，截出的描述以「…, 」结尾（半句话），
//   既是可见的内容缺陷，也浪费了本就有限的展示位。
const CJK_RE = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
// stage1.6：CJK 判定从「命中 1 个汉字」改为「CJK 字符占比」。
//   起因：行业分类页把 {industry} 换成**双语行业名**（`Food & Beverage / 食品饮料`），
//   整段拉丁文案里混进 4 个汉字 ⇒ 旧的 `CJK_RE.test()` 直接把预算压到 90，
//   实测把 13 行业 × 多语种的分类页 desc 夹在 64–90（本可写到 158）。
//   阈值 25% 的余量很宽：纯中文/日文 ≈ 45%+；「拉丁长句 + 双语短名」≈ 3–10%。
//
//   stage1.7：desc 阈值由 25% 下调到 10%（title 保持 25%，理由见下）。
//   起因：供应商详情页的公司法定名常含中文（如「南京麦克森OE科技有限公司」），
//   整段拉丁文案的 CJK 占比落在 **16–26%** —— 按 25% 判定会**漏判**，
//   让这些页面误走拉丁 158 预算，desc 可达 155 字符（超中文展示位）。
//   下调到 10% 后两类页面被精确分开：
//     · 行业分类页（双语行业名，占比 2.6–5%）→ 仍走拉丁 158；
//     · 供应商详情页（中文公司名，占比 16–26%）→ 回落 CJK 90。
//
//   🔴 desc 与 title 必须用**不同**阈值 —— 这是两个常量的存在理由：
//     同一个「含中文公司名的拉丁标题」若也按 10% 判 CJK，title 主体预算会从
//     65 掉到 36。实测（stage1.7 离线预演）：会让 41 页 title 被额外裁剪，如
//     `en/suppliers/nanjing-mxcomm` 68 → 30、`ja/…/claim` 77 → 32。
//     desc 的诉求是「中文展示位，宁短勿长」；title 的诉求是「别误裁主体」
//     （标题短了照样能被检索到）。目标不同，阈值就该不同。
const CJK_RE_G = new RegExp(CJK_RE.source, "g");
const CJK_DESC_RATIO = 0.1;
const CJK_TITLE_RATIO = 0.25;

/**
 * 该串是否以 CJK 为主（CJK 字符占比 > ratio）。
 *
 * @param ratio 默认 10%（desc 口径）。title 口径须显式传 25%，
 *              否则含中文公司名的拉丁标题会被误判成 CJK 并裁掉主体。
 */
export function isCjkDominant(text: string, ratio: number = CJK_DESC_RATIO): boolean {
  if (!text) return false;
  const total = [...text].length;
  if (total === 0) return false;
  const cjk = (text.match(CJK_RE_G) ?? []).length;
  return cjk / total > ratio;
}
const SENTENCE_END_RE = /[.。!！?？]/;
const DANGLING_TAIL_RE = /[\s,;:，、；：\-–—]+$/u;

export function trimMetaDescription(
  text: string,
  opts?: { cjkBudget?: number; latinBudget?: number }
): string {
  const budget = isCjkDominant(text) ? opts?.cjkBudget ?? 90 : opts?.latinBudget ?? 158;
  const chars = [...text];
  if (chars.length <= budget) return text;
  const head = chars.slice(0, budget).join("");
  // ① 句末标点（取预算内最靠后的一处，保留标点本身）
  for (let i = head.length - 1; i >= 0; i--) {
    if (SENTENCE_END_RE.test(head[i])) return head.slice(0, i + 1).trim();
  }
  // ② 词边界 ③ 剥掉悬空的逗号／分号／破折号
  const sp = head.lastIndexOf(" ");
  return (sp > 0 ? head.slice(0, sp) : head).replace(DANGLING_TAIL_RE, "").trim();
}

// ── meta title 长度闸门（2026-09-29 阶段 1，宽松安全网）───────────────────────
// 与 trimMetaDescription 的差异是**有意为之**：
//   · 只作兜底。预算刻意放宽（拉丁 65 / CJK 36 个字符），正常文案不会被改动；
//     zh / zh-TW / ja 现有标题最长 36 字，因此该预算对本项目 CJK 标题是零命中。
//   · 预算只作用于**品牌段之前的主体**，品牌段（" | FactoryAuditB2B" 及其后可能
//     存在的产品名，如 "... | FactoryAuditB2B RiskScore™"）永远保留、永不裁掉。
//   · CJK 不套用拉丁的 50–60 预算：汉字单字宽约为拉丁字母两倍，36 个汉字已约合
//     72 个半角宽，接近 SERP 实用上限；对中文套 50 会把它撑到被截断。
//   · 断裂顺序：① 分隔符断句（比词边界更自然）→ ② 词边界 → ③ 兜底保留原文。
//   · 幂等：未超预算的 title 原样返回。
const TITLE_BRAND_TOKEN = "FactoryAuditB2B";
const TITLE_SEPARATOR_RE = /[|｜—–·:：/／]/;
const TITLE_LATIN_BODY_BUDGET = 65;
const TITLE_CJK_BODY_BUDGET = 36;
// 分隔符断句至少保留预算的这一比例，避免退化成 "PPAP" 这类几乎无信息的标题
const TITLE_MIN_KEEP_RATIO = 0.35;

export function trimMetaTitle(
  text: string,
  opts?: { cjkBudget?: number; latinBudget?: number }
): string {
  if (!text) return text;
  // 1) 把「品牌段及其前置分隔符」整体划为不可裁的尾巴
  let body = text;
  let tail = "";
  const brandAt = text.indexOf(TITLE_BRAND_TOKEN);
  if (brandAt > 0) {
    const before = text.slice(0, brandAt);
    const cands = [" | ", " — ", " – ", " · ", "|", "—", "–"]
      .map((s) => before.lastIndexOf(s))
      .filter((i) => i >= 0);
    const cut = cands.length > 0 ? Math.max(...cands) : brandAt;
    body = text.slice(0, cut);
    tail = text.slice(cut);
  }
  // 🔴 显式传 title 口径（25%），不要用默认的 desc 口径（10%）——
  //    否则含中文公司名的拉丁标题会被判成 CJK，主体预算 65 → 36，标题被砍掉一半。
  const budget = isCjkDominant(body, CJK_TITLE_RATIO)
    ? opts?.cjkBudget ?? TITLE_CJK_BODY_BUDGET
    : opts?.latinBudget ?? TITLE_LATIN_BODY_BUDGET;
  const chars = [...body];
  if (chars.length <= budget) return text;
  const head = chars.slice(0, budget).join("");
  const minKeep = Math.max(12, Math.floor(budget * TITLE_MIN_KEEP_RATIO));
  // ① 分隔符断句
  for (let i = head.length - 1; i >= 0; i--) {
    if (TITLE_SEPARATOR_RE.test(head[i]) && i >= minKeep) {
      return head.slice(0, i).replace(DANGLING_TAIL_RE, "").trim() + tail;
    }
  }
  // ② 词边界
  const sp = head.lastIndexOf(" ");
  const trimmed = (sp >= minKeep ? head.slice(0, sp) : head).replace(DANGLING_TAIL_RE, "").trim();
  // ③ 兜底：裁完几乎没有信息量，就宁可保留原文（长标题仍可被搜素引擎自行截断）
  if ([...trimmed].length < Math.min(12, minKeep)) return text;
  return trimmed + tail;
}

export function buildPageMetadata({ locale, path, title, description, robots, withBrand = true }: MetaInput): Metadata {
  // 去重：部分页面（如集群页 seo_title）已自带品牌名，避免 "... | FactoryAuditB2B | FactoryAuditB2B"
  const BRAND_SUFFIX = " | FactoryAuditB2B";
  const finalTitle = trimMetaTitle(
    withBrand && !title.includes("FactoryAuditB2B") ? `${title}${BRAND_SUFFIX}` : title
  );
  // ── description 长度闸门统一收口（2026-09-29）────────────────────────────
  // 此前 `trimMetaDescription` 只在少数静态页被手动调用，而 guides / audit-guide /
  // industry 等**动态页直接输出**源码里的 metaDescEn / metaDescZh，
  // 于是超出预算（拉丁 158 / CJK 90）的元描述原样上线 ——
  // 这是 GSC「元描述过长」的主要来源（实测既有指南 162ch / 200ch）。
  // 收口到统一入口后，超预算的会被裁到句末标点或词边界；合规描述原样返回（幂等）。
  const finalDescription = trimMetaDescription(description);
  return {
    title: finalTitle,
    description: finalDescription,
    alternates: { canonical: canonicalFor(locale, path), languages: hreflangFor(path) },
    openGraph: {
      title: finalTitle,
      description: finalDescription,
      type: "website",
      url: canonicalFor(locale, path),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: finalDescription,
      images: [OG_IMAGE],
    },
    robots: robots ?? { index: true, follow: true },
  };
}
