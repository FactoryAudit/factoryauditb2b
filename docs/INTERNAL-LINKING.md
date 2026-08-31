# INTERNAL-LINKING — 内链架构规范

日期：2026-08-29
数据：19 个页面实机爬取，出链 / 入链均为真实统计

---

## 〇、一句话结论

**全站只有导航和页脚在链接，正文里几乎没有一个情境链接。** 19 个页面共享完全相同的 18 条链接，权重被摊平，没有任何页面被"重点推"。198 条 audit-guide 页面只有 sitemap 一个入口，等于被埋在地下。

---

## 一、实测内链快照

### 1.1 出链构成

| 页面 | 出链总数 | 其中导航+页脚 | 情境内链 |
|---|---|---|---|
| `/` | 18 | 18 | **0** |
| `/tools` | 18 | 18 | 0 |
| `/logistics` | 13 | 13 | **0** |
| `/suppliers` | 16 | 13 | 3（供应商详情）|
| `/rfq` | 13 | 13 | **0** |
| `/pricing` | 14 | 13 | 1 |
| `/audit-guide/china/SMETA` | 14 | 13 | 1 |
| `/supplier/[country]/[slug]` | 13 | 13 | **0** |

**结论**：除 `/suppliers`（列目录必然链接详情）外，其余页面正文零情境内链。

### 1.2 入链次数排行

| 入链数 | 页面 | 来源 |
|---|---|---|
| 19 | `/` `/tools` `/suppliers` `/rfq` `/inspectors` `/logistics` `/knowledge` `/pricing` `/factory-audit/request` `/tools/supplier-risk-calculator` `/tools/supplier-verification-checklist` `/services/supplier-verification` `/admin` | 导航 + 页脚（全站通用）|
| 4 | `/tools/supplier-document-checker` | 首页工具网格 + tools hub + 2 处正文 |
| 3 | `/tools/audit-checklist` `/tools/supplier-scorecard` | 首页工具网格 + tools hub + 1 处正文 |
| 2 | `/tools/supplier-risk-assessment` `/tools/audit-report-analyzer` | 仅首页工具网格 + tools hub |
| 1–2 | 供应商详情页 | 仅 `/suppliers` 目录 |
| **0** | **198 条 audit-guide 页面** | **只有 sitemap，无任何页面链入** |

**两个要命的数字**：
1. **`/tools/supplier-risk-assessment` 和 `/tools/audit-report-analyzer` 只有 2 条入链**，是全站最孤立的页面。
2. **198 条 audit-guide 页面入链为 0**。程序化矩阵做出来了，但没有一个页面链向它们，Google 几乎不可能发现并给予权重。

---

## 二、问题清单

### P0-1　198 条 audit-guide 页面零内链

`/audit-guide/{country}/{auditType}` 是本站最大的内容矩阵（9 国家 × 22 审核类型 = 198 页），目前只存在于 sitemap 中。

**修复**：在 `/knowledge` 页建立"按国家浏览 / 按审核类型浏览"双索引矩阵，每个格子链向对应 audit-guide 页。这一处改动就能给 198 个页面各增加 1 条入链，且是情境相关的高质量链接。

### P0-2　供应商详情页软 404

**实测**：`/supplier/china/this-slug-does-not-exist` 返回 **200**，而不是 404。

对比：`/audit-guide/china/FAKEAUDIT` 正确返回 404。

**后果**：任何人可构造无限个返回 200 的空页面，Google 会抓到大量软 404，严重浪费抓取预算并拉低站点质量分。

**修复**：`app/[locale]/supplier/[country]/[slug]/page.tsx` 查不到数据时调用 `notFound()`，与 audit-guide 路由保持一致。

### P1-1　`/admin` 有 19 条入链

后台入口出现在全站页脚，等于把 19 个页面的权重分给一个不该被索引的页面。

**修复**：页脚 admin 链接加 `rel="nofollow"`，`/admin` 页面本身加 `noindex`。

### P1-2　工具间无横向互链

7 个工具各自孤立，用户看完风险计算器不会被引导到验证清单。

