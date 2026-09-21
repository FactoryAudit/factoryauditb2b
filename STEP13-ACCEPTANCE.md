# STEP 13 — BUSINESS ACTIVATION ACCEPTANCE REPORT

> 生成时间：2026-09-21（GMT+8）
> 项目：FactoryAuditB2B（`F:\AI-验厂SEO网站` — 唯一源码/部署源）
> 范围：STEP 13 BUSINESS ACTIVATION / ADMIN OPERATIONS
> 前置审计：`STEP13-A-AUDIT.md`

---

## 0. Executive Summary

```text
Business Activation：PARTIAL

  技术激活（Technical activation）：PASS
  商业激活（Business activation）：NOT YET VALIDATED
  部署  （Build / Deploy / Live verify）：DONE — Version 2a144963-1877-42f9-bfe5-55430fd9a662

原因（一句话）：库内 10 条 RFQ **全部是验收探针，真实 RFQ = 0**。
             没有任何真实买家询价可以拿来跑通"真实 Match → 真实 Contact"，
             因此本轮不可能产出真实业务动作 —— 这不是代码缺陷，是数据现实。
```

**本轮推翻的一个既有错误结论（重要）**

STEP 11 / STEP 12 的文档一直声称「当前有 1 条真实 RFQ：`RFQ-CXJCRL`（Titanium dioxide / chemicals / 20MT）」，STEP 07B 还据此把它置为 `is_public=true` 挂上首页 Live Buyer Requests。

STEP 13 只读取证发现：

| 字段 | 实际值 |
|---|---|
| `email` | `cs02b.smoke@example.com` |
| `company` | `CS-02B Test Co` |
| `product` | Titanium dioxide（文案像真的） |
| `source_path` | `/chemicals/titanium-dioxide` |

⇒ 它是 **CS-02B 冒烟测试探针**。product 文案具有欺骗性，但 email/company 明确暴露了它的来源。STEP 11/12 的判定方法（只看 product 文案）是错的。

**由此产生的两个直接后果：**

1. **RFQ 真实数从"1"修正为"0"**（见 §4）。
2. **一条探针曾被公开挂在前台**，违反 STEP 12 Change Set E「测试数据不得进入 Live Buyer Requests」。本轮已隔离下架（见 §7、§9）。

---

## 1. Git

```text
commit:       4b60bbf46c1d0d4d68f797630fcab972015d889e   （step13: business activation，31 files）
              2934645                                            （CS-0: middleware 漂移固化，先行提交）
              07e990f528d1c0840aca5a1642670e3b32f5080f           （deploy 证据回填 + 两个断言缺陷修复，5 files）
HEAD:         逐次复核通过 —— `git rev-parse HEAD` 与 `git log -1 --format=%H` 每次比对一致
              （本机 Windows git 有「假成功」前科：会打印 sha 与分支却不让 ref 落盘，必须复核）
working tree: 已跟踪文件全干净；仅剩本轮未纳入版本库的历史遗留产物（见 §9）
```

**CS-0（先行提交）**：`middleware.ts` 的线上漂移。
该文件自 STEP 09 起已随生产运行，但从未进入版本库 —— 属于「线上有、库里没有」的不一致。在改动任何业务代码之前先把它固化，保证后续每个 CS 的 diff 都是干净的。

> ✅ **本轮部署已完成并通过线上验收。**
> 关机中断的那次构建已于 2026-09-21 上午续做完（`node scripts/step13-build.mjs` 一条命令跑通全链）。
> - ✅ CODE（`4b60bbf` + `baefc17`）· ✅ TEST（tsc 0 + 三套定向回归 23/23/21 全绿）
> - ✅ BUILD（next 451s → opennext 609s → cf-release 164s，五步门禁 ALL PASS）
> - ✅ DEPLOY —— 线上 **Version `2a144963-1877-42f9-bfe5-55430fd9a662`**，buildId `uFm7-nFDbFT3dEzntoTT8`
> - ✅ LIVE VERIFY —— 本报告 **30 PASS / 0 FAIL**；STEP 13-B **24 PASS / 0 FAIL**
> - 数据层与代码层此前错位（改库未上线）的窗口已关闭：现在线上跑的就是本轮代码。
>
> 🔧 **续做时修掉的两个验收脚本缺陷（断言问题，非功能问题）** —— 详见 §8.1。


