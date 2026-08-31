# FactoryAuditB2B — 关键词 → 页面映射（Keyword Map）

> 用途：让每个高意图搜索词都有对应页面承接，避免内容重叠与内耗。优先级 P1（立刻做）> P2 > P3。
> 搜索量/难度为相对估计（新站视角），以英文主词为主，zh/es/de/fr/pt/ja/zh-TW/ar 由同结构页面承接。

## 簇 1：供应商核验（Verification）— 核心转化簇
| 关键词（示例） | 意图 | 承接页 | 优先级 |
|---|---|---|---|
| verify Chinese supplier / 核验中国供应商 | 信息+交易 | /guides/how-to-verify-a-chinese-supplier（已有） | P1 |
| supplier verification China/Vietnam/Thailand | 交易 | /services/supplier-verification, /countries/[slug] | P1 |
| how to verify a factory | 信息 | /guides/how-to-verify-a-chinese-supplier + 国家页 | P1 |
| supplier verification checklist | 信息 | /tools/supplier-verification-checklist | P1 |

## 簇 2：工厂验厂（Audit）— 核心收入簇
| 关键词 | 意图 | 承接页 | 优先级 |
|---|---|---|---|
| factory audit checklist | 信息 | /guides/factory-audit-checklist（新增） | P1 |
| factory audit Vietnam/China/Thailand | 交易 | /guides/how-to-audit-a-factory-in-vietnam（新增）, /audit-guide/[country]/[type] | P1 |
| how to read a factory audit report | 信息 | /guides/how-to-read-a-factory-audit-report（新增） | P1 |
| factory audit cost / 验厂费用 | 交易 | /services/factory-audit, /pricing | P2 |
| on-site factory audit | 交易 | /factory-audit/request | P1 |

## 簇 3：风险评估（Risk）— 工具引流簇
| 关键词 | 意图 | 承接页 | 优先级 |
|---|---|---|---|
| supplier risk assessment | 信息 | /guides/supplier-risk-assessment-guide（新增） | P1 |
| supplier risk score / calculator | 工具 | /tools/supplier-risk-calculator | P1 |
| how to assess supplier risk | 信息 | /methodology | P2 |

## 簇 4：合规与标准（Compliance）— 高专业度簇
| 关键词 | 意图 | 承接页 | 优先级 |
|---|---|---|---|
| SMETA vs BSCI | 信息 | /guides/smeta-vs-bsci-social-audit-comparison（新增） | P1 |
| social audit / 社会责任审核 | 信息 | /guides/smeta-vs-bsci… + /audit-guide/[c]/[social] | P1 |
| ISO 9001 / CE / UL 含义 | 信息 | /methodology, 标准页（规划中） | P2 |
| what is a factory audit certificate | 信息 | /trust, /guides/how-to-read… | P2 |

## 簇 5：验货 / 出货（Inspection）
| 关键词 | 意图 | 承接页 | 优先级 |
|---|---|---|---|
| pre-shipment inspection checklist | 信息 | /guides/pre-shipment-inspection-checklist（新增） | P1 |
| product inspection China | 交易 | /services/inspection | P1 |
| AQL sampling | 信息 | /guides/pre-shipment-inspection-checklist | P2 |

## 簇 6：行业落地（Industry）— 待扩充（P2/P3）
| 关键词 | 意图 | 承接页 | 优先级 |
|---|---|---|---|
| electronics supplier verification | 交易 | /industry/electronics（已有，待充实） | P2 |
| garment / furniture / toy factory audit | 交易 | /industry/[code] + 指南 | P2 |
| food contact / auto parts audit | 交易 | /industry/[code]（规划） | P3 |

## 使用规则
1. 每篇新指南的 `titleEn` 直接命中一个主词；`metaDescEn` 含主词+次词。
2. 同簇页面用「Related guides / 工具 / 服务」互链，形成主题簇（已在新指南中接好）。
3. 国家页与 audit-guide 页只覆盖 Phase 1 三国，避免薄页（已限三国）。
4. 每月按本表 P1 缺口补内容，P2/P3 在权威建立后补。
