# /logistics 装柜计算器 — 交付说明与全站待办盘点

日期：2026-08-29
状态：✅ 已交付并通过验证　服务：http://localhost:3000（生产构建，365 静态页）

---

## 一、本次交付

`/logistics` 从"货代占位页"改造为**真能用的集装箱装柜计算器**。

### 1. 计算器能力（`components/tools/ContainerLoadCalculator.tsx`，新建）

| 能力 | 说明 |
|---|---|
| 柜型覆盖 | 20GP / 40GP / 40HQ / 45HQ / 20RF / 40RF / 20OT / 40OT 共 8 种 |
| 摆放优化 | 6 种朝向逐一比对集装箱内尺寸，取装得最多的摆法 |
| 间隙补偿 | 可设箱间间隙（默认 0），按双边计算 |
| 载重限制 | 单件重量 × 装量不得超过该柜型限重，取"空间"与"载重"的较小值 |
| 柜数计算 | 所需柜数 = 向上取整（总件数 ÷ 每柜装量）|
| 结果输出 | 每柜装量、摆放方式（长×宽×层）、所需柜数、体积利用率、载重利用率 |
| 辅助展示 | 全柜型横向对比表、俯视摆放示意图、超重/超尺寸/门框告警 |
| 单位 | cm / inch、kg / lb 可切换 |

**规格取值（行业标准，单位 mm）**

| 柜型 | 内尺寸（长×宽×高）| 容积 | 限重 |
|---|---|---|---|
| 20GP | 5898 × 2352 × 2393 | 33.2 m³ | 28.0 t |
| 40GP | 12032 × 2352 × 2393 | 67.7 m³ | 26.5 t |
| 40HQ | 12032 × 2352 × 2698 | 76.4 m³ | 26.5 t |
| 45HQ | 13556 × 2352 × 2698 | 86.1 m³ | 27.6 t |
| 20RF | 5450 × 2290 × 2270 | 28.3 m³ | 27.4 t |
| 40RF | 11580 × 2290 × 2500 | 66.3 m³ | 27.7 t |
| 20OT | 5900 × 2330 × 2330 | 32.1 m³ | 28.0 t |
| 40OT | 12000 × 2330 × 2330 | 65.2 m³ | 26.6 t |

> 术语纠正：正确写法是 **20GP / 40GP**（GP = General Purpose 普通干箱），不是 20PG / 40PG。

### 2. 页面结构（AI 搜索友好）

```
H1 集装箱装柜计算器
├─ Quick Answer      40–80 词直接回答"一个 20GP 能装多少箱"
├─ 计算器本体        WebApplication（浏览器端交互）
├─ How it works      4 步方法论
├─ 规格表            8 种柜型完整参数
├─ Methodology       算法说明
└─ FAQ               JSON-LD FAQPage
```

### 3. 多语言与接线

- 6 份字典 `i18n/dictionaries/{en,zh,es,de,fr,pt}.json` 新增顶层 `container` 键
- 首页工具卡片新增入口（英文 "Container Load Calculator"）/`toolCards.containerCalculator`
- `app/llms.txt/route.ts` 补入口，"Seven tools" → "Eight tools"

---

## 二、验证结果

| 检查项 | 结果 |
|---|---|
| `next build` | ✅ EXIT=0，365 个静态页 |
| 6 语言 HTTP 状态 | ✅ 全 200（en / zh / es / de / fr / pt）|
| JSON-LD | ✅ 4 段，含 `WebApplication` + `FAQPage` + `BreadcrumbList` |
| hreflang | ✅ 9 变体（en / en-US / zh-CN / zh-Hans / es / de / fr / pt-BR / x-default）|
| sitemap.xml | ✅ 6 条 logistics URL 已收录 |
| llms.txt | ✅ 已收录 |
| 首页入口 | ✅ `href="/logistics"` 存在 |
| 中文 H1 实测 | ✅ "集装箱装柜计算器" |

---

## 三、修复的两个问题

1. **构建报 `Cannot read properties of undefined (reading 'openTop')`**
   字典里 `ui` / `types` / `specs` 是**平级兄弟键**，组件却只收到 `c.ui` 再访问 `t.types` / `t.specs`，取到 undefined。
   解法：`types` 与 `specs` 改为**独立 prop** 传入。第一次只改了 `types`、漏了 `specs`，报错原样复现，补改后通过。

2. **遗留怪表达式**
   `unit === "cm" ? t.length && "cm" : "in"` → 改为 `unit === "cm" ? "cm" : "in"`。

---

## 四、84 节 SEO 任务书 — 完成度盘点

### 已完成（本次会话内）
- `/logistics` 装柜计算器（含 6 语言、结构化数据、收录接线）

### 未启动

| 项 | 要求 | 现状 |
|---|---|---|
| 7 份文档 | `SEO-AUDIT.md`、`AI-SEARCH.md`、`INTERNAL-LINKING.md`、`SCHEMA.md`、`CONTENT-STRATEGY.md`、`CRAWLER-ACCESS.md`、`SEO-KEYWORD-MAP.md` | ❌ `docs/` 目录不存在，一份未产出 |
| `/services/*` | 服务矩阵 | ⚠️ 仅 1 个（`supplier-verification`）|
| `/sourcing/china/` | 采购国家页 | ❌ 路由不存在 |
| `/methodology/` | 方法论页 | ❌ 路由不存在 |
| `/about/` | 关于页 | ❌ 路由不存在 |
| `/case-studies/` | 案例页 | ❌ 路由不存在 |
| 30 篇核心内容 | 内容矩阵 | ❌ schema 无 Article / Content 模型，无数据载体 |

现有路由共 23 个（含动态路由），其中 `/tools/*` 6 个工具 + 1 个 hub 已成型。

### 建议执行顺序

1. **先建 `docs/` 7 份文档**（纯分析产出，不改代码，风险最低，且是任务书的硬指标）
2. **补 4 个缺失路由**（about / methodology / case-studies / sourcing/china）
3. **扩 `/services/*` 矩阵**
4. **最后做 30 篇内容**（需要先加 Article 模型，工作量最大）