**修复**：每个工具页底部加"相关工具"模块，按流程顺序互链（见 3.2）。

### P1-3　页脚 9 个国家名为纯文本

`SiteFooter.tsx` 第 93–95 行，国家名无任何链接，浪费了全站 19 个页面的页脚位置。

**修复**：改为链向 `/factory-audit/{country}`（需先建该路由，见 SEO-AUDIT P0-3）。

---

## 三、目标内链架构

### 3.1 三层结构

```
        第 1 层：枢纽（Hub）
   /            /tools              /knowledge        /suppliers
   │               │                    │                  │
   │        第 2 层：分类（Category）      │                  │
   │     7 个工具页    9 个国家页     198 条 audit-guide   供应商详情
   │               │                    │                  │
   └───────────────┴── 第 3 层：叶子（Leaf）────────────────┘
              供应商详情 / 标准页 / 案例
```

**规则**：任何页面距首页不超过 3 次点击；每个叶子页至少有 1 条来自同层或上层的情境链接。

### 3.2 工具页互链顺序（按采购决策流程）

```
验证清单 → 风险计算器 → 评分卡 → 文件核查 → 审核清单 → 报告分析 → 风险评估
   ①          ②          ③         ④          ⑤          ⑥          ⑦
```

每个工具页底部展示"上一步 / 下一步"两个链接，加"相关服务"一个链接：
- 工具 → 工具：同层互链，传递相关性
- 工具 → 服务：下层转化（`/services/supplier-verification`、`/rfq`、`/factory-audit/request`）

### 3.3 audit-guide 矩阵入口（P0-1 的具体做法）

在 `/knowledge` 页放一个 9 × 22 的双向矩阵：

| 入口 | 链接去向 | 新增入链 |
|---|---|---|
| 按国家浏览 | 9 个国家各链接到该国 22 个 audit-guide | 198 |
| 按审核类型浏览 | 22 个审核类型各链接到 9 个国家页 | 198（重复，去重后 198 页面各得 2 条）|

同时在 `/audit-guide/{country}/{auditType}` 页内加：
- 同国家其他审核类型（21 条）
- 同审核类型其他国家（8 条）
- 该国供应商目录（1 条）

这样每个 audit-guide 页出链约 30 条，198 个页面之间形成致密网络。

---

## 四、锚文本规则

| 场景 | 锚文本写法 | 示例 |
|---|---|---|
| 推荐 | 描述目标页内容的具体短语 | "SMETA 验厂在中国的要求与流程" |
| 可接受 | 目标页 H1 的简化版 | "中国 SMETA 验厂指南" |
| 禁止 | "点击这里" / "更多" / "查看详情" | — |
| 禁止 | 全站统一锚文本指向不同 URL | 9 个国家都用"验厂服务" |

**多语言**：锚文本必须随语言切换，从字典取，不得硬编码。

**密度**：同一页面指向同一 URL 的链接只计第 1 个的权重，不要为了加链接在正文里重复堆砌同一个链接。

---

## 五、执行清单

| 优先级 | 任务 | 位置 | 预估 |
|---|---|---|---|
| P0 | `/supplier/[country]/[slug]` 查不到数据时 `notFound()` | `app/[locale]/supplier/[country]/[slug]/page.tsx` | 20 分钟 |
| P0 | `/knowledge` 建 9×22 audit-guide 矩阵入口 | `app/[locale]/knowledge/page.tsx` | 半天 |
| P1 | 页脚 admin 加 nofollow + `/admin` 加 noindex | `SiteFooter.tsx` + admin layout | 20 分钟 |
| P1 | 7 个工具页加"上一步/下一步"互链 | `app/[locale]/tools/*/page.tsx` | 半天 |
| P1 | audit-guide 页内加同国家/同类型互链 | `app/[locale]/audit-guide/[country]/[auditType]/page.tsx` | 半天 |
| P1 | 页脚 9 国家名改为链接 | `SiteFooter.tsx` | 30 分钟（依赖路由先建好）|
| P2 | 正文内容页按锚文本规则补情境链接 | 各内容页 | 持续 |
