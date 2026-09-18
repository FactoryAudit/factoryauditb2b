# 审核清单源文件（CS-21 待办，尚未接入代码）

> 2026-09-18 收自用户微信，两份 docx 已**原文完整提取**为 Markdown（见同目录两个 `.source.md`）。
> 原始 docx 位于微信临时目录，**会被清理**，故此处为准。

## 本目录文件

| 文件 | 说明 |
|---|---|
| `Supplier-Quality-Audit-Checklist.source.md` | 质量审核清单**原文提取**（Markdown，人读/AI 读） |
| `Supplier-Social-Compliance-Audit-Checklist.source.md` | 社会责任审核清单**原文提取** |
| `Supplier-Quality-Audit-Checklist.original.docx` | 质量审核清单**原始 docx 备份**（63,621 B，含原始版式） |
| `Supplier-Social-Compliance-Audit-Checklist.original.docx` | 社会责任审核清单**原始 docx 备份**（64,341 B） |
| `README.md` | 本文件：内容盘点 + 平台映射 + 冲突清单 |

## 这两份是什么

| | 质量审核 | 社会责任审核 |
|---|---|---|
| 标题 | Supplier Quality Audit Report & Checklist | Supplier Social Compliance Audit Report & Checklist |
| 副题 | Buyer Decision Edition / 买方采购决策版 | Buyer Risk & Worker Rights Edition / 买方风险与员工权益版 |
| 章节 | 7 章 + Reference Basis | 7 章 + Reference Basis |
| 检查组 | **A–H 共 8 组 / 35 项** | **A–I 共 9 组 / 37 项** |
| 评分 | C=2 / PC=1 / NC=0 / NA | C / PC / NC / **CR**（无算术分） |
| 评分卡权重 | 15/10/10/20/15/10/10/10 = 100 | 10/10/15/20/10/20/5/10 = 100 |
| 设计依据 | ISO 19011:2026 + ISO 9001 概念 | SMETA 7.0 方法 + amfori BSCI 等 |
| 语言 | 中英双语（单文件对照） | 中英双语（单文件对照） |

结构一致：封面信息表 → 保密声明 → 1 管理层决策摘要（建议 + 总分/严重项/证据覆盖/风险等级 + 60秒四问 + Top Findings）→ 2 范围与方法（方法/抽样/证据/局限四列 + 审核准则）→ 3 审核清单（分组）→ 4 不符合项与 CAPA（8 列：严重度/要求/证据/风险/根因/整改+期限/验证）+ 严重度规则（Critical/Major/Minor/Observation）→ 5 买方评分卡 → 6 证据索引（Ref/证据/有/已核实）→ 7 报告确认（审核员/买方/供应商签收/报告状态）→ 设计依据 → END OF REPORT。

## 已核实的事实（不是问题）

- **ISO 19011:2026 真实存在**：2026-05-27 发布，第 4 版，46 页，ISO/PC 302（替代 ISO 19011:2018）。文档引用无误。
- SMETA 7.0、amfori BSCI、SA8000、ISO 9001、RBA 均为真实标准/体系。
- 两份文件的「非认证证书」「无证据=未核实」表述，与平台反伪造纪律（VERIFIED/PARTIALLY/NOT/CONFLICTING/OUTDATED）方向一致。

## 与平台既有实现的冲突（接入前必须解决）

1. **风险等级口径冲突（最硬）**。文档用 `LOW / MED / HIGH` 三档；平台 `lib/riskEngine.ts` 是 `LOW(85–100) / MODERATE(70–84) / ELEVATED(55–69) / HIGH(40–54) / CRITICAL(<40)` 五档。`lib/checklist.ts` 的 `riskLevel` 类型又是 `"Low" | "Medium" | "High"`。**三套并存**。
2. **决策区间是新概念**。文档 `90–100 Approved / 80–89 Approved with Action / 70–79 Conditional / <70 Not Approved` 在平台无对应；且与「高分=低风险」的 supplier risk 指数是**两个不同的分**，不可混用。
3. **8 个审核类型只覆盖 2 个**。平台 `lib/auditScope.ts` / `lib/checklist.ts` 的 `AUDIT_TYPES` 有 8 项（Factory Verification / Factory Audit / Supplier Quality Audit / Production Capacity Audit / Social Compliance Audit / Environmental Audit / Technical Audit / Custom Buyer Audit），文档只对应其中 2 项。
4. **公开工具是残桩**。`/tools/audit-checklist`（`lib/checklist.ts`）只出 6 条通用 + 最多 2 条行业/类型附加（6–10 条），与这两份 35/37 条差距巨大。文档若接入，这个工具是首要受益方。
5. **同名导出**。`lib/checklist.ts` 与 `lib/auditScope.ts` **都导出 `AUDIT_TYPES`**，值不同（前者 8 个英文串、后者是 key 索引）。接入时需先统一。
6. **语言数**。文档只有中英；平台 9 语（en/zh/zh-TW/ja/es/de/fr/pt/ar），其余 7 语需回退或补译。
7. **与 CS-20 报告编辑器模板不同源**。CS-20 的 13 章骨架来自 `lib/standardReport.ts` 样张；这两份是 7 章结构。二者需要决定是并列为「按审核类型分模板家族」还是映射合并。

## 天然的落库位置（现已建好，全 0 行）

CS-18 已建三张表，schema 就是为此设计的，至今**零行**：

- `audit_templates`：`code` / `name` / `name_zh` / `description` / `is_active`
- `audit_sections`：`template_id` / `section_code` / `title` / `title_zh` / `parent_id` / `sort_order`
- `audit_questions`：`section_id` / `question_code` / `title` / `title_zh` / `requirement` / `requirement_zh` / `guidance` / `guidance_zh` / `response_type` / `options` / `severity_if_failed` / `mandatory` / `sort_order`

映射：模板 2 行 → 分组 A–H / A–I 共 17 行 → 检查项 35 + 37 = **72 行**。

## 读取工具的能力上限（务必知悉）

本机 `editor_sdk` 读文档的工具（`doc_resolve_document_structure` 等）**单段文本上限 200 字符**，所以 `.source.md` 里 4 段长文本被截断：保密声明、审核准则、评分约定/评级约定、设计依据。若要逐字复用这几段，需直接解析原 docx XML。表格单元格**无此限制**，35/37 条检查项是完整的。

## 状态

- 已做：原文提取落盘 + 原始 docx 备份、与平台实现逐项对照、冲突清单。
- **未做**：未写入任何 DB、未改任何代码、未提交决策。等用户拍板方向。
