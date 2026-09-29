# stage1.8 验收报告 —— /suppliers 与 /industrial-clusters 改预渲染 + 客户端过滤

执行时间：2026-09-29 · 提交 `3c999d8` · CF 版本 `252a78c2-8a19-43f8-adac-5f9fda430704`

---

## 1. 每项改动的前后对比

| # | 文件 | 改前 | 改后 |
|---|---|---|---|
| ① | `app/[locale]/suppliers/page.tsx` | `await searchParams`（`page` 与 `generateMetadata` **两处**）⇒ 强制动态渲染；`generateMetadata` 有 `isFiltered` 分支输出 `robots: {index:false}`；`badgeMap` 只查 filtered；JSON-LD 绑 `filtered` | 删两处 `searchParams`；`export const revalidate = 3600`（:50）；`robots: {index:true, follow:true}` 恒输出（:66）；派生值服务端算好为 `DirectoryItem[]`；`badgeMap` 查**全量**；JSON-LD 绑**全量** `all`（`numberOfItems: all.length`，:204）；三区 → `<Suspense fallback={<DirectoryView .../>}><DirectoryGrid .../></Suspense>`（:273-298） |
| ② | `components/supplier/DirectoryGrid.tsx`（新） | 不存在 | `"use client"`；`useSearchParams()` + `mounted` 闸门（首帧不过滤，避免 hydration mismatch）+ `useMemo` 本地过滤（country/industry 精确相等，q 匹配 legalName/mainProducts/city）；chip 仍是 `<Link>`（URL 可分享、可被 noindex 规则命中） |
| ③ | `components/supplier/DirectoryView.tsx`（新） | 不存在 | 纯展示层，**无 state / 无 hooks / 不取数**；服务端预渲染与客户端过滤共用同一份标记 ⇒ 两处逐字一致 |
| ④ | `app/[locale]/industrial-clusters/page.tsx` | `force-dynamic`（:230）+ 上方注释「🔴 必须是动态渲染」 | `export const revalidate = 3600`（:246）+ **:221-230 注释整段倒转**（承认推翻旧结论、列出新事实、仍禁 Cache Rule） |
| ⑤ | `app/[locale]/industrial-clusters/[...segments]/page.tsx` | `force-dynamic`；无 `generateStaticParams` | 新增 `generateStaticParams()`（:69，详情 slug + 国家段 + 国家/省·市段，去重；`CN→province`、`VN/ID→city`、`TH→null`）；`revalidate = 3600`（:429）+ `dynamicParams = true`（:430，新产业带运行时可渲染） |
| ⑥ | `middleware.ts` | 仅 locale 重写/301/matcher | 新增 `stripLocalePrefix()` + `isFilteredDirectory`；**两条返回分支各注入一次** `X-Robots-Tag: noindex, follow`。locale 重写/301/matcher **一字未动**（cs06a B 段守着） |

UI / URL / 文案 / JSON-LD / 埋点**逐字未变**（三条 route 从 `ƒ (Dynamic)` 变 `● (SSG)`）。

---

## 2. 构建链路 ①-⑦ 结果

| 步 | 命令 | 结果 |
|---|---|---|
| ① | `next build` | **EXIT=0**；`fetch failed` = **0**；`/suppliers/*.html` = **81**；日志首行 banner 显示已忽略被劫持的 `:5701`、走 **7897** ✓ |
| ② | `opennext build` | **EXIT=0**（4021 文件） |
| ③ | 循环 `populate-static-assets-cache.cjs --worker --batch 250` | **9 批全 DONE**（2161 项） |
| ④ | `populate-static-assets-cache.cjs --check` | buildId `oUEKcL3k0WkbB9eHatSBQ`；页面缓存 **2057** / fetch 104 / 非预期 **0** / 非 `.cache` **0** / 源-目标 **2161 = 2161** |
| ⑤ | `scrub-next-env.mjs` | 清空 **21** 处密钥 |
| ⑥ | `verify-opennext-bundle.mjs` | **ALL PASS**（叶子 3126 / 缓存 2057→2057 / assets 2347 / 单文件 2.35 MiB） |
| ⑦ | `wrangler deploy`（`OPEN_NEXT_DEPLOY=true`） | **EXIT=0**，上传 2172 文件（gzip 3481 KiB） |

