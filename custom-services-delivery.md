# 个性化服务卡片与后台 Lead 管理 — 交付说明

日期：2026-08-29
服务：http://localhost:3000（生产构建，静态页 365）

---

## 交付内容

按用户截图中的空白位置，在首页和 `/tools` 工具中心页补了【个性化服务】卡片，并配套完整流程。

| 项 | 文件 | 说明 |
|---|---|---|
| 数据库字段扩展 | `prisma/schema.prisma` | `Lead` 表新增 `message String?` |
| Lead API 升级 | `app/api/lead/route.ts` | 支持动态 `tool` 字段；`custom-services` 来源不建嵌套 Assessment |
| 个性化服务页面 | `app/[locale]/custom-services/page.tsx` | 服务端组件，含 `Service` + `BreadcrumbList` JSON-LD |
| 表单组件 | `components/CustomServiceForm.tsx` | 客户端表单，提交到 `/api/lead` |
| 多语言文案 | `i18n/dictionaries/{en,zh,es,de,fr,pt}.json` | `toolCards.personalizedService` + 完整 `customServices` 字段 |
| 首页入口 | `app/[locale]/page.tsx` | 工具卡片网格加入个性化服务 |
| 工具中心入口 | `app/[locale]/tools/page.tsx` | 2 列 8 张卡片，填补原空白 |
| SEO 接线 | `app/sitemap.ts` / `app/llms.txt/route.ts` | 6 语言 URL 已收录 |
| 后台 Lead 列表 | `app/[locale]/admin/leads/page.tsx` | ADMIN 角色可查看全部线索及需求详情 |
| 后台入口 | `app/[locale]/admin/page.tsx` | Lead Management 模块改为可点击链接 |

---

## 用户流程

1. 用户在首页或 `/tools` 点击【个性化服务 / Custom Service / Serviço personalizado】
2. 进入 `/custom-services`，填写姓名、公司、邮箱、国家、需求描述
3. 提交后数据进入 `Lead` 表，`tool="custom-services"`，`message` 字段保存需求详情
4. 管理员登录后台 → 点击 Lead Management → 查看列表和每条需求原文

---

## 验证结果

| 检查项 | 结果 |
|---|---|
| `next build` | ✅ EXIT=0 |
| `/custom-services` 6 语言 | ✅ 全 200（en / zh / es / de / fr / pt）|
| POST `/api/lead` | ✅ 返回 `{"ok":true,"leadId":"..."}` |
| 数据库写入 | ✅ `tool="custom-services"`，`message` 字段非空 |
| 首页 / `/tools` 卡片 | ✅ 出现个性化服务 |
| sitemap / llms.txt | ✅ 已收录 |
| `/admin/leads` 权限 | ✅ 未登录 307 到 `/login?error=admin_only` |

---

## 后台访问

- 后台地址：`http://localhost:3000/admin`
- 账号：`admin@factoryauditb2b.com` / `FactoryAudit2026!`
- 进入后点击 **Lead Management** → 查看所有线索

---

## 后续可选增强

1. **邮件通知**：提交后自动发邮件给管理员（需配置 SMTP）
2. **状态流转**：列表页直接改 `status`（NEW → CONTACTED → QUOTE_SENT 等）
3. **搜索/筛选**：按 tool 来源、状态、日期筛选
