# STEP 12 — DATA ACTIVATION 验收报告

> 执行原则：**一个 Change Set → 修改 → 测试 → 部署 → 线上验收 → 提交 commit**
> 完成链路：CODE → TEST → BUILD → DEPLOY → LIVE VERIFY ✅
> 时间：2026-09-20　对象：FactoryAuditB2B 生产库 + `F:\AI-验厂SEO网站`
> 本轮**未**新增 Cluster、未新增 SEO 页面、未改 `supplier.cluster_slug`、未伪造 consent（CHANGE SET F 全遵守）

---

## 0. 交付摘要

| 项 | 结果 |
| --- | --- |
| TypeScript | `tsc --noEmit` **0 错误**（跑两轮：改动后 + 修 bug 后） |
| next build | EXIT=0（4m17s） |
| opennext build | EXIT=0（17m18s） |
| cf-release | **ALL PASS**（en 字典叶子数 **2939** / 期望 2939；assets 1741 ≤ 20000） |
| 部署版本 | **`a1757fd1-5158-4bf2-b72d-56deca06a90a`** |
| sitemap | total=1323，**new=0** （符合「不新建页面」） |
| 线上验收 | 第一轮 **16/16 PASS**；修 bug 重部署后冒烟 **9/9 PASS** |
| 匹配逻辑 | 功能验证 **4/4 PASS**；确认写入路径 **8/8 PASS** |

---

## 1. Supplier

### 1.1 全量字段与完整率（before → after）

| 指标 | before（STEP 11） | after（本轮） | 变化 |
| --- | --- | --- | --- |
| 总 Supplier | 17 | **17** | 不变（未新增、未删除） |
| `province` 非空 | **0 / 17（0%）** | **14 / 17（82%）** | +14 |
| `industry_code` 非空 | 10 / 17（59%） | **15 / 17（88%）** | +5 |
| `consent` 完整 | 7 / 17（41%） | **7 / 17（41%）** | **刻意不变** |
| 已发布 | 9 | **9** | 不变 |
| 草稿 | 8 | **8** | 不变 |
| rejected / incomplete 标记 | 0 | **1** | +1（脏数据，未删除） |

### 1.2 province 补全（A3，14 行，全部有明确城市证据）

| slug | city 证据 | 回填 province |
| --- | --- | --- |
| dongguan-plastic-molding | Dongguan | Guangdong |
| guangzhou-sunny-food | Guangzhou | Guangdong |
| guangzhou-textile-factory | Guangzhou | Guangdong |
| jiangsu-liquid-damper | Jiangsu（省名落在 city） | Jiangsu |
| nanjing-mxcomm | Nanjing | Jiangsu |
| qingdao-xiuxinyang-… | Rizhao, Shandong | Shandong |
| shandong-loyal-industrial | Jinan | Shandong |
| shenzhen-jorigin-packaging | Shenzhen | Guangdong |
| shenzhen-precision-electronics | Shenzhen | Guangdong |
| u-w-y-company-limited | Shenzhen, Guangdong | Guangdong |
| xiamen-jings-eyewear | Xiamen | Fujian |
| xiamen-jintaijin-polish-tech-… | Xiamen | Fujian |
| guangdong-junchi-sports-… | Qingyuan | Guangdong |
| supplier（脏数据行） | 青岛 | Shandong |

**跳过 3 行（不编值）**：`batik-soehadi`（印尼 Surakarta，非中国 canonical 未确立）、`ho-chi-minh-garment`（越南直辖市，无省级）、`loomeami`（city=unknown）。

### 1.3 industry 补全（A4，5 行，仅白名单内 + 产品可证）

| slug | main_products 证据 | 回填 industry_code |
| --- | --- | --- |
| batik-soehadi | batik, daster, fabric | textiles |
| loomeami | Loungewear & Sleepwear | textiles |
| qingdao-xiuxinyang-… | loungewear, pajamas, knitwear, apparel | textiles |
| u-w-y-company-limited | Smart TV, Digital Signage, Kiosk, Monitor | electronics |
| xiamen-jintaijin-polish-tech-… | finishing/polishing machines | machinery |

**保留 NULL（不强行填）**：`guangdong-junchi-sports`（Pickleball Paddles，白名单无 sports 类 code）、`supplier`（PPE，无 ppe/safety code，且已标记 rejected）。

### 1.4 consent（A5 —— 严禁伪造）

legacy 9 家**没有历史 consent 就保持没有**，未写入任何假的 consent 时间/IP/UA。consent 完整率停在 41% 是**合规结果，不是缺口**。新注册供应商继续走既有 consent 机制（服务端取 IP/UA）。

### 1.5 7 条真实 supplier_application leads 审核（A1）

