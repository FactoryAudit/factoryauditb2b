# CONTENT-STRATEGY — 内容矩阵与 30 篇核心内容计划

日期：2026-08-29
现状：站点 22 个路由，其中 0 篇独立内容页；数据库无 Article 模型

---

## 〇、一句话结论

**本站目前没有内容，只有工具和服务页。** 工具页能带来搜索流量，但撑不起"验厂权威"这一定位，也无法被 AI 反复引用。

**30 篇核心内容是建立主题权威度（topical authority）的最小规模。** 但要先把 Article 数据模型建出来，否则内容只能写成硬编码页面，后续无法多语言维护，也无法做内容运营。

---

## 一、现状评估

| 维度 | 现状 | 评价 |
|---|---|---|
| 内容页数量 | 0 | 无任何文章型页面 |
| 数据模型 | 无 Article / Content 表 | 内容无载体 |
| `/knowledge` 页 | 7 张卡片，无链接 | 点了没反应 |
| 程序化页面 | 198 条 audit-guide 已生成 | 有规模，但内容同质化、零内链 |
| 业务数据 | 供应商 3 家、审核员 1 名 | 案例支撑不足 |
| 多语言内容 | 仅 UI 文案翻译完成 | 正文内容未翻译 |

**核心矛盾**：程序化矩阵（198 页）建起来了，但没有一篇原创内容做支撑，这些页面缺乏被引用的价值。

---

## 二、内容模型设计（先建这个）

### 2.1 Prisma 模型

```prisma
model Article {
  id          String   @id @default(cuid())
  slug        String   @unique
  category    String   // audit-program | inspection | verification | logistics | compliance
  countryCode String?  // 可选，用于国家维度
  standardCode String? // 可选，关联 Standard
  status      String   @default("DRAFT") // DRAFT | PUBLISHED | ARCHIVED
  publishedAt DateTime?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  translations ArticleTranslation[]

  @@index([category, status])
  @@index([slug])
}

model ArticleTranslation {
  id          String  @id @default(cuid())
  articleId   String
  locale      String  // en | zh | es | de | fr | pt
  title       String
  h1          String
  metaTitle   String
  metaDesc    String
  quickAnswer String  // 40–80 词的答案前置段落（AI 摘取用）
  body        String  // Markdown
  faq         String  // JSON 字符串：[{q,a}, ...]

  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([articleId, locale])
  @@index([locale])
}
```

### 2.2 为什么用关联表而不是 JSON 字段

6 种语言的正文放在一张表的 JSON 字段里，单条记录会超过几十 KB，编辑和查询都痛苦。拆成 `ArticleTranslation` 后：

- 按需加载单语言内容，页面构建更快
- 某语言缺翻译不影响其他语言发布
- 便于后续接翻译工作流

### 2.3 路由

```
/knowledge/[slug]        → 英文（无前缀）
/zh/knowledge/[slug]     → 中文
```

---

## 三、内容矩阵（三层结构）

```
第 1 层：支柱内容（Pillar）
    10 篇深度指南，每篇 2000+ 词，覆盖核心主题
         │
第 2 层：支撑内容（Cluster）
    20 篇专项文章，每篇 1200–1800 词，回答具体问题
         │
         └── 每个支柱链接 2 篇支撑，支撑回链支柱
         │
第 3 层：程序化页面
    198 条 audit-guide + 国家/行业/标准矩阵
         └── 从支柱内容继承权威度
```

**关键规则**：第 3 层的程序化页面必须有第 1、2 层内容做支撑，否则就是薄内容。当前 198 条 audit-guide 缺的正是这个。

---

## 四、30 篇核心内容清单

### A. 审核体系指南（10 篇，支柱内容）

