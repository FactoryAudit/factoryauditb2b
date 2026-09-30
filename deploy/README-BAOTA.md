# FactoryAuditB2B → 香港服务器（宝塔）部署指南

> 目标：把本站从 **Cloudflare Workers** 迁到你的香港服务器，用宝塔的 Node 项目管理。
> 数据库**不动** —— 继续用 Supabase 云端，服务器上不装 Postgres。

---

## 一、先读这一段：可行性前置检查

在动手前，请先确认服务器满足下面三条。任一条不满足，迁移的收益会小于代价。

| 项目 | 最低 | 建议 | 怎么查 |
|---|---|---|---|
| 内存 | **1 GB** | 2 GB+ | 宝塔首页「系统信息」 |
| Node 版本 | **20.9** | 22 LTS | 宝塔 → Node 版本管理器 |
| 月流量 | **100 GB** | 300 GB+ | 服务商控制台 |

**为什么内存是硬门槛**：本站有 ~1500 个预渲染页面，`next start` 启动后常驻约 200–400 MB；再叠加并发请求，1 GB 会非常紧。
**本指南采用「本地构建 + 上传产物」**（不在服务器上跑 `next build`），已把那 1–2 GB 的构建峰值留在了开发机 —— 这是 1 GB 机器能跑起来的前提。

**为什么流量要盯**：Cloudflare 免费版在全球边缘缓存你的静态资源、且不计流量。搬到香港单机后，**每一个海外访客的每个字节都要从这台机器出**。如果你的套餐是 1 Mbps 带宽或每月 50 GB 流量，欧美买家会明显变慢，甚至跑爆流量。

> ⚠️ **先说清代价，再决定。**

### 迁移会失去什么（务必知情）

| 失去的能力 | 影响 |
|---|---|
| 全球边缘 CDN | 欧美买家从「就近节点」变成「绕到香港」。静态资源影响小（有 `/_next/static` 长缓存），HTML 首字节会变慢 |
| 免费 DDoS / WAF | 单机暴露，被打就是真被打 |
| 现成的发布链 | 现在的九步发布 + 3 道验收门（含线上产物 md5 对拍）**全部作废**，改为本文的流程 |
| 自动 SSL 续期以外的运维 | 系统补丁、Node 升级、磁盘、备份都要你自己管 |

### 迁移能得到什么

| 得到的能力 | 说明 |
|---|---|
| **内存不再有 128 MB 天花板** | 这正是 Error 1102 的根因。单机可用内存 = 你买多少有多少 |
| 无 CPU 时长限制 | 可跑长任务（批量导出、PDF 生成、定时抓取） |
| 完全可控 | 日志、进程、端口都在自己手里 |

> 💡 **补充一条更省事的备选**：如果 1102 是唯一动因，其实还有一个**零成本方案** —— 在 Cloudflare 加一条 Cache Rule（Edge TTL 2h，排除 `/api/*`、`/login`、`/account*`、`/admin*`），让预渲染 HTML 走边缘缓存、不再每次穿透 Worker。这能在 Free 套餐内大幅降低 1102 复发率，且**不需要搬家**。
> 如果你要的是「不受 CF 限制」，那就继续往下走。

---

## 二、部署步骤

### 步骤 0 · 本地：构建并打包产物

在开发机（`F:\AI-验厂SEO网站`）执行：

```bash
# ① 用 standalone 模式构建（走代理，否则构建期拿不到 Supabase 数据会静默降级）
export FAB2B_OUTPUT=standalone
export FAB2B_DISABLE_BUILD_TRACE=1
export FAB2B_PROXY=http://127.0.0.1:7897
export NODE_OPTIONS="--require=$(pwd)/scripts/with-proxy.cjs"
node node_modules/next/dist/bin/next build

# ② 组装 + 完整性自检 + 打成上传包（一条命令）
bash deploy/pack.sh
```

产出两个东西：

| 路径 | 内容 |
|---|---|
| `_baota_pkg/` | 组装好的可运行目录（321 MB / 9039 文件） |
| `_baota_upload.tar.gz` | **要上传到服务器的那个包**（66 MB） |

**怎么判断成功**：脚本末尾必须打印 `✓ 打包完成`，且 6 个关键路径全为 `✓`，外加一条安全断言：

```
  ✓ server.js          ✓ package.json      ✓ node_modules
  ✓ .next/static       ✓ .next/server      ✓ public
  ✓ 未夹带 .env（构建期密钥未泄漏）
```

`.next/static` 或 `public` 缺失是最常见的翻车点 —— 症状是**线上页面没样式、favicon 404**。

