# 网站数据分析（Analytics）配置文档

> 最后更新：2026-09-03 ｜ 适用：FactoryAuditB2B.com（Next.js 15 + OpenNext / Cloudflare Workers）
>
> 本站已内置两套分析通道：**Cloudflare Web Analytics**（流量与性能）+ **Google Analytics 4**（事件与转化）。
> 两者都是「配置即生效」：不填 ID 时完全不加载任何脚本，页面零额外开销。

---

## 0. 快速开始（3 步启用）

### 第 1 步：拿到两个 ID

| ID | 去哪拿 | 长什么样 |
|---|---|---|
| GA4 Measurement ID | [ga.google.com](https://ga.google.com) → 左下角「管理」齿轮 → 「数据流」→ 选 Web 数据流 → 右上角「衡量 ID」 | `G-XXXXXXXXXX`（G- 开头） |
| Cloudflare beacon token | [dash.cloudflare.com](https://dash.cloudflare.com) → 左侧 **Web Analytics** → **Add a site** → 填 `factoryauditb2b.com` → 复制 JS snippet 里 `"token":"..."` 那串 | 32 位十六进制字符（只含 0-9 a-f） |

### 第 2 步：填进项目根目录的 `.env`

```ini
NEXT_PUBLIC_GA4_MEASUREMENT_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN="32位十六进制串"
```

> ⚠️ **`NEXT_PUBLIC_` 前缀的变量是构建时内联的**：改完 `.env` 必须重新构建部署才生效，只改文件、只重启 dev server 都不够。
> 生产部署命令（两步，勿用 `npm run cf:build`）：
>
> ```bash
> # 1. next build（带 NEXT_PRIVATE_STANDALONE=true，环境变量见 .env 注释）
> # 2. ./node_modules/.bin/opennextjs-cloudflare build --skipNextBuild
> # 3. ./node_modules/.bin/opennextjs-cloudflare deploy
> ```

这两个 ID 是**公开标识符**（本来就会出现在网页源码里，任何人查看源码都能看到），不是密钥，用 `NEXT_PUBLIC_` 前缀是安全的。真正的密钥（如 `MAIL_HTTP_KEY`）绝不放 `NEXT_PUBLIC_`。

### 第 3 步：验证

- 本地：`.env` 设 `NEXT_PUBLIC_ANALYTICS_DEBUG="1"` 后 `npm run dev`，打开浏览器 Console（F12），每个事件都会打印 `[analytics] 事件名 {参数}`。
- 线上：查看网页源码（Ctrl+U）应能看到 `googletagmanager.com/gtag/js?id=G-...` 与 `cloudflareinsights.com/beacon.min.js` 各一次。

---

## 1. Cloudflare Web Analytics 如何查看

登录 [dash.cloudflare.com](https://dash.cloudflare.com) → 左侧菜单 **Web Analytics** → 点 `factoryauditb2b.com`。

自动提供（**无需任何手动埋点**，beacon 脚本自动采集，也不用 Cookie）：

- Visitors / Page Views / Page Load Time
- Top Pages / Top Referrers / Top Search Terms
- Countries / Browsers / Devices
- Core Web Vitals（LCP / INP / CLS）

> 注意：Cloudflare Web Analytics 只看「流量」，看不到下面第 3 节的自定义事件（那些在 GA4 里）。

## 2. Google Analytics 4 如何查看

登录 [ga.google.com](https://ga.google.com) → 选你的媒体资源：

| 想看什么 | 在哪 |
|---|---|
| 流量 / 受访页面 / 国家 / 渠道 | 「报告」→「互动度 / 流量获取」 |
| **自定义事件**（第 3 节清单） | 「管理」→「事件」，或「报告」→「互动度」→「事件」 |
| 事件参数（如搜索词 query） | 「管理」→「事件」→ 点事件名 → 参数报表（首次需注册自定义维度） |
| **转化漏斗** | 先把核心转化事件标记为「关键事件」（见第 5 节），然后看「报告」→「业务目标」或用「探索」自建漏斗 |
| 实时调试 | 「管理」→「DebugView」（本地 dev 环境自动开 debug_mode，事件只进 DebugView 不污染生产报表） |

---

## 3. 已安装的事件清单

事件常量的**单一事实来源**是 `lib/analytics.ts` 的 `ANALYTICS_EVENTS`。以下均为**已真实接线**（有真实用户行为才会触发，不造假数据）：

### 3.1 页面浏览类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `page_view` | GA4 自动上报（首次加载）；SPA 站内跳转由 Tracker 补发 | page_path |
| `page_view_group` | 所有带 `data-track-page` 的页面（按类型聚合，如 180 个指南页归为一类） | page |
| `supplier_directory_view` | /suppliers 目录页 | — |
| `supplier_profile_view` | 供应商详情页（页面级）；目录卡片点击（点击级，带 slug） | value=slug |
| `supplier_claim_view` | /suppliers/{slug}/claim 页 | — |
| `register_view` | /register 注册页 | — |
| `membership_page_view` | /membership 会员页 | — |
| `founding_buyer_view` | /membership 会员页曝光（Founding Buyer 商业意图） | — |
| `tool_risk_calculator` / `tool_verification_checklist` / `tool_compare` / `tool_audit_checklist` / `tool_audit_report_analyzer` / `tool_document_checker` / `tool_risk_assessment` / `tool_scorecard` / `rfq` / `custom_services` / `supplier_network` / `sample_report` | 对应工具页 / RFQ 页 / 付费咨询页 / 供应商入驻页 / 样例报告页 | page |

### 3.2 供应商目录行为类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `supplier_search` | 目录搜索表单提交 | query=搜索词 |
| `supplier_filter` | 点击国家 / 行业筛选 | value=国家或行业代码 |
| `supplier_profile_free_cta` | 详情页「免费」CTA 点击 | value=slug |
| `supplier_profile_paid_cta` | 详情页付费 CTA 点击 | value=slug |
| `supplier_claim_submit` | Claim 表单提交成功 | slug |
| `supplier_compare` | 对比工具首次实际操作（改评分 / 添加供应商） | — |

### 3.3 免费工具类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `risk_calculator_start` | 风险计算器首次作答 | — |
| `risk_calculator_complete` | 计算完成 | level、score |
| `verification_checklist_start` | 核查清单首次勾选 | — |

### 3.4 服务请求类（含表单）

| 事件 | 触发点 | 参数 |
|---|---|---|
| `verification_request` | /services 核查服务卡片点击 | — |
| `audit_request` | 验厂服务卡片点击 + 验厂表单提交 | value=类型 |
| `audit_request_submit` | 验厂表单提交**成功** | value=类型 |
| `inspection_request` | 验货服务卡片点击 + 验货表单提交 | value=阶段 |
| `inspection_request_submit` | 验货表单提交**成功** | value=阶段 |
| `sourcing_request` | /services sourcing 卡片点击 | — |
| `rfq_start` | RFQ 表单首次聚焦 | — |
| `rfq_submit` | RFQ 提交**成功** | — |
| `custom_service_start` | /custom-services 付费咨询表单首次聚焦（全站付费档 CTA 的落地页） | — |
| `custom_service_submit` | 付费咨询表单提交**成功**（核心转化终点） | — |
| `sample_report_cta` | 样例报告留资按钮点击 | — |
| `sample_report_submit` | 样例报告留资提交**成功**（线索转化） | — |
| `supplier_network_start` | /join-supplier-network 入驻表单首次聚焦 | — |
| `supplier_network_submit` | 供应商入驻提交**成功**（供给侧线索转化） | — |

### 3.5 账户类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `register_cta` | 各处「创建账号」入口点击 | — |
| `signup_start` | 注册表单首次聚焦 | — |
| `register_submit` | 注册表单通过校验、发起提交 | — |
| `signup_complete` | 注册**成功**（核心转化） | — |

### 3.6 商业转化类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `founding_buyer_checkout_start` | 会员页 Founding Buyer CTA 点击 | — |
| `verification_checkout_start` | /pricing 推荐档（核查套餐）CTA 点击 | — |

### 3.7 预留未接线（诚实标注）

以下事件**常量已定义但不会触发**，因为 V2.0 没有对应功能。等未来功能上线时接线，避免出现假数据：

| 事件 | 为什么没接 |
|---|---|
| `supplier_save` | 站内无收藏功能 |
| `login` | V2.0 已禁用 auth，无登录系统 |
| `founding_buyer_purchase` / `verification_purchase` | 在线支付未接入（线下成交） |
| `membership_cta` | 旧常量；会员页 CTA 已分别改用 `founding_buyer_checkout_start` / `register_cta` |

---

## 4. 每个事件是什么意思（业务口径）

- **`supplier_search` 的 query**：买家在目录搜了什么产品关键词 → 直接回答「哪些产品关键词带来流量」。
- **`supplier_filter` 的 value**：买家筛了哪个国家 / 行业 → 回答「哪些国家 / 行业受关注」。
- **`supplier_profile_view` 的 value（slug）**：哪些供应商页访问最高。
- **`supplier_compare`**：买家开始用对比工具权衡多个供应商（高购买意向信号）。
- **`risk_calculator_complete` 的 level/score**：免费工具的完成率与输出分布（质量信号）。
- **`*_request`（无 submit 后缀）**：用户表达了意向（点击 / 提交表单）。
- **`*_submit`（有后缀）**：表单**成功**送达 → 这才是真实线索数。
- **`founding_buyer_view` → `founding_buyer_checkout_start` → `signup_complete`**：会员页曝光 → 付费意向 → 免费注册的递进。

## 5. 核心转化事件（Key Events）

`lib/analytics.ts` 的 `CONVERSION_EVENTS` 列出 16 个：`signup_complete`、`register_submit`、`founding_buyer_purchase`*、`verification_purchase`*、`founding_buyer_checkout_start`、`verification_checkout_start`、`audit_request_submit`、`inspection_request_submit`、`rfq_submit`、`custom_service_submit`、`sample_report_submit`、`supplier_network_submit`、`verification_request`、`audit_request`、`inspection_request`、`sourcing_request`（* 为支付未接入的预留）。

**在 GA4 标记为关键事件**：管理 → 事件 → 找到事件名 → 右侧开关「标记为关键事件」。

**主漏斗**（`FUNNEL_STEPS`，对应「Google 搜索 → 落地 → 档案/工具 → 免费账号 → Founding Buyer → 核查 → 验厂 → 验货/Sourcing」）：

```
page_view（落地页）
  → supplier_profile_view / risk_calculator_start（档案或免费工具）
    → signup_complete（免费账号）
      → founding_buyer_view → founding_buyer_checkout_start（会员意向）
        → verification_checkout_start → verification_request（核查）
          → audit_request_submit（验厂）
            → inspection_request_submit / rfq_submit / custom_service_submit（验货 / Sourcing / 付费咨询）
```

> 注：付费档 CTA 全部导流到 /custom-services 询价（无在线支付），因此 `custom_service_submit` 是当前付费转化的实际终点。

GA4 「探索」→「漏斗探索」按上面顺序逐层添加即可看到逐级转化率。

## 6. 如何增加新事件

1. **定义**：在 `lib/analytics.ts` 的 `ANALYTICS_EVENTS` 加一行（键用驼峰，值用 snake_case）。
2. **接线**（三选一，优先用前两种，零 JS）：
   - 点击：`<Link data-track={ANALYTICS_EVENTS.xxx} data-track-value="某值">`（Tracker 自动委托）。
   - 表单提交：`<form data-track-submit={ANALYTICS_EVENTS.xxx} data-track-field="q">`。
   - 代码调用：`trackEvent(ANALYTICS_EVENTS.xxx, { level: r.level })`（先 focus / 提交成功等语义点）。
3. **参数限制**：只允许白名单键（value/query/slug/country/industry/locale/plan/step/score/level/method 等，见 `ALLOWED_PARAM_KEYS`）；邮箱、电话、密码等敏感数据在两层防护下不可能被发出（键名敏感词黑名单 + 值正则过滤）。**新增埋点严禁携带任何个人敏感信息。**
4. 若是重要商业节点，同时把它加进 `CONVERSION_EVENTS`，并去 GA4 标记关键事件。

## 7. 如何测试

1. `.env` 里设 `NEXT_PUBLIC_ANALYTICS_DEBUG="1"`，`npm run dev`。
2. 打开 localhost:3000，F12 Console。操作页面（搜索、点筛选、跑计算器、提交 RFQ……），每个事件应打印：
   `[analytics] supplier_search {query: "led"}`
3. 配了真实 GA4 ID 时，GA4 →「管理」→「DebugView」几秒内应出现同样的事件（dev 环境自动 debug_mode，不污染生产报表）。
4. 生产验证：改 `.env` → 重新构建部署 → 线上 Ctrl+U 查源码，确认 `gtag/js?id=G-...` 和 `beacon.min.js` 各出现**一次**；GA4「报告」→「实时」应出现活跃用户。
5. 测完把 `NEXT_PUBLIC_ANALYTICS_DEBUG` 改回空。

## 8. 如何判断 Analytics 正常工作（健康检查清单）

| 检查项 | 方法 | 正常判据 |
|---|---|---|
| 脚本已注入且不重复 | 线上查看源码 | `googletagmanager.com/gtag/js` 出现 1 次、`beacon.min.js` 出现 1 次 |
| 未配置时不注入 | 不填 ID 构建 | 源码里搜不到上述两个脚本（组件返回 null，零开销） |
| Cloudflare 收数 | dash.cloudflare.com → Web Analytics | 24h 内有 Visitors / Top Pages 数据 |
| GA4 收数 | GA4 → 实时报告 | 自己访问网站时「活跃用户 ≥ 1」 |
| 事件收数 | GA4 → DebugView（dev）或实时报告 | 操作后几秒内出现对应事件名 |
| PV 不翻倍 | GA4 → 报告 → 互动度 | Page Views 与实际访问次数同量级；`page_view_group` 与 `page_view` 是两类不同事件 |
| SEO 不受影响 | Google Search Console / 抓取 | 脚本 `strategy="afterInteractive"` 不阻塞 SSR：正文 HTML 完整、robots.txt / sitemap.xml / canonical / 结构化数据与安装前一致 |
| 无敏感数据外泄 | Console 调试模式抽查事件参数 | 只有白名单键，永远看不到 email / 电话 / 密码 |

## 9. 架构备注（给未来的自己）

- **注入点唯一**：`components/AnalyticsScripts.tsx` 只在 `app/[locale]/layout.tsx` 挂载一次，任何页面/组件不要再写 `<Script>`。
- **事件委托**：`components/AnalyticsTracker.tsx` 全局监听 `data-track` / `data-track-submit` / `data-track-page` / `data-track-view` 四类属性，页面只加属性、不写监听。
- **fail-open**：`trackEvent` 无 gtag/dataLayer 时静默 no-op；埋点任何异常都不影响业务。
- **PV 不翻倍**：gtag.js 自动上报标准 `page_view`；自定义的页面类型事件命名 `page_view_group`；SPA 跳转由 `usePathname` 补发 `page_view`。
- **不用 `useSearchParams`**：避免 Suspense 边界让静态页退化（SEO 硬要求）。
- **ID 格式校验**：GA4 只接受 `G-` 开头，CF token 只接受 32 位 hex，填错不加载、不报错。