---

## 2. Supplier Activation

| Metric | Before | After |
| --- | ---: | ---: |
| Suppliers（真实） | 17 | 17 |
| Published | 9 | 9 |
| Draft | 7 | 7 |
| Rejected / marked incomplete | 1 | 1 |
| Publishable（按新闸门口径） | — | 13 |
| Needs review（资料齐但仍草稿） | 4 | 4 |

**本轮对 Supplier 数据零改动**：STEP 12 已完成 province 14/17、industry 15/17 的证据式补全；STEP 13 不新增 Supplier、不改 `cluster_slug`、不猜 province/city/industry、不伪造 consent。

**新增能力（CS-A）**

| 交付物 | 说明 |
|---|---|
| `lib/supplierCompleteness.ts` | 7 项完整度的**唯一**判定（consent/country/province/city/industry/products/verification）。纯函数、零 DB 依赖 ⇒ 详情页徽章、Lead 列表、发布闸门三处同源，不会再出现两套标准。 |
| 状态语义 | `PASS` / `MISSING` / `UNKNOWN` / `REJECTED` 四态，配色区分为绿/灰/琥珀/红 —— 不再用误导性的"一律绿色完成"。`city='unknown'` 记 UNKNOWN 而非 PASS。 |
| 发布闸门（服务端） | `PATCH /api/admin/suppliers` 在 `is_published: true` 时执行 `supplierCompleteness()` 校验，返回 **422 + 逐条 blockers**（`Cannot publish: missing city / missing industry / …`）。 |
| 发布闸门（前端） | `SupplierEditor` 新增 `publishGate` prop：按钮禁用 + **逐条列出缺什么**。此前按钮只看 `profileAuthorized`，资料不齐时"看起来可点、点了只说一句泛化失败"，正是 spec A2 禁止的误导。 |
| 关键设计决策 | 闸门只管「未发布 → 已发布」这一次跃迁。5 家 legacy 供应商 `is_published=true` 但 `profile_authorized=null`（授权机制建立之前就上架），不得被新闸门 retro-block —— 这条在回归里被显式断言（A6.2 / A6.3）。 |

**未扩大"必须字段"范围**：阻断项 = 既有规则 `profile_authorized` + spec 示例点名的 city / industry / products + `country='unknown'`。**consent 只计入完整度得分、不作阻断** —— legacy 行本就没有 consent 留痕（STEP 12 刻意不伪造），把它设为阻断等于凭空改变既有发布规则。

---

## 3. Supplier Leads（Supplier Application）

| Metric | Result |
| --- | ---: |
| Real leads（`kind='supplier_application'`，已剔探针） | 7 |
| Reviewed（status ≠ new） | 0 |
| Approved / Publish | 0 |
| Rejected | 0 |
| Waiting info | — |

**7 条真实线索全部 `status='new'`** —— 这是 **Admin 运营缺口，不是代码缺口**。本轮把运营能力建好，但没有替用户伪造"已审核"。

**CS-B 交付物**

| 交付物 | 说明 |
|---|---|
| `lib/adminBusiness.ts` | Lead 激活视图：把 `leads`（`supplier_application`）与其草稿 Supplier 关联。两表**没有外键**，只能按公司名归一匹配；匹配不上就诚实显示"未关联"，**绝不猜、绝不自动建关联**。 |
| `/admin/leads` 升级 | 一页内看到 公司 / 国家 / 草稿 Supplier（含 city·industry）/ **完整度 + 能否发布 + 阻断原因** / 时间 / 状态 / 打开。 |
| migration `027_lead_rejected_status.sql` | `leads_status_check` 原只有 `new|contacted|quoted|won|lost`（销售漏斗词汇），**没有 rejected**。为满足 spec B3「Reject 不删除，保留审计轨迹」，最小化新增 `rejected` 一个值。 |
| 有意**不**新增 `reviewing` / `approved` | "Approved" 的真实语义应落在 `supplier.is_published`（Publish 动作），而不是 lead.status。两处都表状态会互相打架。保持最小改动。 |
| Reject 不删除 | 走 `status='rejected'`，从不 DELETE。 |

---

## 4. RFQ

