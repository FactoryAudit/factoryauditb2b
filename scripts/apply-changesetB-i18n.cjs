/**
 * CHANGE SET B —— 首页 Industrial Clusters 入口 + 产业带目录/详情页所需的 19 个键（九语，幂等）。
 *
 * 与 apply-step04-i18n.cjs / apply-cs12-i18n.cjs 同一约定：幂等注入 + 九语键集一致性自检，
 * 避免「改了 8 个语言漏了 1 个」，也避免重复执行把译文覆盖回英文。
 *
 * 新增键：
 *   home（+3）
 *     · home.clustersTitle  首页轻量入口标题
 *     · home.clustersLead   首页轻量入口副文案
 *     · home.clustersCta    首页轻量入口按钮
 *   clusters（新建命名空间，+16）—— 目录页与详情页共用
 *     · clusters.h1 / lead / metaTitle / metaDesc
 *     · clusters.breadcrumbHome / breadcrumb
 *     · clusters.emptyTitle / emptyLead                （industrial_clusters = 0 时的空态）
 *     · clusters.countryLabel / regionLabel / industryLabel
 *     · clusters.supplierCount                          （{count} 插值）
 *     · clusters.viewSuppliers
 *     · clusters.suppliersTitle / suppliersEmpty        （详情页供应商区）
 *     · clusters.detailMetaDesc                         （{cluster} 插值）
 *
 * 🔴 副作用（必须同步处理）：九语 en 字典叶子数 2827 → 2846。
 *    项目把该数字作为**冻结常量**写在：
 *      scripts/verify-opennext-bundle.mjs（发布门禁）、cs06a C8、cs08 G4/G5、
 *      cs12 E4/E5、cs13 F1i、cs16 A1-A6、cs17 A1-A6、cs20 A1
 *    加键后这些常量必须同改（本 CS 已一并同步为 2846）。
 *
 * 跑法：node scripts/apply-changesetB-i18n.cjs
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");

// ---------- home 命名空间新增 3 键 ----------
const HOME = {
  en: {
    clustersTitle: "Explore Industrial Clusters",
    clustersLead: "Discover manufacturers by country, region and industrial cluster.",
    clustersCta: "Explore Industrial Clusters →",
  },
  zh: {
    clustersTitle: "探索产业带",
    clustersLead: "按国家、地区与产业带发现制造商。",
    clustersCta: "探索产业带 →",
  },
  "zh-TW": {
    clustersTitle: "探索產業帶",
    clustersLead: "依國家、地區與產業帶探索製造商。",
    clustersCta: "探索產業帶 →",
  },
  ja: {
    clustersTitle: "産業クラスターを探す",
    clustersLead: "国・地域・産業クラスター別にメーカーを探せます。",
    clustersCta: "産業クラスターを探す →",
  },
  es: {
    clustersTitle: "Explorar clústeres industriales",
    clustersLead: "Descubra fabricantes por país, región y clúster industrial.",
    clustersCta: "Explorar clústeres industriales →",
  },
  de: {
    clustersTitle: "Industriecluster entdecken",
    clustersLead: "Hersteller nach Land, Region und Industriecluster entdecken.",
    clustersCta: "Industriecluster entdecken →",
  },
  fr: {
    clustersTitle: "Explorer les clusters industriels",
    clustersLead: "Découvrez des fabricants par pays, région et cluster industriel.",
    clustersCta: "Explorer les clusters industriels →",
  },
  pt: {
    clustersTitle: "Explorar clusters industriais",
    clustersLead: "Descubra fabricantes por país, região e cluster industrial.",
    clustersCta: "Explorar clusters industriais →",
  },
  ar: {
    clustersTitle: "استكشف التجمعات الصناعية",
    clustersLead: "اكتشف المصنّعين حسب الدولة والمنطقة والتجمع الصناعي.",
    clustersCta: "استكشف التجمعات الصناعية ←",
  },
};

// ---------- clusters 命名空间（新建，16 键）----------
const CLUSTERS = {
  en: {
    h1: "Industrial Clusters",
    lead: "Explore manufacturing hubs and connect with suppliers by location and industry.",
    metaTitle: "Industrial Clusters: Manufacturing Hubs and Suppliers",
    metaDesc: "Browse manufacturing hubs by country, region and industry, and connect with published suppliers grouped into industrial clusters.",
    breadcrumbHome: "Home",
    breadcrumb: "Industrial Clusters",
    emptyTitle: "No industrial clusters are available yet.",
    emptyLead: "We're currently expanding our supplier coverage. Check back soon.",
    countryLabel: "Country",
    regionLabel: "Region",
    industryLabel: "Industry",
    supplierCount: "{count} suppliers",
    viewSuppliers: "View Suppliers →",
    suppliersTitle: "Suppliers in this Industrial Cluster",
    suppliersEmpty: "No published suppliers are listed in this industrial cluster yet.",
    detailMetaDesc: "Suppliers, region and industry overview for the {cluster} industrial cluster.",
  },
  zh: {
    h1: "产业带",
    lead: "探索制造集聚区，按地区与行业连接供应商。",
    metaTitle: "产业带：制造集聚区与供应商",
    metaDesc: "按国家、地区与行业浏览制造集聚区，连接已发布的产业带供应商。",
    breadcrumbHome: "首页",
    breadcrumb: "产业带",
    emptyTitle: "暂未收录产业带。",
    emptyLead: "我们正在扩充供应商覆盖范围，敬请稍后再来。",
    countryLabel: "国家",
    regionLabel: "地区",
    industryLabel: "行业",
    supplierCount: "{count} 家供应商",
    viewSuppliers: "查看供应商 →",
    suppliersTitle: "该产业带的供应商",
    suppliersEmpty: "该产业带暂未收录已发布的供应商。",
    detailMetaDesc: "「{cluster}」产业带的供应商、地区与行业概览。",
  },
  "zh-TW": {
    h1: "產業帶",
    lead: "探索製造聚落，依地區與產業連結供應商。",
    metaTitle: "產業帶：製造聚落與供應商",
    metaDesc: "依國家、地區與產業瀏覽製造聚落，連結已發布的產業帶供應商。",
    breadcrumbHome: "首頁",
    breadcrumb: "產業帶",
    emptyTitle: "暫未收錄產業帶。",
    emptyLead: "我們正在擴充供應商覆蓋範圍，敬請稍後再來。",
    countryLabel: "國家",
    regionLabel: "地區",
    industryLabel: "產業",
    supplierCount: "{count} 家供應商",
    viewSuppliers: "查看供應商 →",
    suppliersTitle: "該產業帶的供應商",
    suppliersEmpty: "該產業帶暫未收錄已發布的供應商。",
    detailMetaDesc: "「{cluster}」產業帶的供應商、地區與產業概覽。",
  },
  ja: {
    h1: "産業クラスター",
    lead: "製造拠点を地域と業種から探し、サプライヤーとつながりましょう。",
    metaTitle: "産業クラスター：製造拠点とサプライヤー",
    metaDesc: "国・地域・業種別に製造拠点を閲覧し、産業クラスター単位で公開サプライヤーとつながれます。",
    breadcrumbHome: "ホーム",
    breadcrumb: "産業クラスター",
    emptyTitle: "現在、公開中の産業クラスターはありません。",
    emptyLead: "サプライヤーの網羅範囲を拡大しています。しばらくしてからご確認ください。",
    countryLabel: "国",
    regionLabel: "地域",
    industryLabel: "業種",
    supplierCount: "サプライヤー {count} 社",
    viewSuppliers: "サプライヤーを見る →",
    suppliersTitle: "この産業クラスターのサプライヤー",
    suppliersEmpty: "この産業クラスターには、まだ公開サプライヤーが登録されていません。",
    detailMetaDesc: "{cluster} 産業クラスターのサプライヤー・地域・業種の概要。",
  },
  es: {
    h1: "Clústeres industriales",
    lead: "Explore centros de fabricación y conéctese con proveedores por ubicación e industria.",
    metaTitle: "Clústeres industriales: centros de fabricación y proveedores",
    metaDesc: "Explore centros de fabricación por país, región e industria, y conéctese con proveedores publicados agrupados por clúster industrial.",
    breadcrumbHome: "Inicio",
    breadcrumb: "Clústeres industriales",
    emptyTitle: "Aún no hay clústeres industriales disponibles.",
    emptyLead: "Estamos ampliando nuestra cobertura de proveedores. Vuelva pronto.",
    countryLabel: "País",
    regionLabel: "Región",
    industryLabel: "Industria",
    supplierCount: "{count} proveedores",
    viewSuppliers: "Ver proveedores →",
    suppliersTitle: "Proveedores en este clúster industrial",
    suppliersEmpty: "Aún no hay proveedores publicados en este clúster industrial.",
    detailMetaDesc: "Proveedores, región e industria del clúster industrial {cluster}.",
  },
  de: {
    h1: "Industriecluster",
    lead: "Entdecken Sie Fertigungszentren und finden Sie Lieferanten nach Standort und Branche.",
    metaTitle: "Industriecluster: Fertigungszentren und Lieferanten",
    metaDesc: "Durchsuchen Sie Fertigungszentren nach Land, Region und Branche und finden Sie veröffentlichte Lieferanten nach Industriecluster.",
    breadcrumbHome: "Startseite",
    breadcrumb: "Industriecluster",
    emptyTitle: "Es sind noch keine Industriecluster verfügbar.",
    emptyLead: "Wir erweitern derzeit unsere Lieferantenabdeckung. Schauen Sie bald wieder vorbei.",
    countryLabel: "Land",
    regionLabel: "Region",
    industryLabel: "Branche",
    supplierCount: "{count} Lieferanten",
    viewSuppliers: "Lieferanten anzeigen →",
    suppliersTitle: "Lieferanten in diesem Industriecluster",
    suppliersEmpty: "In diesem Industriecluster sind noch keine veröffentlichten Lieferanten gelistet.",
    detailMetaDesc: "Lieferanten, Region und Branche des Industrieclusters {cluster}.",
  },
  fr: {
    h1: "Clusters industriels",
    lead: "Explorez les pôles de fabrication et connectez-vous aux fournisseurs par localisation et secteur.",
    metaTitle: "Clusters industriels : pôles de fabrication et fournisseurs",
    metaDesc: "Parcourez les pôles de fabrication par pays, région et secteur, et connectez-vous aux fournisseurs publiés regroupés par cluster industriel.",
    breadcrumbHome: "Accueil",
    breadcrumb: "Clusters industriels",
    emptyTitle: "Aucun cluster industriel n'est encore disponible.",
    emptyLead: "Nous élargissons actuellement notre couverture de fournisseurs. Revenez bientôt.",
    countryLabel: "Pays",
    regionLabel: "Région",
    industryLabel: "Secteur",
    supplierCount: "{count} fournisseurs",
    viewSuppliers: "Voir les fournisseurs →",
    suppliersTitle: "Fournisseurs de ce cluster industriel",
    suppliersEmpty: "Aucun fournisseur publié n'est encore répertorié dans ce cluster industriel.",
    detailMetaDesc: "Fournisseurs, région et secteur du cluster industriel {cluster}.",
  },
  pt: {
    h1: "Clusters industriais",
    lead: "Explore polos de fabricação e conecte-se a fornecedores por localização e setor.",
    metaTitle: "Clusters industriais: polos de fabricação e fornecedores",
    metaDesc: "Navegue por polos de fabricação por país, região e setor e conecte-se a fornecedores publicados agrupados por cluster industrial.",
    breadcrumbHome: "Início",
    breadcrumb: "Clusters industriais",
    emptyTitle: "Ainda não há clusters industriais disponíveis.",
    emptyLead: "Estamos ampliando nossa cobertura de fornecedores. Volte em breve.",
    countryLabel: "País",
    regionLabel: "Região",
    industryLabel: "Setor",
    supplierCount: "{count} fornecedores",
    viewSuppliers: "Ver fornecedores →",
    suppliersTitle: "Fornecedores neste cluster industrial",
    suppliersEmpty: "Ainda não há fornecedores publicados neste cluster industrial.",
    detailMetaDesc: "Fornecedores, região e setor do cluster industrial {cluster}.",
  },
  ar: {
    h1: "التجمعات الصناعية",
    lead: "استكشف مراكز التصنيع وتواصل مع الموردين حسب الموقع والقطاع.",
    metaTitle: "التجمعات الصناعية: مراكز التصنيع والموردون",
    metaDesc: "تصفّح مراكز التصنيع حسب الدولة والمنطقة والقطاع، وتواصل مع الموردين المنشورين مجمّعين حسب التجمع الصناعي.",
    breadcrumbHome: "الرئيسية",
    breadcrumb: "التجمعات الصناعية",
    emptyTitle: "لا توجد تجمعات صناعية متاحة بعد.",
    emptyLead: "نعمل حاليًا على توسيع تغطية الموردين. تحقق مرة أخرى قريبًا.",
    countryLabel: "الدولة",
    regionLabel: "المنطقة",
    industryLabel: "القطاع",
    supplierCount: "{count} مورد",
    viewSuppliers: "عرض الموردين ←",
    suppliersTitle: "الموردون في هذا التجمع الصناعي",
    suppliersEmpty: "لم يتم إدراج موردين منشورين في هذا التجمع الصناعي بعد.",
    detailMetaDesc: "نظرة عامة على الموردين والمنطقة والقطاع للتجمع الصناعي {cluster}.",
  },
};

const LOCALES = Object.keys(HOME);
let homeChanged = 0;
let clustersChanged = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${locale}（文件不存在）`);
    continue;
  }
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));

  let added = 0;

  // home：已存在则跳过（幂等，不覆盖既有译文）
  if (!obj.home) {
    console.log(`WARN  ${locale} 缺 home 命名空间，跳过该语言的 home 键`);
  } else {
    for (const [k, v] of Object.entries(HOME[locale])) {
      if (k in obj.home) continue;
      obj.home[k] = v;
      added++;
    }
    if (added > 0) homeChanged++;
  }

  // clusters：整命名空间新建
  if (!obj.clusters) {
    obj.clusters = {};
  }
  let cAdded = 0;
  for (const [k, v] of Object.entries(CLUSTERS[locale])) {
    if (k in obj.clusters) continue;
    obj.clusters[k] = v;
    cAdded++;
  }
  if (cAdded > 0) clustersChanged++;

  if (added + cAdded === 0) {
    console.log(`SKIP  ${locale}（已全部存在）`);
    continue;
  }

  const out = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  console.log(`OK    ${locale}.json  home +${added} / clusters +${cAdded}`);
}

// ---- 叶子数实测（en 为单一事实源，算法与 cs06a C7 的 leaves() 完全一致）----
function leaves(obj, prefix = "", out = []) {
  if (obj === null || typeof obj !== "object") {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    leaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const en = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));
const enLeaves = leaves(en);
function leafTypes(o) {
  if (o === null || typeof o !== "object") return [typeof o];
  if (Array.isArray(o)) return o.flatMap(leafTypes);
  return Object.values(o).flatMap(leafTypes);
}
const types = leafTypes(en);
const nStr = types.filter((t) => t === "string").length;
const nBool = types.filter((t) => t === "boolean").length;
console.log(`\n完成：home ${homeChanged}/${LOCALES.length}、clusters ${clustersChanged}/${LOCALES.length} 个语言文件被修改`);
console.log(`en 叶子数 = ${enLeaves.length}（= ${nStr} 字符串 + ${nBool} boolean）`);
console.log(`  ← 必须同步 verify-opennext-bundle.mjs（2827 → ${enLeaves.length}）与各 CS 回归常量`);

// ---- 九语键集一致性自检（getDictionary 无深 fallback，键集必须严格一致）----
const enHomeKeys = JSON.stringify(Object.keys(en.home).sort());
const enClustersKeys = JSON.stringify(Object.keys(en.clusters).sort());
let mismatch = 0;
for (const locale of LOCALES) {
  const o = JSON.parse(fs.readFileSync(path.join(DIR, `${locale}.json`), "utf8"));
  if (JSON.stringify(Object.keys(o.home || {}).sort()) !== enHomeKeys) {
    mismatch++;
    console.log(`  🔴 ${locale} 的 home 键集与 en 不一致`);
  }
  if (JSON.stringify(Object.keys(o.clusters || {}).sort()) !== enClustersKeys) {
    mismatch++;
    console.log(`  🔴 ${locale} 的 clusters 键集与 en 不一致`);
  }
}
console.log(
  mismatch === 0
    ? "九语 home / clusters 键集一致 ✓"
    : `键集不一致条目数 = ${mismatch}`
);
