# FactoryAuditB2B 站点全面勘察报告

生成时间：2026-08-29　|　代码库：`F:\AI-验厂SEO网站`　|　线上域名：factoryauditb2b.com

---

## 〇、先看结论

这个站点可以概括成一句话：**架构是优等生，内容是空架子。**

技术骨架（多语言、分类引擎、SEO 结构化数据、可解释的风险模型）做得相当扎实，甚至比很多上线站点都规范。但业务闭环在最后一公里断了——**用户填了表单，数据不保存**；站点里躺着的只有 3 个供应商、1 个审核员的演示数据。

**我的建议：先别做"优化"，先做"收口"。**

现在去优化架构或加新功能，等于给一个空展厅装修。当务之急是把三件事接通：表单落库、换掉演示数据、支付会员。这三件事做完之前，任何优化投入的边际收益都很低。

按优先级排序（后面有详细拆解）：

| 优先级 | 事项 | 工作量 | 不做会怎样 |
|---|---|---|---|
| **P0** | 验厂申请 + RFQ 表单落库 | 半天 | 客户填完表单，你收不到，等于白投广告 |
| **P0** | 替换演示数据 | 持续 | 客户一看只有 3 家供应商就知道是空站 |
| **P1** | 支付与会员门控 | 3–5 天 | 定价页是摆设，无法变现 |
| **P1** | 剩余 15 个页面接入多语言 | 1–2 天 | 小语种用户看到满屏英文 |
| **P2** | 补齐 knowledge / logistics 空壳页 | 2–3 天 | 导航点进去是空的，掉信任 |
| **P2** | 接通风险权重配置 | 半天 | 后台改权重不生效（当前是假配置） |
| **P3** | 上线前切 PostgreSQL、配 DeepSeek | 1 天 | 本地能跑，上线要重来 |

---

## 一、结构

### 1.1 技术栈

| 层面 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 15.3.3（App Router） | 服务端渲染为主 |
| UI | React 19 + Tailwind v4 | 自定义类 `.btn` `.card` `.input` 等 |
| 语言 | TypeScript strict | 严格模式，类型错误会阻断构建 |
| 数据库 | SQLite（`prisma/dev.db`） | 开发用；schema 刻意避开 SQLite 独有特性，可平滑切 Postgres |
| ORM | Prisma 6.5.0 | 客户端输出在 `generated/prisma-client`（**不在 node_modules 内**，为规避 Windows 文件锁） |
| 鉴权 | NextAuth v5 | 邮箱密码（bcrypt）+ Google OAuth（未配置则自动不启用） |
| 多语言 | 自研轻量方案，零新增依赖 | 6 种语言 |
| AI | DeepSeek（可选） | **未配置 Key，当前全部走本地规则引擎** |

### 1.2 路由地图

共 **22 个页面**、6 个 API 接口。

| 分类 | 路由 | 状态 |
|---|---|---|
| **核心** | `/`（首页） | ✅ 已接多语言 |
| **工具（7 个）** | `/tools` 工具中心 | ✅ 已接多语言 |
| | `/tools/supplier-risk-calculator` 风险计算器 | ✅ 旗舰，已接多语言 |
| | `/tools/supplier-verification-checklist` 验证清单 | ✅ 已接多语言 |
| | `/tools/supplier-risk-assessment` 风险评估 | ⚠️ 英文硬编码 |
| | `/tools/audit-checklist` 审核清单生成器 | ⚠️ 英文硬编码 |
| | `/tools/supplier-scorecard` 评估计分卡 | ⚠️ 英文硬编码 |
| | `/tools/audit-report-analyzer` 报告分析器 | ⚠️ 英文硬编码 |
| | `/tools/supplier-document-checker` 文件核对器 | ⚠️ 英文硬编码 |
| **服务** | `/services/supplier-verification` 供应商验证 | ✅ 已接多语言 |
| | `/factory-audit/request` 验厂申请 | ⚠️ 英文 + **表单不落库** |
| | `/inspectors` 审核员市场 | ⚠️ 含中文硬编码 |
| | `/logistics` 物流市场 | ❌ 纯占位页 |
| **商机** | `/rfq` 询价 | ⚠️ 英文 + **Post RFQ 按钮无效** |
| | `/suppliers` 供应商目录 | ⚠️ 英文硬编码 |
| | `/supplier/[country]/[slug]` 供应商详情 | ⚠️ 英文硬编码 |
| **内容** | `/audit-guide/[country]/[auditType]` 审核指南 | ⚠️ 程序化生成，英文 |
| | `/knowledge` 知识中心 | ❌ 7 张卡片点不动 |
| **其他** | `/pricing` 定价 | ⚠️ 静态卡片，**无支付** |
| | `/login` 登录 | ⚠️ 英文硬编码 |
| | `/admin`、`/admin/taxonomy` 后台 | ✅ 可用 |

