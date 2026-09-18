# SEO / Indexation Audit — FactoryAuditB2B V2.1

> 扫描基准：`F:\AI-验厂SEO网站` 全量代码（Next 15.5 App Router + React 19 + TS strict + Tailwind v4 + Cloudflare Workers/OpenNext + Supabase）。
> 扫描日期：2026-09-17
> 范围：routes / metadata / generateMetadata / canonical / hreflang / robots / sitemap / noindex / redirect / rewrite / middleware / Supabase schema。
> 本文件是 V2.1 的**第一道闸门产出**（指令 §1：先扫描，不允许盲改）。后续改动必须对照本文件与 `docs/SEO-INDEXABILITY-POLICY.md`。

---

## 0. 执行摘要（先结论）

1. **SEO 基础层已成熟且合规**（CS-01 / CS-05b / CS-06a / CS-11 / CS-13 / CS-14 已落地）：canonical 单一事实源、9 语 + x-default hreflang、metadata 进 `<head>`、locale 301 去重、供应商可索引性闸门均已就位。**不需要重做，禁止盲改。**
2. **未发现 sitemap↔noindex 冲突。** 全站所有详情页（`guides/[slug]`、`case-studies/[slug]`、`field-reports/[slug]`、`chemicals/[slug]`、`countries/[slug]`、`industry/[slug]/[topic]`、`services/[slug]`）的 `noindex` **仅出现在「未找到」fallback 分支**；真实存在的页面都返回 `buildPageMetadata`（默认 `index:true, follow:true`）。sitemap 只提交真实/已配置页面。供应商档经 `determineSupplierIndexability` 闸门过滤后才进 sitemap。⇒ 不存在 Search Console「Submitted URL marked noindex」。
3. **真实风险只剩边缘项**：
   - **www ↔ non-www** 规范化：代码层（middleware / next.config）未处理，须在 Cloudflare 边缘确认 301 到 non-www。
   - **http ↔ https**：代码层未处理，须确认 Cloudflare 强制 HTTPS。
   - **trailing slash**：Next 默认 `trailingSlash:false`（`/x/`→308 `/x`），部署后实测确认。
4. **V2.1 新增面（审核/证据/报告/验真）当前完全不存在**：DB 无 `audits/evidence/findings/report` 任何表（仅 `supplier_consents` 已建，属 CS-16）。整套工作流是 net-new，须按 `docs/SEO-INDEXABILITY-POLICY.md` 默认 noindex 构建。

---

## 1. 当前可索引 URL 类型（index, follow）

| URL 类型 | 路由 | canonical 来源 | 进 sitemap | 内容 |
|---|---|---|---|---|
| Homepage | `/[locale]` (→ `/`) | `hreflang.ts:canonicalFor` | ✅ | 富 |
| Supplier Published（过闸门） | `/suppliers/[slug]` | `supplierSeo.generateSupplierCanonical` + 闸门 | ✅（仅达标档） | 富 |
| Industry 索引 / 详情 / 子主题 | `/industry`、`/industry/[slug]`、`/industry/[slug]/[topic]` | `buildPageMetadata` | ✅ | 富（子主题走 `industryContent`） |
| Country 索引 / 详情 | `/countries`、`/countries/[slug]` | `buildPageMetadata` | ✅ | 富（`coverage.ts` 国别内容） |
| Service 索引 / 静态 / 国别服务 | `/services`、`/services/inspection`、`/services/supplier-verification`、`/services/supplier-improvement`、`/services/[country]-[service]` | `buildPageMetadata` | ✅ | 富 |
| Tools 索引/工具页 | `/tools`、`/tools/*` | `buildPageMetadata` | ✅ | 中 |
| RFQ / Audit Request / Join / Membership / Pricing / Standard Report | 各页 | `buildPageMetadata` | ✅ | 中 |
| Guides / Case / Field 索引 / 详情 | 索引 + `[slug]` | `buildPageMetadata` | ✅ | 富（编辑内容） |
| Methodology / Trust / Training / Logistics / Custom / About / Resources / Privacy / Terms / Chemicals 索引 / Chemicals 详情 | 各页 | `buildPageMetadata` | ✅ | 中-富 |
| Audit Guide | `/audit-guide/[country]/[auditType]` | `buildPageMetadata` | ✅（仅覆盖国） | 富 |
| Verify / Report / Audit Console | **不存在** | — | — | V2.1 新增，待建（默认 noindex） |

