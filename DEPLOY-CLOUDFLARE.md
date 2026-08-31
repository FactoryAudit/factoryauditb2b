# 部署到 Cloudflare（FactoryAuditB2B）

**目标**：`factoryauditb2b.com` → Cloudflare Workers + Neon Postgres + GitHub Actions 自动部署

## 架构

```
GitHub (main) ──push──> GitHub Actions ──> @opennextjs/cloudflare build ──> wrangler deploy
                                                                                │
                                          Neon Postgres (Pooled) <──DATABASE_URL──┘
                                          Resend HTTP API <──MAIL_HTTP_KEY──────┘
```

- **运行时**：Cloudflare Workers（`@opennextjs/cloudflare`，Node.js 兼容模式，支持 Next.js 15.5+）
- **数据库**：Neon Postgres（免费档 0.5GB；SQLite 只能在本地，云端必须 Postgres）
- **邮件**：Resend HTTP API（Workers 平台禁止 SMTP 出站，不能用 nodemailer SMTP）
- **CI**：GitHub Actions 每次 push 到 main 自动：建表(幂等) → 灌种子(幂等) → 构建 → 部署 → 配置环境变量

## 你只需要做 4 件事（其余我已全部配好）

### ① 注册 Neon，拿数据库连接串（约 3 分钟）
1. 打开 https://neon.tech 用邮箱注册（免费，不需要绑卡）
2. 创建项目（Region 选 Singapore 或 Tokyo，离国内近）
3. 控制台会显示两个连接串，**都要复制给我**：
   - **Pooled**：`postgresql://user:pass@xxx-pooler.neon.tech/dbname?sslmode=require`
   - **Direct**：`postgresql://user:pass@xxx.neon.tech/dbname?sslmode=require`

### ② 建 GitHub 仓库，把代码推上去（约 5 分钟）
1. 打开 https://github.com/new → 仓库名 `factoryauditb2b` → **Private（私有）** → Create
2. 把仓库地址发给我（形如 `https://github.com/你的用户名/factoryauditb2b.git`），我来推送代码并配置 Secrets

### ③ 创建 Cloudflare API Token（约 3 分钟）
1. 打开 https://dash.cloudflare.com/profile/api-tokens → Create Token
2. 用模板 **"Edit Cloudflare Workers"**（已有正确权限）→ Create
3. 复制 Token 发给我；同时把 **Account ID**（dash.cloudflare.com 首页右侧栏）发给我

### ④ 把域名接入 Cloudflare（约 10 分钟，DNS 生效需等待）
1. dash.cloudflare.com → Add a site → 输入 `factoryauditb2b.com`
2. 选 **Free 计划** → 它会给你两个 NS 地址（形如 `xxx.ns.cloudflare.com`）
3. 去你买域名的服务商控制台，把域名的 NS 改成这两个地址（**这是让 Cloudflare 接管 DNS**）
4. 等 10 分钟~24 小时生效（Cloudflare 显示 Active 即可）

> ①②③ 完成后我就能在 CI 里把一切都跑通；④ 决定域名何时能访问。

## GitHub Secrets 清单（我配置 CI 时会用到，你只要提供上面 ①②③ 的素材即可）

| Secret | 值 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | ③ 的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | ③ 的 Account ID |
| `DATABASE_URL` | ① 的 Pooled 连接串 |
| `DATABASE_URL_UNPOOLED` | ① 的 Direct 连接串 |
| `AUTH_SECRET` | 我生成（强随机） |
| `NEXTAUTH_URL` | `https://factoryauditb2b.com` |
| 其他（WhatsApp/AI/Google 登录/邮件） | 可选，你确认要用的我逐个补 |

## 已完成的工程改造（勿回退）

| 文件 | 改动 |
|---|---|
| `package.json` | next 15.3.3→15.5.24；新增 @opennextjs/cloudflare、wrangler、@prisma/adapter-neon、@neondatabase/serverless；加 cf:build/cf:dev/cf:deploy 脚本 |
| `lib/db.ts` | 按 `DATABASE_URL` 前缀自动切 SQLite（本地）/ Neon（云端） |
| `lib/notify.ts` | 新增 HTTP 邮件通道（`MAIL_PROVIDER=http`，Resend 兼容），Workers 必用 |
| `next.config.mjs` | 加 `serverExternalPackages`（Prisma/pg workerd 兼容） |
| `scripts/switch-db.cjs` | 切 Postgres 时自动补 `directUrl`，提示两种连接串 |
| `wrangler.jsonc` | Workers 配置（nodejs_compat + 静态资源） |
| `.github/workflows/deploy.yml` | 自动构建部署流水线 |
| `.env.example` | 完整环境变量说明（含 Cloudflare/Neon/邮件） |
| `.gitignore` | 加 .opennext/.wrangler 等 |

## 上线后必做（SEO/运营）

1. **GSC 验证**：Search Console 添加 `factoryauditb2b.com` → 用 `GOOGLE_SITE_VERIFICATION`（已支持）
2. **提交 sitemap**：`https://factoryauditb2b.com/sitemap.xml` 到 GSC / Bing Webmaster
3. **换真邮箱**：Resend 里验证发件域名 `factoryauditb2b.com`（SPF/DKIM 记录，Resend 会给出），送达率才有保障
4. **Google OAuth**：如果要用 Google 登录，在 Google Cloud Console 配置 OAuth 客户端（回调 `https://factoryauditb2b.com/api/auth/callback/google`）
5. **HTTPS**：Cloudflare 自动签发（橙色云朵开启），无需额外配置

## 已知限制（Cloudflare Workers 环境）

- **限流降级**：`lib/rateLimit.ts` 是内存计数，Workers 无状态（每次请求可能不同实例），限流阈值会放宽——不影响功能，后续可换 KV
- **Workers 免费额度**：10 万请求/天，个人站足够；Worker 体积压缩后需 <3MB（本项目估计 1-2MB，够）
- **图片优化**：next/image 需 Cloudflare Images 或改用本地 public/ 静态图（本项目全是 public/ 静态图，无影响）