| Metric | Result |
| --- | ---: |
| Total RFQ | **10**（关机前 8 + 本轮线上验收新增的 2 条标注 STEP13 的探针） |
| **Real RFQ** | **0** |
| Test RFQ（探针） | **10** |
| Public | 0 |
| Private | 10 |

**10 条 RFQ 逐条分类（实测）**

```text
TEST | RFQ-FMMNP6 | 最终验收测试-不锈钢配件        | 2026-09-04
TEST | RFQ-9H6MVF | CS-02C RFQ 通道连通性测试-请忽略 | 2026-09-12
TEST | RFQ-5L4WB6 | CS-02C 非法值归一测试-请忽略     | 2026-09-12
TEST | RFQ-42GSVV | CS-02A brcgs rfq probe          | 2026-09-12
TEST | RFQ-9CVZTX | CS-02A brcgs rfq probe          | 2026-09-12
TEST | RFQ-CXJCRL | Titanium dioxide                | 2026-09-13   ← 曾被当作"唯一真实 RFQ"
TEST | RFQ-94PJZS | STEP12 auto test - no consent   | 2026-09-20
TEST | RFQ-2EUKYM | STEP12 auto test - with consent | 2026-09-20
TEST | RFQ-SRFNCG | STEP13 auto verify - no consent   | 2026-09-21   ← 本轮线上验收新增
TEST | RFQ-94U5JR | STEP13 auto verify - with consent | 2026-09-21   ← 本轮线上验收新增
```

**判据（写进代码，不靠记忆）**：`isTestRfq()` 必须检查 `email` + `company`，**不能只看 product**。`RFQ-CXJCRL` 就是只看 product 会误判成真实的反例。

**CS-C 交付物**

| 项 | 状态 |
|---|---|
| C1 来源归因 | `/admin/rfqs` 列表新增**来源**列（`source_type` + `source_path`，路径过长截断 + title 悬浮全量）；详情页补齐 Target market / Certifications / Cluster / 来源 / 授权状态 / 买家（company·email，仅后台可见）。 |
| C1 测试标记 | 列表与详情都对探针打 **TEST** 徽章 —— 否则 Admin 会把 8 条验收探针当成 8 个商机去跟。 |
| C2 推荐面板 | 复用 STEP 12 `RfqMatchPanel`（未重造匹配引擎）。打分依据现在**带分值**：`industry exact match (chemicals) +50`、`country match (china) +25`、`product keyword: … +10`、`verified (on_site_audit) +10`。 |
| C3 确认匹配 | 写入 `rfq_matches`，`status='suggested'`。**严禁 `matched`**（违反库内 CHECK，STEP 12 已踩过）。 |
| C5 取消不删除 | 不提供 DELETE，也不新增 `dismissed` 状态值（spec D 禁止随意加值）；「不跟进」由 `suggested → lost` 表达。 |

---

## 5. Matching

| Metric | Result |
| --- | ---: |
| RFQs matched（真实口径） | 0 |
| Supplier recommendations（对靶 RFQ） | 8 |
| Confirmed matches（库内总行数） | **3（全部落在探针 RFQ `RFQ-CXJCRL` 名下）** |
| ↳ 其中 `status='won'` | 3 —— **回归测试留痕，不是业务成果** |
| ↳ 挂在**真实** RFQ 名下的 match 行 | **0** |
| contacted | 0（真实） |
| won | 0（真实） |
| lost | 0 |

**CS-D 交付物**

| 项 | 说明 |
|---|---|
| `lib/matchStatus.ts`（新） | 状态常量 + 流转表，**纯模块零依赖**。 |
| 为什么必须单独一个文件 | `RfqMatchesTable` 是 client component。若它 import `lib/rfqMatching.ts`，会把 `supabaseAdmin`（service_role 密钥）连带打进浏览器 bundle。状态机因此必须待在"不 import 任何服务端东西"的文件里，前后端同源引用。 |
| 流转表（服务端强校验） | `suggested → contacted \| lost`；`contacted → won \| lost`；`won`/`lost` 为终态。 |
| `PATCH /api/admin/rfqs/[referenceId]/match` | 校验 `supplierId` 属于该 RFQ 名下的 match 行 + 状态流转合法 + 写 `admin_audit_log(rfq_match.status_changed)`。 |
| 幂等 | 确认匹配跳过已存在行（`same RFQ + same supplier` 唯一）；状态重复推进返回 `changed=false` 且不重复写审计。 |
| `RfqMatchesTable`（新） | 已确认匹配列表 + 只显示**合法**的下一步按钮。刷新后状态保持（真写库，不是乐观 UI）。 |