| # | 标题 | 目标关键词 | 目标 URL |
|---|---|---|---|
| 1 | SMETA Audit: Requirements, Process and Cost | smeta audit requirements | `/knowledge/smeta-audit-guide` |
| 2 | BSCI Audit: What Buyers Need to Know | bsci audit requirements | `/knowledge/bsci-audit-guide` |
| 3 | WRAP Certification Explained | wrap certification | `/knowledge/wrap-certification-guide` |
| 4 | SA8000 vs SMETA: How They Differ | sa8000 vs smeta | `/knowledge/sa8000-vs-smeta` |
| 5 | RBA Code of Conduct Audit Guide | rba audit | `/knowledge/rba-audit-guide` |
| 6 | ICTI Audit for Toy Manufacturers | icti audit | `/knowledge/icti-audit-guide` |
| 7 | CTPAT: Supply Chain Security Audit | ctpat audit requirements | `/knowledge/ctpat-audit-guide` |
| 8 | ISO 9001 for Chinese Factories | iso 9001 certification china | `/knowledge/iso-9001-china` |
| 9 | ISO 14001 Environmental Audit Guide | iso 14001 audit | `/knowledge/iso-14001-guide` |
| 10 | ISO 45001 vs OHSAS 18001 | iso 45001 vs ohsas 18001 | `/knowledge/iso-45001-guide` |

### B. 验厂实操（8 篇）

| # | 标题 | 目标关键词 | 目标 URL |
|---|---|---|---|
| 11 | Factory Audit Process: Step by Step | factory audit process | `/knowledge/factory-audit-process` |
| 12 | Factory Audit Checklist (Free Template) | factory audit checklist | `/knowledge/factory-audit-checklist` |
| 13 | How to Read a Factory Audit Report | how to read audit report | `/knowledge/read-audit-report` |
| 14 | Top 20 Audit Non-Conformities in China | audit non conformity | `/knowledge/common-audit-findings` |
| 15 | Factory Audit Cost Breakdown | factory audit cost | `/knowledge/factory-audit-cost` |
| 16 | How to Prepare Your Factory for an Audit | how to prepare for audit | `/knowledge/prepare-for-audit` |
| 17 | Announced vs Unannounced Audits | unannounced audit | `/knowledge/unannounced-audit` |
| 18 | Audit vs Certification: The Difference | audit vs certification | `/knowledge/audit-vs-certification` |

### C. 供应商验证（6 篇）

| # | 标题 | 目标关键词 | 目标 URL |
|---|---|---|---|
| 19 | How to Verify a Supplier in China | verify supplier in china | `/knowledge/verify-supplier-china` |
| 20 | Supplier Background Check: Complete Guide | supplier background check | `/knowledge/supplier-background-check` |
| 21 | Red Flags When Vetting a New Supplier | supplier red flags | `/knowledge/supplier-red-flags` |
| 22 | Supplier Scorecard: How to Build One | supplier scorecard template | `/knowledge/supplier-scorecard-guide` |
| 23 | On-Site Verification vs Desktop Review | on site verification | `/knowledge/onsite-vs-desktop` |
| 24 | Documents to Request Before Placing an Order | supplier documents checklist | `/knowledge/supplier-documents` |

### D. 验货与物流（6 篇）

| # | 标题 | 目标关键词 | 目标 URL |
|---|---|---|---|
| 25 | Pre-Shipment Inspection: A Buyer's Guide | pre shipment inspection | `/knowledge/pre-shipment-inspection` |
| 26 | AQL Sampling Explained (With Tables) | aql sampling | `/knowledge/aql-sampling-guide` |
| 27 | Container Types and Sizes Compared | container types sizes | `/knowledge/container-types` |
| 28 | How to Calculate Container Load | container load calculation | `/knowledge/container-load-guide` |
| 29 | Choosing a Freight Forwarder in China | freight forwarder china | `/knowledge/freight-forwarder-china` |
| 30 | Incoterms 2026: Which One to Use | incoterms explained | `/knowledge/incoterms-guide` |

---

## 五、写作规范（必须遵守）

### 5.1 结构模板

每篇文章固定结构，与 `/logistics` 保持一致：

```
H1（含核心关键词）
├─ Quick Answer        40–80 词，第一句给结论
├─ 正文（带 H2/H3）
│   ├─ 表格（能用表格就不用段落）
│   ├─ 编号列表（流程类）
│   └─ 具体数字与单位
├─ 相关页面链接        至少 2 条站内情境链接
└─ FAQ（4–6 组）      同时输出 FAQPage JSON-LD
```

### 5.2 文案风格（去 AI 味）

