# stage1.8 方案设计：`/suppliers` 与 `/industrial-clusters` 渲染改造

> 状态：**方案设计（未改任何代码）**。等确认后进入第二步实施。
> 编写时间：2026-09-29（当前线上版本 `0cdbc9d5`，回滚锚点 `652a050b`）

---

## 1. 现状实测（非推断，全部有取证）

### 1.1 三条动态路由（比你给的多一条）

| 路由 | 为什么动态 | 构树期数据往返 | 线上 TTFB（3 轮） | 响应头 `Cache-Control` |
|---|---|---|---|---|
| `/suppliers` | `page.tsx` 与 `generateMetadata` **都 `await searchParams`** ⇒ Next 强制动态 | **4 次**：`listSupplierDirectory`（内含 `fetchRows` + `resolvePublishedClusterNames`）+ `verifiedAuditSupplierIds` + `getVerificationBadgesForSuppliers` | **3.94s**（首轮 17.55s） | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/industrial-clusters` | 无 searchParams，但文件末尾**显式 `export const dynamic = "force-dynamic"`**（:230） | **2 次**：`listPublishedClusters` + `countSuppliersByClusterSlugs` | **3.19s** | 同上 |
| `/industrial-clusters/[...segments]` | **同样显式 `force-dynamic`**（:384） | 待测（推测 2–3 次） | **2.99 / 3.09 / 3.20s** | 同上 |

> **⚠️ 你给的任务范围只列了两条，但产业带**详情页**（`[...segments]`，8 个已发布产业带 × 9 语）是同一张 `force-dynamic` 声明、同一条 TTFB 曲线。** 若不一并改造，产业带链路的第 3 跳（Cluster Detail）仍是每次请求 SSR。见 §6 决策点 D4。
>
> **⚠️ 你给的 TTFB 基数（967ms）偏乐观**：实测 `/suppliers` 为 2.66–4.23s（首轮冷启 17.55s）。对照组 `/suppliers/guangzhou-sunny-food`（已预渲染）TTFB **1.41s**、响应头 `s-maxage=2249`。

### 1.2 过滤态 `robots` 现状（**当前是正确的**）

| URL | 当前 `<meta name="robots">` |
|---|---|
| `/suppliers` | `index, follow` |
| `/suppliers?country=china` | `noindex, follow` |
| `/suppliers?q=furniture` | `noindex, follow` |
| `/suppliers?country=china&industry=FURNITURE&q=wood` | `noindex, follow` |

实现位置：`app/[locale]/suppliers/page.tsx:33-39` —— `generateMetadata` 读 `searchParams` 后 `isFiltered = Boolean(country \|\| industry \|\| q)`，为真时传 `robots: { index:false, follow:true }`。

**🔴 这条链路是本次改造最大的技术难点**：页面一旦预渲染，`generateMetadata` **拿不到 `searchParams`** ⇒ 上表的 `noindex` 会**全部退回 `index, follow`**。详见 §3。

### 1.3 体积与数据量（用于算内联成本）

| 指标 | 实测值 |
|---|---|
| `/suppliers` HTML 总字节 | **125,094 B** |
| 其中 RSC flight payload（`self.__next_f.push`） | **71,207 B**（16 段） |
| 去掉 `<script>` 后的可见 DOM | **40,882 B** |
| 页面卡片数（`class="card p-5"`） | **13** = 9 张供应商卡 + 4 张 FAQ 卡 |
| `/industrial-clusters` HTML | 69,261 B |

**库内规模（只读查询实测）**：已发布供应商 **9 家**｜国家 **2**｜行业 **6**｜产业带 **8**。

⇒ 单张供应商卡的可见 DOM 约 **1.2 KB**；把 9 家数据作为 props 交给客户端组件，**体积与现状持平**（数据本来就在 flight payload 里）。

### 1.4 三条既有资产（本批要复用，不是发明）

1. **模板就在仓库里**：`app/[locale]/suppliers/[slug]/page.tsx` 已做过同款改造 —— `generateStaticParams()` + `revalidate = 3600`，产出 **81 页静态产物**（9 语 × 9 家）。本批是把同一范式套到目录页。
2. **`[locale]/layout.tsx` 已无动态 API**：`await headers()` 已于 CS-19 摘除（:24-46），`[locale]` 子树已可预渲染（prerender-manifest 319 → 1,597 就是那次的结果）。**目录页是这棵树里仅剩的几处 `force-dynamic` / `searchParams` 之一。**
3. **现有组件可不改**：`components/supplier/VerificationBadge.tsx` 是纯展示组件（`state` + `dict` 入参），目录卡片用到的 `LEVEL_COLOR` / `overallLevel` 都是纯函数 ⇒ 可以整体搬进客户端组件。

### 1.5 两条既有禁令（**这两条直接否决了候选方案 b**）

| 出处 | 原文要点 |
|---|---|
| `app/[locale]/suppliers/[slug]/page.tsx:139` | 「⚠️ 无论选哪条，都**不要**加 Cache Rule 边缘缓存并覆盖 `/suppliers` —— 那会按边缘 TTL 提供过期档案。」 |
| `app/[locale]/industrial-clusters/page.tsx:221-229` | 「🔴 必须是**动态渲染**，不能是 ISR / 预渲染。」实测 ISR 后 CF 按 `s-maxage=3275` 缓存约 55 分钟 ⇒ 「后台已经发布了产业带，前台目录页仍然是空的」，运营无法判断是「没保存」还是「缓存没到期」。 |

> 注意第 2 条的措辞：它否决 ISR 的**理由是「改完即见」**（运营体验），不是性能。这与你的诉求（降 TTFB）**直接冲突**，必须由你拍板取舍。见 §6 决策点 D2。

---

## 2. 候选方案对比

> 先澄清一个容易误判的前提：在当前 `open-next.config.ts`（`incrementalCache: staticAssetsIncrementalCache` + `enableCacheInterception: true`）下，增量缓存的 `set()` / `delete()` 都是 no-op ⇒ **缓存只读，`revalidate` 不生效，内容在构建期冻结**（`[slug]/page.tsx:116-129` 有实测记录）。
> 所以下表的 **a** 与 **d** 在当前部署形态下**实质等价** —— 这不是两个方案，而是同一件事的两种叫法。

| 维度 | **a. 预渲染 + 客户端过滤** | b. CF Cache Rules 边缘缓存 | c. 混合（预渲染全量 + 客户端过滤） | d. 构建期冻结 + 静态导出 |
|---|---|---|---|---|
| **实施复杂度** | 中：新建 1 个客户端组件 + 页面去掉 `searchParams` 依赖 + 处理 `Suspense` 边界 | 低：面板配一条规则 | 中：同 a | 低：同 a（去掉 `revalidate` 声明即可） |
| **SEO 影响** | **正向**：无 JS 也能看到全量 9 家（现状 `force-dynamic` 每次 SSR，抓取预算消耗大）；静态 HTML 含完整 `ItemList` JSON-LD | 中性：HTML 内容不变，仅缓存层变化 | 同 a | 同 a |
| **首屏（ТTFB）** | **降至静态命中**（对照页实测 1.41s，且 `x-opennext-cache: HIT` 不进 Worker；实测预渲染页首字节主要耗在网络） | 首次 MISS 仍 4s，往后命中边缘节点 | 同 a | 同 a |
| **过滤响应速度** | 客户端本地过滤，**< 10ms**（9 条数据内存筛选）；现状是整页往返 4s | 同现状（4s） | 同 a | 同 a |
| **回滚难度** | **易**：`git revert` + 七步重建部署（与 stage1.6/1.7 同路径） | **中**：需在面板撤销规则，且已缓存的边缘副本要等 TTL 自然过期 | 易 | 易 |
| **与现有 `searchParams` 逻辑兼容** | **需改造**：过滤从服务端移到客户端（§3.2 给出具体做法，UI 与 URL 结构零变化） | **完全兼容**：代码不动 | 需改造 | 需改造 |
| **扩到 100 家后** | HTML ≈ **250 KB**（可见 DOM ≈ 150 KB + flight ≈ 90 KB），gzip ≈ 55 KB。仍可用，但**建议 50 家为阈值**（见 §4.1） | 与现状相同（仍 4s），且 100 家后**每次 MISS 都要跑 4 次 Supabase 往返**，CPU 风险随数据量上升 | 同 a | 同 a |
| **既有限制** | 触发 `[slug]:139` 的**禁止事项**（新增边缘缓存） | **直接违反** `[slug]:139` | 同 a | 同 a |

### 结论：候选 b 不是「平行选项」，是**已被否决的选项**

它同时撞上两条既有禁令（`[slug]:139` 与 `industrial-clusters:221`）。如果你的真实诉求只是「降 TTFB」，b 看起来最省事，但它会复活一个已经记录在案的运营事故（改完看不到）。**我不建议把它列为候选**，除非你明确要推翻既有决策。

---

## 3. 推荐方案：a（= d）预渲染 + 客户端过滤

### 3.1 数据流（改造后）

```
构建期（with-proxy preload）
  ├─ listSupplierDirectory()            → 9 家（visitor 档，已按 tier 裁剪）
  ├─ getVerificationBadgesForSuppliers() → badgeMap（服务端唯一权威）
  └─ 服务端为每家算好派生值：
       publicVerificationLevel / hasEvidence / levelLabel / riskLabel / riskColor
                ↓  作为 plain props 传给客户端组件
  ┌─────────────────────────────────────────────────────────┐
  │ 静态 HTML（构建期冻结）                                    │
  │  · 渲染全量 9 张卡（**服务端渲染，无 JS 也完整**）           │
  │  · ItemList JSON-LD = 全量 9 条（结构化数据与页面内容一致）   │
  │  · FAQPage JSON-LD 不变                                   │
  │  · robots: index, follow（目录根）                         │
  └─────────────────────────────────────────────────────────┘
                ↓  客户端水合
  客户端组件读 URL 的 searchParams（country / industry / q）
    → 本地内存过滤 9 条 → 重渲染卡片列表 + 计数标签
    → 过滤态：不改标题 / 不改 canonical / 不写 noindex（见 §3.2）
