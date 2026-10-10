import { permanentRedirect } from "next/navigation";
import { isLocale, DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";

// CS-01 P1-8：/sample-report 与 /standard-report 争夺同一批
//「supplier audit report sample / specimen」词 —— 两页都在 sitemap、都 self-canonical，
// 互相稀释权重。/standard-report 是 CS-11 建设的完整样张（13 章节 + 留资下载门禁），
// 内容更厚、转化路径更完整，因此定为唯一入口，本页 308 过去。
//
// 为什么用 308 而不是 301：与站内既有重定向（/knowledge、/country/*、/supplier/*）
// 保持一致；308 同样传递权重，且不会把 POST 降级成 GET。
//
// 注意：本页原有正文与表单的处置口径（2026-10-11 清理）：
// components/SampleReportForm.tsx 已删（零引用死代码）。
// 但字典 sampleReport 的 891 条文案（9 语 × 99 键）**保留未删** —— 它们是
// 产物与回归门禁的叶子数不变量（en = 3293）的一部分，删除属不可逆数据变更，
// 需独立周期；保留也让日后若要恢复本页时无需重译。
export default async function SampleReportRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  permanentRedirect(localePath(locale, "/standard-report"));
}
