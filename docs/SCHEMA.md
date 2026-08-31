# SCHEMA — JSON-LD 结构化数据规范

日期：2026-08-29
现状：22 个页面中 6 个有结构化数据（覆盖率 27%）

---

## 〇、一句话结论

**已有实现质量不错，问题在于覆盖率太低。** 6 个已实现的页面 schema 类型选择准确、字段完整；但 `/suppliers`、`/pricing`、供应商详情页这些最该有 schema 的页面一个都没有。补全这 3 个页面的收益，大于给剩下 13 个页面全部补上。

---

## 一、覆盖率实测

| 页面 | 现有 schema | 应有 | 状态 |
|---|---|---|---|
| 全站（layout）| Organization, WebSite, SearchAction | 同左 | ✅ |
| `/logistics` | WebApplication, Offer, BreadcrumbList, FAQPage | 同左 | ✅ |
| `/tools/supplier-risk-calculator` | WebApplication, Offer, FAQPage | + BreadcrumbList | ⚠️ 缺面包屑 |
| `/tools/supplier-verification-checklist` | WebApplication, Offer, FAQPage | + BreadcrumbList | ⚠️ 缺面包屑 |
| `/services/supplier-verification` | Service, Organization, BreadcrumbList, FAQPage | 同左 | ✅ |
| `/audit-guide/[country]/[auditType]` | Service, Organization, BreadcrumbList | + FAQPage | ⚠️ 缺 FAQ |
| `/tools` | ItemList | + BreadcrumbList | ⚠️ 缺面包屑 |
| **`/suppliers`** | **无** | ItemList | ❌ 高优先级 |
| **`/supplier/[country]/[slug]`** | **无** | Organization, Place | ❌ 高优先级 |
| **`/pricing`** | **无** | Product, Offer | ❌ 高优先级 |
| **`/knowledge`** | **无** | ItemList, FAQPage | ❌ |
| **`/inspectors`** | **无** | ItemList | ❌ |
| **`/rfq`** | **无** | Service, FAQPage | ❌ |
| **`/factory-audit/request`** | **无** | Service | ❌ |
| `/tools/audit-checklist` 等 5 个工具页 | 无 | WebApplication, FAQPage | ❌ |
| `/` | 无（仅全局）| FAQPage | ❌ |

**统计**：✅ 完整 4 个 / ⚠️ 部分 3 个 / ❌ 缺失 15 个

---

## 二、全局 Schema（已实现，作为基准）

位置：`app/[locale]/layout.tsx` 的 `siteGraph`，全站每页输出。