| 禁止 | 原因 | 替代做法 |
|---|---|---|
| 破折号做修辞补充 | AI 写作的典型痕迹 | 用冒号，或拆成两句 |
| "not X, but Y" 否定式排比 | 同上 | 直接陈述 |
| 三段式堆砌 | 同上 | 该说几点说几点 |
| smarter way / seamless / robust | 营销套话 | 说具体做了什么 |
| "在当今竞争激烈的市场中" | 无信息量 | 直接进主题 |

**正面示例**：

```
❌ A smarter way to verify suppliers — comprehensive checks,
   seamless workflow, robust reporting.

✅ We look up the registration, walk the floor and read the
   audit paperwork. You get the documents, photos and findings.
```

### 5.3 AI 可摘取性检查

每篇写完后自查：

- [ ] 第一段能否独立回答标题的问题？
- [ ] 是否有至少 3 个具体数字？
- [ ] 是否有表格或编号列表？
- [ ] 每段能否脱离上下文单独理解？
- [ ] FAQ 是否与正文内容一致（不是编的）？

---

## 六、程序化页面内容增强

198 条 audit-guide 页面当前内容同质化。增强方案：

| 增强项 | 做法 | 工作量 |
|---|---|---|
| 国家特有内容 | 各国的法规要求、常见不符合项、本地审核资源 | 每国 1 份，共 9 份素材 |
| 审核类型特有内容 | 该体系的审核范围、判定标准、有效期 | 每类型 1 份，共 22 份素材 |
| 交叉引用 | 每个 audit-guide 页链接同国家 21 个 + 同类型 8 个 | 模板化，一次搞定 |
| 支柱内容回链 | 链接到 A 组对应指南 | 模板化 |

素材共 31 份，组合出 198 个页面的差异化内容。这是程序化 SEO 的正确做法：**有限的高质量素材 + 结构化组合**，而不是生成 198 篇雷同文章。

---

## 七、发布节奏

| 阶段 | 内容 | 周期 | 目标 |
|---|---|---|---|
| 第 1 月 | 建 Article 模型 + `/knowledge/[slug]` 路由 | 1 周 | 内容可发布 |
| 第 1 月 | A 组前 3 篇（SMETA / BSCI / WRAP）| 3 周 | 三大体系权威度 |
| 第 2 月 | A 组 4–10 篇 | 4 周 | 审核体系全覆盖 |
| 第 2 月 | B 组前 4 篇 | 并行 | 实操长尾 |
| 第 3 月 | B 组 5–8 篇 + C 组前 3 篇 | 4 周 | 决策流程覆盖 |
| 第 4 月 | C 组 4–6 篇 + D 组 6 篇 | 4 周 | 完成 30 篇 |

**翻译节奏**：英文发布后 1 周内完成 6 语言翻译。不要先写完 30 篇英文再统一翻译，那样翻译时原文可能已经需要修订。

---

## 八、优先级建议

**不要现在就开始写 30 篇。** 按当前站点状态，顺序应该是：

| 顺序 | 任务 | 理由 |
|---|---|---|
| 1 | 修 canonical 与 metadata（SEO-AUDIT P0）| 不修，写了也没人看得到 |
| 2 | 清 sitemap 死链（CRAWLER-ACCESS 3.2）| 10 分钟止损 |
| 3 | 补 Article 模型 + 路由 | 内容需要载体 |
| 4 | 写 A 组前 3 篇，验证流程 | 小批量试错 |
| 5 | 全量推进 30 篇 | 流程跑通后加速 |

**第 1、2 项约半天，必须先做。** 在没有 canonical 的站点上发内容，等于往漏水的桶里倒水。

---

## 九、度量指标

| 指标 | 目标（6 个月）| 来源 |
|---|---|---|
| 已发布内容数 | 30 篇 × 6 语言 | 内部统计 |
| 内容页有机流量占比 | > 40% | Search Console |
| 内容页被 AI 引用次数 | 每月 > 5 次 | 手动抽查 |
| 平均停留时长 | > 2 分钟 | 分析工具 |
| 内容页 → RFQ 转化率 | > 2% | 内部埋点 |
