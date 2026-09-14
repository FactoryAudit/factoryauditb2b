# Supplier SEO V1.0 — PHASE 01 审计报告（AUDIT REPORT）

> **状态：仅审计，未改动任何代码 / 数据 / 数据库 / 算法。** 按任务 §50，本报告输出后**暂停**，等你确认再进入 Implementation。
> 依据：源码 `F:\AI-验厂SEO网站`（Next 15.5 App Router + OpenNext/Cloudflare Workers + Supabase，9 语）+ Supabase 生产库**只读**快照（2026-09-14）。
> 关联既有文档：`docs/SEO-AUDIT.md`、`docs/SCHEMA.md`、`SUPPLIER-NETWORK-AUDIT.md`、`seo/SEO-STRATEGY.md`。

---

## 0. 一句话结论

现有 SEO 地基（canonical / hreflang / OG / JSON-LD / robots / sitemap / 过滤态 noindex / CS-02「公开核验等级权威推导 + 反伪造」）**已经存在且质量不低**；但 Supplier Profile 目前是「结构化数据展示页」，**还不是**任务要求的「SEO Entity 引擎」。缺的是：SEO 逻辑集中层、Buyer Snapshot、FAQ、Related Suppliers、Product/Location taxonomy、indexability 质量门、Supplier 级 Schema 扩展。

**最重要的两条**：① 目录卡片把「尚未核验」**写死**了，与已核验的 Sunny Food 直接矛盾（Bug）；② 4 家未核验供应商显示 56–88 高分（§33 正中）。

---

## 0.1 规模事实（生产库只读快照）

- `suppliers` 共 **10 行**，`is_published = true` 仅 **5 家**：

| slug | 行业 code | 国家 / 城市 | verification_level | risk_score |
|---|---|---|---|---|
| shenzhen-precision-electronics | electronics | china / Shenzhen | unverified | 88 |
| guangzhou-textile-factory | textiles | china / Guangzhou | unverified | 72 |
| dongguan-plastic-molding | plastics | china / Dongguan | unverified | 56 |
| ho-chi-minh-garment | textiles | vietnam / Ho Chi Minh | unverified | 59 |
| guangzhou-sunny-food | food-beverage | china / Guangzhou | **on_site_audit** | 96 |

- 相关表行数：`supplier_audits` **1**（VERIFIED 1，= Sunny Food）· `supplier_certifications` **0** · `supplier_documents` **0** · `supplier_evidence` **3**（全部 public + VERIFIED）· `supplier_capabilities` **7**。
- 推论：**当前可索引 Supplier 实体 = 5 个**。本轮价值在于**把引擎建好**，而非即时流量；「批量生产 SEO 页」的能力目前无数据量可验证。

---

## 1. 当前 Supplier SEO 架构

**路由**
- `/suppliers`（目录页，**dynamic**：读 `searchParams`）
- `/suppliers/[slug]`（Profile 页，**SSG**：有 `generateStaticParams`，**无** `dynamic` / `revalidate`）
- `/suppliers/[slug]/claim`（认领）
- 旧路由保留：`/supplier/[country]/[slug]`、`/country/[slug]`（308 重定向）

**已有相邻 taxonomy 落地页**：`/industry`、`/industry/[slug]`、`/industry/[slug]/[topic]`、`/countries`、`/countries/[slug]`、`/chemicals/[slug]`、`/audit-guide/[country]/[auditType]`

**不存在**：`/products/*`、`/locations/*`（除国家级的 `/countries/*`）

**SEO 逻辑位置**：**内联在页面组件里**（`app/[locale]/suppliers/page.tsx`、`.../[slug]/page.tsx`）；**无 `lib/seo/*`**

**元数据基建（已具备）**
- `lib/pageMeta.ts` `buildPageMetadata()` —— 统一 canonical + hreflang + OG + twitter + robots
- `i18n/hreflang.ts` —— 9 语 1:1 + x-default；英文落无前缀
- `components/JsonLd.tsx` —— JSON-LD 注入
- `app/robots.ts`、`app/sitemap.ts`

---

## 2. 当前数据来源（Data Source）