```

**关键设计**：过滤**不在服务端发生**，所以静态 HTML 永远是「全量视图」。这带来两个好处：
1. 无 JS / 爬虫看到的是完整目录（SEO 更优，且与 JSON-LD 自洽）；
2. 不产生任何按需渲染路径，Worker CPU 恒定为零（静态资源不进 Worker）。

### 3.2 🔴 过滤态 `noindex` 的落地（核心难点，三选一）

静态化后 `generateMetadata` 读不到 `searchParams`，现有 `isFiltered → noindex` 机制**失效**。可选路径：

| 方案 | 机制 | 可行性 | CPU 成本 | 需要你操作 |
|---|---|---|---|---|
| **(i) middleware 注入 `X-Robots-Tag`** | `middleware.ts` 里对 `pathname === "/suppliers" && url.search` 的请求返回 `NextResponse.next()` 并设 `X-Robots-Tag: noindex, follow` | **待实测**。已读构建产物确认 `middlewareHandler` **先于** Next server 执行（缓存拦截在 `handler.mjs` 内部）；但 `enableCacheInterception` 命中静态资源时**是否仍经过 middleware**，读码不足以下结论，**必须部署后实测** | 极低 | 无 |
| **(ii) CF Response Header Transform Rule** | CF 控制台按 `http.request.uri.query` 匹配加 `X-Robots-Tag: noindex, follow` | **确定可行**（CF 免费版可用） | 零（边缘层） | **需你在面板配置** |
| **(iii) 仅依赖 robots.txt + canonical** | 不做额外动作 | 可行但**不精确** | 零 | 无 |

**为什么 (iii) 的实际风险比想象小**：线上 `robots.txt` 的 26 组 UA 中，**13 组（12 命名 + `*`）都是 `Disallow: /*?` + 仅 `Allow: /suppliers?q=`** ⇒ `?country=` / `?industry=` 在 robots 层就已被阻断，**真正的例外只有 `?q=`**。且静态页的 `canonical` 恒自指 `/suppliers`（不带 query）⇒ 即使 `?q=furniture` 被抓，也会被 canonical 收敛。

**推荐组合：(i) 为主 + (ii) 为兜底**。理由是 (i) 在代码内、可回归、无需你操作；但**必须实测**确认 middleware 在缓存命中路径上仍执行。若实测发现 middleware 被跳过，则退到 (ii)（我给你精确的匹配表达式，你在面板填）。

> ⚠️ **一个必须澄清的边界**：客户端 JS 注入 `<meta name="robots">` **无效**（爬虫读初始 HTML，不执行 JS），所以不能靠客户端组件解决这个问题。它只能靠响应头（middleware / CF 边缘）。

### 3.3 实施要点（第二步要做的事，现在不动）

**`app/[locale]/suppliers/page.tsx`**
1. 删掉 `searchParams` 入参与 `await searchParams`（两处：`generateMetadata` 与默认导出）⇒ 页面转为可预渲染；
2. 加 `export const revalidate = 3600` + 注释说明「当前部署形态下等价于构建期冻结」（照抄 `[slug]` 的注释范式，避免后人误以为每小时自更新）；
3. `generateMetadata` 去掉 `isFiltered` 分支，恒输出目录根的 `index, follow`；
4. 保持 `page.tsx` 仍是 RSC：服务端算好 `items`（含派生值）与 `dict` 片段，交给客户端组件；
5. **UI、URL 结构、文案、JSON-LD、转化埋点（`ANALYTICS_EVENTS.*`）逐字不变**；
6. 新增 `components/supplier/DirectoryGrid.tsx`（客户端组件）：
   - `"use client"`，用 `useSearchParams()` 读过滤条件（**须包 `<Suspense>`**，否则 Next 15 在静态渲染时会报错）；
   - 本地 `useMemo` 过滤（与现有 `matchQ` 逻辑逐字一致：公司名 / 产品 / 城市，不区分大小写）；
   - 渲染卡片网格 + `countLabel`；筛选 chip 仍是 `<Link>`（**不改成按钮** —— 保持「可抓取的链接」这一既有设计意图，见 `page.tsx:73` 注释）。

**`app/[locale]/industrial-clusters/page.tsx`**
1. 删除 `export const dynamic = "force-dynamic"`（:230），改 `export const revalidate = 3600`；
2. 该页**无 `searchParams`** ⇒ 改造量比 `/suppliers` 小得多：只需删掉那行声明 + 加 `generateStaticParams`（复用 `[locale]/layout.tsx` 的 locale 段即可，无需额外参数）；
3. **必须同时更新 :221-230 的注释** —— 那段注释现在会变成「与实际代码相反」，属于最高危的过时注释（后人照着它理解会得出错误结论）。

**`app/[locale]/industrial-clusters/[...segments]/page.tsx`**（若 D4 确认纳入）
- 同款处理；但需先确认它的 `generateStaticParams` 是否已存在（8 个产业带 × 9 语 = 72 页）。

**`middleware.ts`**（若 D3 选 (i)）
- 增加对 `/suppliers` 带 query 请求的 `X-Robots-Tag` 注入；
- **不得改动 locale 重写逻辑**（既有行为）。

---

## 4. 关键决策点（逐条回应你的三个问题 + 我新增的两个）

### 4.1 决策点 D1：全量内联 vs 客户端按需 fetch

**推荐：全量内联，阈值 50 家。**

| 家数 | 可见 DOM（估） | HTML 总字节（估） | gzip（估） | 结论 |
|---|---|---|---|---|
| 9（现状） | 41 KB | **125 KB** | ≈ 28 KB | 与现状持平 |
| 50 | ≈ 90 KB | ≈ 180 KB | ≈ 40 KB | **可接受** |
| 100 | ≈ 150 KB | ≈ 250 KB | ≈ 55 KB | 仍可用，但首屏解析成本开始可见 |

**为什么不按需 fetch**：客户端 fetch 会引入新的运行时数据源，破坏「构建期冻结」的一致性（同一页有两个数据来源、两个时间点的风险），且需重建权限裁剪逻辑（`redactSupplier` 目前在服务端保证付费内容不泄漏 —— 客户端 fetch 等于把裁剪点搬到前端，这是**权限边界后退**，不可接受）。**内联的另一个必要理由**：文件名数据已在 `flight payload` 中，内联不增加体积，而 fetch 会新增一轮往返。

**阈值机制（建议写进代码注释 + 回归断言）**：当已发布供应商 **> 50 家**时，二选一并重新评估：
- 保留内联 + 加客户端分页 / 虚拟滚动（DOM 成本线性，但只在视口内渲染）；
- 或退回「服务端渲染 + 边缘缓存」并重新评估 §1.5 的禁令。

> `page.tsx:92-93` 已有一条前瞻注释：「⚠️ 已发布供应商超过 ~60 家后，需要以**新的 Change Set** 引入分页 / Load More / 结果排序；本轮明确不做分页。」本方案的 50 家阈值与之呼应，**不冲突**（它针对「渲染全部卡片」，我针对「内联体积」）。

### 4.2 决策点 D2：过滤态是客户端还是服务端

**推荐：客户端本地过滤。**

| | 客户端（推荐） | 服务端（现状） |
|---|---|---|
| 过滤延迟 | **< 10 ms**（9 条内存筛选） | **≈ 4 s**（整页往返） |
| Worker CPU | **零**（静态资源不进 Worker） | 每次请求 4 次 Supabase 往返 |
| 100 家时 | 仍 < 20 ms | 4 次往返不变，但 payload 变大 |
| 代价 | 首次过滤需等 JS 水合（约 100–200 ms，且列表卡在首屏已由 SSR 渲染） | 无 |

### 4.3 决策点 D3：过滤态的独立 SEO 价值是否保留

**现状**：过滤态 `noindex, follow`（**不参与索引**），`canonical` 恒自指 `/suppliers`。**推荐：保持现状语义 —— 过滤态继续不索引**，但实现手段从「服务端 `generateMetadata`」改为「响应头」（§3.2）。

**一个需要你知情的取舍**：静态化后，`?q=furniture` 这类 URL 的 HTML 内容会变成「全量列表 + 客户端过滤」，即与 `/suppliers` 高度重复。`robots.txt` 对 `?q=` 是 **`Allow`**（这是既有决策，为让搜索入口页可抓取）。所以：
- 若选 (i)/(ii) 加 `X-Robots-Tag: noindex` ⇒ 语义与现状一致，无副作用；
- 若选 (iii) 不加 ⇒ 依赖 canonical 收敛，**可接受但不精确**。

### 4.4 🆕 决策点 D4：`/industrial-clusters/[...segments]` 是否一并改造

**建议：一并纳入本批。** 理由：同一张 `force-dynamic` 声明、同一条 3.0s TTFB 曲线、且**它没有 `searchParams`**（改造量最小、风险最低）。若拆到下一批，产业带链路的第 3 跳仍是动态渲染，「链路已静态化」的说法不成立。

### 4.5 🆕 决策点 D5：`/industrial-clusters` 是否接受「改完即见」失效

这是**业务流程变化，不是技术取舍**。转静态后，后台发布产业带 **必须重新构建部署** 才能生效（`/industrial-clusters:221` 记录的运营事故正是此事）。

**减损事实**：这个流程**已经存在** —— `/suppliers/[slug]` 与 `/suppliers` 上的供应商数据都已是构建期冻结（「发布供应商 = 重新 build/deploy」是你 2026-09-20 拍板写进发布流程的）。所以本批是**把产业带对齐到已有流程**，而非引入新规则。

---

## 5. 风险与缓解

| # | 风险 | 缓解 |
|---|---|---|
| R1 | **过滤态 `noindex` 静默失效**（最危险：不报错、只影响 SEO） | ① 部署后**必测** 4 个 URL 的 `X-Robots-Tag` / robots meta（§3.2）；② 把断言写进验收脚本；③ 若 middleware 不生效，退到 CF Transform Rule |
| R2 | **构建期静默回落静态数据**（stage1.6/1.7 两次踩到） | 沿用既有闸门：构建后必数 `/suppliers/*.html` = **81**（9 语 × 9 家）；`fetch failed` 计数必须为 0；**显式 `FAB2B_PROXY=http://127.0.0.1:7897`**（环境变量 `HTTPS_PROXY=…:5701` 会劫持 preload） |
| R3 | `useSearchParams()` 未包 `<Suspense>` ⇒ 构建报错 | 实施时确认 Suspense 边界；构建 ① 步即为闸门 |
| R4 | 静态化后 `ItemList.numberOfItems` 与实际 DOM 卡片数不再随过滤变化 | **这是预期行为**（结构化数据描述页面内容 = 全量）。**不得**让客户端改 JSON-LD |
| R5 | 「扩到 100 家」时 HTML 膨胀 | 50 家阈值写进注释 + 回归断言（§4.1） |
| R6 | 折叠注释与实际代码相反（`industrial-clusters:221` 那段） | 必须同步改写，否则成为误导后人的高危注释 |
| R7 | 过滤态 UX 从「整页刷新」变「原地过滤」，可能影响埋点 | `ANALYTICS_EVENTS.directoryFilter` / `directorySearch` 的 `data-track` 属性**逐个保留**；脚本侧确认事件语义是否依赖整页加载 |
| R8 | 首次过滤时若 JS 未就绪，用户看到全量列表 | 可接受（这是 SSR 全量渲染的固有特性）；`<Link>` 导航保留，无 JS 时退化为整页加载（**功能不缺失**） |

---

## 6. 不在本批范围

1. **不加 CF Cache Rule 覆盖 `/suppliers`**（违反 `[slug]:139`）。
2. **不做分页 / 排序**（`page.tsx:92` 明确「本轮不做」）。
3. **不改 URL 结构、视觉、品牌、字典文案**（你的约束 4）。
4. **不动 `/suppliers/[slug]`**（已静态化，无需改）。
5. **不引入 R2 增量缓存**（`[slug]:134-137` 记录：当前收益不抵风险）。

---

## 7. 第二步实施后的验收计划（先说清口径）

| # | 验收项 | 方法 | 阈值 |
|---|---|---|---|
| 1 | 本地构建产物 HTML 含供应商列表 | 读 `.next/server/app/*/suppliers.html` | 9 张卡 × 9 语，legalName 全部命中 |
| 2 | 线上 TTFB | 经代理 curl 多轮采样 | `/suppliers` < **500 ms**（对照：`/suppliers/<slug>` 实测 1.41s，若静态 HIT 但网络 RTT 主导，需按实测调整口径） |
| 3 | 多 `searchParams` 组合返回 200 | 5 组组合 × 2 语 | 全部 200，无 5xx |
| 4 | 无 5xx | 同上 + 部署后抽样 30 min | 0 |
| 5 | 搜索 / 过滤功能正常 | Playwright 真交互（输入 `furniture` → 卡片数变化 → 清空复原） | 计数标签 = 卡片数 |
| 6 | 过滤态 robots 正确 | 4 个 URL 逐条断言 | 与 §1.2 表格**逐字一致** |
| 7 | `/suppliers/*.html` = 81 | `ls .next/server/app/*/suppliers/*.html \| wc -l` | 81 |

---

## 8. 我需要的确认（5 条）

| # | 问题 | 我的建议 |
|---|---|---|
| **D1** | 全量内联，阈值 50 家？ | 是 |
| **D2** | 接受 `/industrial-clusters`「改完即见」失效（改为重新构建部署）？ | 是（与既有供应商发布流程一致） |
| **D3** | 过滤态 `noindex` 落地方式：(i) middleware 待实测 / (ii) CF Transform Rule 你来配 / (iii) 仅靠 robots.txt + canonical？ | **(i) 为主 + (ii) 兜底** |
| **D4** | `/industrial-clusters/[...segments]`（产业带详情页）是否一并纳入本批？ | 建议一并 |
| **D5** | 阈值 50 家与「>60 家做分页」两条既有注释如何对齐？ | 两者不冲突：50 家管「内联体积」，60 家管「卡片渲染量」，可共存 |
