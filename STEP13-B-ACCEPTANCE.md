# INDUSTRIAL CLUSTERS UI ACCEPTANCE — STEP 13-B

> 项目：FactoryAuditB2B（`F:\AI-验厂SEO网站` — 唯一源码/部署源）
> 任务：`/industrial-clusters` 的信息架构从「国家筛选器 + 一大堆卡片」改成真正的
> **Country → Region → Industry(标签) → Cluster → Suppliers**。
> 范围：只改渲染 / 分组 / 排序。**不动数据、不动 URL、不动 SEO、不新增索引页。**

## 0. 状态（先读这一段）

```text
UI / IA 改造：完成并已提交（baefc17）
测试：       tsc 0 + cs13b 回归 38 PASS / 0 FAIL + cs06a 55 PASS / 0 FAIL + cs16 62 PASS / 0 FAIL
部署：       ✅ 已完成（2026-09-21 上午续做）
             next build 451s → opennext build 609s → cf-release 164s（五步门禁 ALL PASS）
线上版本：   Version 2a144963-1877-42f9-bfe5-55430fd9a662 / buildId uFm7-nFDbFT3dEzntoTT8
线上验收：   ✅ 24 PASS / 0 FAIL（与部署前基线逐项对比，Before/After 已闭环）
线上现状：   Country(H2) → Region(H3) → 2 列卡片，国家 tab 带计数
```

续做用的是同一条命令：`node scripts/step13-build.mjs`（rename → next build → opennext build → cf-release），
随后 `node scripts/step13b-live-verify.mjs` 自动读取磁盘上的 Before 基线做对比。

> 🔧 部署后首次跑验收时报了 2 个 FAIL，**是断言缺陷不是页面缺陷**（把 Next.js 的 RSC flight payload
> 也算进了 DOM 文本计数）。取证与修法见 §10.1。修后 24 PASS / 0 FAIL。

---

## 1. Before / After（IA 层级）

| 维度 | Before（线上实测 HTML） | After（代码 + 纯函数回归实测） |
| --- | --- | --- |
| 页面结构 | 8 张卡片平铺，`md:grid-cols-3` | Country(H2) → Region(H3) → 2 列卡片 |
| **H2 数量/语义** | **8 个，全是产业带名** | **4 个，= 国家**（China/Thailand/Vietnam/Indonesia） |
| **H3 数量/语义** | **0 个** | **5 个，= 地区**（South China / Eastern Thailand / Northern Vietnam / Riau Islands / Central Java） |
| 每张卡顶部 | 重复 `China · South China` | 不再重复（已成为页面层级） |
| 卡片信息顺序 | Country·Region → 名称 → 行业 → 简介 → 计数 → CTA | **行业徽章 → 名称 → City·Province·Country → 简介 → 计数 → CTA** |
| 顶部导航 | 无 | 国家 tab + 计数（**纯同页锚点**，无客户端 JS、无新 URL） |
| 排序依据 | `sort_order → name`（一维） | **Country(组内最小 sort_order) → Region(同上) → Cluster(sort_order → name)** |

**Before 的硬证据**（部署前抓取的线上 HTML，存 `s13b-before.html` + `s13b-baseline.json`）：

```text
status=200  clusters=8  h2=8  h3=0  md:grid-cols-3=true  md:grid-cols-2=false  sitemap=1323
h2=[江门家居厨房用品产业带, 中山照明产业带, 佛山家具产业带, 东莞电子制造产业带,
    泰国罗勇汽车制造产业带, 越南北宁电子制造产业带, 印尼巴淡电子制造产业带, 印尼茉莉芬家具产业带]
```

即：**产业带与国家处在同一个标题层级，国家/地区从未成为视觉层级** —— 这正是要修的问题。

---

## 2. Country groups

| Country | Clusters | 来源 |
| --- | ---: | --- |
| China | 4 | `country='China'`, `country_code='CN'` |
| Thailand | 1 | `country='Thailand'` |
| Vietnam | 1 | `country='Vietnam'` |
| Indonesia | 2 | `country='Indonesia'` |