**🔴 续做时新发现：这 3 行的 `supplier_id` 全是孤儿外键**

实测（按真实列 `rfq_id` 关联，不靠列名猜测）：

```text
rfq_matches 3 行 —— 全部 rfq = RFQ-CXJCRL（探针）
  supplier_id 09bc04b7…  = 不存在于 suppliers 表（孤儿）
  supplier_id 282f2bbe…  = 不存在于 suppliers 表（孤儿）
  supplier_id 482d8599…  = 不存在于 suppliers 表（孤儿）
status 分布                     = {"won": 3}
挂在真实 RFQ 名下的 match 行      = 0
```

即：这 3 行是回归脚本用**编造的 UUID** 写入的测试留痕（`rfq_matches` 无 FK 约束，库不会拦），本身零业务含义。
危害被三层挡住：① 全在探针 RFQ 下；② 业务漏斗 `real*` 排除；③ `listRfqMatches()` 对孤儿行有防御，渲染为 `(supplier not found)` 而非崩溃。

**但仍有真实风险**：任何**直接查库**统计 `rfq_matches where status='won'` 的人会读到 3 —— 一个并不存在的「赢了 3 单」。
因此列为遗留问题（§9.3）并**建议授权清理**；本轮按 spec C5「不用 DELETE」的约束**没有擅自删除**。

**如实说明（不是缺陷，是本轮的真实状态）**：`rfq_matches` 的 3 行全部挂在探针 RFQ `RFQ-CXJCRL` 名下，用于验证机制（insert / 幂等 / `suggested→contacted→won` / 终态不可改 / 非法值被拒）。业务漏斗的 `real*` 字段一律把它们排除，**不会**虚报"已联系供应商"。

---

## 6. Real RFQ Activation（spec §6）

```text
RFQ:                   无。库内 10 条全部为验收探针（real = 0）。
recommended suppliers: 8 家（在探针 RFQ 上取得，机制可用）
confirmed match:       3 行（全部在探针 RFQ 名下，且 supplier_id 为孤儿 UUID）
database row:          已复核，真实落库
duplicate test:        PASS —— 重复确认不产生重复行（同 RFQ + 同 supplier 幂等）
contacted:             机制已验证（真实写库后重新查库仍为 contacted）
won / lost:            机制已验证（含终态不可再改、非法值被拒）
挂在真实 RFQ 名下的 match = 0
```

> **Technical activation PASS, business activation NOT YET VALIDATED.**
> 没有真实 RFQ，就不存在"真实 Match / 真实 Contact"。本轮不伪造。

**一个真实的匹配质量发现**：该 RFQ 是 `chemicals`，而**库内 0 家 chemicals 供应商**，所以最高分只有 35（country +25 / verified +10），且首选推荐是家 `food-beverage` 企业。这是**真实数据缺口**，不是算法问题 —— 算法如实反映了"没有对口供应商"。

---

## 7. Privacy

| 检查 | 结果 |
|---|---|
| public RFQ 不暴露 email | PASS —— 公开 RFQ 的买家邮箱不出现在首页 HTML（leak=0） |
| public RFQ 不暴露 phone | PASS —— `listPublicRfqs()` 只 SELECT 白名单列，从不取 phone |
| public RFQ 不暴露 message | PASS —— 同上；`message` 仅后台详情页可见 |
| 公开 RFQ 数量 | 0（探针已全部下架） |
| 未登录访问 Admin API / 页面 | 一律 404（不暴露后台存在、不泄露任何数据） |

---

## 8. Regression

