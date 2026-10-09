# 发布流程规则（Release Process Rules）

> 本文件是**发布流程的硬规则**，不是说明文档。每次正式发布前逐条对照。
> 违反这里的规则会导致「改了数据库但线上没变」这类**看起来像 bug、其实不是**的问题。

---

## 规则 0：构建必须走九步链路（第 0 / 1.5 / 1.6 步不得跳过）

> 本规则描述**当前唯一可用的发布链路**。
> 它同时更正本文档其它位置对 `cf-release.cjs` 的描述：本机 `spawnSync` 恒 EBUSY，
> 该脚本在 `populate` 分批派生子进程时必然失败（`第 1 批失败（exit=null）`），**不可用**。

### 九步 + 链内强制门 1.6

| 步 | 命令 | 通过标志 |
|---|---|---|
| **0** | `node scripts/build-preflight-check.mjs` | `EXPECTED_SUPPLIERS=<n>, EXPECTED_GUIDES=<m>` |
| **1** | `node node_modules/next/dist/bin/next build 2>&1 \| tee outputs/_next_$(date +%Y%m%d%H%M%S).log` | 日志 0 行 `query failed` |
| **1.5** | `node scripts/build-postflight-check.mjs --log outputs/_next_<上一步时间戳>.log` | `POSTFLIGHT_OK` |
| **1.6** | `node scripts/_r25_verify_wall.cjs` | `PASS 13 / FAIL 0`（`/suppliers` 登录墙产物门） |
| 2 | `node node_modules/@opennextjs/cloudflare/dist/cli/index.js build` | — |
| 3 | 循环 `node scripts/populate-static-assets-cache.cjs --worker --batch 250` 至输出 `DONE` | 末行 `DONE` |
| 4 | `node scripts/populate-static-assets-cache.cjs --check` | `[populate] OK` |
| 5 | `node scripts/scrub-next-env.mjs` | 打印清空处数 |
| 6 | `node scripts/verify-opennext-bundle.mjs` | `ALL PASS`（含 en 叶子数闸门） |
| 7 | `OPEN_NEXT_DEPLOY=true node node_modules/wrangler/bin/wrangler.js deploy` | 输出新版本 UUID |

**任一步 exit != 0 ⇒ 立即停止，不执行后续步骤。**

> 第 **1.6** 步与第 0 / 1.5 / 8 步一样是**强制门，不得跳过**。它读的是 `.next/server/app` 的
> 预渲染产物，所以只能落在链内：`.next` 在本脚本开头就被改名隔离后重建 ⇒ 只有链内这一份
> 才是「即将被部署的那份」；而它排在第 7 步 deploy **之前** ⇒ 门失败时站点尚未变更（fail-safe）。
> 探针是本地未入库文件（`.gitignore` 的 `scripts/_*.cjs`），故 `release.sh` 显式检查其存在性，
> 缺失即 `exit 1`，**不静默跳过**。

> 上述九步负责**产出并部署**。部署之后还有一道**强制门**（第 8 步，`scripts/release.sh` 已内置）：
> `node scripts/verify-live-md5.cjs` ⇒ 末行必须是 `LIVE_MD5_OK`。
> 判据与失败处置见 **规则 5**。探针 PASS ≠ 发出去的是这份构建，两件事。

⚠️ 第 3 步必须是**外层 shell 循环**：脚本自身的主模式靠 `spawnSync` 派生子进程，本机必挂。

### 推荐入口

推荐用 `bash scripts/release.sh` 一次性执行九步（含链内 1.6 强制门）。它带 `set -e -o pipefail`，
任一步失败即停，避免人工跳步。手工执行时请严格按九步表（含 1.6）的顺序。

（脚本已内置下方「前置动作」的四个环境变量 —— `FAB2B_PROXY` / `NODE_OPTIONS` 注入
`with-proxy.cjs` / `FAB2B_DISABLE_BUILD_TRACE=1` / `NEXT_TELEMETRY_DISABLED=1`，
外部显式赋值仍可覆盖。跑之前**不需要**手工 export 任何东西。）