**API 接口 6 个**：`/api/lead`（线索落库）、`/api/risk`（风险评估）、`/api/rfq-draft`（询价草稿生成）、`/api/report-analyze`（报告分析）、`/api/admin/taxonomy`（后台分类管理）、`/api/auth/[...nextauth]`（鉴权）。

### 1.3 数据模型

**22 张表**，分九组：

| 组 | 表 | 当前数据量 | 说明 |
|---|---|---|---|
| 分类核心 | TaxonomyNode | 48 | 分类树，单一事实来源 |
| | TaxonomyRelation | 7 | 节点间关系 |
| 目录 | AuditType | 22 | 审核类型（SMETA/BSCI/ISO9001…） |
| | Standard | 21 | 认证标准 |
| 风险模型 | RiskWeightRule | 16 | 可配置权重 |
| | RiskEvent | 1 | 供应商负面事件 |
| 用户 | User / Account / Session | 3 用户 | 4 种角色：BUYER/SUPPLIER/AUDITOR/ADMIN |
| 审核员 | Auditor / AuditorCapability | 1 人 / 3 标签 | |
| 供应商 | Supplier | **3 家** | 深圳电子、广州纺织、胡志明服装 |
| | SupplierCapability | 6 | 能力标签 |
| | SupplierEvidence | 3 | 证据记录 |
| 字典 | Country / Industry | 9 国 / 12 行业 | |
| 业务 | Rfq | 1 | 询价单 |
| | AuditRequest | 1 | 验厂申请 |
| 线索 | Lead / Assessment | 1 / 1 | 工具 → 邮箱 → 线索 |
| 日志 | AuditLog | **0** | 后台操作日志，从未写入 |

**关键观察**：除分类数据（48 节点 / 22 审核类型 / 21 标准）是有效资产外，**所有业务数据都是种子演示数据**。AuditLog 为 0，说明后台操作从未被记录。

### 1.4 多语言架构

| 语言 | URL 形式 | 字典 |
|---|---|---|
| English（默认） | `/tools` **无前缀** | en.json |
| 简体中文 | `/zh/tools` | zh.json |
| Español | `/es/tools` | es.json |
| Deutsch | `/de/tools` | de.json |
| Français | `/fr/tools` | fr.json |
| Português | `/pt/tools` | pt.json |

- 路由：`app/[locale]/` 下承载全部页面，`app/` 根只留 api 与 SEO 文件
- 中间件：无前缀 URL 内部重写到英文（地址栏不变），`/en/*` 301 到无前缀
- 字典类型以英文为准，**缺 key 会在构建时报错**，不会静默漏翻
- 6 份字典 key 完整度已校验：0 缺失 / 0 多余

---

## 二、内容

### 2.1 内容资产盘点

| 内容类型 | 数量 | 评价 |
|---|---|---|
| 免费工具 | 7 个 | 其中旗舰计算器完成度最高（22 题六维模型） |
| 程序化落地页 | 约 200 条 | 国家×行业、国家×审核类型组合，模板驱动 |
| 供应商档案 | 3 家 | 演示数据 |
| 审核员档案 | 1 人 | 演示数据 |
| 知识文章 | **0 篇** | 知识中心只有 7 个空分类 |
| 案例 / 报告样本 | 0 | 无 |

### 2.2 各页面完成度分级

**✅ 完成度高（可直接展示）**
- 首页：Hero + 搜索 + 工具列表 + 三条价值主张
- 风险计算器：22 题六维打分、结果可视化、分级建议、动态 CTA、邮箱捕获、可打印报告
- 验证清单：6 阶段 29 项，关键项高亮，进度本地保存
- 供应商验证服务页：6 项核查、4 步流程、交付物、FAQ

**⚠️ 能用但有缺口**
- 工具中心、审核员市场（读真实数据，但文案未翻译）
- 供应商目录/详情页（读 DB，未翻译）
- 审核指南（程序化生成，有 SEO 结构化数据，未翻译）
- 定价页（4 档价格卡片，但**没有支付**）

**❌ 空壳 / 占位**
- **物流页**：整页只有一句 "Logistics RFQ and forwarder marketplace arrive in Phase 3"
- **知识中心**：7 个分类卡片，**没有链接，点了没反应**
- **询价页**：表单能填，但 "Post RFQ" 按钮**没有绑定任何事件**
- **验厂申请页**：提交后只弹一句提示，页面源码里自己写着 "(Demo — no data persisted.)"

### 2.3 文案质量

已完成**去 AI 味**重写（英文源文案 + 6 语言翻译）。清理了 57 处破折号滥用，删除 "not X, but Y" 句式和 "smarter way" / "compounding moat" 这类营销腔。