- 国家 tab **由真实数据生成**（`buildClusterDirectory` 遍历数据，不硬编码国家列表）；
  没有产业带的国家根本不会出现。
- 国家顺序 = 组内最小 `sort_order` ⇒ China(10) → Thailand(50) → Vietnam(60) → Indonesia(70)。
  **不写死国家顺序**，也不加 `country_order` 字段（不为此改 schema）。
- ⚠️ 与你的示意图有一处**刻意不同**：你的 tab 示例写的是 `China / Vietnam / Thailand / Indonesia`，
  而 section 示例写的是 `China / Thailand / Vietnam / Indonesia`。同一页面两处不一致时，
  我按「tab 与 section 必须同序」实现（否则点 tab 跳到的位置与 tab 顺序不符），
  顺序由 `sort_order` 决定。若你要 tab 用别的顺序，改 `sort_order` 即可，不用改代码。

## 3. Region groups

| Country | Region | Clusters |
| --- | --- | ---: |
| China | South China | 4 |
| Thailand | Eastern Thailand | 1 |
| Vietnam | Northern Vietnam | 1 |
| Indonesia | Riau Islands | 1 |
| Indonesia | Central Java | 1 |

- Region 组顺序同样由组内最小 `sort_order` 决定 ⇒ Indonesia 下 Riau Islands(70) 在 Central Java(80) 之前。
- **缺 region 时不渲染 H3**，也不臆造「其他地区」（回归 D2/D3 覆盖）。

## 4. Cluster count / URL count

| 指标 | Before | After | 判定 |
| --- | ---: | ---: | --- |
| 页面上产业带数量 | 8 | 8 | 一条不少、一条不多 |
| 卡片链接（站内相对 href） | 8 | 8 | 集合完全一致 |
| canonical URL | 8 条 | 8 条（**逐条相同**） | 无 URL 变更 |
| sitemap 总条目 | 1323 | 待线上复核 | 无新增索引页 |
| 新增 indexable 页面 | — | **0** | 国家 tab 是同页 `#anchor`，不进 sitemap |

URL 逐条基准（与 `lib/clusterRoutes.ts` 的 P0 事实同源，已写进验收脚本当 oracle）：

```text
/industrial-clusters/china/guangdong/jiangmen-home-kitchen
/industrial-clusters/china/guangdong/zhongshan-lighting
/industrial-clusters/china/guangdong/foshan-furniture
/industrial-clusters/china/guangdong/dongguan-electronics
/industrial-clusters/thailand/rayong-automotive
/industrial-clusters/vietnam/bac-ninh/bac-ninh-electronics
/industrial-clusters/indonesia/batam/batam-electronics
/industrial-clusters/indonesia/jepara/jepara-furniture
```

## 5. 排序规则（确定性，非 created_at）

```text
Country 组顺序 = 组内最小 sort_order，再按国家名
Region  组顺序 = 组内最小 sort_order，再按地区名
Cluster 顺序  = sort_order，再按名称（纯码点比较，不依赖 ICU/locale）
```

实现取巧但严谨：先按 `(sort_order, name)` 全局排序一次，再按插入序分组 ——
每个分组的第一个成员天然就是该组最小 `sort_order` 的成员，因此「组顺序」自动正确，
不需要额外 min() 计算，也不会出现两种口径分叉。

`sort_order` 是后台 Admin 可编辑字段（DB column default 100）——它是运营的排序旋钮，缺值退化为 100。
**实现里完全没有出现 `created_at`。**

⚠️ 与 spec §6 的一处**刻意偏差**：spec 把排序写成 `Country → Region → **Industry** → Cluster Name`。
我没有把 industry 放进排序键，理由：(a) 同一节 spec 明确要求「行业不要单独成为第二层，只做标签」；
(b) 你的最终 UI 示意图里 China 的卡片顺序是 Home & Kitchen → Lighting → Furniture → Electronics，
那正是 `sort_order` 的顺序，而按 industry 字母序会变成 Electronics → Furniture → Home & Kitchen → Lighting，
与你的示意图相反；(c) 若按 industry 排，后台的 `sort_order` 字段就失去了意义。
如果你要 industry 参与排序，改 `lib/clusterDirectory.ts` 一行即可。