### 第 0 步与第 1.5 步为什么不得跳过

`next build` 的**数据源失败不报错**。`lib/queries.ts` 的设计是
「Supabase 查不到 → 静默回落 `lib/staticData.ts` 的 `STATIC_SUPPLIERS`」，于是：

- 供应商 11 家 → 4 家（`STATIC_SUPPLIERS` 恰好 4 条）
- `/suppliers/<slug>` 预渲染产物 99 篇 → 36 篇（`en` 目录只剩 4 篇）
- `next build` **EXIT 仍为 0**，日志里只留一行 `[queries] suppliers query failed`

⇒ 没有第 0 步，坏构建照样往下走；没有第 1.5 步，
要等 `opennext build` + `populate` + `deploy` 全部跑完、**缺页站点已经上线**才发现。

### 第 1.6 步（登录墙产物门）的自证记录

门自己也要被验 —— 拿一个没跑过的哨兵去守访问控制，等于没守。2026-09-30 首次自证，
两组对照，`scripts/_r25_verify_wall.cjs` **未修改**（A/B 两组跑的是同一个文件）：

| 组 | 对象 | 期望 | 实测 |
|---|---|---|---|
| **A 对照组（无墙）** | 线上 r24 抓下来的 `/suppliers` + `/` + `/login` | FAIL | `PASS 6 / FAIL 7`，exit 1 |
| **B 实验组（有墙）** | 本次 `next build` 的产物 | PASS | `PASS 13 / FAIL 0`，exit 0 |

复现 A 组：`curl -sS --noproxy '*' -H 'Accept-Encoding: identity'` 抓线上三份 HTML，
按 `<dir>/server/app/{en.html,en/suppliers.html,en/login.html}` 铺开，整体换入 `.next` 再跑门。
🔴 **不得用 `execFileSync('curl', …)`** —— 本机 `spawnSync` 恒 EBUSY（同 `cf-release.cjs` 挂掉的成因）。

⛔ **自证时发现并修掉的真实缺陷（教训）**：门的首页产物候选路径只写了 `en/index.html`，
而真实落点是 `.next/server/app/en.html`（见 `verify-live-md5.cjs` 的 `artifactFor()`），
⇒ **D 组断言（首页 "View sample record" 已改指登录页）长期静默跳过**。
已补上该路径，并把「三份产物定位失败」从静默跳过改为**显式 FAIL**。
**通则：任何 `if (xxxHtml) { … }` 形态的守卫，都必须配一条「定位失败即 FAIL」** —— 否则门看着绿，其实没查。

### 前置动作（仅当第 1 步要重建时才需要）

```bash
export NEXT_TELEMETRY_DISABLED=1
export FAB2B_DISABLE_BUILD_TRACE=1    # 不带 ⇒ EPERM .next\trace 秒崩
export FAB2B_PROXY=http://127.0.0.1:7897   # 不带 ⇒ 被环境里的 :5701 劫持
export NODE_OPTIONS="--require F:/AI-验厂SEO网站/scripts/with-proxy.cjs"

# 清 Data Cache（规则 1）+ 避开 safe-delete 护栏：整包改名挪走，不要 rm -rf
node -e "const fs=require('fs');if(fs.existsSync('.next'))fs.renameSync('.next','_prune_next_'+Date.now())"
```

### 第 1 步的日志名必须带时间戳

`outputs/_next_$(date +%Y%m%d%H%M%S).log`

第 1.5 步在没有显式 `--log` 时，会在 `outputs/` 里自动挑选最新的 next|build 日志。
带时间戳的名字能**唯一确定「本次构建」**；否则可能被 `_g42_build1.log` 这类历史日志抢走 ——
用**上一轮的干净日志**替**本轮的坏产物**背书，就是一次假 PASS。
（自动挑选到历史命名时，第 1.5 步会打印告警，但告警不等于拦截，所以命名规范必须遵守。）

### 失败处理