```ts
const siteGraph = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: "FactoryAuditB2B",
    url: BASE,
    description: "Global supplier verification, factory audit, inspection and sourcing platform...",
    logo: `${BASE}/logo.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE}/#website`,
    url: BASE,
    name: "FactoryAuditB2B",
    potentialAction: {
      "@type": "SearchAction",
      target: `${BASE}/suppliers?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
];
```

**待补字段**（提升实体识别度）：

```ts
{
  "@type": "Organization",
  sameAs: [                       // 关联实体，帮助知识图谱对齐
    "https://www.linkedin.com/company/factoryauditb2b",
    "https://x.com/factoryauditb2b"
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@factoryauditb2b.com",
    availableLanguage: ["en", "zh", "es", "de", "fr", "pt"]
  },
  areaServed: ["CN", "VN", "TH", "IN", "ID", "BD", "MY", "TR", "MX"]
}
```

> `sameAs` 只有在上線真实社媒账号后才填，不要填不存在的 URL，反而损害可信度。

---

## 三、三类高优先级缺失页的 Schema 模板

### 3.1 `/suppliers` — ItemList

```ts
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Verified suppliers in China and Asia",
  numberOfItems: suppliers.length,
  itemListElement: suppliers.map((s, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${BASE}/supplier/${s.countryCode}/${s.slug}`,
    name: s.name,
  })),
}
```

配套 `BreadcrumbList`：

```ts
itemListElement: [
  { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}${p("/")}` },
  { "@type": "ListItem", position: 2, name: "Suppliers", item: canonicalFor(locale, "/suppliers") },
]
```

---

### 3.2 `/supplier/[country]/[slug]` — Organization + Place

这是全站**实体密度最高**的页面，务必写全：

```ts
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE}/supplier/${country}/${slug}#org`,
  name: supplier.name,
  url: canonicalFor(locale, `/supplier/${country}/${slug}`),
  address: {
    "@type": "PostalAddress",
    addressCountry: supplier.countryCode.toUpperCase(),
    addressLocality: supplier.city,
    streetAddress: supplier.address,
  },
  foundingDate: supplier.foundedYear ? String(supplier.foundedYear) : undefined,
  numberOfEmployees: supplier.employeeCount
    ? { "@type": "QuantitativeValue", value: supplier.employeeCount }
    : undefined,
  hasCredential: supplier.certifications.map((c) => ({
    "@type": "EducationalOccupationalCredential",
    credentialCategory: c.code,          // 例：ISO9001 / SMETA
    name: c.name,
  })),
}
```

> 供应商数据目前只有 3 条，且字段可能不全。**上线前先补数据，否则 schema 写出来也是空的**，反而是负面信号。

---

### 3.3 `/pricing` — Product + Offer

价格是 AI 回答里被引用频率最高的信息之一：

```ts
{
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Supplier verification and factory audit plans",
  brand: { "@type": "Organization", name: "FactoryAuditB2B" },
  offers: plans.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    price: plan.priceUsd,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: canonicalFor(locale, "/pricing"),
    description: plan.description,
  })),
}
```

**注意**：pricing 页目前所有按钮链向 `/login`，没有真实价格。补 schema 前需要先确定价格，否则构成误导性结构化数据，可能触发 Google 的人工处置。

---

## 四、各页面类型 Schema 对照表

| 页面类型 | 必填 | 建议补充 |
|---|---|---|
| 首页 | Organization, WebSite | FAQPage, ItemList（工具列表）|
| 工具页 | WebApplication, BreadcrumbList | FAQPage, Offer（免费则 price 0）|
| 服务页 | Service, BreadcrumbList | FAQPage, Offer, AggregateRating（有真实评价后）|
| 目录页 | ItemList, BreadcrumbList | — |
| 详情页 | Organization, BreadcrumbList | Product, hasCredential |
| 指南页（audit-guide）| Article 或 Service, BreadcrumbList | FAQPage, HowTo |
| 定价页 | Product, Offer | FAQPage |
| 内容页 | Article | FAQPage, BreadcrumbList |

---

## 五、WebApplication 字段规范（工具页统一标准）

现有 3 个工具页已用此类型，保持字段一致：

```ts
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: s.metaTitle,
  url: canonicalFor(locale, PATH),
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript. Works in modern browsers.",
  inLanguage: locale,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description: s.metaDesc,
  publisher: { "@id": `${BASE}/#organization` },   // 引用全局实体，避免重复定义
}
```

**`publisher` 用 `{"@id": ...}` 引用而不是重复写整个 Organization**，这是 schema 图谱的正确做法，能让 Google 把页面归属到站点实体下。

---

## 六、校验方法

### 6.1 本地快速校验

```bash
# 抓页面，提取 JSON-LD，用 node 验证 JSON 合法性
curl -s http://localhost:3000/logistics \
  | grep -o '<script type="application/ld+json">[^<]*</script>' \
  | sed 's|<[^>]*>||g'
```

### 6.2 官方工具

| 工具 | 用途 |
|---|---|
| Google 富媒体搜索结果测试 | https://search.google.com/test/rich-results |
| Schema.org 校验器 | https://validator.schema.org/ |
| Google Search Console → 增强功能 | 上线后监控 schema 报错 |

### 6.3 常见错误自查

- [ ] 每个页面的 `@id` 唯一，不与全局冲突
- [ ] `url` 用 canonical 值，含 locale 前缀（非英文）
- [ ] `inLanguage` 填当前 locale（en / zh-CN / es / de / fr / pt-BR）
- [ ] FAQPage 的 `mainEntity` 至少 2 条问答，且与页面可见文本一致
- [ ] BreadcrumbList 的 `position` 从 1 开始连续
- [ ] 结构化数据内容与页面可见内容一致（不一致会被判作弊）

---

## 七、执行清单

| 优先级 | 任务 | 预估 |
|---|---|---|
| P0 | `/suppliers` 补 ItemList + BreadcrumbList | 1 小时 |
| P0 | `/supplier/[country]/[slug]` 补 Organization（需先补数据）| 2 小时 |
| P1 | `/pricing` 补 Product + Offer（需先定价格）| 2 小时 |
| P1 | 3 个已有 schema 的工具页补 BreadcrumbList | 1 小时 |
| P1 | `/knowledge` 补 ItemList + FAQPage | 1 小时 |
| P1 | 5 个无 schema 工具页补 WebApplication + FAQPage | 半天 |
| P2 | 首页补 FAQPage | 2 小时 |
| P2 | Organization 补 sameAs / contactPoint / areaServed | 1 小时 |
