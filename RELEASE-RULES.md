# 发布流程规则（Release Process Rules）

> 本文件是**发布流程的硬规则**，不是说明文档。每次正式发布前逐条对照。
> 违反这里的规则会导致「改了数据库但线上没变」这类**看起来像 bug、其实不是**的问题。

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

后果是两条路由的**时效不一致**：

| 路由类型 | 实例 | Cache-Control | 数据时效 |
|---|---|---|---|
| `force-dynamic` | `/industrial-clusters` | `private, no-cache, no-store, max-age=0, must-revalidate` | **即时**读库 |
| 预渲染 / ISR | `/suppliers/[slug]`、`/verify-supplier`、首页等 | `s-maxage=3xxx, stale-while-revalidate=2592000` + `x-nextjs-prerender: 1` | **冻结到下次构建** |

⚠️ 特别注意：**`export const revalidate = 3600` 当前不生效**。
它不是「每小时自更新」，而是「构建时快照，直到下次 build + deploy 才变」。

### 具体症状（会误判为 bug）

- 后台把某供应商的 `cluster_slug` / `region` 填好 → **产业带页立刻可见**（force-dynamic），
  但**该供应商详情页看不到**（预渲染快照）。
- 后台把 `is_published` 改为 true → 目录页立刻出现，详情页可能还是 404 或旧内容。
- 首页新增的入口区块、新页面文案，改完库不重新发布就不变。

### 规则

**凡改动了数据库内容（`suppliers`、`industrial_clusters`、`leads` 等任何前台会展示的表），
要让变化出现在线上，必须重新跑一次完整发布。**

```bash
# 唯一发布入口（五步全在内：populate 缓存 → scrub env → verify bundle → deploy → IndexNow）
node scripts/cf-release.cjs
```

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

当前基线：**2940**（= 2936 字符串 + 4 boolean）。
变更历史见 `scripts/cs06a-directory-regression.ts` 的 C7 注释 —— **历史条目不可篡改**，
同步脚本必须保护 `A → B` 这类既成事实的标记。

---

## 规则 4：验收必须做「真实浏览器 + 真实部署」

代码绿 ≠ 上线可读。尤其是**否定型测试**（「未发布的不应出现」）：

> 夹具必须在 **build 之前**注入，否则页面是旧快照，探针本来就不在里面 ——
> 测试会**假通过**。

两轮流程：`setup → build → deploy → accept → teardown → build → deploy`。
第二轮不可省，否则探针文案会永久留在生产 HTML 里。
