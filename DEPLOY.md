# 商业化上线清单（小白照做版）

> 目标：**尽快开始收到真实客户询盘并成交收款。**
> 你不用懂技术，照着顺序点就行。每一步都写了「去哪、点什么、填什么」。

---

## 一、先花 1 分钟搞懂：钱是怎么进来的

```
海外买家搜索 → 进入你的落地页 → 提交需求（询盘）
      ↓
  你的邮箱收到通知  ← ⚠️ 现在这里是断的
      ↓
  你邮件/WhatsApp 跟进报价
      ↓
  客户付款（对公转账 / PayPal / Wise）→ 成交
```

**现在卡在哪**（我已经体检过了）：

| 环节 | 状态 | 说明 |
|---|---|---|
| 落地页 + 询盘表单 | ✅ 已做好 | 9 语言、行业/国家落地页、培训方案页都在 |
| 询盘存数据库 | ✅ 本地正常 | 但上线后必须换 Postgres，否则会丢 |
| **邮件通知** | ❌ **断的** | `.env` 里是 Ethereal **测试假邮箱**，客户询盘**根本发不到你邮箱** |
| **站点上线** | ❌ 没上线 | 还在 `localhost:3000`，客户找不到你 |
| 在线收款 | ⏸ 未接 | 建议先线下成交，不阻塞赚钱 |

**结论：只要打通「真实邮箱 + 上线」这两件事，你就能开始收询盘赚钱了。**

---

## 二、开张必做 3 件事（今天就能做完，约 20 分钟）

### 第 1 件：换一个能真发信的邮箱（约 5 分钟）★最优先

没有这一步，客户询盘全丢，前面所有努力白费。

**推荐用 QQ 邮箱**（国内稳定、免费）：

1. 登录 <https://mail.qq.com> → 顶部「设置」→「账户」
2. 往下找到「POP3/IMAP/SMTP/Exchange/CardDAV 服务」
3. 开启「**IMAP/SMTP服务**」→ 按提示用手机发短信 → 页面给你一串 **16 位授权码**（长这样 `abcdefghijklmnop`）
4. 打开项目根目录的 `.env` 文件，把邮件那几行改成：

```env
SMTP_HOST="smtp.qq.com"
SMTP_PORT=465
SMTP_USER="你的QQ号@qq.com"
SMTP_PASS="刚才那16位授权码"
NOTIFY_ADMIN_EMAIL="你日常收信的邮箱"
FROM_EMAIL="你的QQ号@qq.com"
```

5. 回到命令行，运行一次自检：

```bash
npm run check:smtp
```

- 显示 **全部通过** → 去收件箱确认收到测试邮件（没有就看垃圾箱）
- 显示 `[FAIL] 你用的还是 Ethereal` → 说明没改对，重做第 4 步
- 显示 `EAUTH` → 授权码填错了（注意：是**授权码**，不是 QQ 登录密码）

> 自检脚本我已经做好了，它会用大白话告诉你哪错了、怎么改。

---

### 第 2 件：建一个免费数据库（约 5 分钟）

**为什么必须做**：现在是 SQLite（本地文件数据库）。Vercel 的服务器文件系统是临时的，客户询盘会**随时丢失**。生产必须用 PostgreSQL。

1. 打开 <https://neon.tech> → 用 GitHub 或邮箱注册（免费）
2. 点「Create Project」，名字随便填（如 `factoryaudit`），地区选 **Singapore** 或 **Tokyo**（离亚洲近）
3. 建好后，页面上会有一串 **Connection string**，点复制（形如 `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb`）
4. 打开 `.env`，改这一行：

```env
DATABASE_URL="粘贴刚才的连接串?sslmode=require"
```

5. 命令行执行（切换数据库 + 建表 + 灌数据）：

```bash
npm run db:postgres
npx prisma db push
npm run db:seed
```

---

### 第 3 件：部署上线（约 10 分钟）

1. 注册 <https://vercel.com>（用 GitHub 账号登录最省事）
2. 先把代码传到 GitHub：
   - 装 <https://desktop.github.com>（图形界面，不用敲命令）
   - 把 `F:\AI-验厂SEO网站` 这个文件夹加进去 → Commit → Publish repository（选 Private 私有）
   - > 我已经建好 `.gitignore`，你的密钥和 `.env` **不会**被传上去
3. 回到 Vercel → 「Add New」→「Project」→ 选中刚才的仓库 → Import
4. **关键**：在 Environment Variables 里，把 `.env` 里每一行 `键=值` 逐个添加进去
   （尤其是 `DATABASE_URL`、所有 `SMTP_*`、`NOTIFY_ADMIN_EMAIL`、`FROM_EMAIL`、`AUTH_SECRET`、`NEXTAUTH_URL`）
5. 点 Deploy，等 3-5 分钟 → 成功后会给你一个网址（如 `xxx.vercel.app`）

**上线后立刻改这两处**：

