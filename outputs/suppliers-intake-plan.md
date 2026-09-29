# 供应商库扩充方案（内容侧启动）—— 第一批 30 家

> 交付范围：`suppliers` schema 说明 · 现有数据画像 · 发布闸门（代码级）· 合规评估（含 robots.txt 实测）· 渠道分级 · 字段映射 · 录入方案与脚本 · 发布流程 · D1 阈值评估 · 第一批执行清单
> **本文档不含"编造的 30 家公司名单"** —— 原因与替代路径见 §10。

---

## 1. `suppliers` 表 schema（只读实测，**67 列**）

数据来源：`information_schema.columns`（只读 SQL，未改动任何数据）。

### 1.1 标识 / 工商登记级（公开可见）

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | uuid | ✅ | 主键（默认 gen） |
| `slug` | text | ✅ | URL 用，**发布后不可改**（改了 = 线上 404） |
| `legal_name` | text | ✅ | 法定公司名（可为中文，如「南京麦克森OE科技有限公司」） |
| `english_name` | text | — | 英文名（**现 9 家全空**；多数 `legal_name` 本身已是英文） |
| `display_name` | text | — | 展示名 |
| `country_code` | text | ✅ | ⚠️ **值域不统一**：现存 `china` / `cn` / `vietnam` / `indonesia` / `unknown` |
| `city` / `province` | text | city ✅ | 城市 / 省 |
| `address` | text | — | 公开登记地址（**不得填个人住址**） |
| `industry_code` | text | ✅ | 行业代码（现存 7 个值，见 §1.6） |
| `business_type` / `company_type` | text | — | 业务类型 / 企业类型 |
| `established` | int | — | 成立年（**≠ `export_since`**，两者不可混用） |
| `employees` | text | — | 员工规模（文本区间，非数字） |
| `registration_number` | text | — | 统一社会信用代码 / 注册号 |
| `website` | text | — | 官网 |
| `company_description` | text | — | 公司描述（**现 9 家全空**） |

### 1.2 产品 / 市场 / 产能

| 列 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `main_products` | text[] | ✅ | 主要产品（**默认 `{}`**，空数组也满足 NOT NULL） |
| `export_markets` | text[] | ✅ | 出口市场（默认 `{}`） |
| `production_capacity` / `monthly_output` / `factory_size` | text | — | 产能 / 月产量 / 厂房面积 |
| `export_since` | int | — | 出口起始年 |

### 1.3 认证（**两条永不交叉的轴**）

| 列 | 类型 | 说明 |
|---|---|---|
| `certifications` | text[] | **平台核验**的证书（默认 `{}`） |
| `self_reported_certificates` | jsonb | **供应商自述**证书（`{name, issuer, id, validTo}`）—— 与上一列语义不同，不可互填 |

### 1.4 核验 / 评分（**付费不买结论**）

| 列 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `verification_level` | text | `unverified` | 现存值域：`unverified`(20) / `on_site_audit`(1) |
| `verification_status` | text | — | 文本状态 |
| `risk_score` | int | — | 0–100（高=低风险）；**只有手写种子数据有值，新录入留 NULL，绝不编造** |
| `risk_breakdown` | jsonb | — | 8 维明细 |
| `audit_status` | text | — | 审核状态 |
| `inspection_history` | int | `0` | 检验次数 |
| `completeness_percent` | int | — | 完整度（现全空） |

### 1.5 来源 / 发布 / 权限 / 合规同意书

| 列 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `source_url` | text | — | **可追溯证据（本次采集的硬要求）** |
| `source_type` / `source_name` | text | — | 来源类型 / 名称（现存 `supplier_application`、`SUPPLIER_REGISTRATION`） |
| `discovered_at` | timestamptz | — | 发现时间 |
| **`is_published`** | boolean | **`true`** ⚠️ | **列级默认是 true** ⇒ 不显式传 `false` 就会直接发布 |
| `public_profile_enabled` | boolean | — | 现 21 行全 true |
| `search_index_enabled` | boolean | — | 现 21 行**全 false** |
| `profile_status` | text | — | 现存 `public`(9) / `draft`(12) |
| `access_tier` | text | `public` | 现存 21 行全 `public` |
| `profile_authorized` / `authorized_at` / `authorized_by` | bool / ts / text | — | 授权痕迹 |
| `consent_version` / `consent_ip` / `consent_user_agent` | text | — | 同意书留痕（**`consent_ip` 属敏感，录入脚本已列入禁止列**） |
| `unpublished_at` / `unpublished_by` | ts / text | — | 下线痕迹 |
| `region` / `cluster` / `cluster_slug` / `cluster_tags` | text / text[] | — | 产业带归属 |
| `utm_source` / `utm_medium` / `utm_campaign` / `referrer` / `landing_page` / `first_touch_at` | text / ts | — | 内部归因（**刻意不进 `ROW_SELECT`**） |