| 公司 | 国家 | 城市 | 对应草稿 | 公开资格判断 |
| --- | --- | --- | --- | --- |
| Qingdao Xiuxinyang | China | Rizhao, Shandong | 有 | 数据补齐后可发布（products/consent 齐） |
| U.W.Y Company Limited | China | Shenzhen | 有 | 补齐后可发布（industry 已补 electronics） |
| 青岛信戈诺科技 | 中国 | 青岛 | 有（slug=supplier） | **脏数据**：slug 非法、country=unknown ⇒ 已标记 rejected |
| Loomeami | China | （city 未填） | 有 | 缺 city ⇒ 需补正后再评估 |
| Batik Soehadi | Indonesia | Surakarta | 有 | 缺 province（非中国 canonical）⇒ 待定 |
| Guangdong Junchi Sports | 中国 | Qingyuan | 有 | 缺 industry（白名单无 sports）⇒ 待定 |
| CS02D Live Factory | CN | — | 测试 | **测试探针**，不计入真实 |

> ⚠️ 7 条 leads 的 `status` 仍为 `new`：是否发布属 **Admin 业务判断**，本轮不代替 Admin 落定（见 §6）。

---

## 2. RFQ

| 指标 | 数量 | 说明 |
| --- | --- | --- |
| 总 RFQ | 6 | — |
| 真实 RFQ | 1 | Titanium dioxide / chemicals / china（`RFQ-CXJCRL`） |
| 测试探针 | 5 | 全部 `is_public=false`，不进公开/SEO/意图/匹配指标 |
| public RFQ | 1 | 仅真实那条 |
| private RFQ | 5 | — |
| 有 source attribution | 3（历史）→ **新提交 100%** | 旧数据 3 条历史带过 `source_path`；新机制下每次提交必带 |
| buyer consent 状态 | **显式授权才 public** | 未勾选 ⇒ `is_public=false`（已线上验证） |

### 2.1 CHANGE SET C1 —— 来源归因

- 表单按优先级取来源：显式注入 → `?src=` → **当前页路径兜底**。
- 服务端 `deriveSourceType()` 由路径推导（仍受白名单约束）：`/industry/*` `/chemicals/*`→`industry`，`/industrial-clusters/*`→`industrial_cluster`，`/`→`home`，其余→`direct`。
- 线上验证：`source_path=/industry/chemicals` ⇒ `source_type=industry`；`source_path=/rfq` ⇒ `source_type=direct`。

### 2.2 CHANGE SET C2 —— 公开授权（修正 STEP 11 的错误结论）

STEP 11 曾建议「RFQ 默认 `is_public=true`」——本轮**明确否决**：

- `/api/rfq` 新增 `normalizePublicConsent()`：**只有** `true/"true"/"on"/"1"` 视为同意，缺省/false/其它一律 `false`。
- 表单新增**默认不勾选**的「允许公开（隐藏联系方式）」勾选项（9 语 dict key `rfq.form.labels.publicConsent`，**未硬编码**）。
- Admin 仍保留既有 `RfqPublicToggle` 可人工改公开状态。
- 测试探针保持 `is_public=false`。
- 公开页 `listPublicRfqs` 本就只 SELECT 白名单列（product/quantity/target_market/industry/certifications/cluster/created_at），**不含 email/phone/message** —— 线上隐私检查 `leak=0`。

---

## 3. Matching（CHANGE SET D）

| 指标 | 结果 |
| --- | --- |
| `rfq_matches` 行数 | **0**（机制已验证可写；是否落定属 Admin 业务判断） |
| 有效匹配 RFQ 数 | 1（唯一公开真实 RFQ 可得 8 条推荐） |
| 有效推荐 Supplier 数 | **8 / 9 已发布**（`ho-chi-minh-garment` 因 score=0 被正确排除） |
| 只推荐已发布 | ✅ 硬过滤 `is_published=true` |
| 排除 incomplete | ✅ 既无 industry 又无产品 ⇒ 不推荐 |
| 排除 country=unknown | ✅ |
| 排除测试/占位 | ✅ 脏 slug 黑名单（`supplier`） |
| 不改 `cluster_slug` | ✅ 全程未触碰 |
| 自动发送 Supplier | ❌ 未做（符合第一版要求） |

**确定性打分**：industry 精确 +50 / country +25 / 产品关键词 ≤+15 / 已核验 +10；score=0 不推荐。

**⚠️ 发现并修复的真 Bug**：`rfq_matches.status` 有 CHECK 约束，只允许 `suggested|contacted|won|lost`。初版写 `matched` 被数据库拒绝 —— 已改为语义正确的 `suggested`（Admin 已确认推荐、尚未联系），并重新构建部署。**这正是端到端验证的价值：只看代码会误判为成功。**

---

## 4. 真实漏斗

```
Supplier Lead      17（7 条真实 application + 8 草稿 in suppliers）
  → Reviewed       0 条 leads 实际流转（status 全 new）   ← 运营缺口，非代码缺口
  → Published      9
  → Buyer RFQ      6（真实 1 / 测试 5）
  → Public RFQ     1（显式授权才公开）
  → Match          0（推荐已可算：1 RFQ → 8 家；待 Admin 确认）
  → Buyer Contact  仅 leads，无报价工作流
  → Audit/Inspection/Sourcing  orders=0（入口在，转化未跑）
```

