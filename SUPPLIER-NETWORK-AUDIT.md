# Supplier Network V1.0 — 审计报告与开发清单（2026-09-01）

> 依据《FactoryAuditB2B Supplier Network V1.0 — Implementation Brief》。
> 原则：不推倒重做，保持现有 SEO 结构/URL/功能，先审计后开发，经确认再动手。
> 范围仅限 Brief 的 MVP（Supplier Registration → Email → Human Review → Supplier Profile → Buyer Inquiry），不做复杂后台/CRM/支付。

---

## 一、现状审计结论

现有架构与 Brief 高度兼容，**无需重构**：

| Brief 要求 | 现状 | 结论 |
|---|---|---|
| 无大数据库，表单+邮件+人工 | `/api/lead` 统一表单入口（限流 5/h/IP + Resend 双邮件 + UUID），注释已写明「运营手动归档 Google Sheets」 | ✅ 直接扩展 |
| `/suppliers` | 已有列表页（静态示范 4 家 + 国家/行业筛选 + RFQ 兜底 + 供应商侧入口） | ✅ 保留，增强 |
| 供应商详情页 | `/supplier/[country]/[slug]` 已有（含 verificationStatus/riskScore/evidence） | ✅ 保留，补 Evidence Level |
| Verification 等级 | `lib/verification.ts`：Level 0-4 + EvidenceProvenance（provided/reviewed/independent/onsite） | ✅ 映射为 5 级 Evidence Level |
| 统一声明不卖证书 | footer copyright + why3Body + values + AI 提示词均已声明 | ✅ 已满足 |
| 服务链路 | `/services/supplier-verification`、`/factory-audit/request`、`/services/inspection`、`/rfq`、`/services/supplier-improvement` | ✅ 已存在，直接链接 |
| 招商文案 | 供应商侧入口目前导向 `/services/supplier-improvement` | ⚠️ 需换成「Join the FactoryAuditB2B Supplier Network」 |
| 注册表单/状态机/证据级别/风险模型 | 无 | ❌ 需新增 |

**关键架构决策（保持无 DB）**：
- 供应商注册数据 → 新 `/api/supplier-register` → Resend 邮件（结构化文本，可直接复制进 Sheets）+ 客户回执
- 存储 = **Google Sheets（人工录入）**：我给你字段清单，你在 Google 建表
- 展示 = **静态发布**：审核通过 → 管理员把供应商加进 `lib/staticData.ts` → build 部署（沿用现有流程）

---

## 二、新增页面列表（P0）

| 页面 | 路由 | 说明 |
|---|---|---|
| Join the Supplier Network | `/join-supplier-network` | 招商页：核心卖点 7 条 + 9 段注册表单 + FAQ + JSON-LD（Service+FAQPage） |
| Supplier Registration（同页内嵌） | 同上（表单 POST `/api/supplier-register`） | 9 大块：Company / Factory / Products / Production Capability / Export Markets / Certificates / Contact / Audit Availability / Inspection Availability |
| Report a Concern | `/report-a-concern` | 5 类举报：Supplier Complaint / Buyer Complaint / Auditor Complaint / Anti-Bribery Reporting / 其他（P0 简化版，P1 可增强） |

**Brief 提到的其余 URL 不新建**（避免 SEO 分流与死链风险）：
- `/supplier-verification` → 链接现有 `/services/supplier-verification`
- `/factory-audit` → 链接现有 `/factory-audit/request`
- `/factory-inspection` → 链接现有 `/services/inspection`

---

## 三、修改文件列表（P0）

