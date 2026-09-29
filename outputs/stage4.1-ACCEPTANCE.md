# 第 4 批批 4.1 验收报告 —— guides 9 语 desc 补全（前 10 篇）

- 执行时间：2026-09-29
- 范围：`lib/guides.ts` 47 篇指南中的**前 10 篇**，补 ja / es / de / fr / pt / ar 六语 `metaDesc`
- 写入位置：**方案 A**（`Guide` 接口新增 6 个可选字段，逐条追加到 `lib/guides.ts`）
- 部署版本：`1fdee516-d3eb-41d6-abe5-92356734aa4a`
- 回滚锚点（上一线上版本）：`cbf4f598-cdc6-4933-87e4-5b8db1b65b9e`（stage1.7.1）

---

## 1. 三处微调的前后对比

| # | slug / 语种 | 修前 len | 修后 len | 预算 | 说明 |
|---|---|---|---|---|---|
| 1 | `how-to-verify-a-chinese-supplier` / **de** | **157** | **142** | 158 | 压到 ≤150。把尾句 `…, prüfen Sie den Kreditcode und bestätigen Sie den Standort.` 收为 `…, prüfen Sie den Kreditcode und den Standort.`（去掉了与首句重复的 `prüfen Sie` 语义冗余，信息量不变） |
| 2 | `on-site-vs-desk-audit` / **ja** | **53** | **68** | 90 | 补到 60–70。新增 `コスト、確度、対象範囲の違いと、それぞれの使いどころ` 三个对比维度 |
| 3 | `pre-shipment-inspection-checklist` / **ja** | **52** | **63** | 90 | 补到 60–70。在既有六项检查项后追加 `に加え、サンプルと記録の確認項目も` |

**逐字对照**

| # | 修前 | 修后 |
|---|---|---|
| 1 | So prüfen Sie einen chinesischen Lieferanten Schritt für Schritt. Gleichen Sie den Firmennamen ab, prüfen Sie den Kreditcode und **bestätigen Sie** den Standort. | So prüfen Sie einen chinesischen Lieferanten Schritt für Schritt. Gleichen Sie den Firmennamen ab, prüfen Sie den Kreditcode und den Standort. |
| 2 | 現地監査とデスク監査の違いを解説します。**それぞれの使いどころと、安全な調達のための**組み合わせ方を示します。 | 現地監査とデスク監査の違いを解説します。**コスト、確度、対象範囲の違いと、それぞれの使いどころ、安全な調達に向けた**組み合わせ方を示します。 |
| 3 | 出荷前検査のチェックリストを解説します。数量、作り、機能、包装、ラベル、積み込み**の確認項目をまとめます**。 | 出荷前検査のチェックリストを解説します。数量、作り、機能、包装、ラベル、積み込み**に加え、サンプルと記録の確認項目もまとめます**。 |

> ⚠️ **需你裁决的一点（见 §7 风险 1）**：本批 ja 共 10 条中，除你指定的 2 条外，**还有 4 条在 50–59**（`how-to-read-a-factory-audit-report` 50、`factory-audit-checklist` 56、`how-to-audit-a-factory-in-vietnam` 56、`smeta-…`/`what-is-…`/`supplier-evaluation-…` 59）。批 4.1 方案里这 10 条长度已全部公示，你只指定 2 条微调 ⇒ 我按「其余直接采用」执行，未擅自改动。

---

## 2. 60 条 desc 的合规校验结果

**三层校验，全部通过：**

**① 写入脚本写前自检（镜像 `lib/pageMeta.ts` 口径）** → 「共 60 条，不合规 0」

**② 真实收口函数幂等断言**（`scripts/_g4_verify.ts`，跑真实 `metaDescriptionBudget` + `trimMetaDescription`）：

```
补齐字段 60 条（期望 60）｜FAIL 0
阴性对照：超预算串被收口改写 = true（必须为 true）
=> ALL CLEAN
```