> 🔴 **为什么用 `deploy/pack.sh` 而不是 `package-standalone.mjs`**
> 在 WorkBuddy 的 Windows 沙箱里，node 进程被注入了文件安全守卫：`fs.cpSync` 一次性递归拷 6900+ 文件会被**静默杀掉**（exit 127，没有任何报错，看起来像"脚本跑一半没了"）。同一份目录用外部 `cp -r` 则完全正常。
> 又因为本机 node 调 `spawnSync/execFileSync` 会恒报 EBUSY，**没法在 mjs 里改调外部命令**，所以打包只能由 shell 完成。
> `package-standalone.mjs` 保留在仓库里 —— 在没有守卫的普通机器（你自己的终端 / CI）上它依然可用，两者产物等价。

---

### 步骤 1 · 服务器：装齐三个组件

宝塔面板 → **软件商店**，依次安装：

1. **Nginx**（一般已装）
2. **Node.js 版本管理器** → 安装 **Node 22 LTS**，并「设为命令行默认」
3. **PM2 管理器**（若你的宝塔版本没有，用命令装：`npm i -g pm2`）

**怎么判断成功**：宝塔终端里执行

```bash
node -v      # 应输出 v22.x
pm2 -v       # 应输出版本号
```

---

### 步骤 2 · 上传并解压

用宝塔「文件」功能把 `_baota_upload.tar.gz` 上传到 `/www/wwwroot/`，然后解压到独立目录：

```bash
mkdir -p /www/wwwroot/factoryauditb2b
tar -xzf /www/wwwroot/_baota_upload.tar.gz -C /www/wwwroot/factoryauditb2b
cd /www/wwwroot/factoryauditb2b
ls -1        # 应看到 server.js / node_modules / .next / public / ecosystem.config.js
```

**怎么判断成功**：`ls` 里同时有 `server.js` 和 `node_modules`。缺 `node_modules` = 包没打对，回步骤 0。

---

### 步骤 3 · 填环境变量

```bash
cd /www/wwwroot/factoryauditb2b
cp env.production.example .env.production
# 用宝塔「文件」编辑器打开 .env.production 逐项填写
```

最少必填这 5 项（其余留空不会导致启动失败，只会关掉对应功能）：

```
NEXT_PUBLIC_SITE_URL=https://factoryauditb2b.com
SUPPLIER_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**想开通在线收款**，还要填（详见 `env.production.example` 里的说明）：

```
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
```

> 🔴 `SUPABASE_SERVICE_ROLE_KEY` 绝不能加 `NEXT_PUBLIC_` 前缀 —— 加了会被打进浏览器可下载的 JS 里。

---

### 步骤 4 · 启动应用

```bash
cd /www/wwwroot/factoryauditb2b
pm2 start ecosystem.config.js
pm2 save                       # 保存进程列表，服务器重启后自动拉起
pm2 logs factoryauditb2b --lines 30
```

**怎么判断成功**（**关键**：一定要先在本机 curl 一次，再用浏览器）：

```bash
curl -s -o /dev/null -w "HTTP=%{http_code}\n" http://127.0.0.1:3000/
```

- `HTTP=200` → 应用起来了，继续步骤 5
- `HTTP=000` 或连接被拒 → 看 `pm2 logs`，多半是端口占用或 Node 版本过低

> ⚠️ 此时**不要**用 `http://服务器IP:3000` 去访问。`HOSTNAME=127.0.0.1` 只监听回环是**故意**的（不让 3000 裸奔在公网），对外一律走 nginx。

---

### 步骤 5 · 宝塔建站 + 反向代理

1. 宝塔 → **网站** → 添加站点，域名填 `factoryauditb2b.com`（**不要**勾选「创建数据库」——我们用 Supabase 云库）
2. 进入该站点 → **配置文件**，把 `deploy/nginx.conf` 里【BEGIN 反向代理】到【END 反向代理】之间的内容粘进去，保存
3. 站点 → **SSL** → Let's Encrypt → 申请证书，并打开「强制 HTTPS」

**怎么判断成功**：

```bash
curl -sI https://factoryauditb2b.com/ | head -5
```

此时若 DNS 还指向 Cloudflare，可能仍返回旧站，属正常 —— 下一步才切。

---

### 步骤 6 · 切 DNS

⚠️ **这是唯一有真实停服风险的步骤。** 先做一次备份与回滚预案：

**切之前**：记下当前 Cloudflare 的配置（截个图）。回滚 = 把 DNS 改回去，5–30 分钟生效。

**切换**（Cloudflare 后台 → DNS）：

- 方案 A（**推荐**）：保留 Cloudflare 托管 DNS，把 `factoryauditb2b.com` 的 A 记录改成**香港服务器 IP**，并把小云朵**关掉（灰云 / DNS only）**
- 方案 B：把域名的 NS 换到别处，由宝塔直接解析