| 文件 | 改动 |
|---|---|
| `lib/supplierNetwork.ts`（新增） | 单一事实来源：SupplierStatus 8 态、EvidenceLevel 5 级、10 维风险模型与权重、Master Sheet 字段定义、20 个文档模板清单 |
| `app/api/supplier-register/route.ts`（新增） | 表单接收：校验（邮箱/必填/长度上限）+ 限流复用 `lib/rateLimit` + 双邮件（管理员完整数据 / 供应商回执）+ 返回 leadId |
| `lib/notify.ts`（修改） | 新增 `notifyAdminSupplierRegistration(data)` 与 `notifySupplierReceived(email)`（结构化文本，可直接粘贴进 Sheets） |
| `app/[locale]/join-supplier-network/page.tsx`（新增） | 招商 + 表单页（Client 表单组件 + Server 页壳） |
| `components/SupplierRegistrationForm.tsx`（新增） | 表单组件：9 大块、公司/个人信息**独立授权开关**（Brief 十三隐私）、必填校验、提交态、成功/失败提示 |
| `i18n/dictionaries/*.json`（9 份） | 新增 `supplierNetwork` 块（约 60 key）+ `footer` 增加 Join 链接文案 |
| `lib/nav.ts` | 供应商目录页/页脚/导航挂 Join 入口（SERVICE_MENU 或 footer 新链接） |
| `app/sitemap.ts` | 加 `/join-supplier-network`（9 语言 URL） |
| `app/llms.txt/route.ts` | 加新页面 |
| `components/SiteFooter.tsx` | 加 Join Supplier Network 链接 |
| `lib/staticData.ts` | （审核通过后）加新供应商条目模板字段：evidenceLevel/status 等（P0 只加类型字段，不造数据） |
| `app/[locale]/supplier/[country]/[slug]/page.tsx` | 展示 Evidence Level + Verification Status（不搞绿色 Certified 标签） |

---

## 四、Google Sheets：Supplier Master Sheet 字段（25+）

```
Supplier ID（UUID，系统生成）
Company Name / English Name / Company Type / Location（Country+City）
Products（主产品，逗号分隔）/ Production Capacity
Employees / Established / Website / Export Markets
Contact Person / Email / Phone / WhatsApp（展示范围：公开/仅平台/不展示）
Certificates（列表）/ Certificate Status
Verification Status（8 态）/ Evidence Level（5 级）/ Risk Score（0-100）/ Risk Level
Audit Status / Inspection Availability / Inspection Status
Last Review Date / Next Review Date / Assigned Reviewer
Source（join-supplier-network）/ Submitted Date / Notes
```

---

## 五、Google Docs 模板（20 个）

Brief 列了 20 个模板。这些是**外部 Google Docs 文档**，不在代码里。做法：
1. 我在 `/join-supplier-network` 页放「Required Documents」清单 + 下载/查看链接
2. 模板本体：建议你建一个 Google Drive 文件夹（如 `FactoryAuditB2B Supplier Network Docs`），按 Brief 清单建 20 个 Google Docs（我提供每份的中英文字段结构，你复制粘贴即可）

P0 先放**链接占位**（链接指向你的 Drive 文件夹），模板填充可 P1 分批做。

---

## 六、Environment Variables（新增/沿用）

| 变量 | 用途 | 状态 |
|---|---|---|
| `MAIL_HTTP_KEY` | Resend key | ✅ 已配置（本轮） |
| `NOTIFY_ADMIN_EMAIL` | 管理员收件 | ✅ 已改为 Gmail |
| `FROM_EMAIL` | 发件地址 | ✅ 临时 onboarding@resend.dev |
| 新增：无 | 表单复用现有邮件通道，**不需要新环境变量** | — |

⚠️ 唯一线上阻塞：`CLOUDFLARE_API_TOKEN`（部署用，用户在找）。

---

## 七、Email 流程（供应商注册）

```
供应商提交表单
  → POST /api/supplier-register（限流 5/h/IP）
  → 校验通过 → 生成 UUID
  → 邮件 A：管理员（NOTIFY_ADMIN_EMAIL）
      主题：[FactoryAuditB2B] New Supplier Registration
      正文：全部字段结构化文本 + 证据级别声明 + 待办（审核 5 步）
  → 邮件 B：供应商
      主题：We received your supplier application
      正文：Reference ID + 审核周期说明（1 business day 回复）+ 不承诺保证
  → 返回 { ok: true, supplierId }
管理员收到 → 人工审核（见下） → 录入 Google Sheets → 状态变更
```