- 开关 `lib/queries.ts useSupabase()`：`.env` `SUPPLIER_DATA_SOURCE = "supabase"` → 读库（`suppliers` where `is_published=true`，service_role）；DB 异常 → **静默回落** `lib/staticData.ts` 的 `STATIC_SUPPLIERS`（4 家）。
- ✅ 页面**不是**读静态数组（除兜底）：生产 5 家来自 DB，与静态 4 家同源（DB 是静态的镜像 + Sunny Food）。
- 消费函数：`listSupplierDirectory` / `getSupplierDetail` / `listSupplierSlugs` / `getSupplierPublicCertifications` / `getSupplierPublicAudits`；矩阵页 `listSuppliersByCountry/Industry/AuditType`（CS-02C 起 DB 优先）。
- `ROW_SELECT` 只取 31 列；`display_name / phone / contact_visibility / profile_authorized` 刻意不读（同意书管辖）。

---

## 3. 当前数据库结构（与 Supplier SEO 相关）

**`suppliers` 列**：`id, slug, legal_name, country_code, city, industry_code, business_type, established, employees, main_products(text[]), export_markets, verification_status(legacy 文本), verification_level(权威), risk_score, risk_breakdown, certifications, audit_status, inspection_history, access_tier, is_published, company_type, english_name, website, registration_number, address, production_capacity, monthly_output, factory_size, export_since, self_reported_certificates(jsonb)`

- 🔴 **无 `province` / `state` / `region` 列** ⇒ 任务 §13 的「Country → Province → City」**在数据层就缺一级**；只有 `country_code` + `city`。
- 相关表：`supplier_audits`（公开侧仅 VERIFIED）、`supplier_certifications`（同）、`supplier_documents`、`supplier_evidence`（按 visibility 裁剪）、`supplier_capabilities`（`ref_type/ref_code`）、`admin_audit_log`。
- **无 product 表、无 location/province 表**；产品是 `suppliers.main_products` 自由文本数组（现为英文，如 `"Soy Sauce"`）。

---

## 4. 当前 SEO 已完成部分（✅ 可复用，别推翻）

1. 每页 canonical + hreflang(9 语 + x-default) + OG + twitter（`buildPageMetadata`）。
2. Profile **H1 = 真实公司名**（符合 §5，未做 keyword 堆砌）。
3. Profile JSON-LD：`Organization`（name/address/description/url，且**仅当确有 VERIFIED 证书**才输出 `hasCredential`）+ `BreadcrumbList`（Home → Suppliers → Company）。
4. **反伪造 + 核验等级权威推导**：`publicVerificationLevel(vl, hasRealEvent)`（无真实事件恒为 Level 0）+ `LEVEL_SCOPE`；证据 provenance（provided/reviewed/independent/onsite）。
5. `robots.txt`：AI **检索**爬虫放行 / **训练**爬虫拦截 / `Disallow: /api`；已声明 sitemap。
6. `sitemap.xml` **动态生成**，含全部 published supplier（每语言一条 + hreflang alternates）。
7. 目录页：独立 Title/Desc/H1、FAQ 区块 + `ItemList` & `FAQPage` JSON-LD、可爬 `<Link>`、**过滤态（country/industry/q）一律 noindex + canonical 回目录首页**（§43 已达标）。
8. **无 `<meta name="keywords">`**（符合 §41）。
9. analytics 事件齐备（directoryView / profileView / …），分桶规范。

---

## 5. 当前缺失部分（vs 任务要求）