### 1.6 `industry_code` 实际值域（**7 个，不是 6 个**）

`textiles`(5) · `machinery`(3) · `electronics`(3) · `eyewear`(1) · `food-beverage`(1) · `plastics`(1) · `packaging`(1)

> `lib/industryContent.ts` 的 `INDUSTRY_COPY` 只配置了 `food-beverage` 与 `chemicals` 两个「有子主题」的行业 —— **行业页有内容 ≠ 数据库只有这些值**。新增行业前需确认 `/industry/[slug]` 是否有对应页面，否则该行业无法被页面引用。

---

## 2. 现有数据画像（只读实测）

| 指标 | 值 |
|---|---|
| 总行数 | **21** |
| `is_published = true` | **9**（= `/suppliers` 展示的；9 × 9 语 = 81 页 HTML ✅ 与构建实测一致） |
| `is_published = false` | **12**（全部 `profile_status='draft'`） |

### 2.1 已发布 9 家的字段完整度（非空计数）

| 字段 | 有值 / 9 | 备注 |
|---|---|---|
| legal_name / city / industry_code / business_type | **9 / 9** | 核心标识齐 |
| province | 8 / 9 | |
| established / employees | 6 / 9 | |
| website | 5 / 9 | |
| address | 3 / 9 | |
| registration_number | **1 / 9** | |
| **source_url** | **1 / 9** | ⚠️ 可追溯证据严重缺失 |
| english_name / company_description / contact_email | **0 / 9** | |

### 2.2 已发现的数据质量问题（**录入前应先修**）

1. **`country_code` 值域不统一**：`china`(16) vs `cn`(1) —— 同一国家两种写法，会破坏按国家聚合。
2. **`unknown`(2)** 与被污染值：存在 `slug='supplier'`、`city='青岛'`（中文城市名）、`country_code='unknown'` 的行。
3. **测试脏数据 12 家 draft 中至少 4 条明显是测试残留**：`step12-automated-verify-co`、`supplier`、`xiamen-jintaijin-polish-tech-co-ltd-1` / `-2`（同一公司出现 `-1`/`-2` 后缀，疑似重复导入）。
4. **`certifications` 多数为空**：9 家中仅 3 家有值（`SMETA`、`ISO 9001/SMETA/CE`、部分含 `OEKO-TEX`）。
5. **`risk_score` 仅 4 家有值**，来源是手写种子数据 —— 新录入**必须留 NULL**。

---

## 3. 发布闸门（代码级，必须理解才能录对）

### 3.1 数据源开关与过滤（`lib/queries.ts`）

- `SUPABASE_DATA_SOURCE === "static"` → 读**静态常量**（`lib/staticData.ts`，4 家）
- 否则 → 读库，且**唯一闸门**是 `.eq("is_published", true)`（4 处调用点：`fetchRows` 及 3 个列表函数）
- 查询失败 → **静默 fallback 到静态数据**（不报错，只是页面"少了几家"）⇒ 构建期必须查 `fetch failed`

### 3.2 公开读列白名单 `ROW_SELECT`（约 37 列）

**录了但公开页读不到的列**（不在 `ROW_SELECT`）：
`source_url`、`source_type`、`source_name`、`discovered_at`、`display_name`、`company_description`、`phone`、`contact_person`、`contact_email`、`whatsapp`、`profile_status`、`completeness_percent`、全部 `utm_*`

> ⚠️ **关键后果**：`source_url` 目前**不会出现在任何公开页面**上。要让它可见，必须改 `ROW_SELECT` 并**重新构建部署**（列已存在，不需要 DDL，但需要代码 + 部署）。这一点会直接影响 Go/No-Go：如果"来源可追溯"要展示给用户看，需另开一个小改动。

### 3.3 SSG 冻结

`staticAssetsIncrementalCache` + `enableCacheInterruption` ⇒ 缓存只读、`revalidate` 等价构建期冻结。**改库（任何字段）后必须重建 + 重新部署**，否则线上仍是旧数据且**零报错**。