---

## 八、Supplier 审核流程（人工）

```
1. 收到邮件 → 建 Supplier Review Record（Sheets 一行 + 邮件归档）
2. 完整性检查（AI 辅助）：必填字段齐全？
3. 文件一致性检查（AI 辅助）：证书日期/主体名称核对
4. 证据收集 → 定 Evidence Level（Self-Declared → Factory Audited）
5. 定 Supplier Status（8 态）+ Risk Score（10 维模型）
6. 审核通过 → 录入 staticData → 发布 → 供应商出现在 /suppliers
7. 状态为 Rejected/Suspended → 发 Supplier Suspension/Removal Notice（模板 20）
```

Status 流转：`Pending → Submitted → Under Review → Approved / Approved with Conditions → Verified Supplier`，异常：`Suspended / Rejected`。

---

## 九、Risk Score 规则（100 分，10 维）

供审核员评估用，**独立于**买家自助工具的 riskEngine（两者不混）：

| 维度 | 权重 |
|---|---|
| Company Identity | 15 |
| Business Information | 10 |
| Factory Information | 10 |
| Document Consistency | 10 |
| Certificate Evidence | 15 |
| Production Capability | 10 |
| Export Experience | 10 |
| Contact Verification | 10 |
| Audit Evidence | 10 |
| Other Risk Indicators | 0（扣分项） |

输出（与 Brief 一致）：`80-100 Low Risk / Strong Profile`、`60-79 Moderate Risk`、`40-59 Needs Further Verification`、`<40 High Risk / Insufficient Evidence`。

**强制免责声明**（页面 + 报告尾部）：
> Risk Score is an informational assessment and does not constitute certification, accreditation or a guarantee of supplier performance.

**反伪造铁律（沿用）**：无数据 ≠ 低风险；Evidence Level 未达 Independently Verified 前，绝不显示任何「Verified/认证」标签；不卖证书声明全站统一。

---

## 十、待用户确认的 4 个决策点

1. **`/join-supplier-network` 页面语言**：9 种语言全做（工作量最大项，字典 +60 key × 9 份）还是先 en/zh？
2. **Risk Score 10 维模型**：放页面公开展示（透明）还是仅管理员邮件可见（P0 隐藏）？
3. **20 个 Google Docs 模板**：P0 只放 Drive 文件夹链接占位，还是我在报告里把 20 份的中英文字段结构全写出来？
4. **/report-a-concern**：P0 一起做（约 +20 key × 9 份）还是 P1？

---

## 十一、开发完成后的验证清单

- [ ] `next build` 通过（0 Type error）
- [ ] 新增页面 9 语言 200（含 `/join-supplier-network` 表单提交成功态）
- [ ] 表单端到端：提交 → Gmail 收到管理员邮件（含全部字段）
- [ ] 全站无死链（导航/页脚/sitemap/llms.txt 同步检查）
- [ ] 供应商详情页 Evidence Level 显示正确、无「Certified」误标

---

## 十二、P1 / P2 建议（本轮不做）

- **P1**：Supplier Profile 动态展示（改 staticData 免发布）、20 模板内容填充、举报页增强（附件上传）、Evidence Level 时间线展示、Buyer-Supplier Matching 页
- **P2**：复杂 Supplier Dashboard、在线支付、大 Marketplace、自动化证书核验（Brief 明确暂不开发）

---

*关联未完成项（另线进行）*：① 页脚领土表述修复已 commit（6afa5db）但线上未部署，CI 正在重跑、等 Cloudflare API Token；② V1.1 风险引擎 8 维半成品备份在 `.workbuddy/v11-wip-20260901.patch`，未影响本报告范围。