---

## 2. 当前 noindex 来源（逐项核实 —— 全部为「未找到」fallback，非真实冲突）

统一模式（以 `countries/[slug]/page.tsx` 为例）：
```ts
const country = findCoverageCountry(slug);
if (!country) return buildPageMetadata({ ..., robots: { index: false } }); // 仅 fallback
return buildPageMetadata({ ... }); // 真实页 ⇒ 默认 index:true
```
| 页面 | noindex 位置 | 性质 |
|---|---|---|
| `guides/[slug]` | `:28`（仅 `if(!g)`） | fallback |
| `case-studies/[slug]` | `:30`（仅 `if(!c)`） | fallback |
| `field-reports/[slug]` | `:35`（仅 `if(!r)`） | fallback |
| `chemicals/[slug]` | `:36`（仅 `if(!chem)`） | fallback |
| `countries/[slug]` | `:36`（仅 `if(!country)`） | fallback |
| `industry/[slug]/[topic]` | `:49`（仅 `if(!topic)`） | fallback |
| `services/[slug]` | `:34`（仅 `if(!entry)`） | fallback |
| `/account`、`/login`、`/register`、`/admin/**`、`/checkout/[ref]`、`/order` | 显式 `index:false` | 有意私有（正确） |
| `/suppliers/[slug]/claim` | 显式 `index:false` | 表单薄页（正确） |
| 供应商未过闸门档 | `suppliers/[slug]/page.tsx:97,124` | 空壳页（正确，且不进 sitemap） |
| 供应商目录筛选态 `?country=&industry=&q=` | `suppliers/page.tsx:32` | `noindex`+canonical 回目录（正确） |

**结论**：所有 `noindex` 要么是「未找到 fallback」（页面根本不被 sitemap 提交，因为 sitemap 只列已配置 slug），要么是有意私有/空壳。无意外 noindex。

---

## 3. 当前 canonical 来源
- **单一事实源**：`i18n/hreflang.ts:canonicalFor(locale, path)`（英文无前缀、其余带前缀）。
- 页面层统一走 `lib/pageMeta.ts:buildPageMetadata`（注入 `alternates.canonical` + `openGraph.url`）。
- 供应商档走 `lib/seo/supplierSeo.ts:generateSupplierCanonical`（复用同一来源）。
- 根 layout 用 middleware 注入的 `x-pathname` 生成差异化 canonical（修复早期「16 页 canonical 全指向首页」）。
- **未发现** canonical 指向首页的回归。

## 4. 当前 sitemap 来源
- `app/sitemap.ts`：程序化，维度由 `lib/taxonomy` 驱动。
- 结构：`core`（硬编码核心页）+ `coverage`（国别/国别服务/guides/case/field）+ 程序化（audit-guide、suppliers 达标档、industry+子主题、chemicals）。
- **供应商达标档已与可索引性闸门同源**（`sitemap.ts:131` 调 `determineSupplierIndexability`），正确。
- **sitemap 仅提交真实存在的页面**（与页面 `generateStaticParams` 同源），无 noindex 页面泄漏。

## 5. 当前 hreflang 来源
- `i18n/hreflang.ts:hreflangFor`：9 语 + `x-default`（指向 en 无前缀）。每语仅一个代码（无 en-US/zh-Hans 别名重复，CS-01）。sitemap 每条带完整 hreflang 变体。
- **结论**：正确，无重复声明。

## 6. 当前重复 URL 来源（duplicate / canonical 风险）
| 来源 | 处理 | 状态 |
|---|---|---|
| `/en/*` 与 `/*` | middleware `301` 到无前缀（`middleware.ts:25-35`） | ✅ |
| `/country/[code]` → `/countries/[code]` | `permanentRedirect` 308 | ✅ |
| `/supplier/[country]/[slug]` → `/suppliers/[slug]` | 308 | ✅ |
| `/sample-report` → `/standard-report` | 308 | ✅ |
| `/knowledge` → `/services/supplier-improvement` | 308 | ✅ |
| `/inspectors` → `/resources` | 308 | ✅ |
| 供应商目录筛选 `?…` | `noindex` + canonical 回目录 | ✅ |
| **www vs non-www** | 未在代码处理 | ⚠️ 待 Cloudflare 边缘核实 |
| **http vs https** | 未在代码处理 | ⚠️ 待 Cloudflare 核实 |
| **trailing slash** | Next 默认 `trailingSlash:false`（`/x/`→`/x`） | ✅ 但部署后实测 |
| locale 间互相 | 各自 self-canonical + hreflang，非重复 | ✅ |