### 3.4 三种"发布"语义要分清

| 字段 | 含义 | 现状 |
|---|---|---|
| `is_published` | **是否进 `/suppliers`**（唯一硬闸门） | 9 家 true |
| `public_profile_enabled` | 是否有公开档案页 | 21 家全 true（**未用作闸门**） |
| `search_index_enabled` | 是否允许索引 | 21 家全 false（**未接入闸门**） |

⇒ 不要以为把 `public_profile_enabled` 设 true 就"发布了"；**只有 `is_published` 有效**。

---

## 4. 合规评估（"四不"原则 + robots.txt 实测）

### 4.1 四不原则（写进流程）

1. **不非法侵入**：不绕过登录墙、不突破验证码、不使用被禁止的接口。
2. **不干扰运行**：全局串行，**≤ 1 req/s**，不并发、不用高并发扫描。
3. **不破坏技术**：**严格遵守 robots.txt**（实测见 §4.2），不绕过反爬技术措施。
4. **不损害权益**：**只采集公司层面公开信息**；不采集个人邮箱 / 电话 / 姓名 / ID。

### 4.2 robots.txt 实测（2026-09-29，走本机受控代理）

| 来源 | 实测结果（原文摘录） | 可自动采集？ |
|---|---|---|
| **中国制造网** `made-in-china.com` | `Disallow: /company-search/`、`/*.do`、`/member/`、`/browsing-history/`、`/qa/userInfo` | ❌ **企业搜索被禁**（公司页亦受 `.do` 规则约束） |
| **广交会** `cantonfair.org.cn` | `/robots.txt` **不存在**（返回站点 HTML 首页）；名录为 **SPA + 需登录** | ❌ 无声明 + 登录墙 ⇒ 视为不可采 |
| **Kompass** `kompass.com` | `Disallow: /o/`、`/searchCompanies`、`/search*`、`/*?`、`/c/` | ❌ **近乎全面禁止**（含所有带 query 的 URL） |
| **Alibaba** `alibaba.com` | `Disallow: /supplier/`、`/corporations/`、`/minisite/`、`/product/`、`/buy/`（Allow 仅限 `/product-detail/`、`/showroom/`、`/catalog/*?` 等商品侧） | ❌ **公司/供应商页被禁** |

### 4.3 结论

> **你建议的 5 个渠道中，4 个（含 Kompass、阿里、广交会、中国制造网）按 robots 实测均不可自动采集。** 因此第一批**不走爬虫**，走**人工查看 + 手工核验录入**（这也正是你方案里的"手动查询 + 复制"）。

---

## 5. 渠道分级（按可采性，而非"看起来能不能爬"）

| 级别 | 渠道 | 方式 | 合规要点 |
|---|---|---|---|
| **A（推荐，可规模化）** | ① 供应商**自愿提交**（已有 `supplier_application` 提交流程 + `consent_*` 留痕）② 企业**官网**公开"关于我们/工厂"页 | 人工 / 半自动（需先核验该站 robots） | 授权明确、证据最强 |
| **B（推荐，权威）** | ③ 国家企业信用信息公示系统（工商登记级）④ 上市公司公告 / 年报 / 招股书 | **人工查询**（有验证码，禁止自动化） | 只取登记级公开项 |
| **C（可用，需人工）** | ⑤ 广交会 / 华交会等**展会公开名录**（人工在展会现场或官网逐条查）⑥ 中国制造网 / 阿里公开展商页（**人工**打开、复制公司名/城市/类目） | **纯人工**，不进爬虫 | 只取公司名/城市/类目；不取联系人 |
| **D（禁止）** | 任何需登录 / 绕验证码 / 破反爬的来源；任何个人联系方式；社交媒体个人主页 | — | 直接不做 |

> robots.txt 约束的是**自动化客户端**，**不约束人工浏览**。因此 C 类"人工打开页面并抄录公司层面信息"在合规上是成立的；一旦写成脚本批量抓取就越线了。

---

## 6. 字段映射（来源 → 列 → 填法）