> 🔴 如果选了 A 但**不关小云朵**，Cloudflare 仍会拦在你和服务器之间；而厂牌 `factoryauditb2b` 的 Worker 路由会继续抢占流量 —— 必须同时去 **Workers → 你的服务 → 设置 → 触发器** 里删掉 `factoryauditb2b.com/*` 这条 route，否则请求永远打到 Worker，永远到不了香港服务器。

---

### 步骤 7 · 验收清单

逐条过，全绿才算迁完：

```bash
BASE=https://factoryauditb2b.com

# 1) 首页 / 9 语随机抽 3 个
for p in / /zh /de /ar; do
  printf "%-6s HTTP=%s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")"
done

# 2) SEO 三件套
for p in /robots.txt /sitemap.xml /llms.txt; do
  printf "%-16s HTTP=%s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")"
done

# 3) 静态资源带长缓存
curl -sI "$BASE/_next/static/" | grep -i "cache-control"   # 期望含 max-age=31536000

# 4) 静态资源真的能取到（取首页引用的任意一个 chunk）
curl -s "$BASE/" | grep -o '/_next/static/[^"]*\.js' | head -1
```

浏览器手测 4 件事：

1. 首页正常、样式正常、favicon 正常
2. `/suppliers` 能看到供应商列表（匿名态公司名脱敏、卡片指向 `/login?next=`）
3. 登录后 `/account` 能打开
4. `/zh/admin/members` 用你的管理员账号能打开，且能看到「档位」下拉

---

## 三、日常运维

| 场景 | 命令 |
|---|---|
| 看日志 | `pm2 logs factoryauditb2b` |
| 重启 | `pm2 restart factoryauditb2b` |
| 停 | `pm2 stop factoryauditb2b` |
| 改环境变量后 | 必须 `pm2 restart factoryauditb2b --update-env`（否则读的还是旧值） |
| 重新部署 | 重复步骤 0 → 2 → `pm2 restart` |

> 🔴 **改代码/改文案后必须重新构建上传** —— 本站的 HTML 是构建期预渲染的，改完源码不重新构建、直接重启是**没有效果**的。

> 🔴 **改数据库内容（供应商资料等）后同样要重新构建 + 重新上传** —— 预渲染把数据冻结在构建那一刻。

---

## 四、故障对照表

| 症状 | 最可能的原因 | 处置 |
|---|---|---|
| 页面无样式 / 一片白 | `.next/static` 或 `public` 没拷进包 | 回步骤 0，用 `bash deploy/pack.sh` 重新打包 |
| `502 Bad Gateway` | 应用没起来 / 端口不对 | `pm2 logs`；`curl 127.0.0.1:3000` |
| 启动即退出，日志 `Cannot find module` | `node_modules` 没随包上传 | 检查解压完整性 |
| 供应商列表是空的 / 只有 4 家 | 构建期没拿到 Supabase 数据（静默降级到静态常量） | 本地构建必须带 `FAB2B_PROXY`；检查构建日志有无 `query failed` |
| 改了 `.env` 没生效 | PM2 缓存了旧环境 | `pm2 restart factoryauditb2b --update-env` |
| `/pricing` 点付款跳到人工页 | PayPal 密钥没填全 | 检查 `PAYPAL_CLIENT_ID` / `SECRET` / `WEBHOOK_ID` |
| 用户付了钱但会员没开 | webhook 没配或验签失败 | 看 `pm2 logs` 里 `[payments]` 开头的行 |
| DNS 改了还是旧站 | Cloudflare 小云朵没关 / Worker route 没删 | 见步骤 6 的红字提示 |

---

## 五、回滚

**30 秒回滚**：Cloudflare DNS 的 A 记录改回原值（若原为 Worker，则重新补上 Worker route）。CF 的 DNS 生效很快。

**注意**：回滚回 Cloudflare 后，**代码仍需重新用 CF 模式构建部署**才能同步你在香港服务器期间的新改动 —— 两条路的产物不通用。

---

## 六、附：为什么不用服务器构建

如果你坚持在服务器上 `next build`（比如服务器配置很强、想省上传时间）：

```bash
cd /www/wwwroot/factoryauditb2b-src
npm ci
FAB2B_DISABLE_BUILD_TRACE=1 npx next build
```

但这要求：

- 内存 ≥ **2 GB**（否则预渲染阶段 OOM），
- 服务器能直连 `*.supabase.co`（香港可达，这点没问题），
- 且要额外上传**完整源码**（含 `node_modules` 或允许服务器 `npm ci`）。

对 1 GB 的机器，这条路会失败。
