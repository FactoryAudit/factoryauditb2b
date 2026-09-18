# Indexability Policy — FactoryAuditB2B

> 配套 `docs/SEO-INDEXABILITY-AUDIT.md`。本文件是索引策略的**单一事实源**（指令 §3/§5）。
> 任何新页面上线前，必须先在下面矩阵中找到自己的类型并套用规则；sitemap 生成器与 `generateMetadata` 必须同源。

## 0. 铁律
1. **不是所有 Noindex 都是问题。** 有意 noindex（私有/薄/筛选/后台）是正确策略，禁止误修。
2. **sitemap 只输出「真正希望 Google 索引的 canonical URL」。**
   严禁纳入：noindex / redirect / duplicate / parameter / admin / private / draft / unpublished / buyer-only / internal-audit URL。
3. **canonical 必须 self-canonical**（各语言版本 canonical 到自身），并用 hreflang 建立语言关系；禁止把语言版本当重复页处理。
4. **可索引性闸门与 sitemap 同源**：一条 URL 要么「index + 进 sitemap」，要么「noindex + 不进 sitemap」。禁止漂移（SC「Submitted URL marked noindex」）。
5. **供应商档案「宁可 noindex，也不生成空壳页」**：未过 `determineSupplierIndexability` 闸门者 noindex，且不进 sitemap（已有实现，禁止退化）。

## 1. Indexability Matrix

| URL Type | Index | Canonical | Sitemap | Reason |
|---|---|---|---|---|
| Homepage | Yes | Self | Yes | Core |
| Supplier Published（过闸门） | Yes | Self | Yes | Core |
| Supplier Draft / 未过闸门 | No | — | No | Incomplete / 空壳 |
| Industry 索引 | Yes | Self | Yes | SEO |
| Industry 详情（富内容后） | Yes* | Self | Yes* | SEO；当前薄内容→noindex+不出 |
| Country 索引 | Yes | Self | Yes | SEO |
| Country 详情（富内容后） | Yes* | Self | Yes* | SEO；当前薄内容→noindex+不出 |
| Service 索引 | Yes | Self | Yes | SEO |
| Service 静态页 | Yes | Self | Yes | SEO |
| Service 动态 `[slug]` | No | — | No | 薄/未配置 |
| Tools 索引/工具页 | Yes | Self | Yes | SEO 工具 |
| RFQ | Yes | Self | Yes | 商业入口 |
| Factory Audit Request | Yes | Self | Yes | 服务入口 |
| Join / Membership / Pricing | Yes | Self | Yes | 转化页 |
| Standard Report | Yes | Self | Yes | 样本/信任 |
| Guides / Case / Field 索引 | Yes | Self | Yes | 核心内容 |
| Guides / Case / Field 详情 | No† | — | No† | 当前 noindex；富内容化后重评 |
| Methodology / Trust / Training / Logistics / Custom / About / Resources | Yes | Self | Yes | 内容/信任 |
| Privacy / Terms | Yes | Self | Yes | 法律页 |
| Chemicals 索引 | Yes | Self | Yes | SEO |
| Chemicals 详情 | No | — | No | 试点薄页 |
| Audit Guide `[country]/[auditType]` | Yes | Self | Yes | 覆盖国 SEO |
| Internal Search（`?country=` 等） | No | Parent | No | Search utility |
| Filter / Sort / Pagination 变体 | No | Parent | No | Duplicate |
| Admin / Login / Account / Register | No | — | No | Private |
| Audit 内部（checklist/evidence/findings） | No | — | No | Private |
| Auditor Console / Buyer Audit List | No | — | No | Private |
| Private Report（Buyer/Supplier/Admin only） | No | — | No | Private |
| Public Report Verification | Depends‡ | Self | Depends‡ | 按 `visibility` |
| Preview / Test / Draft | No | — | No | Temporary |

`*` 富内容化达标（指令 §11/§12：真实 supplier count / industry count / 示例 / 服务 / RFQ 等差异化内容）后改为 Yes 并纳入 sitemap。
`†` 当前 noindex 且不出 sitemap；若后续补充真实差异化内容，按「达标才提交」重新纳入。
`‡` `visibility = Public Verification` ⇒ index（仅公开字段）；其余 noindex（指令 §40/§41）。

## 2. 供应商索引条件（已有实现，禁止退化）
```
published = true
AND company name exists
AND country exists
AND city exists
AND meaningful product/capability exists
AND description exists
AND not suspended
```
不满足 ⇒ `noindex` + 不进 sitemap。

## 3. 防空壳（指令 §10）
禁止批量生成「Shenzhen Supplier / China Supplier 2」类薄页。每个 supplier 页须含真实：Company / Location / Supplier Type / Products / Capabilities / Description / Source / Contact。

## 4. Sitemap 自动 QA（指令 §6/§57）
每次 build/CI 对 sitemap 每条 URL 校验：
```
status === 200
indexable === true
canonical === self
not redirected
not noindex
```
失败 ⇒ build/CI 警告或失败。

## 5. 重复/规范处理（指令 §7/§8）
- 同内容双 URL ⇒ 优先 301 到主 URL，或 self-canonical；禁止保留大量相同内容 URL。
- 语言版本：self-canonical + hreflang，不当 duplicate。
- Google 仍选其他 canonical ⇒ 查内容相似度 / 内链 / sitemap / hreflang / canonical 动态错误 / 内容过薄（§8 九条）。

## 6. V2.1 新增面默认策略（预先裁定）
- `/verify/report/[id]`：默认 noindex（私有报告）；`visibility=Public Verification` 时 index 仅公开字段。
- `/audit`、`/auditor`、`/admin/audit/**`、checklist/evidence/findings 页：一律 noindex。
- 公开验真摘要按 `report.visibility` 决定 index/noindex（§40/§41）。
- 严禁写「Google Verified / Verified by Google」或暗示 Google 背书（§39）。