---

## 5. 回归（Regression）

| 测试 | 结果 |
| --- | --- |
| TypeScript | ✅ 0 错误 |
| build（next + opennext + cf-release） | ✅ 全 exit 0，ALL PASS |
| API 测试 | ✅ `/api/rfq` 提交 200 + stored=true |
| RFQ submit 测试 | ✅ 未授权 → `is_public=false`；明确授权 → `true` → 已撤销 |
| supplier register 测试 | ✅ 200 + ok=true + 生成 draftSlug |
| admin 授权测试 | ✅ 未登录访问 admin 匹配接口 = **404**（不暴露后台） |
| public/private 可见性测试 | ✅ 公开 RFQ 邮箱未出现在首页 HTML（leak=0） |
| source attribution 测试 | ✅ source_path/source_type 正确落库 |
| matching 测试 | ✅ 推荐 4/4 + 确认写入 8/8（含幂等、清理） |
| privacy 暴露测试 | ✅ 见上 |
| 脏数据隔离测试 | ✅ `/en/suppliers/supplier` = **404** |
| 数据补全上线测试 | ✅ 供应商页出现 Guangdong / Fujian |

---

## 6. 业务验收（诚实结论）

**供应商端** —— 链路**通**，但最后一步需人：
提交 ✅ → Admin 收到 ✅（register 落草稿+lead+回执）→ 审核 ✅（后台已加「数据完整度 x/7」徽章，consent/行业/国家/省/市/产品/核验一目了然）→ 补齐 ✅（本轮已补 19 个字段）→ Publish（机制在，Admin 未执行）→ 公开页 ✅（回填数据线上可见）。

**买家端** —— **全链路已真实跑通**：提交 ✅ → 来源归因 ✅ → 明确授权 ✅ → 入库 ✅ → Admin 查看 ✅ → 推荐 Supplier ✅（8 家）→ 确认 Match ✅（写入路径已验证）。

**业务端** —— 「RFQ 怎么变成 Audit/Inspection/Sourcing 商机」：
**目前仍是人工线下闭环**。`rfq_matches` 只记录「推荐了谁、状态 suggested→contacted→won/lost」，**没有**自动发送、没有报价表、`orders=0`。这是第一版刻意的范围（spec D 明确「不要在第一版直接自动发送给 Supplier」），不是遗漏，但意味着**转化仍未自动化**。

---

## 7. Remaining Issues（遗留）

1. **`xiamen-jings-eyewear.industry_code="eyewear"` 不在 `STATIC_INDUSTRIES` 白名单**（13 个 code）内 —— 遗留脏值，本轮未擅自改（改它等于替业务猜行业）。
2. **唯一真实 RFQ 是 chemicals，库内 0 家 chemicals 供应商** ⇒ 匹配只能命中 country 级（弱匹配）。这是**真实数据缺口**，不是算法问题。
3. **7 条真实 leads 仍 `status=new`、8 个草稿未发布** ⇒ 真实 Supplier 增长停在 9。需 Admin 运营执行。
4. **province 仍有 3 家 NULL**（非中国 canonical 未确立 + city=unknown）。
5. **consent 9 家 legacy 无留痕**（刻意不伪造，合规结果）。
6. **`rfq_matches`=0**：推荐与确认机制均已就绪并验证，等 Admin 在后台落定业务判断。

---

## 8. Change Set Summary / 提交与部署

- **commit**：见 `git log -1`（本节由提交后补充）
- **deploy version**：`a1757fd1-5158-4bf2-b72d-56deca06a90a`
- **buildId / 门禁**：en 字典叶子数 **2939**（常量已从 2938 同步，8 处同源 + verify-opennext-bundle + RELEASE-RULES）
- **回滚**：`node scripts/step12-activate-data.mjs --rollback`（备份 `step12-backup.json`，16 行）

新增/修改文件：
- 新增 `lib/rfqMatching.ts`、`app/api/admin/rfqs/[referenceId]/match/route.ts`、`app/[locale]/admin/rfqs/[referenceId]/page.tsx`、`components/admin/RfqMatchPanel.tsx`
- 修改 `app/api/rfq/route.ts`、`components/RfqForm.tsx`、`app/[locale]/admin/rfqs/page.tsx`、`app/[locale]/admin/suppliers/[slug]/page.tsx`、9 个 `i18n/dictionaries/*.json`、8 个门禁常量文件 + `RELEASE-RULES.md`
- 新增脚本 `step12-activate-data.mjs`（含 --rollback）、`step12-live-verify.mjs`、`step12-i18n-gates.cjs`、`step12-stats.mjs` 等

---

## 9. STOP

本轮已完成 **CODE → TEST → BUILD → DEPLOY → LIVE VERIFY**，线上真实可用。
**不自动进入 STEP 13。** 下一步由你决定。