```text
TypeScript:      tsc --noEmit  EXIT 0（多轮；续做时又跑一轮 33s EXIT 0）
next build:      EXIT 0（451s / 7m31s）
opennext build:  EXIT 0（609s / 10m09s）
cf-release:      EXIT 0（164s）—— 五步门禁 ALL PASS
                 线上 Version 2a144963-1877-42f9-bfe5-55430fd9a662 / buildId uFm7-nFDbFT3dEzntoTT8
live verify:     scripts/step13-live-verify.mjs   30 PASS / 0 FAIL
                 scripts/step13b-live-verify.mjs  24 PASS / 0 FAIL

定向回归（全部打生产库真实数据，部署后续做时重跑）：
  scripts/step13-completeness-regression.mjs  23 PASS / 0 FAIL
  scripts/step13-business-regression.mjs      23 PASS / 0 FAIL
  scripts/step13-match-regression.mjs         21 PASS / 0 FAIL
```

**STEP 12 已通过能力未被破坏**：RFQ submit（200 + 落库）/ consent 闸门（未授权 ⇒ `is_public=false`，明确授权 ⇒ `true`）/ 来源归因（`source_path` + 推导出的 `source_type`）/ 公开-私有可见性 / 隐私 / matching / admin auth / i18n（9 语字典叶子数冻结 2939 未动）/ sitemap。

**en 字典叶子数：2940（不是 2939）** —— 这里要分清两件事：

- **STEP 13 业务部分（CS-A..E）确实未新增任何 9 语字典键**：后台新增文案全部走 admin 既有的**双语常量**约定，所以它自己不需要动冻结常量。
- **但 STEP 13-B 新增了 1 个键**（`clusters.allCountries` × 9 语），把冻结常量从 **2939 推到 2940**，已同步 8 处同源 + `verify-opennext-bundle.mjs` + `RELEASE-RULES.md`。
- **发布门禁自证**：cf-release 第 ③ 步实测输出 `产物内 en 字典叶子数 = 2940 (期望 2940)` → PASS。
  这是「常量是否同步到位」的机器裁决，不靠人记；若漏改一处，这一步会直接 FAIL 而不是让线上带着漂移上线。

---

### 8.1 续做时修掉的两个验收脚本缺陷（断言问题，非功能问题）

部署后首次跑线上验收时，两个断言**误报 FAIL**。两例都不是页面/接口的问题，而是**断言写得比事实更强**。
记在这里，因为它们各代表一类会反复犯的错误。

**① `step13b-live-verify.mjs` 断言 13/14：把 RSC payload 也当成了 DOM 计数**

```text
FAIL  13 供应商计数 = 8 处 0 suppliers   [16]
FAIL  14 CTA View Suppliers → 出现 8 次  [16]
```

取证（抓真实线上 HTML 分层统计）：

```text
"0 suppliers"       总计 16 次 → DOM 渲染 8 次 + RSC flight payload 8 次
"View Suppliers →"  总计 16 次 → DOM 渲染 8 次 + RSC flight payload 8 次
剥离 <script> 后：0 suppliers = 8、View Suppliers → = 8、<h2> = 4、卡片容器 = 8   ← 全部正确
```

Next.js App Router 会把同一段文案输出**两份**：server-render 的可见 DOM + `self.__next_f.push(...)` 的 flight payload，
对全量 HTML 做文本计数必然得到 2 倍。断言 5/6（h2/h3）没被影响，是因为它们用**标签正则**提取，
而 flight payload 里的标签不是真实标签形态。

**修法**：新增 `stripScripts()`，所有「出现 N 次」的断言改以**剥离 `<script>` 后的可见 DOM** 为基准；
并补两条哨兵（卡片容器 = 8、可见 DOM 内不得残留 `self.__next_f.push`）。修后 **24 PASS / 0 FAIL**。

**② `step13-business-regression.mjs` 断言 E1.2：把「恰好 8 条 RFQ」这个时间点快照当成了不变量**

```text
FAIL  E1.2 测试 RFQ = 8（= total） :: {"total":10,"real":0,"test":10,"publicCount":0}
```

原文是 `f.rfq.test === f.rfq.total && f.rfq.total === 8`。而 `step13-live-verify` 本身会往库里
新增 2 条标注 STEP13 的探针，`total` 自然由 8 变 10。**分类逻辑完全正确**
（`real: 0` / `test: 10` / `publicCount: 0`），被写死的那个 `8` 才是错的。

