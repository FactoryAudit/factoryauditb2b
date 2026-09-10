# 网站数据分析（Analytics）配置文档

> 最后更新：2026-09-10 ｜ 适用：FactoryAuditB2B.com（Next.js 15 + OpenNext / Cloudflare Workers）
>
> 本站已内置两套分析通道：**Cloudflare Web Analytics**（流量与性能）+ **Google Analytics 4**（事件与转化）。
> 两者都是「配置即生效」：不填 ID 时完全不加载任何脚本，页面零额外开销。
>
> **CS-04（2026-09-10）**：a) 修正 CTA 点击被误记为服务请求的事件口径问题；b) 重新划分
> 转化桶 / 点击桶 / 未接线桶；c) **GA4 生产通道已激活**。
>
> **GA4 激活状态**：`NEXT_PUBLIC_GA4_MEASUREMENT_ID = "G-1GKLYNLVQ5"`，已随 Worker 版本
> `f333f339-3f55-4f71-bfc2-2b28e8932c20` 部署。实测已确认 `page_view`、`supplier_profile_view`、
> `*_cta_click` 真实送达 `www.google-analytics.com`（`tid=G-1GKLYNLVQ5`），且点击服务卡片
> **不产生任何 `*_request`**。Cloudflare beacon token 仍为空（未接入）。
>
> ⚠️ **本节曾有一处错误结论，已更正（2026-09-11）**：早期记录称 `page_view_group` 首次加载
> **不被投递**（P2）。经复核，该结论是**投递探针的解析缺陷造成的误判** —— GA4 把事件批量放在
> 一个 POST body 里且以 `\n` 分行，旧探针只按 `&` 匹配，每批**只能读到第一条事件**。
> 实测（修正探针后）：`page_view_group` 一直正常投递，`/suppliers` 与供应商详情页各 1 次/页。
> 探针与回归脚本均已修正并加守护断言。真正被修掉的是另一个**潜在静默丢事件竞态**：
> 页面浏览事件的「分析通道就绪等待」，详见 §9 架构备注。

---

## 0. 快速开始（3 步启用）

### 第 1 步：拿到两个 ID

