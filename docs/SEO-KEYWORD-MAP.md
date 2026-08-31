# SEO-KEYWORD-MAP — 关键词到 URL 映射

日期：2026-08-29
覆盖范围：6 种语言（en 无前缀 + zh / es / de / fr / pt 带前缀）

> **关于搜索量**：本文不给具体月搜索量数字。编造的搜索量会导致错误的优先级判断。上线前请用 Ahrefs / Semrush / Google Keyword Planner 逐个核实，填入"量"列后再排序。本文提供的是**关键词结构、意图判断与 URL 归属**，这部分不依赖搜索量。

---

## 〇、一句话结论

**本站关键词布局的头号问题不是缺词，是缺页面。** 高商业意图的核心词（验厂服务、验货服务、中国采购）目前没有一个专属页面承接，全靠首页硬撑。而工具词和装柜词已经有两个像样的页面打底，可以立刻拿量。

**建议节奏**：先用工具词和装柜词引流（竞争小、见效快），同时补核心服务页承接商业意图。

---

## 一、关键词分组与 URL 归属

### A 组：核心服务词（商业意图最高）

| 关键词 | 意图 | 目标 URL | 页面状态 |
|---|---|---|---|
| factory audit china | 商业 | `/services/factory-audit` | ❌ 待建 |
| china factory audit service | 商业 | `/services/factory-audit` | ❌ 待建 |
| supplier verification china | 商业 | `/services/supplier-verification` | ✅ 已有 |
| verify supplier in china | 商业 | `/services/supplier-verification` | ✅ 已有 |
| pre shipment inspection | 商业 | `/services/pre-shipment-inspection` | ❌ 待建 |
| third party inspection china | 商业 | `/services/pre-shipment-inspection` | ❌ 待建 |
| china sourcing agent | 商业 | `/sourcing/china` | ❌ 待建 |
| factory audit cost | 商业调研 | `/pricing` | ⚠️ 已有但无价格 |
| how much does a factory audit cost | 信息 | `/pricing` | ⚠️ 已有但无价格 |

**关键缺口**：`/services/factory-audit` 和 `/services/pre-shipment-inspection` 是本站业务的主干，却没有页面。这两个页面应当优先于任何内容营销。

### B 组：工具词（引流主力，竞争相对小）

| 关键词 | 意图 | 目标 URL | 页面状态 |
|---|---|---|---|
| supplier risk assessment | 工具 | `/tools/supplier-risk-calculator` | ✅ 已有 |
| supplier verification checklist | 工具 | `/tools/supplier-verification-checklist` | ✅ 已有 |
| supplier audit checklist | 工具 | `/tools/audit-checklist` | ✅ 已有 |
| supplier scorecard template | 工具 | `/tools/supplier-scorecard` | ✅ 已有 |
| factory audit report analyzer | 工具 | `/tools/audit-report-analyzer` | ✅ 已有 |
| supplier document checker | 工具 | `/tools/supplier-document-checker` | ✅ 已有 |
| supplier risk assessment template | 工具 | `/tools/supplier-risk-assessment` | ✅ 已有 |

**问题**：B 组 7 个页面只有 2 个有独立 metadata，其余 5 个共用首页 title（见 SEO-AUDIT P0-2）。这意味着即使排名上去，搜索结果也显示错误的标题。

### C 组：装柜与物流词（新增，机会最大）

| 关键词 | 意图 | 目标 URL | 页面状态 |
|---|---|---|---|
| container load calculator | 工具 | `/logistics` | ✅ 已有 |
| how many cartons in a 20gp | 信息 | `/logistics` | ✅ 已有 |
| 20gp container capacity | 信息 | `/logistics` | ✅ 已有 |
| 40hq vs 40gp difference | 比较 | `/logistics` | ✅ 已有 |
| container loading calculator cartons | 工具 | `/logistics` | ✅ 已有 |
| 20gp internal dimensions | 信息 | `/logistics` | ✅ 已有 |
| freight forwarder china | 商业 | `/logistics` | ✅ 已有 |

**这一组是本站当前最有竞争力的**：页面结构完整（Quick Answer + 工具 + 规格表 + FAQ + WebApplication schema），6 语言齐全，且竞品多为纯文字说明页。建议优先投入外链与推广资源。

### D 组：审核体系知识词（信息意图，建立权威）

| 关键词 | 意图 | 目标 URL | 页面状态 |
|---|---|---|---|
| what is smeta audit | 信息 | `/audit-guide/{country}/SMETA` | ✅ 198 页已建 |
| bsci audit requirements | 信息 | `/audit-guide/{country}/BSCI` | ✅ 已建 |
| iso 9001 certification china | 信息 | `/supplier-audit/ISO9001` | ❌ 404 |
| wrap certification meaning | 信息 | `/supplier-audit/WRAP` | ❌ 404 |
| sa8000 vs smeta | 比较 | `/supplier-audit/SA8000` | ❌ 404 |

**问题**：`/supplier-audit/{standard}` 21 条 URL 全是 404（见 SEO-AUDIT P0-3）。这是 D 组最大的损失。

### E 组：国家 × 服务矩阵词

| 关键词模式 | 目标 URL | 页面状态 |
|---|---|---|
| `factory audit vietnam` | `/factory-audit/{country}` | ❌ 404（9 条）|
| `supplier verification bangladesh` | `/supplier-verification/{country}` | ❌ 404（9 条）|
| `electronics factory audit china` | `/factory-audit/{country}/{industry}` | ❌ 404（108 条）|