| 列 | 来源 | 填法 | 缺失时 |
|---|---|---|---|
| `slug` | 由 `legal_name` 派生 | 小写、连字符、≤80 字符；**发布后不可改** | 必填 |
| `legal_name` | 公开名录 / 公示系统 | 原样抄（中英皆可） | 必填 |
| `english_name` | 官网 / 名录英文页 | 原样抄 | **留 NULL（不要拼音硬凑）** |
| `country_code` | 公开信息 | **统一用 `china`/`vietnam`/`thailand`/`malaysia`/`indonesia`**（脚本会拒绝值域外的值） | 必填 |
| `city` / `province` | 公开信息 | 英文城市名（如 `Dongguan`） | `province` 可空 |
| `industry_code` | 产品推断 | 取 §1.6 的 7 个值之一（脚本对未知值**告警不阻断**） | 必填 |
| `business_type` | 公开信息 | 如 `OEM/ODM`、`Manufacturer` | 可空 |
| `established` | 公开信息 | 整数年份 | 可空（**不要用 `export_since` 顶替**） |
| `main_products` | 公开名录 | `|` 分隔，≥1 项 | 必填 |
| `certifications` | 认证机构公示 / 官网 | `|` 分隔；**仅填可核验的**，不确定就留空 | 可空 |
| `self_reported_certificates` | 供应商自述 | ⚠️ **不要手工填**（属另一条轴，需按表单结构） | 留 NULL |
| `website` | 公开名录 | 完整 URL | 可空 |
| `registration_number` | 公示系统 | 统一社会信用代码 | 可空 |
| `source_url` | 采集来源 | **必填**（脚本强制） | 必填 |
| `source_type` / `source_name` | 采集来源 | 如 `manual_public_registry` / `国家企业信用信息公示系统` | 建议填 |
| `verification_level` | — | **强制 `unverified`**（脚本硬编码） | — |
| `is_published` | — | **强制 `false`**（脚本硬编码；列默认是 true，必须显式覆盖） | — |
| `risk_score` | — | **留 NULL**（付费不买结论；算法未产出前不填） | 留 NULL |
| `phone` / `contact_person` / `contact_email` / `whatsapp` | — | **禁止采集**（脚本出现即报错退出） | 留 NULL |

---

## 7. 录入方案

### 方案 A：Supabase 后台手填（第一批 30 家，**推荐**）

- 逐个 INSERT，字段少（本方案只需 ~18 列），每条 2–4 分钟 ⇒ 30 家约 1–2 小时
- 优点：每条都过人工眼；缺点：无校验、易漏 `is_published`（**默认 true！**）
- **必须**在建行时手动把 `is_published` 关掉

### 方案 B：批量导入脚本（**已交付并跑通 dry-run**）

```bash
# 预览（默认，不写库）
node --env-file=.env scripts/suppliers-intake.mjs --file data/suppliers-intake.json
# 写入
node --env-file=.env scripts/suppliers-intake.mjs --file data/suppliers-intake.json --apply
```

脚本 `scripts/suppliers-intake.mjs` 的安全设计：

1. **默认 dry-run**，必须显式 `--apply`（白名单式，避免误写生产）
2. **强制** `is_published=false` + `verification_level='unverified'`（第一批判死，发布是独立动作）
3. **拒绝个人数据列**：出现 `phone`/`contact_person`/`contact_email`/`whatsapp`/`consent_ip` 即报错退出
4. **列白名单**：未知列只告警并忽略（防手抖写脏字段）
5. **校验**：必填 7 项、slug 格式、`country_code` 5 国值域、`source_url` 必填且 http(s)、文件内 slug 去重
6. **幂等 + 只补 NULL**：已存在 slug 只 PATCH 当前为空的列，**绝不覆盖非空**（沿用 CS-14 铁律）
7. 有任一不合规行 → **拒绝写入**（一行都不写）

输入格式：JSON 数组或 CSV（`|` 分隔数组字段）。模板：`data/suppliers-intake.example.json`。
**实测**：示例文件 dry-run → `忽略未知列 _comment` 告警 + `INSERT 1`，EXIT=0 ✅

---

## 8. 发布流程与审核标准

```
人工核验公开信息 → 写入（is_published=false, profile_status 保持 draft）
  → 人工审核（见下）→ 置 is_published=true → 重建 + 重新部署 → 线上生效
```

**审核标准（每条必须全过）**

1. 有 `source_url`，且该 URL 人工打开后**确实能看到所填信息**
2. `legal_name` + `country_code` + `industry_code` + `city` 非空
3. **不含**任何个人联系方式 / 个人姓名
4. 数据与公开信息**逐字一致**（不做推断、不美化）
5. `certifications` 只在能核验时填；`risk_score` 保持 NULL
6. `slug` 全局唯一且符合 URL 规范