改后的风格是具体、克制、有立场，例如：

> 原：A smarter way to source from China and Asia. … — all in one platform.
> 现：We look up the registration, walk the floor and read the audit paperwork for factories in China and across Asia. You get the documents, photos and findings, then decide whether to place the order.

**但只有 7 个页面享受了这个质量**，其余 15 个页面仍是旧文案（且 inspectors 页混着中文硬编码）。

---

## 三、服务

### 3.1 对外服务线

| 服务 | 落地页 | 实际可用性 |
|---|---|---|
| 供应商验证 | `/services/supplier-verification` | 页面完整，但申请表单不落库 |
| 工厂审核 | `/factory-audit/request` | **表单不落库** |
| 产品验货 | `/inspectors` | 审核员市场，仅 1 人 |
| 询价撮合 | `/rfq` | **Post RFQ 按钮无效** |
| 物流货运 | `/logistics` | **占位，未实现** |
| 免费工具 | `/tools` | ✅ 7 个可用 |

### 3.2 转化漏斗（关键）

设计意图是**免费工具 → 打分 → 留邮箱 → 转化付费服务**，这条链目前的状态：

```
首页/自然搜索
    ↓
免费工具（7 个）           ✅ 可用
    ↓
风险打分 + 关键风险因子     ✅ 可用
    ↓
按风险等级动态 CTA         ✅ 可用（低风险给报告，高风险推验证）
    ↓
留邮箱拿完整报告           ✅ 落库（Lead + Assessment 表）
    ↓
申请验证 / 验厂            ❌ 断
    ↓
表单提交                   ❌ 不落库（页面自述 "no data persisted"）
    ↓
成交                       ❌ 无支付
```

**漏斗在倒数第二步断掉。** 前端引流、打分、抓邮箱全都做了，也很完整，但客户真正要下单时，填的信息没有进数据库——你不会收到任何通知。

这是当前最严重的问题：**你为引流做的所有工作（SEO、工具、多语言），到最后一分钱都收不回来。**

---

## 四、变更逻辑

这是本次勘察最需要说清楚的部分：**改一个地方，会影响哪里；以及哪些地方改了根本不生效。**

### 4.1 数据从哪来

```
prisma/seed.js（种子脚本）
    ↓ 写入
SQLite 数据库（prisma/dev.db）
    ↓ 读取
lib/taxonomy.ts（分类引擎，16 个函数）
    ↓ 供
页面 / SEO / 风险模型 / 审核员匹配
```

**重要**：所有内容数据靠 `node prisma/seed.js` 灌入。**没有后台录入界面**（除分类树外）。要加供应商、加审核员，目前只能改 seed 脚本或直接改数据库。

### 4.2 后台能改什么

`/admin/taxonomy` 后台可操作：

| 能力 | 接口 | 改了之后的影响范围 |
|---|---|---|
| 新增/编辑/删除分类节点 | `/api/admin/taxonomy` | ✅ 生效：程序化 SEO 页、审核员匹配、供应商能力标签、审核指南 |
| 调整风险权重 | `/api/admin/taxonomy` | ❌ **不生效**（见下） |
| 查看分类树、审核类型、标准 | 同上 | 只读 |

### 4.3 ⚠️ 断链点：风险权重是假配置

数据库里有 `RiskWeightRule` 表（16 条记录），后台也能改。但是：

- 风险计算器的权重**硬编码在代码里**（Company 15 / Quality 20 / Compliance 20 / Production 15 / Supply Chain 15 / Documentation 15）
- 全项目只有 `lib/taxonomy.ts` 在读写这张表，**没有任何业务代码消费它**
- `lib/scoring.ts`（另一套评分）同样不读数据库

**结果：你在后台把质量权重从 20 改成 50，前端计算结果一个数字都不会变。**

这是"看起来可配置、实际不可配置"，属于容易踩坑的地方——如果哪天你想按行业调整权重，会发现改了没用。

### 4.4 内容更新路径

| 想改什么 | 改哪里 | 是否需要重新构建 |
|---|---|---|
| 页面文案（6 语言） | `i18n/dictionaries/*.json` | ✅ 需要 |
| 工具问卷题目/选项 | 同上 + `lib/riskEngine.ts`（结构） | ✅ 需要 |
| 导航 / 页脚 | `components/SiteHeader.tsx` / `SiteFooter.tsx` | ✅ 需要 |
| 首页工具列表 | `app/[locale]/page.tsx` 的 TOOLS 数组 | ✅ 需要 |
| 分类 / 审核类型 / 标准 | 后台 或 `prisma/seed.js` | 后台改即时生效；改 seed 需重跑 |
| 供应商 / 审核员数据 | `prisma/seed.js` 或直接改库 | 页面是动态的，改库即生效 |
| 新增语言 | `i18n/config.ts` + 新增一份字典 | ✅ 需要 |

