# 批 4.2 验收报告（guides 9 语补全：ja 回补 6 条 + #11–20 的 60 条）

- **部署版本**：`672d465e-727c-479b-aae2-d2773063a8c2`
- **回滚锚点**：`1fdee516-d3eb-41d6-abe5-92356734aa4a`（批 4.1）
- **代码改动**：`lib/guides.ts`（+126 / −6）、`.gitignore`（+3）、`scripts/g4-desc-idempotency-regression.ts`（新增）、`scripts/translate-guides-batch42.cjs`（新增）、`scripts/suppliers-intake.mjs`（新增，内容侧）、`data/suppliers-intake.example.json`（新增）
- **证据文件**：`outputs/_g42_build1.log`、`_g42_build2.log`、`_g42_deploy.log`、`_g42_liveverify.log`、`_g42_regression.log`

---

## ① 微调与补足前后对比

### 1.1 批 4.1 ja 回补 6 条（替换，实测全部落在 60–90）

| slug | 修前 | 修后 | 预算 |
|---|---|---|---|
| how-to-read-a-factory-audit-report | 62 | **65** | 90 |
| factory-audit-checklist | 60 | **64** | 90 |
| how-to-audit-a-factory-in-vietnam | 63 | **67** | 90 |
| smeta-vs-bsci-social-audit-comparison | 60 | **66** | 90 |
| what-is-a-factory-audit | 62 | **66** | 90 |
| supplier-evaluation-checklist | 63 | **66** | 90 |

> 你给的 6 条估字为 63/66/70/67/66/68，实测 65/64/67/66/66/66 —— 全部 ∈ [60, 90]，**零改动直接落盘**。

### 1.2 批 4.2 原稿的 16 条补足（**这是本次唯一需要你留意的一节**）

你的 60 条原稿**硬约束（≤预算 / 句末标点 / 无破折号）全部通过**，但有 16 条**低于你设定的下限**（ja 6 条 <60；其他 10 条 <120）。按你「确保落在区间内」的指示，我做**最小改动补足**（只追加同类信息：判据 / 边界 / 后续步骤；不改语义、不加营销词、保持原句式与风格）。

**ja 6 条（<60 → 62–69）**

| slug | 原稿 | 补足后 | 改动 |
|---|---|---|---|
| capacity-audit-guide | 59 | **67** | 尾句「…数量を見極めます」→「…数量**と発注前の確認点**を見極めます」 |
| aql-sampling-standard-fri | 56 | **62** | 「ロット合格の判定**基準**を示します」→「ロット合格の判定**と不合格時の対応**を示します」 |
| full-inspection-100-percent | 58 | **69** | 「導入すべきケースを示します」→「導入すべきケース**と費用対効果の判断基準**を示します」 |
| failed-inspection-dispute | 53 | **67** | 「交渉材料を示します」→「交渉材料**と、期限内に決着させる進め方**を示します」 |
| sa8000-certification-guide | 56 | **66** | 「更新の要件を示します」→「更新の要件、**審査で問われる記録**を示します」 |
| esg-supplier-audit-guide | 59 | **67** | 「準備を示します」→「準備、**求められる証拠**を示します」 |

**其他 10 条（<120 → 121–138）**

| slug | 语种 | 原稿 | 补足后 |
|---|---|---|---|
| third-party-audit-pain-points | ar | 115 | **138** |
| aql-sampling-standard-fri | ar | 93 | **128** |
| ppi-vs-dupro-inspection | ar | 113 | **132** |
| full-inspection-100-percent | ar | 101 | **125** |
| full-inspection-100-percent | de | 113 | **133** |
| full-inspection-100-percent | pt | 110 | **129** |
| fba-rejection-inspection | ar | 92 | **130** |
| failed-inspection-dispute | ar | 91 | **123** |
| sa8000-certification-guide | ar | 91 | **132** |
| esg-supplier-audit-guide | ar | 102 | **134** |

> **可一键回退**：原稿完整保存在 `scripts/_g42_data.cjs`，补足版在 `scripts/_g42_patch.cjs`（均为一次性探针，未入库）。若你更信任原稿，说一句即可按原稿重写。
>
> **口径说明**：`ar` 天然字符更少（批 4.1 的 ar 实测 91–111 你已接受）。本次为对齐你新给的「其他 120–158」，我把 8 条 ar 一并补足；若你认为 ar 不应受 120 下限约束，同样可以回退这 8 条。