| 失败步 | 处理 |
|---|---|
| **第 0 步** | 先诊断**数据源**：代理是否 `:7897`、`.env` 里 `SUPABASE_SERVICE_ROLE_KEY` 是否齐、数据库 `suppliers where is_published=true` 是否有行。修好后**从第 0 步重跑**。 |
| **第 1.5 步** | **不继续**第 2 步。失败块第一行是**第 ③ 项（构建日志）**的证据（刻意排在最前：日志里有失败痕迹是「因」，页数不符只是「果」）；据此定位后**从第 1 步重跑**（第 0 步已通过，不必重跑）。 |
| 第 3/4 步 | 复制未跑完 ⇒ 继续循环 `--worker`；契约不符 ⇒ 重跑第 2 步 + 第 3 步。 |

### 输出契约（可被外层脚本 grep）

| 场景 | 输出 | exit |
|---|---|---|
| preflight 成功 | `EXPECTED_SUPPLIERS=<n>, EXPECTED_GUIDES=<m>` | 0 |
| preflight 失败 | 含子串 `数据源失败，中止构建` | 1 |
| postflight 成功 | `POSTFLIGHT_OK` | 0 |
| postflight 失败 | 含子串 `构建产物不符` | 1 |

⚠️ 用 `tee` 的第 1 步在 `set -e` 下**必须**同时 `set -o pipefail`，
否则管道退出码取 `tee` 的（恒 0），"任一步失败即停"会静默失效。

---

## 规则 1（最重要）：数据库修改 → 正式发布时必须重新 build/deploy

### 为什么

生产用的是**只读静态资源增量缓存**：

```
open-next.config.ts
  incrementalCache: staticAssetsIncrementalCache
  enableCacheInterception: true
        ↓
构建时：.open-next/cache/  →  复制进  assets/cdn-cgi/_next_cache/
        ↓
该缓存的 set() / delete() 都是 no-op
        ↓
⇒ 页面数据在**构建时冻结**，运行时无法写回
```

后果是：**前台页面在构建时冻结**，运行时无法写回。

| 路由类型 | 实例 | Cache-Control | 数据时效 |
|---|---|---|---|
| 预渲染 / ISR（**当前全部前台路由**） | `/industrial-clusters`、`/industrial-clusters/**`、`/suppliers`、`/suppliers/[slug]`、首页、`/countries` 等 | `s-maxage=3xxx, stale-while-revalidate=2592000` + `x-nextjs-prerender: 1` | **冻结到下次构建** |

⚠️ 特别注意：**`export const revalidate = 3600` 当前不生效**。
它不是「每小时自更新」，而是「构建时快照，直到下次 build + deploy 才变」。

### 🔴 订正（2026-09-30 实测）：`/industrial-clusters` 已**不是** `force-dynamic`

本文档此前把 `/industrial-clusters` 列为 `force-dynamic`（`private, no-cache, no-store`，即时读库），
据此推出「产业带页立刻可见、只有详情页是快照」的诊断。**该前提已失效。**

实测证据（两条独立）：

1. `curl -sSI https://factoryauditb2b.com/industrial-clusters` ⇒
   `Cache-Control: s-maxage=2930, stale-while-revalidate=2592000` + `x-nextjs-prerender: 1`（**预渲染**特征，
   非 `private, no-cache`）。
2. `node scripts/verify-live-md5.cjs /industrial-clusters` ⇒ **`LIVE_MD5_OK`**
   （线上响应体与 `.next/server/app/en/industrial-clusters.html` 逐字节相同 ⇒ 是静态产物）。

源码侧同样如此：`app/[locale]/industrial-clusters/page.tsx` 与
`app/[locale]/industrial-clusters/[...segments]/page.tsx` **都是** `export const revalidate = 3600`，
且两个文件的注释自己就写着「**stage1.8：本路由已由 force-dynamic 改为预渲染（构建期冻结）**」。

⇒ **结论：现在没有任何前台路由是「即时读库」的。改库之后要线上可见，一律必须重新发布。**

### 具体症状（会误判为 bug）

- 后台把某供应商的 `cluster_slug` / `region` 填好 → **产业带页和该供应商详情页都不会变**
  （两者同为构建期快照）。别再把「产业带页也没变」当成 bug 去查库。