> 阴性对照证明该断言**非恒真**：喂一条必然超预算的串，收口函数确实改写了它。
> 幂等的意义：`pickGuideDesc` 的返回值会经 `buildPageMetadata` → `trimMetaDescription`；
> 若某条超预算，收口函数会重写它 ⇒「线上/预渲染 HTML 里的 desc」≠「我写的 desc」，
> 所有逐字断言都会失真。`trim(raw) === raw` 是这一步的硬门槛。

**③ 全量分布**（90 页预渲染 HTML 实测长度；`en` = 未改动的既有值）

| slug | en | zh | zh-TW | ja | es | de | fr | pt | ar |
|---|---|---|---|---|---|---|---|---|---|
| how-to-verify-a-chinese-supplier | 127 | 59 | 60 | 64 | 136 | 142 | 138 | 133 | 108 |
| factory-audit-checklist | 140 | 51 | 51 | 56 | 146 | 133 | 143 | 142 | 101 |
| supplier-risk-assessment-guide | 126 | 56 | 56 | 60 | 145 | 144 | 141 | 138 | 103 |
| smeta-vs-bsci-social-audit-comparison | 127 | 56 | 56 | 59 | 128 | 126 | 130 | 126 | 111 |
| how-to-read-a-factory-audit-report | 123 | 49 | 49 | 50 | 136 | 145 | 133 | 135 | 101 |
| how-to-audit-a-factory-in-vietnam | 129 | 50 | 50 | 56 | 136 | 136 | 122 | 122 | 98 |
| pre-shipment-inspection-checklist | 128 | 50 | 50 | 63 | 133 | 132 | 136 | 135 | 92 |
| what-is-a-factory-audit | 126 | 65 | 65 | 59 | 132 | 121 | 136 | 139 | 107 |
| supplier-evaluation-checklist | 139 | 53 | 53 | 59 | 131 | 139 | 134 | 134 | 105 |
| on-site-vs-desk-audit | 125 | 38 | 38 | 68 | 130 | 143 | 119 | 131 | 91 |

- 60 条**全部落在预算内**：ja ≤ 90（实际 50–68）、es/de/fr/pt/ar ≤ 158（实际 91–146）
- 60 条**全部句末标点收尾**、**全部双句**（≥2 个句末标点）、**无破折号**
- 预算判定依据：`ja` CJK 占比 0.94 ⇒ 预算 90；`ar`/`es`/`de`/`fr`/`pt` CJK 占比 0 ⇒ 预算 158（用真实 `isCjkDominant` 判定，非估计）

---

## 3. `pickGuideDesc` 替换的调用点清单

新建 `lib/pickGuideDesc.ts`（**唯一取值入口**）。为什么不写进 `lib/guides.ts`：该文件是**纯数据文件（全文件零 import）**，把取值逻辑塞进去会让 9000+ 行数据文件依赖 `lib/tw.ts` 与 `i18n/config`。

**共 5 处调用点，全部替换（无残留）：**

| # | 文件 | 位置 | 作用 |
|---|---|---|---|
| 1 | `app/[locale]/guides/[slug]/page.tsx` | `generateMetadata` → `description` | 页面 `<meta name="description">` |
| 2 | `app/[locale]/guides/[slug]/page.tsx` | JSON-LD `Article.description` | 结构化数据 |
| 3 | `app/[locale]/guides/page.tsx` | 指南索引卡片 | 列表摘要 |
| 4 | `app/[locale]/guides/category/[category]/page.tsx` | 分类页卡片 | 列表摘要 |
| 5 | `app/[locale]/page.tsx` | 首页 FEATURED GUIDES 卡片 | 首页摘要（保留 `.slice(0,120)`） |

> 第 5 处是任务书未列出的**第 5 个调用点**，由全仓 grep 发现并一并替换（否则首页仍渲染英文摘要）。

**未改动（有意）**：`lib/tw.ts`（zh-TW 繁化逻辑）、`g.titleEn/titleZh` 系列（标题不在本批范围）、`app/[locale]/resources/page.tsx`（只渲染标题、无 desc）、`app/llms.txt/route.ts`（用 `en.quickAnswer`，非 desc）、`app/sitemap.ts`（只输出 loc）。`lib/caseStudies.ts` / `lib/fieldReports.ts` 是**另外两条数据轴**，不在本批范围。

