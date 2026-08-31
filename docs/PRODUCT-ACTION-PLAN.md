# PRODUCT ACTION PLAN — 产品执行计划

日期：2026-08-29
依据：任务书 Phase 3–9 + 当前代码审计 + 竞品研究

---

## 核心原则

**Closed Loop First**：Traffic → Tool → Result → Lead → Quote → Revenue 闭环跑通之前，禁止开发大型新系统。

---

## P0：商业闭环（本周，最高优先）

| # | 任务 | 当前状态 | 动作 |
|---|---|---|---|
| 1 | Audit Request 落库 | ❌ 只 setSubmitted，注释自述 "Demo — no data persisted" | 接 `/api/lead`（tool="audit-request"）|
| 2 | RFQ Post 落库 | ❌ 按钮无 onClick | 表单接 `/api/lead`（tool="rfq"）|
| 3 | 统一 Lead 模型 | ⚠️ 已有 Lead 表，缺 source 细分 | 用 `tool` 字段承载 source（TOOL/SERVICE/RFQ/SUPPLIER/CONTACT）|
| 4 | Lead Scoring | ❌ 无 | 轻量启发式 0–100（见下）|
| 5 | Admin 后台 | ⚠️ 已有 /admin/leads | 增加 RFQ / Audit Request 视图或并入 Lead 列表 |
| 6 | Email 通知 | ❌ 无 SMTP | 建 `lib/notify.ts`，可配置 SMTP；无配置时降级日志 |

### Lead Scoring（明确为内部启发式，非行业标准）

```
+25 工作邮箱（非 gmail/hotmail/qq 等）
+20 有公司名
+15 有供应商网站
+15 风险 HIGH/CRITICAL（工具结果）
+15 申请了审核/验证（source = service/audit）
+10 填写了产品/采购内容
（满分 100）
```

实现：`lib/leadScore.ts`，纯函数，随 lead 创建时计算，存 `score` 字段。

---

## P1：旗舰工具增强（两周内）

| # | 任务 | 说明 |
|---|---|---|
| 1 | 结果页动态 CTA | 低风险→Download Report；中→Review Missing Evidence；高→Verify This Supplier；严重→Request Independent Verification |
| 2 | 工具页方法论补全 | 每个工具页补"评分规则 + 4 步流程 + 实例"（竞品借鉴）|
| 3 | Supplier Verification Readiness Checker | 8 个是否问题 → 就绪分 + 缺失项 + 验证 CTA（任务书 §25，P1）|
| 4 | Supplier Comparison | 最多 5 家对比，输出 Best Overall / Lowest Risk / Best Value（任务书 §26）|
| 5 | 模板导出 | 7 份 Excel/PDF 模板页（竞品借鉴，各占 URL）|

---

## P2：内容与权威页（一个月内）

| # | 任务 |
|---|---|
| 1 | 30 篇内容（CONTENT-STRATEGY.md 清单），先 3 篇验证流程 |
| 2 | /methodology 方法论页（风险模型、评分、证据、限制、更新）|
| 3 | /about + /contact + /editorial-policy（真实信息，禁止虚构）|
| 4 | /glossary 术语表（12 个术语起）|
| 5 | 5 个匿名真实案例（禁止虚构客户）|

---

## P3：未来（两个月+）

Supplier Claim / Verified Supplier 会员、RFQ Marketplace、Supplier Monitoring、Buyer SaaS。

---

## 禁止开发清单（任务书 §65）

- ❌ 大型 CRM / 复杂 ERP / 物流系统 / AI Chatbot
- ❌ 多币种 / 多语言管理后台
- ❌ 为"看起来像大平台"做的任何系统

---

## 验收标准（P0 完成时）

- [ ] 4 个表单全部落库（tool 来源可区分）
- [ ] Lead 表每条有 score
- [ ] 后台可看到全部线索（Lead / RFQ / Audit Request / custom-services）
- [ ] 无 SMTP 时系统不崩，有 SMTP 时发送成功
