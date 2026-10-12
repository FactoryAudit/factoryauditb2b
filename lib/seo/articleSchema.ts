// lib/seo/articleSchema.ts —— Article 结构化数据的**单一构造器**
//
// 背景（2026-10-12 全站 SEO 体检）：
//   此前 7 个页面组件（guides / case-studies / field-reports / chemicals /
//   industry topic / methodology / standard-report）**各自内联了一份** Article 节点。
//   实测字段集互不一致：
//     · /guides/*        —— 有 dateModified / inLanguage / url，**缺 author**
//     · /chemicals/*     —— 有 inLanguage / url，**缺 author / dateModified / mainEntityOfPage**
//     · /field-reports/* —— 有 author / dateModified / mainEntityOfPage，**缺 inLanguage / url**
//   这类「每页各写一份」的写法必然漂移，而 E-E-A-T 恰恰要求「作者是谁、何时更新」
//   能被搜索引擎**稳定解析**——字段时有时无，等于这些信号一半时间不存在。
//
// 因此收口到本文件：字段集固定，**真实缺值就不输出该字段**（绝不填占位值）。
//
// 🔴 两条硬约束：
//   1. `author` 只允许指向已存在的实体（`#organization`）或个人页面。
//      缺省用 Organization 作 author —— 这是**真实**主体，不是编造的人名。
//      若日后补上真人作者，把 person seam 传进来即可（见下）。
//   2. 日期只用**数据模型里真实存在的** updated / date 值。
//      拿不到就不输出 —— 绝不用 `new Date()`（那等于告诉 Google「所有文章今天都改过」）。

export const SEO_BASE = "https://factoryauditb2b.com";
const ORG_ID = `${SEO_BASE}/#organization`;

export type ArticleInput = {
  /** ISO 语言标签，如 en / zh-CN（与页面 <html lang> 同一口径） */
  locale: string;
  /** 绝对规范地址（canonical），如 https://factoryauditb2b.com/guides/xxx */
  url: string;
  /** 文章主标题（与页面 H1 一致） */
  headline: string;
  description: string;
  /** 真实更新时间；缺失则不输出该字段 */
  dateModified?: string;
  /** 真实首次发布时间；缺失则不输出该字段 */
  datePublished?: string;
  /**
   * 真人作者（可选）。传了就输出 Person 节点，没传则回退为 Organization。
   * 形如：{ name: "张三", url: `${SEO_BASE}/about/team#zhang-san`, jobTitle: "Factory Audit Lead" }
   */
  author?: { name: string; url?: string; jobTitle?: string };
};

/** 构造一个字段完整、口径统一的 Article 节点。 */
export function buildArticleSchema(input: ArticleInput) {
  const { locale, url, headline, description, dateModified, datePublished, author } = input;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    inLanguage: locale,
    mainEntityOfPage: url,
    url,
    // 真实值才输出 —— 缺失不填占位
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: author
      ? {
          "@type": "Person",
          name: author.name,
          ...(author.url ? { url: author.url } : {}),
          ...(author.jobTitle ? { jobTitle: author.jobTitle } : {}),
        }
      : { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}