| 任务 | 现状 | 缺口 |
|---|---|---|
| §6 Title 模板 A/B/C | 现为 `{legalName} — {metaTitle}` | 无按「主产品 / 行业」分级模板 |
| §7 Meta Description | 已动态（公司 + 地点 + 类型 + 产品 + 分） | 未含 `supplier-declared / not independently verified` 措辞分支 |
| §8 Buyer Snapshot | **无** | 全缺 |
| §9/§10 Evidence Transparency 结构块 | 部分（核验范围 / 证据计数 / provenance 标签） | 无「Information Source / Source: / Verification:」结构化块 |
| §11 Product SEO | **无** `/products/*` | 缺 product taxonomy + 页面 + 关联 |
| §12 Industry SEO | `/industry/[slug]` 有 | Supplier 页**未链**到行业页；且 `industryCode` 直接显示**原始 code** |
| §13 Location SEO | 仅 `/countries/[slug]` | 无省 / 市级页面；**DB 无 province 列** |
| §18 供应商级 FAQ | **无** | 全缺 |
| §19 Schema（Product/FAQPage/LocalBusiness/WebPage） | 仅 Organization + BreadcrumbList | 缺 4 类 |
| §20 Breadcrumb 到 国家/省/市 | 仅到 Company | 缺中间层（且无真实省 / 市页） |
| §24 GEO / AI 事实块 | 仅 JSON-LD | 无显式「Company: / Location: / Industry: / Products: / …」可见块 |
| §25 内链（industry/product/location/cert/service） | 基本无 | 全缺 |
| §26 Related Suppliers | **无** | 全缺 |
| §28 Indexability 质量门 | **无**（仅 `is_published`） | 缺 `indexable` 判定 |
| §29 sitemap 联动 noindex | 只按 `is_published` | 无质量门联动 |
| §33 Risk Score 口径 | 显示 `Risk score N/100 · band` | 未披露 methodology / sources / coverage；高分 vs 未核验并存 |
| §34 Evidence Level L0–L5 | 有 0–4 映射 | 命名 / 级数与任务 L0–L5 不一致，需**定映射层（不改 schema）** |
| §38 `lib/seo/*` | **无** | SEO 逻辑散落页面 |
| §39 `SupplierSeoData` | **无** | 全缺 |

---

## 6. 风险

1. 🔴 **目录卡片硬编码「尚未核验」** —— `app/[locale]/suppliers/page.tsx:328` 无条件渲染 `{s.verificationNotYet}`。Sunny Food 已是 **Level 3 已核验**，卡片却写「not yet verified」⇒ 与 Profile 页**直接矛盾**。**判定：Bug，建议纳入 V1.0 第一批修复。**
2. 🟠 **数据源静默回落** —— DB 查询失败 → 静默退回静态 4 家（无告警）。SEO 页可能「少一家 / 换内容」且无人察觉，sitemap 与页面甚至会不一致。建议**只加可见性告警，不改行为**。
3. 🟠 **SSG 无显式 revalidate** —— `/suppliers/[slug]` 有 `generateStaticParams` 但**无** `dynamic`/`revalidate`；`dynamicParams` 默认 `true` ⇒ 新 slug 走**按需渲染**，但**已预渲染的 slug 被编辑后可能陈旧**直到下次部署。终极目标「新增 Supplier 自动可发现」需**明确缓存策略**。⚠️ 此条需与你记忆里「发布即实时、无需部署」的说法对齐确认。
4. 🟠 **Risk Score 语义（§33 正中）** —— 4 家**未核验**供应商显示 **56 / 72 / 88 / 59** 高分（如 Shenzhen `88/100 · Low risk`）与「未核验」并排，存在被读成「已评估 = 低风险」的误导风险。**只能改展示与披露**（补 methodology / data coverage / last updated，或改名 Profile Completeness）；**禁改算法、禁改数据**（§48）。
5. 🟠 **legacy `verification_status` 文本仍在库**（"Factory Verified" 等）—— 公开侧已正确忽略（CS-02），但它是「下次被误用就出事」的雷。SEO 层须**永不读它**。
6. 🟡 **产品 / 行业为自由文本 / code** —— `industryCode` 直接展示原始 code（`food-beverage` 显示成 code 而非行业名）；产品无 taxonomy ⇒ 做 `/products/*` 前**必须先建映射**，否则产出 404 或 doorway 页（§27/§48）。
7. 🟡 **无省 / 市数据** —— §13/§20/§22 的省市内链与面包屑，**在数据补齐前不能做**（否则 = 造空页，§13 明令）。
8. 🟡 **sitemap `lastModified = new Date()`** —— 每次生成为「现在」，对爬虫是噪声信号。
9. 🟢 **未发现 `/api/diag` 类暴露**（已核查全部 `app/api/**`）。`/admin` 未在 robots 显式 `Disallow`，但已 `noindex`（可接受）。