- `NEXTAUTH_URL` 改成你的正式地址
- 去 <https://dashboard.vercel.com> → 项目 → Settings → Domains → 绑定你的域名 `factoryauditb2b.com`
  （按页面提示，去你的域名服务商加一条 CNAME 解析即可）

---

## 三、上线后 24 小时内要做（这决定有没有客户）

### 1. 让 Google 收录你（免费流量，最重要）

1. 打开 <https://search.google.com/search-console> → 添加域名 → 验证所有权
2. 左侧「站点地图」→ 填 `https://你的域名/sitemap.xml` → 提交
3. 同样去 <https://www.bing.com/webmasters> 再提交一次（Bing 的结果会进 Copilot 和 Edge）

> 你的 sitemap 已经有 **729 个页面**（9 语言 × 行业页/国家页/工具页），提交后 1-4 周开始收录。

### 2. 改掉后台默认密码（安全）

现在后台是 `admin@factoryauditb2b.com` / `FactoryAudit2026!`。
上线后必须改：打开 `prisma/seed.js`，搜索 `FactoryAudit2026!` 改成你自己的强密码，重新 `npm run db:seed`。

---

## 四、收到询盘后怎么跟进（成交 SOP）

客户提交后会自动发生两件事：
1. **你**收到一封新线索通知邮件（含姓名/邮箱/公司/国家/意向分/需求）
2. **客户**收到一封「已收到，1 个工作日内回复」的确认邮件

**你的标准动作**：

1. 每天早晚各看一次 `/admin/leads` 和邮箱
2. 意向分 ≥ 60 的，**当天**回复（越慢越容易被同行截走）
3. 第一封回复模板（英文）：
   > Hi [Name], thanks for reaching out. We can run a [audit type] in [country] within X days.
   > To scope it accurately, could you share: product category, factory location, target market, and your required standard (SMETA/BSCI/ISO 9001)?
   > Here's our training plan overview: https://你的域名/training-plans
4. 报价后把状态改成 CONTACTED → WON / LOST（后台可改）

**收款方式（先线下，最快见效）**：
对公转账 / PayPal / Wise 都可以，和你的小程序一样走线下，不用等支付接口资质。
等每月稳定有询盘了，再上 Stripe 在线收款（见第五节）。

---

## 五、下一步（等有稳定询盘再做，不着急）

- **在线收款**：Stripe（海外卡）+ 支付宝。需要企业资质，我可以帮你接，但建议月询盘稳定后再做
- **会员付费墙**：Starter / Professional / Enterprise 三档，工厂详情页登录后按等级可见
- **WhatsApp 入口**：海外买家很爱用，给我你的号码，我加到落地页 CTA 上
- **日文/阿语旧文案补全**：目前这两个语言的**旧版页面段落**还是英文占位（新落地页已全部翻译好）。
  原因是 Google 翻译接口限流。脚本已备好，限流恢复后运行即可自动补全：
  ```bash
  python gen_i18n_v2.py   # 只补英文占位，不会覆盖已翻译好的内容
  npm run build
  ```

---

## 六、已为你准备好的工具（命令行运行）

| 命令 | 作用 |
|---|---|
| `npm run check:smtp` | **邮件自检**——客户询盘能不能进你邮箱，大白话报错 |
| `npm run db:status` | 看当前用的是 SQLite 还是 PostgreSQL |
| `npm run db:postgres` | 一键切到 PostgreSQL（上线用） |
| `npm run db:sqlite` | 一键切回 SQLite（本地开发用） |
| `npm run build` | 构建（含 prisma generate，Vercel 不会失败） |
| `npm run dev` | 本地预览 http://localhost:3000 |

---

## 七、遇到问题怎么办

| 现象 | 原因 / 解决 |
|---|---|
| `npm run check:smtp` 报 EAUTH | 用了登录密码 → 要用**授权码** |
| 报 ECONNECTION / 超时 | 端口被拦 → 465 和 587 都试一下 |
| Vercel 部署失败 | 多半是 Environment Variables 没填全，尤其是 `DATABASE_URL` |
| 部署后页面能开但提交报错 | Postgres 没建表 → 本地跑 `npx prisma db push` 再重新部署 |
| 收不到客户询盘 | 先跑 `npm run check:smtp`；再看垃圾邮件箱 |

---

## 附：生产环境变量清单（Vercel 里要填的）

```
DATABASE_URL           Postgres 连接串（末尾加 ?sslmode=require）
AUTH_SECRET            强随机值（openssl rand -base64 32 生成）
NEXTAUTH_URL           https://你的域名
SMTP_HOST / PORT / USER / PASS   真实邮箱 SMTP
NOTIFY_ADMIN_EMAIL     你收询盘通知的邮箱
FROM_EMAIL             发件地址（建议和 SMTP_USER 一致）
GOOGLE_CLIENT_ID/SECRET  可选，配置后可用 Google 登录
DEEPSEEK_API_KEY       可选，配置后 AI 分析更准（留空也能跑）
```
