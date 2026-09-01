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

## 当前状态（2026-08-31 实测）

| 项目 | 状态 |
|---|---|
| Neon Postgres 建库 + schema push + seed | ✅ 完成 |
| 本地 OpenNext Cloudflare 构建（`.open-next/worker.js`） | ✅ 完成 |
| Worker secrets 注入（8 个，`wrangler secret put`） | ✅ 完成 |
| Worker `factoryauditb2b` 部署（Version 290ee55e，47 静态资产） | ✅ 完成 |
| 自定义域绑定 `factoryauditb2b.com` + `www.`（custom_domain） | ✅ 完成 |
| **域名 NS 切换到 Cloudflare（zone pending → active）** | ⛔ **待你操作** |

**唯一阻塞**：域名注册商（DNSPod）处 nameserver 还没切，zone 处于 pending。
Cloudflare 分配的两个 NS：`ada.ns.cloudflare.com` / `dan.ns.cloudflare.com`。
改完等生效（分钟级~24h），域名即可访问，无需再动任何配置。

## 你要做的（剩余步骤）

### ① 切换 nameserver（阻塞项，约 5 分钟，DNS 生效需等待）
域名注册商是 **DNSPod（腾讯云）**，当前 NS 还是 `kim.dnspod.net / worm.dnspod.net`：
1. 登录 DNSPod 控制台 → 域名列表 → `factoryauditb2b.com` → 修改 DNS 服务器
2. 改为（两个都填）：
   - `ada.ns.cloudflare.com`
   - `dan.ns.cloudflare.com`
3. 保存。生效后 Cloudflare zone 变 **Active**，站点自动可访问。

### ② 建 GitHub 仓库 + 配置 CI（约 10 分钟，可选但推荐）
1. 打开 https://github.com/new → 仓库名 `factoryauditb2b` → **Private** → Create
2. 创建 Cloudflare API Token：https://dash.cloudflare.com/profile/api-tokens → 模板 **"Edit Cloudflare Workers"** → Create（CI 用 API Token，不能用浏览器登录态）
3. 把仓库地址 + Token + Account ID（`84de83c97d12040e5ab51ddc836c9f8d`）发我，我来推代码 + 配 GitHub Secrets

### ③ 补齐运行时凭据（当前为空占位，功能关闭/降级）
| 变量 | 影响 | 来源 |
|---|---|---|
| `MAIL_HTTP_KEY` | 邮件发送会失败（询盘通知发不出） | Resend API Key（先在 Resend 验证域名） |
| `GOOGLE_CLIENT_ID / SECRET` | Google 登录不可用 | Google Cloud Console（回调 `/api/auth/callback/google`） |
| `DEEPSEEK_API_KEY` | AI 评分/客服降级为本地规则引擎 | DeepSeek 平台 |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp 按钮不显示 | 你的 WhatsApp 号码（国际格式不带 +） |

拿到凭据后发我，我注入并重新 deploy 即可生效。

## GitHub Secrets 清单（CI 用）

| Secret | 值 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | ② 的 Token（权限：Workers Scripts Edit + Account Settings Read） |
| `CLOUDFLARE_ACCOUNT_ID` | `84de83c97d12040e5ab51ddc836c9f8d` |
| `DATABASE_URL` | Neon Pooled 连接串 |
| `DATABASE_URL_UNPOOLED` | Neon Direct 连接串 |
| `AUTH_SECRET` | 已生成（46 位随机串） |
| `NEXTAUTH_URL` | `https://factoryauditb2b.com` |
| 其他（WhatsApp/AI/Google 登录/邮件） | 可选，逐个补 |

## 手动部署速查（本地命令行，Windows）

```bash
# 1. 环境（必须，HOME 重定向避免 EPERM；NODE_OPTIONS="" 防 preload 破坏）
export HOMEDRIVE=F: HOMEPATH='\wb_home' USERPROFILE='F:\wb_home' \
  APPDATA='F:\wb_home\AppData\Roaming' LOCALAPPDATA='F:\wb_home\AppData\Local' \
  HOME='F:\wb_home' TEMP='F:\wb_home\temp' TMP='F:\wb_home\temp' \
  TMPDIR='F:\wb_home\temp' npm_config_cache='F:\wb_home\npm-cache' \
  npm_config_prefix='F:\wb_home\npm' NODE_OPTIONS=""

# 2. 登录凭据（OAuth 登录后复制到重定向 HOME 才能被识别）
cp "C:/Users/35726/AppData/Roaming/xdg.config/.wrangler/config/default.toml" \
   "F:/wb_home/AppData/Roaming/xdg.config/.wrangler/config/default.toml"

# 3. 构建（OpenNext 产物在 .open-next/ 连字符目录）
node_modules/.bin/opennextjs-cloudflare build --skipNextBuild   # 或先 next build

# 4. 注入 secrets（stdin 传值，防特殊字符）
printf '%s' "$VALUE" | node_modules/.bin/wrangler secret put KEY

# 5. 部署
node_modules/.bin/wrangler deploy
```