| ID | 去哪拿 | 长什么样 |
|---|---|---|
| GA4 Measurement ID | [ga.google.com](https://ga.google.com) → 左下角「管理」齿轮 → 「数据流」→ 选 Web 数据流 → 右上角「衡量 ID」 | `G-XXXXXXXXXX`（G- 开头） |
| Cloudflare beacon token | [dash.cloudflare.com](https://dash.cloudflare.com) → 左侧 **Web Analytics** → **Add a site** → 填 `factoryauditb2b.com` → 复制 JS snippet 里 `"token":"..."` 那串 | 32 位十六进制字符（只含 0-9 a-f） |

### 第 2 步：填进项目根目录的 `.env`

```ini
NEXT_PUBLIC_GA4_MEASUREMENT_ID="G-1GKLYNLVQ5"   # 已于 2026-09-10 配置
NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=""        # 仍未配置（可选）
```

> ⚠️ **`NEXT_PUBLIC_` 前缀的变量是构建时内联的**：改完 `.env` 必须重新构建部署才生效，只改文件、只重启 dev server 都不够。
> 生产部署命令（四步，勿用 `npm run cf:build`）：
>
> ```bash
> # 1. next build（NEXT_PRIVATE_STANDALONE=true，环境变量见 .env 注释），必须后台跑
> # 2. ./node_modules/.bin/opennextjs-cloudflare build --skipNextBuild
> # 3. node scripts/scrub-next-env.mjs        ← 必须有，否则密钥会被内联进 Worker
> # 4. node --env-file=.env ./node_modules/wrangler/bin/wrangler.js deploy
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

事件常量的**单一事实来源**是 `lib/analytics.ts` 的 `ANALYTICS_EVENTS`。以下均为**已真实接线**（有真实用户行为才会触发，不造假数据）。

### 3.1 页面浏览类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `page_view` | GA4 自动上报（首次加载）；SPA 站内跳转由 Tracker 补发 | page_path |
| `page_view_group` | 所有带 `data-track-page` 的页面（按类型聚合，如 180 个指南页归为一类） | page |
| `supplier_directory_view` | /suppliers 目录页 | — |
| `supplier_profile_view` | 供应商详情页（页面级）；目录卡片点击（点击级，带 slug） | value=slug |
| `supplier_claim_view` | /suppliers/{slug}/claim 页 | — |
| `register_view` | /register 注册页 | — |
| `login_view` | /login 登录页 | — |
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

### 3.4 点击层（CTA Click）—— 只表示「意向」，**不是转化**

> ⚠️ **CS-04 口径铁律**：点击 ≠ 请求 ≠ 成交 ≠ 收入确认。
> 本节事件全部属于漏斗上层，**绝不可**标记为 GA4 关键事件，也不在 `CONVERSION_EVENTS` 里。
> 绝对不要用这些数字去算「转化率」。

| 事件 | 触发点 | 参数 |
|---|---|---|
| `verification_cta_click` | /services 核查服务卡片、/suppliers 各处核查 CTA（3 处） | — |
| `audit_cta_click` | /services 验厂服务卡片 | — |
| `inspection_cta_click` | /services 验货服务卡片 | — |
| `sourcing_cta_click` | /services sourcing 服务卡片（落地页是 /rfq） | — |
| `rfq_cta_click` | 目录页 RFQ 入口 | — |
| `sample_report_cta` | 样例报告留资按钮点击 | — |
| `register_cta` | 各处「创建账号」入口点击 | — |
| `founding_buyer_checkout_start` | /membership Founding Buyer CTA 点击（购买意向点击，非转化） | — |
| `verification_checkout_start` | /pricing 推荐档（核查套餐）CTA 点击（购买意向点击，非转化） | — |

> ⚠️ `founding_buyer_checkout_start` / `verification_checkout_start` 是**点击驱动**的旧命名。
> 它们表达的是「购买意向点击」，与 `*_cta_click` 属同一层，故已从 `CONVERSION_EVENTS` 移除。
> 为不改动既有页面，本次 CS-04 保留原名；若将来统一命名，应改为 `founding_buyer_cta_click` / 直接复用 `verification_cta_click`。
> 两者**当前已有 emitter**（不像 3.8 的预留事件），只是不属于转化。

### 3.5 服务请求类（表单）—— 真实 Request

> 只有**用户真正提交表单**才会触发本节事件。服务卡片点击不再进这里（见 3.4）。

| 事件 | 触发点 | 参数 |
|---|---|---|
| `audit_request` | /factory-audit/request 验厂表单提交 | value=审核类型 |
| `audit_request_submit` | 验厂表单提交**成功**（服务端受理） | value=审核类型 |
| `inspection_request` | /services/inspection 验货表单提交（**通过必填校验之后**才发） | value=阶段 |
| `inspection_request_submit` | 验货表单提交**成功**（服务端受理） | value=阶段 |
| `rfq_start` | RFQ 表单首次聚焦 | — |
| `rfq_submit` | RFQ 提交**成功** | — |
| `custom_service_start` | /custom-services 付费咨询表单首次聚焦（全站付费档 CTA 的落地页） | — |
| `custom_service_submit` | 付费咨询表单提交**成功**（核心转化终点） | — |
| `sample_report_submit` | 样例报告留资提交**成功**（线索转化） | — |
| `supplier_network_start` | /join-supplier-network 入驻表单首次聚焦 | — |
| `supplier_network_submit` | 供应商入驻提交**成功**（供给侧线索转化） | — |

### 3.6 账户类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `signup_start` | 注册表单首次交互（每人只发一次） | — |
| `register_submit` | 注册表单通过校验、发起提交 | — |
| `signup_complete` | 注册**成功** / 线索落库成功（核心转化） | — |
| `login` | 登录成功 | — |
| `login_failed` | 登录失败（只记失败事实，不记邮箱密码） | — |
| `logout` | 退出登录 | — |
| `unlock_gate_cta` | 会员软锁 UnlockGate / QuotaBanner 的注册升级 CTA 点击（点击层） | — |

### 3.7 付费成交类

| 事件 | 触发点 | 参数 |
|---|---|---|
| `founding_buyer_purchase` | 会员付费成功（**Stripe 未激活，当前无 emitter**） | — |
| `verification_purchase` | 核查套餐付费成功（**Stripe 未激活，当前无 emitter**） | — |

> 这两个事件语义上确属「成交（Paid Order）」，因此保留在 `CONVERSION_EVENTS` 中；
> 但 Stripe 目前不支持大陆主体（已知 P0），尚无任何代码触发它们，GA4 里会恒为 0 —— 这是**预期**而非故障。

### 3.8 预留未接线（诚实标注）

以下事件**常量已定义但不会触发**，因为当前没有对应功能。等功能上线时接线，避免出现假数据：

| 事件 | 为什么没接 |
|---|---|
| `supplier_save` | 站内无收藏功能 |
| `supplier_card_click` | 目录卡片点击当前复用 `supplier_profile_view`（带 slug），本常量未接线 |
| `verification_request` | Verification Request 真实表单未上线（CS-05+）；核查 CTA 现只发 `verification_cta_click` |
| `sourcing_request` | sourcing 落地页是 /rfq，真实提交事件为 `rfq_submit`，本事件与之重复 |
| `guest_limit_reached` / `free_account_signup_start` / `free_account_signup_complete` | Guest Limit UI 待接线（CS-05） |
| `free_quota_reached` | 免费额度上限功能待接线 |
| `membership_cta` | 旧常量；会员页 CTA 已改用 `register_cta` 等 |

> 这些常量在代码里汇总于 `lib/analytics.ts` 的 `UNWIRED_EVENTS`，并有回归脚本守护：
> 一旦某个「未接线」事件被误写进 `CONVERSION_EVENTS`，验证会失败。

---

## 4. 每个事件是什么意思（业务口径）

- **`supplier_search` 的 query**：买家在目录搜了什么产品关键词 → 直接回答「哪些产品关键词带来流量」。
- **`supplier_filter` 的 value**：买家筛了哪个国家 / 行业 → 回答「哪些国家 / 行业受关注」。
- **`supplier_profile_view` 的 value（slug）**：哪些供应商页访问最高。
- **`supplier_compare`**：买家开始用对比工具权衡多个供应商（高购买意向信号）。
- **`risk_calculator_complete` 的 level/score**：免费工具的完成率与输出分布（质量信号）。
- **`*_cta_click`**：用户**点了**某个入口，只代表意向。比 `*_request` 高一层，只能用来算点击率 / 入口吸引力。
- **`*_request`（无 submit 后缀）**：用户**真实提交了表单**（Request）。这是「询盘」口径。
- **`*_submit`（有后缀）**：表单**成功送达服务端**（Qualified Lead）。这才是真实线索数。
- **`*_purchase`**：收到钱（Paid Order）。
- **收入确认（Revenue Recognition）**：财务口径，**不存在于前端事件流**，由后台/账务系统人工记录。切勿用任何前端事件冒充它。
- **`founding_buyer_view` → `founding_buyer_checkout_start`（点击）→ `signup_complete`**：会员页曝光 → 付费意向 → 免费注册的递进（注意中间那步是点击，不是成交）。

## 5. 核心转化事件（Key Events）

`lib/analytics.ts` 的 `CONVERSION_EVENTS` 列出 **12 个**（CS-04 后）：

| 分组 | 事件 |
|---|---|
| 真实账号 | `register_submit`、`signup_complete` |
| Form Submit（Request） | `audit_request`、`inspection_request`、`rfq_submit`、`custom_service_submit`、`sample_report_submit`、`supplier_network_submit` |
| Qualified Lead（服务端受理） | `audit_request_submit`、`inspection_request_submit` |
| Paid Order（待 Stripe） | `founding_buyer_purchase`、`verification_purchase` |

**已从转化清单移除**（原因见括号）：`founding_buyer_checkout_start`（点击层）、
`verification_checkout_start`（点击层）、`verification_request`（未接线）、`sourcing_request`（未接线且与 `rfq_submit` 重复）。

**在 GA4 标记为关键事件**：管理 → 事件 → 找到事件名 → 右侧开关「标记为关键事件」。

**主漏斗**（`FUNNEL_STEPS`）——严格区分行为漏斗与商业漏斗：

```
【行为漏斗】点击 ≠ 请求
page_view（自然搜索落地）
  → supplier_search（供应商搜索 / 筛选）
    → supplier_profile_view（查看供应商档案）
      → *_cta_click（CTA 点击：意向层，不是转化）
        → rfq_start（Form Start：开始填表）
          → audit_request / inspection_request / rfq_submit（Form Submit：真实提交）
            → audit_request_submit / inspection_request_submit（Qualified Lead：服务端受理）

【商业漏斗】Request ≠ Paid Order
  → founding_buyer_purchase（Paid Order：收到钱）

【财务口径】Paid Order ≠ Revenue Recognition
  → 收入确认（不在前端事件流，人工回填）
```

GA4 「探索」→「漏斗探索」按上面顺序逐层添加即可看到逐级转化率。
⚠️ 不要把 `*_cta_click` 加进漏斗的转化步骤，否则点击率会被误读成转化率。

## 6. 如何增加新事件

1. **定义**：在 `lib/analytics.ts` 的 `ANALYTICS_EVENTS` 加一行（键用驼峰，值用 snake_case）。
2. **接线**（三选一，优先用前两种，零 JS）：
   - 点击：`<Link data-track={ANALYTICS_EVENTS.xxx} data-track-value="某值">`（Tracker 自动委托）。
   - 表单提交：`<form data-track-submit={ANALYTICS_EVENTS.xxx} data-track-field="q">`。
   - 代码调用：`trackEvent(ANALYTICS_EVENTS.xxx, { level: r.level })`（先 focus / 提交成功等语义点）。
3. **命名约定（口径）**：点击用 `*_cta_click`；表单提交用 `*_request`；服务端受理用 `*_submit`；收款用 `*_purchase`。
4. **参数限制**：只允许白名单键（value/query/slug/country/industry/locale/plan/step/score/level/method 等，见 `ALLOWED_PARAM_KEYS`）；邮箱、电话、密码等敏感数据在两层防护下不可能被发出（键名敏感词黑名单 + 值正则过滤）。**新增埋点严禁携带任何个人敏感信息。**
5. **归类**：只把「真实表单提交」或「真实付款」加进 `CONVERSION_EVENTS`；点击一律归入 `CLICK_LEVEL_EVENTS`；暂时没人触发的先放进 `UNWIRED_EVENTS`。
6. 跑一遍回归脚本（见第 7 节），它会检查三个桶互斥、转化事件确有 emitter、以及 PII 清洗是否失效。

## 7. 如何测试

1. `.env` 里设 `NEXT_PUBLIC_ANALYTICS_DEBUG="1"`，`npm run dev`。
2. 打开 localhost:3000，F12 Console。操作页面（搜索、点筛选、跑计算器、提交 RFQ……），每个事件应打印：
   `[analytics] supplier_search {query: "led"}`
3. **口径回归（无需浏览器，纯只读）**：

   ```bash
   # ⚠️ Windows/Git Bash 下不要用 /tmp —— node 会把它解析成 F:\tmp 而找不到文件。
   #    CS04_ROOT 必须是 Windows 风格路径，不能直接给 $PWD（那是 /f/... 形态）。
   OUT="$LOCALAPPDATA/Temp/cs04-reg.cjs"
   ./node_modules/.bin/esbuild scripts/cs04-analytics-regression.ts \
     --bundle --platform=node --format=cjs --outfile="$OUT"
   CS04_ROOT="F:/AI-验厂SEO网站" node "$OUT"
   ```

   期望输出 `PASS=39 FAIL=0`。它校验：三桶互斥、`/services` 卡片点击不泄漏进转化、
   漏斗顺序、转化事件确有 emitter、Reserved 事件确实无人触发、PII 双层清洗，
   以及第 8 节的「页面浏览就绪等待 + 投递探针按行解析」守护断言。

3b. **投递对账（需要真实浏览器，验证 GA4 到底收到了什么）**：

   ```bash
   # 先起一个无头 Chrome 调试端口
   "/c/Program Files/Google/Chrome/Application/chrome.exe" \
     --headless=new --disable-gpu --no-sandbox --disable-extensions \
     --user-data-dir=/tmp/cd-ga4 --remote-debugging-port=9333 \
     --remote-allow-origins=* about:blank &
   node scripts/cs04-ga4-probe.mjs
   ```

   它会驱动线上站点、点击四张服务卡片，并解析 `/g/collect` 请求（query + POST body）后输出
   投递计数与每批条数。期望：`page_view` 每页恰好 1 次、`page_view_group` 在声明了
   `data-track-page` 的页面各 1 次、四个 `*_cta_click` 各 1 次、**`*_request` 为 0**、
   gtag.js 每页只加载 1 次。

   🔴 **解析陷阱（曾导致误判，务必保留）**：GA4 把多个事件**批量**塞进一个 POST body，
   body 是「按 `\n` 分行、行内用 `&` 分隔」的：
   ```
   en=page_view&_ee=1&ep.debug_mode=false
   en=page_view_group&_ee=1&ep.debug_mode=false&ep.page=supplier_directory_view
   ```
   所以解析必须**先按行切分再全局匹配 `en=`**。早期版本用 `/(?:^|&)en=/`（无 `m` 标志）
   只匹配字符串开头，结果每批**只读到第一条事件**，其余全被漏掉 —— 由此得出过
   「`page_view_group` 从未投递」的**错误结论**。回归脚本第 8 节已加断言守护这一点。
4. 配了真实 GA4 ID 时，GA4 →「管理」→「DebugView」几秒内应出现同样的事件（dev 环境自动 debug_mode，不污染生产报表）。
5. 生产验证：改 `.env` → 重新构建部署 → 线上 Ctrl+U 查源码，确认 `gtag/js?id=G-...` 和 `beacon.min.js` 各出现**一次**；GA4「报告」→「实时」应出现活跃用户。
6. 测完把 `NEXT_PUBLIC_ANALYTICS_DEBUG` 改回空。

## 8. 如何判断 Analytics 正常工作（健康检查清单）

| 检查项 | 方法 | 正常判据 |
|---|---|---|
| 脚本已注入且不重复 | 线上查看源码 | `googletagmanager.com/gtag/js` 出现 1 次、`beacon.min.js` 出现 1 次 |
| 未配置时不注入 | 不填 ID 构建 | 源码里搜不到上述两个脚本（组件返回 null，零开销） |
| Cloudflare 收数 | dash.cloudflare.com → Web Analytics | 24h 内有 Visitors / Top Pages 数据 |
| GA4 收数 | GA4 → 实时报告 | 自己访问网站时「活跃用户 ≥ 1」 |
| 事件收数 | GA4 → DebugView（dev）或实时报告 | 操作后几秒内出现对应事件名 |
| **口径正确** | GA4 → 事件报表 | 点一下服务卡片只产生 `*_cta_click`，**不产生** `*_request` |
| PV 不翻倍 | GA4 → 报告 → 互动度 | Page Views 与实际访问次数同量级；`page_view_group` 与 `page_view` 是两类不同事件 |
| SEO 不受影响 | Google Search Console / 抓取 | 脚本 `strategy="afterInteractive"` 不阻塞 SSR：正文 HTML 完整、robots.txt / sitemap.xml / canonical / 结构化数据与安装前一致 |
| 无敏感数据外泄 | Console 调试模式抽查事件参数 | 只有白名单键，永远看不到 email / 电话 / 密码 |
| **投递对账** | `node scripts/cs04-ga4-probe.mjs` | `*_request` 计数为 0；`*_cta_click` 各 1 次；`page_view` 每页 1 次；`page_view_group` 在声明了 `data-track-page` 的页面各 1 次 |
| `page_view_group` | 干净浏览器加载 `/suppliers` → GA4 实时 | ✅ **正常投递**（2026-09-11 实测，每页 1 次）。早期曾记为「未投递 P2」，实为**探针漏读批次 body 造成的误判**，已在探针与回归脚本中修正 |

## 9. 架构备注（给未来的自己）

- **注入点唯一**：`components/AnalyticsScripts.tsx` 只在 `app/[locale]/layout.tsx` 挂载一次，任何页面/组件不要再写 `<Script>`。
- **事件委托**：`components/AnalyticsTracker.tsx` 全局监听 `data-track` / `data-track-submit` / `data-track-page` / `data-track-view` 四类属性，页面只加属性、不写监听。
- **fail-open**：`trackEvent` 无 gtag/dataLayer 时静默 no-op；埋点任何异常都不影响业务。
- **页面浏览要等就绪**：`AnalyticsTracker` 发页面浏览事件前会经 `whenAnalyticsReady()` 轮询等待（间隔 50ms、上限 10s）。原因是 GA4 内联初始化片段由 `next/script(afterInteractive)` 注入，其执行时机与 React 首次 passive effect **同一时间段且顺序不保证**；若 Tracker 先跑，`trackEvent` 会因「既无 gtag 也无 dataLayer」静默 no-op，该次浏览事件**永久丢失**（无报错、无重试）。轮询把这层竞态消除掉，超时即放弃。
- **PV 不翻倍**：gtag.js 自动上报标准 `page_view`；自定义的页面类型事件命名 `page_view_group`；SPA 跳转由 `usePathname` 补发 `page_view`。
- **不用 `useSearchParams`**：避免 Suspense 边界让静态页退化（SEO 硬要求）。
- **ID 格式校验**：GA4 只接受 `G-` 开头 6–15 位（`/^G-[A-Z0-9]{6,15}$/i`），CF token 只接受 32 位 hex，填错不加载、不报错。
- **三个事件桶**：`CONVERSION_EVENTS`（真转化）/ `CLICK_LEVEL_EVENTS`（点击层）/ `UNWIRED_EVENTS`（未接线），三者互斥，由 `scripts/cs04-analytics-regression.ts` 守护。