## 6. 布局与内容

| 验收项 | 结果 |
| --- | --- |
| Desktop 2 列 | `grid grid-cols-1 gap-5 md:grid-cols-2`（原为 `md:grid-cols-3`） |
| Mobile 1 列 | 默认 `grid-cols-1`，且**已移除** `md:grid-cols-3` |
| Country 之间留白 | section 间 `mt-16` |
| Region 标题层级 | H3，比 Country(H2) 小一级，带下边框分隔 |
| 行业徽章 | 取 `industry` 字段（真实值，如 `Home & Kitchen`），空则不渲染 |
| 卡片定位行 | `City · Province · Country`（只拼真实字段；Rayong 无 province ⇒ `Rayong · Thailand`） |
| 供应商计数 | `0 suppliers` × 8 —— 库内 `suppliers.cluster_slug` 命中数为 0（审计实测 `supplierLinks=[]`），**如实显示 0，不虚构** |
| CTA | `View Suppliers →` × 8，指向各自 canonical URL |
| 视觉风格 | 沿用既有站点风格（`card` / `btn btn-outline` / 既有配色），未重做整站 |

## 7. SEO regression

| 项 | 结论 |
| --- | --- |
| `generateMetadata` | **完全未改**（title/description 仍来自 `dict.clusters.metaTitle/metaDesc`） |
| canonical / hreflang / sitemap | 逻辑未改；部署后由验收脚本与 Before 基线逐字对比 |
| JSON-LD | 保留 `ItemList`，8 条、URL 与页面顺序一致（顺序变化，集合与 URL 不变） |
| 新增索引页 | 0（国家 tab 为同页锚点） |
| `dynamic = "force-dynamic"` | **保留**（否则后台改完产业带前台要等 ~55 分钟缓存） |

## 8. i18n / 冻结常量

- 新增字典键 `clusters.allCountries` × 9 语（en/zh/zh-TW/es/de/fr/pt/ja/ar）。
  没有硬编码任何界面文案。
- **en 叶子数冻结常量 2939 → 2940**（2935 字符串 → 2936 字符串），
  已同步 8 处同源 + `verify-opennext-bundle.mjs` + `RELEASE-RULES.md`。
- 门禁自证：`cs06a` C8 = 2940 ✓、九语键集合一致 ✓；`cs16` 冻结层 6 项全绿 ✓。

## 9. 数据

产业带数据**全部来自现有数据库**（`listPublishedClusters()`，页面固定 2 次 DB 往返，无 N+1）。
**本轮零 DML**：没有新增/删除/修改任何产业带行，没有改 `slug`、`cluster_slug`、industry taxonomy。

## 10. Regression

```text
TypeScript:                    EXIT 0（两轮 + 续做一轮 33s）
cs13b-cluster-directory:       38 PASS / 0 FAIL   （分组/排序/边界/结构 + i18n 冻结层）
cs06a-directory (主门禁):      55 PASS / 0 FAIL
cs16-supplier-mgmt (冻结层):   62 PASS / 0 FAIL
next build:                    EXIT 0（451s / 7m31s）
opennext build:                EXIT 0（609s / 10m09s）
cf-release:                    EXIT 0（164s）—— 五步门禁 ALL PASS
                               其中「产物内 en 字典叶子数 = 2940 (期望 2940)」✓
live verify:                   24 PASS / 0 FAIL（22 项原断言 + 2 项新增哨兵，含 Before/After 基线对比）
```

### 10.1 部署后首跑暴露的断言缺陷（已修 —— 断言问题，不是页面缺陷）

```text
FAIL  13 供应商计数 = 8 处 0 suppliers   [16]
FAIL  14 CTA View Suppliers → 出现 8 次  [16]
```

抓真实线上 HTML 分层取证：