---

## 3. 部署版本 ID + 回滚锚点

- **本次部署：`252a78c2-8a19-43f8-adac-5f9fda430704`（版本 #143，2026-09-29T10:10:40Z）**
- 回滚锚点（`wrangler versions list` 实测）：
  - `0cdbc9d5-69ae-42de-979c-10012e72fd30`（#142，**stage1.7**）← 首选
  - `652a050b-cfa7-49cf-a238-56edf51f11e4`（#141，stage1.6）
  - `72ef374c-e83d-4d8c-aff7-8d9c1120f83d`（#140，stage1.5）
- 代码回滚锚点：`f0fd546`（stage1.7）；本次提交 `3c999d8`（20 files changed, +2239/−313）

---

## 4. 验收逐条结果（任务清单共 9 项；汇报格式里写 7 项，此处按 9 项全列）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 构建产物 HTML 含 9 张卡 × 9 语（legalName 全命中） | **PASS** | 9 语 × 9 家详情链接全命中；反向用详情页 `<h1>` 校验 en 目录页 legalName **9/9**（含中文名 `南京麦克森OE科技有限公司`） |
| 2 | 线上 TTFB（主口径 `x-opennext-cache: HIT`） | **PASS** | `/suppliers` 333/305/293ms、`/industrial-clusters` 280/310/304ms，均 `HIT` + `s-maxage=33xx`（辅口径降幅远超 70%） |
| 3 | 5 组 searchParams 返回 200 无 5xx | **PASS** | 含全不匹配组合 `?country=nope&industry=NOPE&q=zzz` 亦 200 |
| 4 | 搜索/过滤正常（Playwright 真交互） | **PASS** | `s18-interaction-test.mjs` **17/0**：9 张 → chip china 8 张 → All 恢复 9 张 → 搜索「Guangzhou」2 张 → 无命中 0 张且网格不渲染、目录区仍有 413 字文案；`计数标签 == 卡片数` 恒成立；零 JS 错误 |
| 5 | 过滤态 robots 正确（逐条断言） | **PASS** | `s18-live-verify.mjs` **19/0**，见第 5 节；另阴性对照 **8/0** |
| 6 | `/suppliers/*.html` = 81 | **PASS** | 构建日志实测 81 |
| 7 | 产业带详情页 72 页静态化 | **PASS** | `B5 产业带详情页静态化 72/72`（8 产业带 × 9 语） |
| 8 | 构建链路 ①-⑦ 全绿 | **PASS** | 见第 2 节 |
| 9 | 回归无新增失败 | **PASS** | `s18-directory-static-regression` 30/0、`cs06a` 55/0、`cs01-seo-foundation` 46/0、`cs22a` 77/0、`cs04` 39/0、`cs05` 67/0、`cs16` 62/0、`cs17` 66/0、`cs20` 125/0、`cs22c` 62/0、`cs02a` 50/0、`cs02b` 65/0、`cs05c` 86/0、`cs08` 71/0、`cs12` 34/0；既有失败 8 条已逐一前后对照取证（见第 6 节） |

---

## 5. D3 的 4 个 URL 响应头实测结果

**终态（`s18-live-verify.mjs` 复测 19 PASS / 0 FAIL）**

| URL | 期望 | 实测 `X-Robots-Tag` | 结果 |
|---|---|---|---|
| `/suppliers` | 无（或 `index, follow`） | *(无该头)* | **PASS** |
| `/suppliers?country=china` | `noindex, follow` | `noindex, follow` | **PASS** |
| `/suppliers?q=furniture` | `noindex, follow` | `noindex, follow` | **PASS** |
| `/suppliers?country=china&industry=FURNITURE&q=wood` | `noindex, follow` | `noindex, follow` | **PASS** |
| `/es/suppliers?country=china`（追加） | `noindex, follow` | `noindex, follow` | **PASS** |

**首轮曾出现 2 例 FAIL，诊断结论：部署传播窗口的一次性瞬态，非逻辑缺陷。**