---

## 9. D1 阈值评估（`/suppliers` HTML 膨胀）

| 阶段 | 家数 | × 9 语 = HTML | 评估 |
|---|---|---|---|
| 现状 | 9 | 81 | ✅ 已实测 |
| 第一批后 | 9 + 30 = **39** | 351 | 🟡 需实测单页 HTML 体积与构建时长 |
| 第二批后 | 39 + 70 = **109** | 981 | 🔴 **超过 50 家阈值，必须先做膨胀评估** |

**阈值评估要做的事（第二批启动前）**：
1. 单页 HTML 字节数（现 81 页可测基线）× 预期页数 → 总量
2. `/suppliers` 列表页 + 国家页 + 行业页的**卡片数量**带来的 HTML 增幅（这是膨胀主因，列表页塞 109 张卡片）
3. 构建时长与 Workers 资产上限（现 assets 2347 ≤ 20000，单文件 2.35 MiB ≤ 25 MiB —— 还有余量，但需重测）
4. 是否需要对列表页分页 / 只渲染前 N 家

> **39 家仍在安全区**，但**"每加一批就重测一次"**应固化进流程。

---

## 10. 第一批 30 家：为什么本文档没给"编造名单"

**硬约束**：你要求每条都有 `source_url` 作为可追溯证据，且严禁无据声称。我**不能凭空生成 30 家公司名 + 对应的公开来源 URL** —— 那会 100% 触犯你自己的红线（假 data 比没 data 更糟：它会被当真、被索引、被客户引用）。

**而且实测表明渠道受限**：§4.2 的 robots 结论使"脚本批量出名单"这条路在合规上已被关闭；唯一合规路径是**人工逐条核验**，这需要人工时间去打开页面、核对登记信息。

**因此我给出的是"可立刻开工的执行清单"，而不是伪造的名单**：

### 10.1 采集工作表模板（每行一家的核验 checklist）

| # | 目标字段 | 取值 | 来源 URL（必填） | 核验时间 | 核验人 | 备注 |
|---|---|---|---|---|---|---|
| 1 | legal_name | | | | | |
| | country_code / city / province | | | | | |
| | industry_code / business_type | | | | | |
| | main_products（`|` 分隔） | | | | | |
| | certifications（可核验才填） | | | | | |
| | established | | | | | |
| | website | | | | | |
| | registration_number | | | | | |
| | slug | | | | | |

### 10.2 三条可立即执行的采集路径（按投入产出排序）

1. **路径 ①（最快、最合规）**：把现有 12 家 `draft` 中的**真实入驻申请**审核后发布 —— 这些是供应商**自己提交**的，授权链最完整（`consent_*` 已留痕）。**先从这 12 家里剔除 4 条测试脏数据，剩下 8 条走审核**。
2. **路径 ②（权威）**：用国家企业信用信息公示系统人工核验一批目标工厂（可先按"导出三大产业带 + 目标行业"定向 30 家），只抄登记级信息。
3. **路径 ③（规模最大）**：把 `/custom-services` + `/rfq` 的**询盘反向变成供应源**（买家问过的工厂 → 邀请入驻 → 走 `supplier_application`）。

### 10.3 抽检口径（数据质量验证，随机 10 家）

抽检 10 家后逐条断言：
- [ ] `source_url` 非空且**人工打开可见所填信息**
- [ ] `legal_name` / `country_code` / `industry_code` / `city` / `main_products` 非空
- [ ] `country_code` ∈ 5 国值域（无 `cn` / `unknown`）
- [ ] `is_published` 状态与预期一致
- [ ] 无个人联系方式字段有值
- [ ] `verification_level` = `unverified`
- [ ] `risk_score` = NULL

---

## 11. 下一步（需要你拍板的两点）

1. **渠道口径**：确认走 §10.2 的**路径 ①（先审 12 家 draft）** 还是 ②/③，或授权我**逐条人工核验并采集 30 家**（我按 ≤1 req/s 人工节奏做，产出含 `source_url` 的 CSV + 走 `suppliers-intake.mjs` 的 dry-run 报告）。
2. **`source_url` 是否要展示**：若要，需改 `lib/queries.ts` 的 `ROW_SELECT` + 页面渲染 + 重新部署（一个小改动）；若只是内部留痕，则**不需要任何代码改动**。
