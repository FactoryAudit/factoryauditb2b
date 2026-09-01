# V2.0 去数据库重构 + 重新部署 — 完成报告

**日期**：2026-09-01　**站点**：https://factoryauditb2b.com　**状态**：已上线，全站 200，零 500

## 做了什么

按 V2.0「去数据库、立刻上线」决策，把整个站点从「Prisma + Neon Postgres + 登录/注册/后台」重构为**纯静态数据源**，彻底根治 Cloudflare Workers 上 Prisma native 引擎导致的首页 500。

### 删除的文件（auth / 注册 / admin / 数据库全停用）
- `lib/db.ts`、`lib/auth.ts`、`types/next-auth.d.ts`
- `app/api/register/route.ts`、`app/api/admin/leads|taxonomy/route.ts`、`app/api/auth/[...nextauth]/route.ts`
- `app/[locale]/admin|login|register/**`、`app/[locale]/providers.tsx`
- `components/AuthMenu|LoginForm|RegisterForm|TaxonomyManager|admin/LeadStatusSelect.tsx`

### 修改的文件
| 文件 | 改动 |
|---|---|
| `lib/staticData.ts` | 静态数据源（9 国 / 12 行业 / 22 审核认证 / 15 类目 / 4 供应商） |
| `lib/taxonomy.ts` `lib/queries.ts` `lib/seo.ts` | 函数签名不变，内部改读静态常量 |
| `app/sitemap.ts` 及落地页 | 去 `prisma` import |
| `app/api/lead/route.ts` | `prisma.lead.create` → `crypto.randomUUID()` + 邮件通知 |
| `components/SiteHeader|SiteFooter.tsx` | 去 AuthMenu / authNav / /admin 链接 |
| `app/[locale]/layout.tsx` | 去 SessionProvider |
| `lib/notify.ts` | 去 /admin 链接，改 leadId |
| `app/robots.ts` `next.config.mjs` | 去 /admin /login；serverExternalPackages 清空 |

## 验证结果
- `next build`：`✓ Compiled successfully`，EXIT_CODE=0，无 type error / warning
- 本地冒烟：首页、工具、供应商、服务、定价、国家、行业、审核指南、多语言等**全部 200**；`/login /register /admin /api/register` **全部 404**
- 生产 `factoryauditb2b.com`：`/` `/tools` `/suppliers` `/pricing` `/countries/china` `/llms.txt` `/sitemap.xml` 全部 200；被删路由 404；**Prisma 500 根治**

## 部署信息
- Worker `factoryauditb2b` 最新版 `cb9908e4-86fd-4fd3-b609-55357092291e`（收尾后重新部署）
- 上传 8148 KB（gzip 1635 KB），137 资产（1 新 + 72 已传），Worker 启动 39ms
- 自定义域：factoryauditb2b.com + www.factoryauditb2b.com

## 收尾进度（09-01 完成）

| # | 事项 | 状态 |
|---|---|---|
| 1 | 依赖清理：package.json + package-lock + node_modules 移除 prisma/next-auth/bcrypt | ✅ 完成，`next build` EXIT_CODE=0 |
| 2 | 删残留文件：prisma/、generated/prisma-client、scripts/switch-db.cjs、cleanup-test-leads.cjs | ✅ 已删 |
| 3 | 字典清理：`auth` 块 + `footer.admin` 键（9 语言） | ✅ 已删，9 份各 -57 行共 -513 行 |
| 4 | 类型修复：`SiteFooter` FooterDict 移除 `admin` 字段 | ✅ 已修（build 曾因此失败） |
| 5 | 重新部署生产（含字典/类型/依赖变更） | ✅ 新版 `cb9908e4`，全站 200 / 被删路由 404 |
| 6 | 运行时凭据（**待用户提供**） | ⏳ MAIL_HTTP_KEY（Resend）、DEEPSEEK_API_KEY、NEXT_PUBLIC_WHATSAPP_NUMBER |

## 关键坑（本轮新增）
- **npm install 会覆盖 `node_modules/@opennextjs/*` 的 Windows 补丁**（fs.cpSync→copyDirContentsSync 等 4 个文件）。重装依赖后必须先恢复 `.workbuddy/patches-backup/` 里的补丁再跑 OpenNext build，否则 build 报 `ENOENT .open-next\.build\open-next.config.edge.mjs`（fs.cpSync 静默失败导致 tempBuildDir 产物未复制）。
- 本机 `http_proxy=127.0.0.1:12321` 会让 npm/curl 走无效代理卡死：npm install 需 `unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY` + `no_proxy='*'` + `--registry=https://registry.npmmirror.com`；本地 curl 巡检需 `--noproxy '*'`。