```ts
export function pickGuideDesc(locale: Locale, g: Guide): string {
  switch (locale) {
    case "zh": return g.metaDescZh;
    case "zh-TW": return twText(g.metaDescZh);
    case "ja": return g.metaDescJa ?? g.metaDescEn;
    // … es / de / fr / pt / ar 同构
    default: return g.metaDescEn;
  }
}
```

**关键性质**：6 个新字段**全部可选**且缺失即回退 `metaDescEn` ⇒ 未补齐的语种行为与补齐前**逐字一致**。因此函数可先行上线，后续批次逐批填值即可。

---

## 4. 构建链路结果（七步手动，全绿）

| 步 | 命令 | 结果 |
|---|---|---|
| ① | `next build` | **EXIT=0**（2m12s）；`/suppliers/*.html = 81` ✓、`/guides/*.html = 423`（9×47）✓、`fetch failed = 0`、`suppliers query failed = 0` |
| ② | `opennext build` | **EXIT=0**（2m57s） |
| ③ | `populate-static-assets-cache.cjs --worker --batch 250` 循环 | **8 批 → DONE** |
| ④ | `populate-static-assets-cache.cjs --check` | **OK**：页面缓存 2057、fetch 缓存 104、非预期路径 **0**、非 `.cache` 结尾 **0**、源/目标 2161/2161 |
| ⑤ | `scrub-next-env.mjs` | **EXIT=0**（清空 21 处密钥明文：production 7 / development 7 / test 7） |
| ⑥ | `verify-opennext-bundle.mjs` | **ALL PASS**：密钥自检 6 项干净、**产物内 en 字典叶子数 = 3126（期望 3126）** ✓、页面缓存 2057/2057、fetch 104/104、assets 2347 ≤ 20000、单文件 2.35 MiB ≤ 25 MiB |
| ⑦ | `wrangler deploy`（`OPEN_NEXT_DEPLOY=true` + `--env-file=.env`） | **EXIT=0**（上传 2160 文件 / 52s） |

- 全程 `NODE_OPTIONS="--require …/with-proxy.cjs"` + 显式 `FAB2B_PROXY=http://127.0.0.1:7897`（劫持的 `HTTPS_PROXY=:5701` 被正确忽略）
- 构建前把 `.next` / `.open-next` 改名隔离为根级 `_prune_*`（规避 safe-delete 护栏：`.next` 15767 files / `.open-next` 6182 files）
- 冷编译（webpack 缓存随 `.next` 一起被隔离）实际耗时仅 2m12s，未触发 >16min 的极端情况

**类型检查**：`tsc --noEmit` → **EXIT=0**

---

## 5. 部署版本 ID + 回滚锚点

| 项 | 值 |
|---|---|
| **本次部署版本** | `1fdee516-d3eb-41d6-abe5-92356734aa4a` |
| **回滚锚点** | `cbf4f598-cdc6-4933-87e4-5b8db1b65b9e`（stage1.7.1） |
| 部署后传播窗口 | 轮询 `/ja/guides/factory-audit-checklist` 的日文标记 + `x-opennext-cache: HIT` ⇒ **try1 即命中**（未出现 D3 式「探测到上一版」） |

---