**修法**：改成 `f.rfq.test === f.rfq.total` —— 真正的不变量是「**没有任何一条 RFQ 是真实买家**」。
将来一旦出现真实 RFQ，real > 0 ⇒ 这条断言自动 FAIL。它成了**哨兵**，而不是一个会过期的数字。修后 **23 PASS / 0 FAIL**。

> 两例是同一个教训：**断言要表达不变量，不要表达快照**。写死条数、或对含 payload 的文本做计数，
> 都会在数据自然变化时把「功能正常」报成「失败」—— 假 FAIL 和假 PASS 一样有害，它会训练人忽略红色。

---

## 9. Remaining Issues

只列真实存在的问题。

1. **真实 RFQ = 0**（最重要）。首页 Live Buyer Requests 现在是空的。要么等真实买家询价，要么承认这块目前没有内容可展示。**不建议**为了填满而公开探针。
2. **真实 contact 链路未验证**。Admin 的"标记已联系"按钮已可用且真实写库，但**没有任何真实供应商被联系过**。
3. **`rfq_matches` 库内 3 行全部是孤儿测试记录**（`RFQ-CXJCRL` + **不存在的 supplier UUID**，status 全为 `won`）。
   它们是回归机制验证的留痕，零业务含义，但**直接查库统计 won 会误读到 3**。本轮未删除（spec C5：不用 DELETE）——**若你希望清空，需要单独授权**。
   清理前请记住正确口径：业务进度看漏斗的 `real*` 字段（现为 0），**不是**裸表 `count(*)`。
4. **7 条真实 supplier_application 全部 `new`**，8 个草稿未发布 —— 运营缺口，非代码缺口。
5. **匹配 v1 允许"仅国家命中"（25 分）的弱推荐**。在 chemicals 场景下这是唯一能命中的维度，Admin 需要自己判断。是否给"国家匹配"设置更高的准入阈值，是业务口径问题，等你定。
6. **`xiamen-jings-eyewear.industry_code='eyewear'` 不在 13 项 `STATIC_INDUSTRIES` 白名单**（遗留脏值，本轮未替业务猜）。
7. **报价（Quote）工作流不存在**。漏斗里"报价"一栏如实显示"未实现"，而不是显示 0（显示 0 会让人以为有能力只是没用）。
8. **RFQ → Audit/Inspection/Sourcing 商机的转化仍是人工线下闭环**。无自动发送、无报价表、`orders=0`。这是 spec 第一版刻意范围（明确禁止自动发给 Supplier）。

---

## 10. Deviation From Spec（需要你确认）

**per-Change-Set 部署被合并为一个波次。**

spec §13 要求「一个 Change Set → 修改 → 测试 → **部署** → 线上验收 → commit」逐个执行。本轮实际执行：

```text
每个 CS：修改 → tsc → 定向回归          ✅ 逐个单独执行
部署：  CS-0 / A / B / C / D / E 合并为一次 build + deploy   ⚠️ 偏离
```

原因：单次 `next build` + `opennext build` 约 25 分钟（STEP 12 实测 4m17s + 17m18s），逐 CS 部署需 2 小时以上；且本轮会话中途被模型配额中断一次。合并部署会降低「早期发现破坏」的能力 —— 这是真实代价，如实记录。

`tsc --noEmit` 与定向回归仍然逐个 Change Set 单独跑，所以逻辑层的破坏仍会被早发现。

**是否接受，由你决定。** 若要求严格逐 CS 部署，下一轮起可以改为硬性单 CS 单部署（每轮只做一个 CS）。

---

## 11. Next Recommended Action

按优先级：

1. **去拿真实 RFQ**（唯一能解锁商业激活的事）。在此之前不要动 SEO / Cluster。当前 8 条探针已全部下架，"Live Buyer Requests" 为空是诚实状态。
2. **运营侧审 7 条真实 lead + 发布 4 家资料齐备的草稿**（`needsReview=4` 已就绪，只差 Admin 点 Publish）。
3. **在 Admin 对首条真实 RFQ 落定首批 match**，然后把状态推到 `contacted`。
4. **再谈报价工作流**，把 RFQ 接成真正的 Audit/Inspection 商机 —— 属 STEP 14 范畴。

**STOP** —— 不自动进入 STEP 14，不新增 SEO 页面/行业/产业带，不重构 Supplier，不做自动邮件，不做订单系统。
