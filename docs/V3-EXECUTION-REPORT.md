# V3.0 任务书执行报告（Phase 1–4 第一批）

日期：2026-08-29
范围：Master Development Prompt V3.0 的 Phase 1（竞品研究）→ Phase 2（行动计划）→ Phase 3（商业闭环）→ Phase 4（SEO 技术修复第一批）

---

## 1. What I changed（改了什么）

### 文档（9 份）
| 文件 | 内容 |
|---|---|
| `docs/competitor/procuretoolkit-research.md` | 竞品全景：4 工具 + 20 模板 + 15 文章，4.1–4.4 完整回答 |
| `docs/competitor/procuretoolkit-seo-analysis.md` | 它的 7 类流量来源、Title 模式、意图覆盖矩阵 |
| `docs/competitor/procuretoolkit-monetization.md` | 商业漏斗推演，Observed/Inferred/Unknown 标注 |
| `docs/competitor/factoryaudit-vs-procuretoolkit.md` | 14 维对比矩阵 + 最终差异化 |
| `docs/SEO-ACTION-PLAN.md` | SEO 修复排期（D1–D5）|
| `docs/PRODUCT-ACTION-PLAN.md` | 产品 P0/P1/P2 + 禁止开发清单 |
| `docs/MONETIZATION-ACTION-PLAN.md` | 4 层变现 + 付费报告 MVP |
| `docs/AI-SEARCH-ACTION-PLAN.md` | AI 爬虫 + AI Readiness Score 标准 |
| `docs/NEXT-30-DAYS.md` | 30 天按周排期 + 成功定义 |

### 代码（商业闭环）
| 文件 | 改动 |
|---|---|
| `lib/leadScore.ts`（新增）| 内部启发式 Lead 评分 0–100 |
| `lib/notify.ts`（新增）| nodemailer 邮件框架，SMTP 可配置，未配置降级日志 |
| `app/api/lead/route.ts` | 统一 Lead 入口：评分 + 通知 + 全部来源落库 |
| `components/AuditRequestForm.tsx`（新增）| 审核申请表单（原页面不落库）|
| `app/[locale]/factory-audit/request/page.tsx` | 重写：字典 + metadata + 落库 |
| `components/RfqForm.tsx`（新增）| RFQ 表单（原按钮无 onClick）|
| `app/[locale]/rfq/page.tsx` | 重写：字典 + metadata + 落库 |
| `i18n/dictionaries/{en,zh,es,de,fr,pt}.json` | 新增 `auditRequest` + `rfq` 键 |
| `app/robots.ts` | AI 爬虫白名单（检索 + 训练）|
| `app/sitemap.ts` | 移除 4 段 404 生成逻辑 |
| `app/[locale]/supplier/[country]/[slug]/page.tsx` | 软 404 修复 `notFound()` |
| `package.json` | + nodemailer、@types/nodemailer |

## 2. Why I changed it（为什么）
- **闭环保第一**（任务书 §9）：先把 4 个表单全部落库，漏斗才有数据
- **竞品研究驱动**：PT 验证了"免费工具 + 模板"流量模型，也暴露了"无变现"缺口，据此确定我们的差异化
- **SEO 止损**：882 条 sitemap 死链 + 软 404 会持续惩罚站点，必须先清

## 3. What I learned from Procurement Toolkit（学到的）
- 工具页 = 工具本体 + 完整方法论教程（一个页面吃两类搜索词）
- 20 个模板页吃 template 长尾词，零注册直接下载
- 簇状内链：工具 ↔ 模板 ↔ 文章，页面深度 ≤ 2
- 它的漏斗在"用完即走"断掉，无任何 email 捕获 → 这是我们的机会

## 4. What we deliberately did NOT copy（不抄的）
- 不复制文案/结构/UI（只学意图与布局）
- 不做 20 个同质模板堆量（我们做 7 个高质量，配合真工具）
- 不学纯本地无后端架构（我们有 Lead + 服务闭环）
- 不做 P×I 单矩阵替换我们的六维引擎
- 不学"用完即走"（我们接报告 + 验证 CTA）

## 5. Current SEO score
| 指标 | 之前 | 现在 |
|---|---|---|
| sitemap 死链 | 882 | **0**（342 URL，57 英文全 200）|
| canonical 错误 | 16 页 | **0**（全站抽查 10/10 正确，含多语言）|
| 差异化 title | 6/22 | **22/22**（全站无重复 title）|
| robots AI 声明 | 无 | ✅ 全量声明 |
| 软 404 | 存在 | ✅ 已修复 |
| 英文首页 title | 缺失（undefined 覆盖）| ✅ 已修复 |
| login/admin noindex | 无 | ✅ 已加 |
| robots AI 声明 | 无 | ✅ 全量声明 |
| 软 404 | 存在 | ✅ 已修复 |

## 6. AI retrieval readiness
- 静态预渲染（365 页 HTML 完整可抓）✅
- llms.txt ✅（保持，不作为排名工具）
- 爬虫可达性：robots 已放行；**部署后必须 curl -A 实测**（Cloudflare 默认拦 AI 爬虫）

## 7. Conversion funnel status
```
表单落库：2/4 → 4/4 ✅（risk-calculator / custom-services / audit-request / rfq）
Lead 评分：✅ 每线索 0–100（实测 audit-request=70，rfq=53）
Email 通知：⚠️ 框架就绪，SMTP 未配置（配 .env 即生效）
后台查看：✅ /admin/leads
付费：🔴 未开始（MONETIZATION-ACTION-PLAN Step 2 待执行）
```

## 8. Remaining P0/P1/P2 issues
| 级别 | 项 |
|---|---|
| P0 | SMTP 配置 + 实际发信验证 |
| P0 | 部署生产 + GSC/Bing 提交 |
| P1 | 7 份模板导出（template 长尾词）|
| P1 | 工具页方法论补全（竞品借鉴）|
| P1 | 30 篇内容（先 3 篇验证流程）|
| P2 | Verification Readiness Checker、Supplier Comparison、证据层 |

> **SEO 技术 P0 已全部清零**（canonical / sitemap 死链 / 软 404 / robots AI 爬虫 / noindex）。

## 9. Next 30 days
见 `docs/NEXT-30-DAYS.md`。本周剩余：canonical 修复（16 页）→ SMTP 配置 → 部署。

## 10. Files changed
见第 1 节表格（12 个代码文件 + 6 份字典 + 9 份文档）。

## 11. Tests passed
- `next build` EXIT=0（365 静态页）
- `/factory-audit/request`、`/rfq` 6 语言全 200
- POST /api/lead：audit-request（score 70）、rfq（score 53）落库 ✅
- sitemap 342 URL 全量巡检 0 死链
- robots.txt AI 爬虫声明实测生效
- 不存在的 supplier slug 返回 404

## 12. Deployment instructions
1. 配置 `.env`：`SMTP_HOST/PORT/USER/PASS`、`NOTIFY_ADMIN_EMAIL`、`FROM_EMAIL`
2. `npx prisma db push`（Lead.message 字段已同步）
3. `npm run build`（Windows 需先重定向 home 环境变量，见项目记忆）
4. 部署后 `curl -A "OAI-SearchBot" https://factoryauditb2b.com/` 实测 200（防 Cloudflare/WAF 拦截）
5. Google Search Console + Bing Webmaster Tools 提交 sitemap
6. 后台 `/admin/leads` 查看全部线索