### 4.5 AI 能力

`lib/ai.ts` 有 3 个 AI 函数：风险分析、询价草稿生成、报告审阅。

**每个函数都有双层兜底**：没配 Key → 用本地规则；调用失败 → 退回本地规则。所以目前**全部返回 `source: "local"`**，功能可用但没有 AI 加持。

配一个 DeepSeek Key 就能启用，不需要改代码。**但注意：即便配了 Key，风险计算器的打分逻辑仍不涉及 AI**（它走的是纯规则引擎，这是刻意的——保证可解释）。

---

## 五、问题清单

### 致命（上线即出事）

| # | 问题 | 证据 |
|---|---|---|
| 1 | 验厂申请表单不落库 | 页面源码自述 "(Demo — no data persisted.)"，仅 `setSubmitted(true)` |
| 2 | Post RFQ 按钮无事件绑定 | `<button className="btn btn-accent w-full">Post RFQ</button>` 无 onClick |
| 3 | 业务数据全是演示数据 | 3 供应商 / 1 审核员 / 1 询价 / 1 申请 |
| 4 | 无支付、无会员门控 | 定价页 4 个按钮全部链到 `/login` |
| 5 | 数据库是 SQLite | 本地文件库，多用户并发写入会锁，无法上线 |

### 重要（影响转化与信任）

| # | 问题 | 影响 |
|---|---|---|
| 6 | 风险权重后台改了不生效 | 假配置，误导决策 |
| 7 | 知识中心 7 张卡片无链接 | 点了没反应，掉信任 |
| 8 | 物流页是 Phase 3 占位 | 同上 |
| 9 | 15 个页面未接入多语言 | 小语种用户看满屏英文 |
| 10 | inspectors 页混中文硬编码 | 英文站出现中文 |

### 一般（可后补）

| # | 问题 |
|---|---|
| 11 | 后台操作日志（AuditLog）从未写入 |
| 12 | 风险引擎不消费供应商真实数据（capability / riskEvent），只依赖用户填的问卷 |
| 13 | 无邮件通知（客户留了邮箱，没有自动回复） |
| 14 | Google Analytics / 转化追踪未接 |
| 15 | 无 sitemap 自动提交、无 Search Console 验证 |

---

## 六、优化建议

### 路线选择

| 路线 | 做什么 | 投入 | 适合什么情况 |
|---|---|---|---|
| **A. 收口上线**（推荐） | 表单落库 + 换真实数据 + 支付会员 + 切 Postgres | 1–2 周 | 想尽快开始获客 |
| **B. 内容扩充** | 补供应商库、写知识文章、补空壳页 | 2–4 周 | 已有真实客户，需要内容承接 |
| **C. 功能扩张** | 加新工具、供应商后台、比价功能 | 1 个月+ | 前两条做完之后 |

**建议按 A → B → C 顺序走。** 现在直接做 C 是浪费——工具再多，客户下单时表单不保存，一切归零。

### 如果只做三件事

1. **接通表单落库**（半天）：验厂申请写 AuditRequest 表，RFQ 写 Rfq 表，加邮件通知
2. **换掉演示数据**（1 天起）：至少录入 20–30 家真实供应商，把 3 家演示数据撤下或标注
3. **上线前的两个开关**（1 天）：切 PostgreSQL、配 DeepSeek Key

这三件做完，站点才具备"承接真实流量"的能力。

### 关于是否重构

**不建议重构。** 现有架构有三个真实优点，值得保留：

1. **分类单一事实来源**：48 个分类节点驱动全站 SEO 页、审核员匹配、供应商标签。改一处全站生效，不会出死链
2. **多语言类型安全**：字典缺 key 直接构建失败，不会静默漏翻
3. **风险模型可解释**：打分逻辑透明，每个维度权重可见——这在验厂行业是信任资产，很多竞品做不到

需要改的是业务闭环，不是架构。

---

## 附录：关键文件索引

| 用途 | 路径 |
|---|---|
| 分类引擎（单一事实来源） | `lib/taxonomy.ts` |
| 风险引擎（结构，无文案） | `lib/riskEngine.ts` |
| 另一套评分逻辑 | `lib/scoring.ts` |
| AI 兜底封装 | `lib/ai.ts` |
| 数据库查询封装 | `lib/queries.ts` |
| 数据模型 | `prisma/schema.prisma` |
| 种子数据 | `prisma/seed.js` |
| 多语言配置 | `i18n/config.ts` |
| 字典目录 | `i18n/dictionaries/` |
| 路由中间件 | `middleware.ts` |
| 站点地图 | `app/sitemap.ts` |
| AI 抓取入口 | `app/llms.txt/route.ts` |