## 已完成的工程改造（勿回退）

| 文件 | 改动 |
|---|---|
| `package.json` | next 15.3.3→15.5.24；新增 @opennextjs/cloudflare、wrangler、@prisma/adapter-neon、@neondatabase/serverless；加 cf:build/cf:dev/cf:deploy 脚本 |
| `lib/db.ts` | 按 `DATABASE_URL` 前缀自动切 SQLite（本地）/ Neon（云端）；`PrismaNeon(new Pool({connectionString}))` 适配 Prisma 6.5 |
| `lib/notify.ts` | 新增 HTTP 邮件通道（`MAIL_PROVIDER=http`，Resend 兼容），Workers 必用 |
| `next.config.mjs` | 加 `serverExternalPackages`（Prisma/pg workerd 兼容） |
| `scripts/switch-db.cjs` | 切 Postgres 时自动补 `directUrl`，提示两种连接串 |
| `wrangler.jsonc` | Workers 配置（nodejs_compat + 静态资源 + **custom_domain 路由**） |
| `.github/workflows/deploy.yml` | 自动构建部署流水线（build → secrets → deploy） |
| `.env.example` | 完整环境变量说明（含 Cloudflare/Neon/邮件） |
| `.gitignore` | 加 .open-next/（**注意是连字符**，`.opennext/` 匹配不到） |
| `_patch-opennext.cjs` | Windows 构建补丁：替换坏掉的 `fs.cpSync`（CI Linux 不需要，node_modules 补丁不入库） |
| `scripts/fix-reify.cjs` | 恢复被中断 npm install 残留的重命名包（`.NAME-随机后缀`） |

## 实战踩坑记录（2026-08-31）

1. **wrangler.jsonc 入口路径**：OpenNext 输出目录是 `.open-next`（**连字符**），写 `.opennext` 会报 `entry-point file not found`。
2. **OAuth 凭据 + HOME 重定向**：Windows 上 build 必须重定向 HOME 到 `F:\wb_home`（否则 EPERM），但 wrangler 登录凭据存真实用户目录；部署前要把 `default.toml` 复制过去，否则 `whoami` 未认证。
3. **wrangler 4.127 移除 `subdomain` 命令**，且 OAuth token 调注册 API 报 `10405 Method not allowed`；workers.dev 子域名需手动在 dash 注册（不影响自定义域）。
4. **zone pending 也能绑定 custom domain**：`routes: [{pattern, custom_domain: true}]` 在 zone pending 时创建成功，等 NS 切换后自动生效。
5. **Prisma 6.5 + adapter-neon 版本匹配**：adapter 必须锁 6.5.0（6.19+ 新工厂式接口与 6.5 client 不兼容，报 `Cannot read properties of undefined (reading 'bind')`）。
6. **npm reify 残留**：SIGTERM 中断的 install 会把包重命名成临时目录，用 `scripts/fix-reify.cjs` 恢复；npm install 后 OpenNext 补丁要重打。

## 上线后必做（SEO/运营）

1. **GSC 验证**：Search Console 添加 `factoryauditb2b.com` → 用 `GOOGLE_SITE_VERIFICATION`（已支持）
2. **提交 sitemap**：`https://factoryauditb2b.com/sitemap.xml` 到 GSC / Bing Webmaster
3. **换真邮箱**：Resend 里验证发件域名 `factoryauditb2b.com`（SPF/DKIM 记录，Resend 会给出），送达率才有保障
4. **Google OAuth**：如果要用 Google 登录，在 Google Cloud Console 配置 OAuth 客户端（回调 `https://factoryauditb2b.com/api/auth/callback/google`）
5. **HTTPS**：Cloudflare 自动签发（橙色云朵开启），无需额外配置

## 已知限制（Cloudflare Workers 环境）

- **限流降级**：`lib/rateLimit.ts` 是内存计数，Workers 无状态（每次请求可能不同实例），限流阈值会放宽——不影响功能，后续可换 KV
- **Workers 免费额度**：10 万请求/天，个人站足够；Worker 体积压缩后需 <3MB（本项目实测 gzip 1.9MB，够）
- **图片优化**：next/image 需 Cloudflare Images 或改用本地 public/ 静态图（本项目全是 public/ 静态图，无影响）