- 后台把 `is_published` 改为 true → 目录页与详情页**都不变**，需重新发布。
- 首页新增的入口区块、新页面文案，改完库不重新发布就不变。
- 唯一例外是**后台自己的管理界面**：它读的是实时数据，**不要**拿它当「线上已经更新」的依据。

### 规则

**凡改动了数据库内容（`suppliers`、`industrial_clusters`、`leads` 等任何前台会展示的表），
要让变化出现在线上，必须重新跑一次完整发布。**

```bash
# 唯一发布入口 = 规则 0 的九步链路（含部署后的第 8 步落地对拍）
bash scripts/release.sh
```

> 🔴 订正：此前这里写的是 `node scripts/cf-release.cjs`，**已不可用**。
> 本机 `spawnSync` 恒 EBUSY，该脚本在派生子进程时必挂（规则 0 开头已声明）。以 `release.sh` 为准。
> 另：IndexNow 增量提交**不在** `release.sh` 内，是独立一步
> （`post-publish-submit.cjs`，只提 sitemap 差量；要全量先清 `scripts/.sitemap-cache.txt`）。

### 配套动作：发布前必须清 `.next/cache`

Next 的 Data Cache 会跨构建复用。不清的话，即使重新 build，
**上一轮的库快照可能被继续复用**，发布等于没发。

```bash
# 用整包改名挪走（同时规避沙箱 safe-delete 守卫，不要 rm -rf）
node -e "const fs=require('fs');if(fs.existsSync('.next')){const t='.next.trash-'+Date.now();fs.renameSync('.next',t);console.log('moved ->',t)}"
```

然后正常 build + release。

### 什么时候**不**适用

- 纯代码改动（文案在字典里、组件逻辑、样式）→ 本来就要 build，规则自然满足。
- 后台**频繁**修改供应商资料的阶段到来之前 → 不要为此改成 R2 ISR。
  届时另开一个 CACHE/ISR Change Set，二选一：
  1. 配 R2 增量缓存（`incrementalCache: r2IncrementalCache`，真 ISR 按窗口更新）；
  2. 去掉 `revalidate` 并恢复 `export const dynamic = "force-dynamic"`（放弃静态产物换实时）。
  ⚠️ 无论选哪条，都**不要**加 Cache Rule 边缘缓存覆盖 `/suppliers` —— 那会按边缘 TTL 提供过期档案。

---

## 规则 2：清理必须走维护窗口，不在功能迭代中顺手做

`.next.bak-*` / `.open-next.bak-*` 这类备份目录：

- **有副作用**：占用磁盘（实测 13 个目录占 85G 可用空间的一部分），但**没有功能风险**。
- **删除成本高**：会触发沙箱 safe-delete 守卫（按 turn 计数、阈值 50），
  在功能迭代中清理会制造「与本次改动无关的失败」，**完全没必要**。
- **规则**：等一次正常的维护窗口统一处理，不要在交付 Change Set 的过程中夹带清理。

---

## 规则 3：冻结常量必须与字典同改（8 处同源）

`en.json` 的**叶子数**是发布门禁的冻结常量，硬编码在 8 个地方：

| 文件 | 位置 |
|---|---|
| `scripts/cs06a-directory-regression.ts` | C8 |
| `scripts/cs08-form-regression.ts` | G4 + G5 |
| `scripts/cs12-profile-regression.ts` | E4 + E5 |
| `scripts/cs13-supplier-seo-regression.ts` | F1i |
| `scripts/cs16-supplier-mgmt-regression.ts` | A1–A6 |
| `scripts/cs17-commerce-regression.ts` | A1–A6 |
| `scripts/cs20-supplier-report.ts` | A1 |
| `scripts/verify-opennext-bundle.mjs` | 发布门禁 |

**加/删字典键时**：先跑 `apply-*-i18n.cjs` 注入，再用配套的 `sync-*-gates.cjs` 同步常量，
最后跑全部回归 + `verify-opennext-bundle` 验证。

