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
// 超预算时的收尾顺序：① 句末标点 → ② 词边界 → ③ 剥掉悬空标点。
//   背景：化工页此前对正文直接 `.slice(0, 200)`，截出的描述以「…, 」结尾（半句话），
//   既是可见的内容缺陷，也浪费了本就有限的展示位。
const CJK_RE = /[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const SENTENCE_END_RE = /[.。!！?？]/;
const DANGLING_TAIL_RE = /[\s,;:，、；：\-–—]+$/u;

export function trimMetaDescription(
  text: string,
  opts?: { cjkBudget?: number; latinBudget?: number }
): string {
  const budget = CJK_RE.test(text) ? opts?.cjkBudget ?? 90 : opts?.latinBudget ?? 158;
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

export function buildPageMetadata({ locale, path, title, description, robots, withBrand = true }: MetaInput): Metadata {
  const finalTitle = withBrand ? `${title} | FactoryAuditB2B` : title;
  return {
    title: finalTitle,
    description,
    alternates: { canonical: canonicalFor(locale, path), languages: hreflangFor(path) },
    openGraph: {
      title: finalTitle,
      description,
      type: "website",
      url: canonicalFor(locale, path),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description,
      images: [OG_IMAGE],
    },
    robots: robots ?? { index: true, follow: true },
  };
}