## 6. 十项验收逐条结果

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 60 条 desc 全部落在预算内（ja ≤90 / 拉丁 ≤158 / ar ≤158） | ✅ | 全量分布：ja 50–68、拉丁 91–146；写前自检 0 不合规 |
| 2 | 全部句末标点收尾 | ✅ | `trimMetaDescription` 零命中 ⇒ 每条都以句末标点结束 |
| 3 | `pickGuideDesc` 替换所有调用点 | ✅ | 5/5 替换；全仓 grep 无残留 `pickZhPair(locale, g.metaDesc…)` |
| 4 | `tsc --noEmit` EXIT=0 | ✅ | EXIT=0 |
| 5 | 构建链路 ①–⑦ 全绿 | ✅ | 见 §4 |
| 6 | en 字典叶子数 = 3126 | ✅ | ⑥ verify：`产物内 en 字典叶子数 = 3126 (期望 3126)`；**未动 `en.json` 一个字节** |
| 7 | 构建后 `/suppliers/*.html = 81` | ✅ | 81 |
| 8 | 90 个预渲染 HTML 语种正确 | ✅ | `_g4_html_probe.mjs`：**检查 90 页｜异常 0 ⇒ ALL CLEAN**（见下） |
| 9 | 部署后 4 页线上验证 PASS | ✅ | `live-meta-verify.cjs` 4 页 **ALL PASS**，`x-opennext-cache=HIT` |
| 10 | 回归无新增失败 | ✅ | 22 脚本，6 项 FAIL **全部既存** |

**验收 8 的双向证据链**（`scripts/_g4_html_probe.mjs`）：

- **en / zh / zh-TW（30 页）**：与**改名前的旧构建**逐字相同 ⇒ 证明「不改既有 EN/ZH 文案」（约束 1）真的成立
- **ja / es / de / fr / pt / ar（60 页）**：与 `lib/guides.ts` 源码字段**逐字相同**，且 **≠ 旧构建**（旧构建里这 60 页显示的是英文回退值）⇒ 证明「不再回退英文」

**验收 9 线上实测节选**：

| URL | desc 长度 | desc（前若干字） | 结果 |
|---|---|---|---|
| `/guides/factory-audit-checklist` | 140 | A factory audit checklist covering documentation and production control… | PASS |
| `/ja/guides/factory-audit-checklist` | 56 | 工場監査チェックリストの項目を解説します。品質、生産管理… | PASS |
| `/de/guides/factory-audit-checklist` | 133 | Eine Checkliste für die Werksauditierung. Sie deckt Qualität… | PASS |
| `/ar/guides/factory-audit-checklist` | 101 | قائمة تحقق لتدقيق المصنع. تشمل الجودة وضبط الإنتاج… | PASS |

4 页均同时 PASS：canonical 自指、hreflang 9 语(BCP-47)+x-default、JSON-LD 2/2 可 parse、**title 与 desc 均与本地预渲染逐字一致**。

**验收 10 的既有失败清单（与本改动无关，已逐条核对身份）**：

| 脚本 | FAIL | 性质 |
|---|---|---|
| cs02d | G2、H | 既有（`lib/leads` 已被 5 个路由 import，断言仍写 3） |
| cs11 | C8 | 既有（生成器默认不含 ADMIN PREVIEW 框） |
| cs13 | F2d | 既有（`supabase/migrations` 13 个 .sql ≠ 断言 10） |
| cs14 | A1 | 既有（全库供应商 21 ≠ 断言 10，DB 漂移） |
| cs22b | G1 | 既有（`supplier_assessments` 实际 206/10） |

cs03 是只读数据探针（`{found:false}`，exit 0，非 PASS/FAIL 型）。⇒ **净修复 0 项、零新增失败**（与本批「只加数据字段」的性质一致）。

---

## 7. 风险和未解决问题