当前基线：**3293**（`en.json` 叶子数，单一事实源；历史：2940 → 3126 → 3192 → 3210 → 3233 → 3291 → 3292 → **3293**，随 clusters / 五国 FAQ / 合规三页（CS-23）等命名空间扩容同步）。
（上一行是 cs13b `A5` 断言的锚点：该断言要求本文档**含**当前叶子数常量，且非 changelog 行不得残留更早的值。
⚠️ 这个字面量在本文件中**只应出现一次**（就是上一行），别在别处重复 —— 同步脚本按唯一命中替换。）
变更历史见 `scripts/cs06a-directory-regression.ts` 的 C7 注释 —— **历史条目不可篡改**，
同步脚本必须保护 `A → B` 这类既成事实的标记。

> ⚠️ **`scripts/step13b-i18n-gates.cjs` 名字像闸门，其实是迁移脚本**（内含两处 `writeFileSync`）。
> 当字典缺 `clusters.allCountries` 或门禁常量未同步时，它会用
> `JSON.stringify(d, null, 2) + "\n"` **重写整个字典**（行尾变 LF、全文重排、CRLF 纪律被破坏）。
> **不要随手跑它。** 跑之前先 `git status --porcelain i18n/` 判据。
> 另：`scripts/step13b-leaf-count.cjs` **不存在** —— 想独立核验叶子数，用自写的
> 8 行递归计数器（数组递归口径：`Object.values` 递归，非对象即计 1），或直接看规则 5 的脚本。

---

## 规则 4：验收必须做「真实浏览器 + 真实部署」

代码绿 ≠ 上线可读。尤其是**否定型测试**（「未发布的不应出现」）：

> 夹具必须在 **build 之前**注入，否则页面是旧快照，探针本来就不在里面 ——
> 测试会**假通过**。

两轮流程：`setup → build → deploy → accept → teardown → build → deploy`。
第二轮不可省，否则探针文案会永久留在生产 HTML 里。

---

## 规则 5（强制）：部署后必须做「落地对拍」—— md5(线上响应体) == md5(预渲染产物)

> **部署后、宣布完成前，必须跑一次 `node scripts/verify-live-md5.cjs`，末行必须是 `LIVE_MD5_OK`。**
> `scripts/release.sh` 已把它接为**第 8 步**；手工发布时不得省略。
> 这条与「改首页 / 改 pricing / 改条款」无关地适用于**每一次**发布。

### 它证明的事，内容探针证不了

| 层 | 判据 | 回答的问题 |
|---|---|---|
| 内容层 | 探针断言线上 HTML 含 / 不含某些串（`_live-*.cjs`） | 「**内容**对不对」 |
| 落地层 | `verify-live-md5.cjs`：`md5(线上响应体) == md5(.next/server/app/<loc>/<path>.html)` | 「**发出去的到底是不是这份构建**」 |

为什么第二层不可省：预渲染产物带 `s-maxage=31536000`（边缘理论可缓存**一年**），链路上还有 CDN 与回源。
而**改文案、加区块、加 FAQ 全是在旧内容上加东西**（新内容是旧内容的**超集**）——
旧版页面对新断言**照样命中**，于是**内容探针可以在旧版本上全绿**。
md5 逐字节相等一次性排除这种假绿灯。

> 实证价值：2026-09-30 那轮 `/terms` 的对拍结果
> `md5(线上) == md5(.next/server/app/en/terms.html) == 812913281ecdf39804a21bbbc8c68f4b`（48444 B），
> 才让「线上就是这份构建」从推测变成事实。

### 命令

```bash
node scripts/verify-live-md5.cjs                      # 默认关键路由集
node scripts/verify-live-md5.cjs /pricing /terms      # 本次改动涉及的路由（不带前导斜杠亦可）
node scripts/verify-live-md5.cjs --all-locales /terms # 展开为 9 语
node scripts/verify-live-md5.cjs --retries=6 --delay=20000   # 刚部署完 / 疑似传播延迟
```

输出契约：末行 `LIVE_MD5_OK`（exit 0）或 `LIVE_MD5_MISMATCH`（exit 1）。