- 三轮取样（`_s18_probe_robots.mjs`）：5 用例 × 3 轮**全部稳定 PASS**；
- 加随机 cache-buster 与请求头 `Cache-Control: no-cache`：仍全 PASS ⇒ 排除边缘缓存固化；
- 响应头快照对照：FAIL/PASS 样本**同构**（`age`/`cf-cache-status` 均 `null`、`s-maxage=33xx`、`x-opennext-cache: HIT`、`x-nextjs-prerender: 1`）⇒ 同一分支同一路径；
- 时间线吻合：脚本在 `wrangler deploy` 返回后**立即**按 1→5 顺序探测 ⇒ 用例 **2、3** 落在新版尚未全球生效的窗口内、命中上一版（middleware 尚无该注入）；用例 **4、5** 已传播完成；用例 1 属「期望无头」，两版都通过，因此掩盖了现象。

**⇒ D3 采用方案 (i) middleware 生效，无需启用 (ii) CF Response Header Transform Rule。**
阴性对照 `_s18_probe_negative.mjs` **8 PASS / 0 FAIL**：`?utm_source=`、`?page=2`、`?q=`（空值）、`?country=`（空值）、`/suppliers/<slug>?country=`、`/industrial-clusters?country=` 均**不触发**；`?industry=FURNITURE`、`/zh/suppliers?q=wood` 正确触发 —— 判定边界与旧服务端口径一致。

证据文件：`outputs/stage1.8-d3-robots-evidence.txt`

---

## 6. 风险与未解决问题

### 6.1 已知代价（决策 D1/D2 已确认接受）
1. **改完即见失效**：`revalidate=3600` 在 `staticAssetsIncrementalCache` + `enableCacheInterception` 下 `set()/delete()` 均为 no-op ⇒ **等价构建期冻结**。改库内容/元数据后必须重建 + 重部署，否则 SSG 固化旧值且**零报错**。产业带新增/下架已按此对齐到供应商发布流程。
2. **D1 闸门**：目录页全量内联，> 50 家即须改分页或回退动态渲染。已写入源码注释并由回归 `B3` 守卫（当前 9 家，余量充足）。
3. **双阈值并存**：内联 50 家（体积）/ 卡片渲染 60 家（性能），含义不同、互不冲突（D5）。

### 6.2 既有失败（**非本轮引入**，已逐一前后对照取证）
| 断言 | 实测 | 取证方式 |
|---|---|---|
| cs13 `F2d` | migrations 13 ≠ 10 | `git status` 显示本轮未触碰 `supabase/`（零 DDL） |
| cs13b `A5` | `RELEASE-RULES.md` 缺 `**3126**` | `git log -S"**3126**" -- RELEASE-RULES.md` 证明该模式**从未**出现；该文件本轮未修改 |
| cs05b ×2 | `searchLines.length` 2≠3/6；首个 redirect 块取到 `308` 分支 | 用 cs05b **自身表达式**（含 `stripComments`）对 HEAD 与工作树做前后对照：**两版都 FAIL**。我新增的 3 行是 `searchParams.get` **读取**（非 URL 重建）；`mw.match(/NextResponse\.redirect\([\s\S]*?\);/)[0]` 在 HEAD 上同样取到 https 分支的 `NextResponse.redirect(u, 308)` |
| cs02d `G2`/`H`、cs11 `C8`、cs14 `A1`（库 21≠10） | 见断言行 | 断言读取的文件均**不在**本轮改动集内 |

### 6.3 建议的后续动作（等文哥决定，未自行扩面）
1. `cs05b` 两条断言已过时：② 应改为定位 `/en/*` 专属 301 块（现取到 https 分支）；① 数字应为 3 且排除 `.searchParams` 读取。
2. `RELEASE-RULES.md` 补一行声明单一事实源叶子数 `**3126**`，可让 cs13b `A5` 转绿（纯文档、零风险）。
3. 进入 **stage1.7.1**（供应商页 desc 质量修复：`nanjing-mxcomm` 5 个拉丁语种页因差 1 字符丢掉免责声明句）。

### 6.4 未触碰（按约束）
RFQ / Clusters 内容 / i18n 字典 / SEO 元数据 / sitemap 均零改动；本轮**未**清理 `_prune_*`；`middleware.ts` 的 locale 重写、301、matcher 原样。