1. **ja 有 4–6 条低于 60（50–59）** —— 你为同一批的 2 条设了 60–70 的目标，意味着 <60 在你看来偏短。批 4.1 方案已公示全部 10 条 ja 长度，你只指定 2 条微调，故我未擅自改动其余。**建议在批 4.2 开工前给一句口径**：是否把「ja ≥60」定为硬门槛并回补本批 4 条？我可在 10 分钟内完成。
2. **`title` 未本地化**：`/ja|/de|/ar/guides/*` 的 `<title>` 仍是英文（`FactoryAuditChecklist: What Auditors Actually Check | FactoryAuditB2B`）。本批范围只有 desc；标题 9 语化是另一项工作（涉及 `metaTitleEn/Zh` 双字段扩到 6 语 + 品牌段保留逻辑）。
3. **282 页缺口已消 60 页**：剩余 **37 篇 × 6 语 = 222 页**仍回退英文（批 4.2–4.5）。回退行为是**设计内的**（字段可选 + `?? metaDescEn`），不会渲染空描述。
4. **`lib/guides.ts.bak` 已删除**（`scripts/translate-guides-batch4.cjs` 的写入前备份，649 KB；部署与线上验收通过后清理）。注意 `.gitignore` 只忽略 `.env.*.bak`，**不覆盖 `lib/*.bak`** ⇒ 该脚本每次运行都会在 `lib/` 留下一个未跟踪文件，若你希望长期保留备份请把 `lib/*.bak` 加进 `.gitignore`。
5. **`outputs/stage1.7.1-ACCEPTANCE.md` 显示为 modified（+97/-95，非纯空白差 12/10）**：mtime 19:05:44（上一轮写报告的时间），本会话未触碰。差异形态是 Markdown 表格管道对齐 + `\*\*` 转义（典型 prettier 痕迹），但本仓**无 prettier 依赖 / 无配置 / 无 husky / 无 lint-staged**，成因未明。**已按「不动未解释的改动」处理：不 stage、不提交、不回滚**（`git checkout --` 是明令禁止的）。建议你下次留意是否有编辑器保存钩子。
6. **`scripts/translate-guides-batch4.cjs` 修过两次自身 bug**（已固化为防御）：
   - **幂等检测漏 `m` 标志** ⇒ `/^\s+metaDescJa:/` 只锚定整串开头、永远为假 ⇒ 复跑会重复插入 120 行（重复键 ⇒ TS 编译错误）。已修复，且「读回校验」在发现不一致时会**自动从备份还原**。
   - **反演校验用错坐标**：插入是倒序做的，摘除必须**升序 + 索引恒为 `after+1`**（更小的块先被摘掉，坐标即回到原文坐标系）。已修复并加注释说明为何严格互逆。
7. **CF Free CPU 10ms/req 配额** 仍是线上 5xx 的主要外部风险（须账号持有人处理：升 Workers Paid 或加 Cache Rule），与本批无关。
8. **`_prune_*` 隔离目录已累积 9 个**（本批新增 2 个：`_prune_next_20260929191756` / `_prune_opennext_20260929191756`）。按 RELEASE-RULES 规则 2 留待维护窗口统一清理（删除计入 50/回合 safe-delete 护栏）。
9. **建议把本次的 `scripts/_g4_verify.ts` 提为常驻回归**：它是「真实收口函数幂等 + 阴性对照」的通用闸门，对本项目**所有** desc 源头（guides / caseStudies / fieldReports / chemicals / suppliers）都适用。批 4.2–4.5 会再加 222 条 desc，届时若有常驻闸门可一次性拦住「超预算 ⇒ 被收口函数重写 ⇒ 逐字断言失真」这类事故。本次按最小改动原则**只作一次性探针（`_` 前缀，不入库）**，未擅自增改回归套件。

---

## 附：改动文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `lib/guides.ts` | 改 | 接口 +6 可选字段；10 篇各追加 6 语 desc（+120 行）；1 处陈旧注释更新（-6/+7） |
| `lib/pickGuideDesc.ts` | 新增 | 唯一取值入口 |
| `app/[locale]/guides/[slug]/page.tsx` | 改 | +import；2 处 desc 调用替换 |
| `app/[locale]/guides/page.tsx` | 改 | +import；1 处替换 |
| `app/[locale]/guides/category/[category]/page.tsx` | 改 | +import；1 处替换 |
| `app/[locale]/page.tsx` | 改 | +import；1 处替换（首页卡片） |
| `scripts/translate-guides-batch4.cjs` | 新增 | 幂等写入器（内联 60 条 + 写前自检 + 备份 + 反演 + 读回校验） |
| `outputs/stage4.1-ACCEPTANCE.md` | 新增 | 本报告 |

**数据侧铁证**：`lib/guides.ts` 的 `git diff --numstat` = **+138 / -6**，其中 **6 行删除全部是注释**（已逐行核对），6 个新字段各恰好出现 **10 次**（无重复键）。