⚠️ **默认关键路由集不只是「对拍清单」，还是一条不变量**：这些路由**应当始终是预渲染产物**
（当前 15 条，真源 = `scripts/verify-live-md5.cjs` 的 `DEFAULT_TARGETS`，勿在文档里再抄一份）。
**变更史**：12 → 13（补 `/trust` 等）→ **15**（2026-09-30 CS-23 把 `/confidentiality`、`/integrity` 由「发布日显式补跑」提为默认集）。
若其中某条报 `FAIL 无预渲染产物`，说明它被人改成了动态渲染 —— 这是**真回归**
（本站在 CF Workers 免费额度下，动态渲染每请求现算，是 5xx / 1102 CPU 超限的主因）。

### 三个前提（任一条不成立，本判据即无意义）

1. **`.next/server/app` 必须是本次部署的那份构建。**
   `release.sh` 开头会把 `.next` / `.open-next` 整体改名隔离后重建 ⇒ **部署后立即跑**才对得上。
   若在 deploy 之后又跑过 `next build` 或清理，对拍失去意义（先重发布）。
2. **目标路由必须是预渲染产物。** 动态路由（后台、`/api/*`、任何 `force-dynamic`）每请求现渲染，
   字节天然不同 ⇒ **不适用**本判据，改用内容探针。
   注：规则 1 已订正 —— 当前**公开前台路由全部为预渲染**。
3. **基准只能取 `.next/server/app` 下的静态 `*.html`。**
   `.open-next/cache` 里是增量缓存的 **JSON 包装**（`*.cache`），不是裸 HTML，不能直接对拍。

### 路径映射（实测自 `.next/server/app` 布局）

| 线上路径 | 预渲染产物 |
|---|---|
| `/` | `.next/server/app/en.html` |
| `/ar` | `.next/server/app/ar.html` |
| `/terms` | `.next/server/app/en/terms.html` ← en 走**无前缀规范址** |
| `/ar/terms` | `.next/server/app/ar/terms.html` |
| `/zh-TW/pricing` | `.next/server/app/zh-TW/pricing.html` |

⚠️ **不存在** `.next/server/app/terms.html` —— en 也在 locale 子目录里。凭印象写路径会得到「产物不存在」的假结论。
⚠️ 线上探测路径用**无前缀**形式：`/en/countries/thailand` 会 **308** 到 `/countries/thailand`。

### 失败怎么判（从便宜到昂贵）

| 现象 | 先查什么 |
|---|---|
| 全部 MISMATCH，稍等复跑通过 | **传播窗口**：deploy 返回后数秒内边缘仍可能命中上一版 ⇒ 加大 `--retries` / `--delay` |
| 个别路由 MISMATCH 但 HTTP 200 | 该路由并非预渲染（看响应头 `x-nextjs-prerender`）；或 `.next` 与本次部署不是同一批 |
| 某路由 `FAIL 无预渲染产物` | 它被改成动态渲染了（见上「不变量」） |
| 全部 SKIP | **不构成任何证据** —— 脚本按失败处理（exit 1，防「全跳过 = 假绿」）|
| 改了库内容但对拍不过 | 库内容变更必须**重新构建**才会进产物（规则 1）|

### 写 / 改这条判据时必须做阴性对照

「能 PASS」不等于「会 FAIL」。本判据已用三组对照证明有效（可复现）：

| 对照 | 做法 | 期望 |
|---|---|---|
| A 篡改产物 | 备份 → 给 `.next/server/app/en/trust.html` 追加 1 字节 → 跑 `/trust` | `MISMATCH` + exit 1；还原后 md5 回原值 |
| B 不存在的路由 | `node scripts/verify-live-md5.cjs no-such-route` | `SKIP`，并触发「全 SKIP 不算通过」守卫 |
| C 传播窗口 | 部署后**立刻**跑 | 允许 MISMATCH，加大重试后须转 `LIVE_MD5_OK` |

⚠️ **不要**把「本轮临时校验」写成长期断言（见规则 4 的同类教训）。