---

## 7. 推荐修改文件（Implementation 阶段）

- `app/[locale]/suppliers/[slug]/page.tsx` —— 接入 SEO 引擎输出（title/desc/snapshot/faq/schema/内链/related）；明确 revalidate 策略。
- `app/[locale]/suppliers/page.tsx` —— 修「硬编码未核验」；统一风险分披露口径。
- `app/sitemap.ts` —— 接入 indexability 过滤；修正 `lastModified`。
- `app/robots.ts` —— 可选：显式 `Disallow: /admin`。
- `lib/pageMeta.ts` —— 视需要小幅扩展（不破坏既有结构）。
- `lib/queries.ts` —— 视需要**新增只读函数**（related suppliers / taxonomy 聚合），**不改现有签名**。
- `lib/suppliers.ts` —— 视需要新增字段清单（**只增不删**）。

---

## 8. 推荐新增文件

- `lib/seo/supplierSeo.ts` —— `generateSupplierTitle/Description/Snapshot/Faq/Schema/Canonical/Indexable` + `SupplierSeoData`（**不**产出 keywords meta）。
- `lib/seo/taxonomySeo.ts` —— industry / product / location 的 slug · 命名 · 关联。
- `lib/productTaxonomy.ts`（或并入 taxonomy）—— 产品名 → slug / 分类（**初期只覆盖真实出现过的产品词**，避免凭空造词）。
- `lib/location.ts` —— country / province / city 解析与展示名（**依赖 DB 补 province，或先只做已在数据里的 country + city**）。
- （可选，仅在真实数据足以支撑时）`app/[locale]/products/[slug]/page.tsx`、`app/[locale]/locations/...`。
- `scripts/cs13-supplier-seo-regression.ts` —— title / desc / schema / indexable / 内链 / sitemap 一致性回归。

---

## 9. 不需要修改的部分

- `i18n/hreflang.ts`、`app/robots.ts` 主策略、`lib/pageMeta.ts` 结构 —— 已正确。
- `lib/verification.ts`（CS-02 权威推导）、`lib/access.ts`（分层裁剪）、`lib/riskEngine.ts`（算法，§48 禁改）。
- 现有 `/industry/*`、`/countries/*`、`/chemicals/*`、`/audit-guide/*` 落地页。
- **数据库 schema**（§48 禁改；province 若确需新增属**独立 migration**，另行确认）。
- `lib/staticData.ts` 静态兜底**不删除**（先确认其角色再议）。

---

## 10. 预计影响

- **改动面**：以**只读 + 展示层**为主；不动 DB、不动算法、不动付费分层、不动 RFQ 核心逻辑。
- **新增**：约 3–5 个 lib 文件 +（可选）1–2 个新路由族 + 1 个回归脚本。
- **风险等级**：低（以「新增」为主，现有页面是「增强」而非重写）。
- **对现有 5 家 Supplier**：全部受益（都获得 Snapshot / FAQ / 内链 / Schema / indexability 判定）。
- **效果前提**：数据量小（5 家），本轮价值在**建引擎**，不在即时流量。

---

## 下一步（等你确认）

- PHASE 02（数据模型审计）已在本报告 §2/§3 完成。
- 建议按 §49 从 **PHASE 03（SEO Architecture，先建 `lib/seo/*`）** 起步。
- **V1.0 第一批建议先做「低风险 + 高确定性」项**：
  ① 修目录「未核验」Bug；② 建 `lib/seo/supplierSeo.ts` + 用 Sunny Food 接入验证；③ indexability 质量门；④ sitemap 联动；⑤ Supplier 级 Schema / FAQ / Buyer Snapshot。
- 需你拍板的两个决策点：**(a) Risk Score 是改名还是补披露？(b) 是否要在 V1.0 内新增 `province` 列（独立 migration）以支撑 §13 省市 SEO？**

> **本报告到此暂停。** 请回复「确认进入 Implementation」或指出需要调整的范围，我再动手。