---

## ② 66 条 desc 的合规校验（三层，全绿）

| 层级 | 手段 | 结果 |
|---|---|---|
| L1 写前自检 | `translate-guides-batch42.cjs`（镜像 `lib/pageMeta.ts` 预算口径 + 下限 + 句末 + 破折号 + 悬空尾标点） | 66 条 **不合规 0** |
| L2 真实收口函数 | `g4-desc-idempotency-regression.ts`（跑真 `metaDescriptionBudget` + `trimMetaDescription`） | **120/120 零命中**，阴性对照 = true |
| L3 预渲染 HTML | 实测 `.next/server/app/**` 抽 meta description | **144 页全绿**、全部 ≤ 预算、全部句末标点 |

**写入器自身修了 2 个 bug（均已固化进脚本）**：
1. `aql-sampling-standard-fri` 的 `metaDescZh` 是**内联单行**（`metaDescZh: "…",`）而其余是多行 —— 原按多行取值导致误报「值行不符合预期」。已改为 `valueLineOf()` 同时支持内联/多行两种写法，且替换时**保持原行格式**（否则会丢 key）。
2. 反演校验必须**升序摘除**（插入是倒序执行的严格逆运算）；替换项反演需还原为**原始行原文**（`oldLine`）而非重建。

---

## ③ 调用点与新增工具

- **调用点**：本次**无新增替换点** —— `pickGuideDesc` 的 5 处替换在批 4.1 已完成（`guides/[slug]` metadata + JSON-LD、`guides`、`guides/category/[category]`、首页卡片）。本批只补数据，取值链路不变。
- **新增常驻回归**：`scripts/g4-desc-idempotency-regression.ts`（`EXPECTED = 120`）。`run-regression.mjs` 无显式清单（按脚本名解析），故**无需登记**，已加入本批全量回归批处理命令。
- **新增写入器**：`scripts/translate-guides-batch42.cjs`（内联 66 条数据 + 备份 + 写前自检 + 反演「只新增 / 只改 6 行」+ 读回校验失败自动还原 + 幂等）。
- **`.gitignore`**：新增 `lib/*.bak`（第 24 行），验证 `git check-ignore -v lib/guides.ts.bak` → `.gitignore:24:lib/*.bak` ✅

**幂等实证**：连跑两次，第二次输出「替换 6/6 条已是新值、新增 10/10 篇已存在，无事可做」；`git diff --numstat` = **+126 / −6**，6 条删除行**逐条对应 6 条 ja 旧值行**，零附带改动。

---

## ④ 构建链路（七步手动，全绿）

| 步 | 命令 | 结果 |
|---|---|---|
| ① | `next build` | EXIT=0（2m6s）**`/suppliers/*.html = 81`、`/guides/*.html = 423`、fetch failed = 0、query failed = 0** |
| ② | `opennext build` | EXIT=0（3m13s） |
| ③ | populate 循环 `--worker --batch 250` | 8 批至 **DONE** |
| ④ | populate `--check` | **OK**（页面缓存 2057 / fetch 104 / 非预期路径 0 / 非 `.cache` 0 / 2161=2161） |
| ⑤ | `scrub-next-env.mjs` | EXIT=0（清空 21 处密钥明文，自检通过） |
| ⑥ | `verify-opennext-bundle.mjs` | **ALL PASS**（密钥 6 项干净、**en 叶子数 3126**、页面缓存 2057/2057、assets 2347 ≤ 20000、单文件 2.35 MiB ≤ 25 MiB） |
| ⑦ | `wrangler deploy`（`OPEN_NEXT_DEPLOY=true`） | EXIT=0（上传 2160 文件 / 187 已存在） |

前置：`.next`(15767 f) / `.open-next`(6182 f) 改名隔离为根级 `_prune_next_20260929194039` / `_prune_opennext_20260929194039`（规避 safe-delete 护栏，同时留作对照基线）。

---

## ⑤ 部署版本 + 回滚锚点

- **本次**：`672d465e-727c-479b-aae2-d2773063a8c2`
- **回滚**：`1fdee516-d3eb-41d6-abe5-92356734aa4a`（批 4.1）
- **传播窗口已固化**：探测 `/ja/guides/third-party-audit-pain-points`（批 4.2 独有标记「第三者監査でよくある問題点を整理します」）→ **try1 即 `x-opennext-cache: HIT` + marker=1**，未出现 D3 式假 FAIL。