## 7. 当前 query 参数 URL
- 仅 `/suppliers` 消费 `country/industry/q`：`noindex` + canonical 回自身。无参数化索引页泄漏。

## 8. 当前动态页面
- 全部 `[locale]` + 动态段：`[slug]`（suppliers/services/guides/case/field/industry/chemicals/country）、`[country]/[slug]`（supplier）、`[slug]/[topic]`（industry）、`[country]/[auditType]`（audit-guide）。
- SSG 判定双口径已就位（`prerender-manifest` + 真实 `Cache-Control`）。

## 9. 当前异常页面
- 无 404/500 软着陆问题；重定向均 308/301 正确。无逻辑异常。

---

## 10. Search Console 风险映射（指令 A/B/C/D）

### A. 被「noindex」标记排除
- **未发现真实冲突。** 全站 `noindex` 均为 fallback（未提交 sitemap）或有意私有/空壳（本就不该进 sitemap）。无「Submitted URL marked noindex」的代码证据。
- 若 Search Console 仍报此类，根因应在**边缘层**（见 B：www/https 双地址导致 Google 抓到不同规范），而非源码。

### B. 重复网页，用户未选定规范网页
- 代码层 301/308 去重已覆盖主要来源。**唯一待核实**：www ↔ non-www 是否在 Cloudflare 正确 301 到 non-www。若未处理，会产生「同内容双地址无规范」⇒ 必须补边缘规则。

### C. 备用网页（有适当的规范标记）
- 9 语 hreflang 变体被 Google 标为「alternate with proper canonical」属**正常状态**（指令 §14）。非 bug，不修。

### D. 重复网页，Google 选择的规范网页与用户指定的不同
- 当前国别/行业/子主题页内容**差异充分**（COVERAGE_COUNTRIES 国别长文、`industryContent` 子主题），低风险。
- 潜在风险来自**未来**模板化复制页（指令 §8 九条）：须以内容差异为门槛，禁止把 China 替换国名生成越南页（已有 `coverage.ts` 注释纪律约束）。
- 若 SC 报此问题，优先查内容相似度 / 内链 / sitemap / hreflang / canonical 动态错误 / 内容过薄。

---

## 11. V2.1 新增面的索引策略（预先裁定，避免新增冲突）
| 新页面/路由 | 默认索引 | 理由（指令 §4/§40） |
|---|---|---|
| `/verify/report/[verificationId]` | **noindex**（私有报告）/ 按 `visibility` 决定 | 验真页≠必须进索引；防低质 SEO 页海 |
| `/audit`（买家审计列表） | noindex | 私有买家页 |
| `/auditor`（审核员工作台） | noindex | 内部工具 |
| `/admin/audit/**` | noindex | 后台 |
| `/audit/[id]/checklist`、`/evidence` | noindex | 内部审核流程 |
| 公开报告验真摘要 | 按 `report.visibility`（Public Verification ⇒ index；其余 noindex） | §40/§41 |

---

## 12. 立即可执行动作（本阶段交付）
1. **修正本审计早版误判**：初版曾怀疑 6 类详情页「noindex 却在 sitemap」，经逐文件核实确认其 `noindex` 仅限「未找到」fallback，真实页可索引，**无需改动 sitemap**。已更正。
2. **Indexability Policy 文档化**：落地 `docs/SEO-INDEXABILITY-POLICY.md`（Indexability Matrix）。
3. **边缘规范化核实（真风险）**：在 Cloudflare 确认 ① www → non-www 301；② http → https；③ 与 `htmlLimitedBots` 一致。此项不在应用代码层，须运维侧确认。
4. **V2.1 新页默认 noindex**：所有审核/报告/验真路由按 §11 默认 noindex，仅 `Public Verification` 摘要按 visibility 放开。
5. **自动 QA（后续）**：`scripts/check-indexability`（指令 §57）验证「sitemap URL ⊆ indexable ∧ self-canonical ∧ 200」。

## 13. 明确排除的盲改
- canonical/hreflang/metadata 基础层（已正确）。
- middleware 301/308 去重（已正确）。
- 供应商可索引性闸门（已正确）。
- 任何「把 noindex 页改成 index」的批量操作（无依据，且现有 noindex 均有正当理由）。
