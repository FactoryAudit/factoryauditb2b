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
// 注意：本页原有的 9 语正文（字典 sampleReport 命名空间，99 键）与
// components/SampleReportForm.tsx 随之变为不可达。二者**本次不做删除** ——
// 删除 891 条本地化文案属不可逆数据变更，按规范 §二十七 需要独立的
// Inspect → Backup → Verify 周期，已记为后续专项清理项。
export default async function SampleReportRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  permanentRedirect(localePath(locale, "/standard-report"));
}