---

## ⑥ 12 项验收逐条

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | ja 回补 6 条落盘 | ✅ | 65/64/67/66/66/66 ∈ [60,90] |
| 2 | 新增 60 条落盘 | ✅ | 10 篇 × 6 语 = 60 字段；git diff +120 行 |
| 3 | 66 条全部落在目标区间 | ✅ | ja 60–69 / 拉丁·ar 121–147；**越界 0** |
| 4 | 全部句末标点收尾 | ✅ | L1+L2+L3 三层均断言 |
| 5 | 无破折号 | ✅ | 三层均断言 |
| 6 | 幂等（收口零命中） | ✅ | `g4-desc-idempotency-regression` 120/120 ALL CLEAN + 阴性对照 true |
| 7 | 反演「只新增 + 只改 6 行」 | ✅ | 「新增 120 行 + 替换 6 行，其余逐行未变」；diff −6 行逐条对应 |
| 8 | `.gitignore` 含 `lib/*.bak` | ✅ | `check-ignore` 命中 `.gitignore:24` |
| 9 | 常驻回归可用 | ✅ | `run-regression.mjs g4-desc-idempotency-regression G4_ROOT` → ALL CLEAN |
| 10 | `tsc --noEmit` EXIT=0 | ✅ | 47s |
| 11 | 构建链路七步 + 三数断言 | ✅ | 81 / 423 / **3126** |
| 12 | 本地 + 线上 + 回归 | ✅ | 本地 144 页 ALL CLEAN；线上 7 页 **ALL PASS**；回归 23 脚本**零新增失败** |

**本地 144 页明细**：批 4.2 十篇 × 9 语 = 90 页（en/zh/zh-TW 与旧构建逐字相同；6 新语种 == 源码且 ≠ 旧值）+ ja 回补 6 篇 × 9 语 = 54 页（ja == 新值且 ≠ 旧值；其余 8 语与旧构建逐字相同）。

**线上 7 页**（`live-meta-verify.cjs`，`MSYS_NO_PATHCONV=1`）：`/guides/factory-audit-checklist`、`/ja|/de|/ar/guides/factory-audit-checklist`、`/ja|/de|/ar/guides/third-party-audit-pain-points` → canonical 自指、hreflang 10 条、JSON-LD 可解析、**title/desc 与本地预渲染逐字一致**。

**回归 23 脚本**：6 项 FAIL **全部为既有失败**（cs02d 2 / cs11 `C8` 1 / cs13 `F2d` 1 / cs14 `A1` 1 / cs22b `G` 1），cs03 为只读数据探针（非 PASS/FAIL 型）⇒ **净新增 0**。

---

## ⑦ 风险与未解决

1. **16 条补足需你确认口径**（见 ①1.2）。原稿与补足版都在，可一键回退；特别请你定：**ar 是否受 120 下限约束**。
2. **`<title>` 仍为英文**：`/ja|/de|/ar/guides/*` 的 title 未本地化（线上实测 title 71/77 字符仍是英文）。desc 已 9 语化，**title 9 语化是独立工作项**。
3. **`outputs/stage1.7.1-ACCEPTANCE.md` 仍显示 modified（+97/−95）**：本会话未触碰，形态是 Markdown 表格对齐 + `\*\*` 转义（prettier 痕迹），但本仓无 prettier 依赖/配置/husky，**成因未明**。按「不动未解释的改动」处理：不 stage、不提交、绝不 `git checkout --`。
4. **剩余缺口**：47 篇中还有 **27 篇 × 6 语 = 162 页**未补（批 4.3/4.4/4.5）。继续补时只需：新建写入器（复用 batch42 骨架）+ 把 `g4-desc-idempotency-regression.ts` 的 `EXPECTED` 从 120 提到实际条数。
5. **`_prune_*` 隔离目录已累积 11 个**，按 RELEASE-RULES 规则 2 留待维护窗口统一清理。
6. **CF Free CPU 10ms/req 配额**仍是线上 5xx 的主要外部风险（须账号持有人处理：升 Workers Paid 或加 Cache Rule）。
7. 改动**未推远端**（本机直连 GitHub 不稳）。