**共 126 条 404**，占全部死链的 86%。这批页面建成后是长尾流量的主力，但建设成本高（需要每个国家/行业有真实差异化内容，否则又是薄内容）。

---

## 二、关键词自查：避免自己人打自己人

| 风险 | 现状 | 处理 |
|---|---|---|
| 7 个工具页共用首页 title | 已发生 | 补 metadata，每个工具页 title 含各自核心词 |
| `/services/supplier-verification` 与 `/supplier-verification/{country}` | 命名相近易混淆 | 国家维度改用 `/factory-audit/{country}` 统一，避免两套近义 URL |
| 装柜词与 freight forwarder 词同在 `/logistics` | 可接受 | 一个页面主打一个意图，装柜计算器为主，货代服务为辅 |
| `/tools/supplier-risk-calculator` 与 `/tools/supplier-risk-assessment` | **高风险** | 两个页面名称高度相似，必须做明确差异化（见下）|

**风险计算器 vs 风险评估的差异化约定**：

| 页面 | 定位 | 主打词 | 差异化 |
|---|---|---|---|
| `/tools/supplier-risk-calculator` | 交互式打分工具 | supplier risk assessment / calculator | 六维问卷，输出 0–100 分 |
| `/tools/supplier-risk-assessment` | 方法论与模板 | supplier risk assessment template / methodology | 讲怎么做评估，提供可下载框架 |

---

## 三、多语言关键词策略

### 3.1 原则

| 原则 | 说明 |
|---|---|
| 不逐字翻译 | 各国买家搜索习惯不同，英文 "factory audit" 在德语区更常用 "Lieferantenaudit" |
| 英文优先 | 英文页面竞争最激烈但也最具参考价值，先做英文，再翻译 |
| 中文站定位 | 中文页面面向中国供应商（他们是被动被搜索方），关键词应偏"如何申请 SMETA 验厂"而非"如何找验厂公司" |
| 葡语用 pt-BR | 巴西是主要市场，不用欧洲葡语 |

### 3.2 各语言核心词对照（示例）

| 语言 | factory audit | supplier verification | container load calculator |
|---|---|---|---|
| en | factory audit | supplier verification | container load calculator |
| zh | 工厂验厂 | 供应商验证 | 集装箱装柜计算器 |
| es | auditoría de fábrica | verificación de proveedores | calculadora de carga de contenedores |
| de | Lieferantenaudit | Lieferantenüberprüfung | Containerladungsrechner |
| fr | audit d'usine | vérification de fournisseur | calculateur de chargement de conteneur |
| pt | auditoria de fábrica | verificação de fornecedores | calculadora de carga de contêiner |

> 以上为直译，上线前需用各语言关键词工具核实。德语区实际搜索更可能用 "Lieferantenaudit" 而非直译的 "Fabrikaudit"。

### 3.3 URL 结构

**英文无前缀，其余带前缀**，同一关键词在 6 个语言页面各自承接对应语言的流量，靠 hreflang 避免互相竞争：

```
/logistics         → 承接英文 container load calculator
/zh/logistics      → 承接中文 集装箱装柜计算器
/de/logistics      → 承接德语 Containerladungsrechner
```

---

## 四、优先级排序

排序依据：**商业意图 > 竞争度低 > 页面已存在**。

| 优先级 | 关键词组 | 理由 | 前置条件 |
|---|---|---|---|
| 1 | C 组（装柜物流）| 页面已完善，竞争小，见效快 | 无，可直接推广 |
| 2 | A 组（核心服务）| 商业价值最高 | 需先建 2 个服务页 |
| 3 | B 组（工具）| 页面存在，只需修 metadata | 补 metadata，半天 |
| 4 | D 组（审核体系）| 198 页已建，缺 21 条标准页 | 建 `/supplier-audit/{standard}` 路由 |
| 5 | E 组（国家矩阵）| 126 条，长尾但建设成本高 | 需真实差异化内容，否则薄内容 |

---

## 五、落地执行

| 步骤 | 任务 | 产出 |
|---|---|---|
| 1 | 用关键词工具核实本文所有关键词的搜索量与难度 | 补充"量"与"难度"两列的表格 |
| 2 | 建 `/services/factory-audit` 与 `/services/pre-shipment-inspection` | 2 个高商业价值页面 |
| 3 | 给 B 组 7 个工具页补独立 metadata | 7 份 title + description |
| 4 | 建 `/supplier-audit/{standard}` 路由 | 恢复 21 条 URL |
| 5 | 建 `/factory-audit/{country}` 路由（先做 3 个主力国家）| 恢复 27 条 URL |
| 6 | 每月用 Search Console 查实际展现词，回填本文 | 关键词表迭代 |

---

## 六、监控指标

| 指标 | 来源 | 频率 |
|---|---|---|
| 各页面展现量与点击率 | Search Console → 效果 | 每月 |
| 关键词排名变化 | Ahrefs / Semrush | 每月 |
| 同页多词竞争（cannibalization）| Search Console 查同一查询多个 URL 展现 | 每季度 |
| AI 引用情况 | 手动抽查 5 个监测问题 | 每月（见 AI-SEARCH.md 六）|
