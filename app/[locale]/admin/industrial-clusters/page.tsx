import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/adminData";
import { listAdminClusters } from "@/lib/industrialClusters";
import IndustrialClusterManager, {
  type ClusterDict,
} from "@/components/admin/IndustrialClusterManager";

// Admin · 产业带（Industrial Cluster）管理
//
// 数据：public.industrial_clusters（migration 024 新建的唯一表）。
// 闭环：本页新增/编辑/上下架 → 数据库 → 前台 /industrial-clusters 与 sitemap 同步
//      （前台页面在 STEP 04 落地，读取的是同一个 listPublishedClusters()）。
//
// 本页禁止硬编码产业带列表 —— 全部来自数据库。数据库未配置时显示空态，不崩。

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: string }> };

// 后台为单人 noindex 工具，按 admin/layout.tsx 既有约定用双语常量，
// 不为内部字段标签补 9 语字典键。
const ZH: ClusterDict = {
  title: "产业带",
  lead: "产业带 ≠ 行政区。country / region / city 是行政维度，产业带是「某地在某行业的制造聚集」（例：佛山 + 家具 = 佛山家具产业带）。前台只显示已发布的产业带。",
  addNew: "+ 新增产业带",
  edit: "编辑",
  cancel: "取消",
  save: "保存",
  saving: "保存中…",
  saved: "已保存",
  error: "操作失败，请重试",
  publish: "上架",
  unpublish: "下架",
  delete: "删除",
  confirmDelete: "确认删除该产业带？已引用它的供应商档案不会被自动修改，需要另行更正。",
  published: "已发布",
  draft: "草稿",
  empty: "还没有产业带。点「新增产业带」创建第一条。",
  fName: "名称",
  fSlug: "URL slug",
  fCountry: "国家",
  fCountryCode: "国家代码（小写单词，如 china / vietnam）",
  fRegion: "地区 / 大区",
  fCity: "城市",
  fProvince: "省份 / 州（中国必填；其他国家可留空）",
  fIndustry: "行业",
  fTags: "行业标签（逗号分隔）",
  fDesc: "描述",
  fSeoTitle: "SEO 标题",
  fSeoDesc: "SEO 描述",
  fSort: "排序（升序）",
  fPublished: "立即发布（前台可见）",
  fFeatured: "首页推荐（战略 Featured Cluster）",
  slugHint: "留空则由名称自动生成。建议英文小写连字符，例如 foshan-furniture。",
  duplicateSlug: "该 slug 已存在，请换一个。",
};

const EN: ClusterDict = {
  title: "Industrial Clusters",
  lead: "A cluster is NOT an administrative division. country / region / city are geographic; a cluster is a manufacturing concentration of an industry in a place (e.g. Foshan + Furniture = Foshan Furniture Cluster). Only published clusters appear on the site.",
  addNew: "+ Add Cluster",
  edit: "Edit",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  error: "Action failed, please retry",
  publish: "Publish",
  unpublish: "Unpublish",
  delete: "Delete",
  confirmDelete:
    "Delete this cluster? Supplier profiles referencing it are not auto-updated — fix them separately.",
  published: "Published",
  draft: "Draft",
  empty: "No clusters yet. Click “Add Cluster” to create the first one.",
  fName: "Name",
  fSlug: "URL slug",
  fCountry: "Country",
  fCountryCode: "Country code (lowercase word, e.g. china / vietnam)",
  fRegion: "Region",
  fCity: "City",
  fProvince: "Province / State (required for China; blank for others)",
  fIndustry: "Industry",
  fTags: "Industry tags (comma separated)",
  fDesc: "Description",
  fSeoTitle: "SEO title",
  fSeoDesc: "SEO description",
  fSort: "Sort order (ascending)",
  fPublished: "Publish now (visible on site)",
  fFeatured: "Featured on homepage (strategic cluster)",
  slugHint:
    "Auto-generated from name if left blank. Use lowercase hyphens, e.g. foshan-furniture.",
  duplicateSlug: "This slug already exists. Please choose another.",
};

export default async function AdminIndustrialClustersPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  if (!(await requireAdmin())) notFound();

  const t = await getDictionary(locale);
  const a = t.admin;
  const p = (href: string) => localePath(locale, href);
  const dict = locale === "zh" || locale === "zh-TW" ? ZH : EN;

  const rows = await listAdminClusters();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a]">
        {locale === "zh" || locale === "zh-TW" ? "产业带管理" : "Industrial Clusters"}
      </h1>

      <IndustrialClusterManager rows={rows} dict={dict} />

      <p className="mt-4 text-xs text-[#64748b]">
        <a href={p("/admin")} className="text-[#0f4c81] hover:underline">
          ← {a.navOverview}
        </a>
      </p>
    </div>
  );
}