```text
"0 suppliers"       总计 16 次 → DOM 渲染 8 次 + RSC flight payload 8 次
"View Suppliers →"  总计 16 次 → DOM 渲染 8 次 + RSC flight payload 8 次
剥离 <script> 后：0 suppliers = 8、View Suppliers → = 8、<h2> = 4、卡片容器 = 8   ← 全部正确
```

Next.js App Router 把同一段文案输出**两份**（可见 DOM + `self.__next_f.push` flight payload），
对全量 HTML 计数必然 2 倍。断言 5/6（h2/h3）用**标签正则**提取，所以没被波及。

**修法**：加 `stripScripts()`，所有计数断言以**剥离 `<script>` 后的可见 DOM** 为准；
另补两条哨兵 —— `15b 卡片容器数量 = 8`、`15c 可见 DOM 内不得残留 self.__next_f.push`。
修后 **24 PASS / 0 FAIL**（22 + 2）。

> 教训：**断言要表达不变量，不要表达快照**。计数前先想清楚「这段文本会以几种形态出现在 HTML 里」。

## 11. 顺带修掉的两个失效点（非本轮功能改动）

1. **`scripts/cs06a-directory-regression.ts` B6 是陈旧断言**（1 FAIL）
   旧断言「`new URL(` 恰好 2 处」写于 middleware 只有 rewrite + `/en` redirect 的年代。
   STEP 09 上线了第三条合法分支 —— 旧扁平产业带 URL → 层级 canonical 的 308，
   它随 STEP 09 一起上线却一直没进版本库（本轮才补提交），该断言从那时起就 FAIL，
   只是没人跑过 cs06a。**处置：不降低强度**，改成按语义逐个钉死 3 处角色
   （rewrite + 两条 redirect 各自的锚点表达式）—— 任何第 4 处分支或角色漂移依然立刻 FAIL。
   → 修复后 55 PASS / 0 FAIL。

2. **`scripts/step13-rename-dirs.mjs` 把「清理历史备份」移出构建关键路径**（真事故）
   07:21 的构建：改名 0.1 秒完成后**卡死在删旧备份的 `rmSync` 循环里**，
   进程挂死 1.5 小时、零构建输出，并持续占用日志文件句柄（导致重跑连日志都打不开，
   还因此产生了一条误导性的 "Out-File 文件被占用" 报错）。
   现在默认只改名（秒回），清理必须显式 `--clean`。

## 12. Commit

```text
STEP 13-B:  baefc17946f9ca95e36a56342d9d028eca4aeda5   （25 files）
STEP 13:    4b60bbf46c1d0d4d68f797630fcab972015d889e   （31 files，同批保存）
CS-0:       2934645                                     （middleware 漂移固化）
部署+修正:  07e990f528d1c0840aca5a1642670e3b32f5080f   （5 files：两份验收报告回填部署证据 +
                                                       §10.1 的断言缺陷修复 + STEP12 报告补记 commit hash）
HEAD 复核:  git rev-parse HEAD == git log -1 --format=%H == 07e990f5…  ✓
            （本机 git 有"假成功"前科，逐次比对；工作区已跟踪文件全干净）
```

## 13. Remaining / 下一步

1. ✅ ~~先补齐部署~~ —— **已完成**：线上 Version `2a144963-1877-42f9-bfe5-55430fd9a662`，
   数据层与代码层先前的错位窗口已关闭。
2. ✅ ~~部署后跑两份线上验收~~ —— **已完成**：STEP 13 `30 PASS / 0 FAIL`、STEP 13-B `24 PASS / 0 FAIL`。
3. **仍未纳入版本库的历史遗留**（本轮未处理，留给后续 decided-by-you）：
   `supabase/migrations/025_industrial_clusters_province.sql`、`026_step10_fields.sql`、
   `supabase/seed_p0_clusters.sql` —— 与 middleware 同类问题（**已 apply 到生产库但从未 commit**）。
   风险与 middleware 那次相同：库里生效、版本库无记录，一旦有人照仓库重建环境就会缺迁移。
4. 本轮未做（spec 明确禁止）：新增 Cluster / 新增 SEO 页面 / 改动 `cluster_slug` /
   改动 industry taxonomy / 改动 URL / 地图视图。
