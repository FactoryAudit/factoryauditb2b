# 批 4.3 + 内容侧路径① A 级发布 —— 验收报告

- 日期：2026-09-29（夜）
- 部署版本：`919e089c-77bc-4801-80c6-7c0010e426bb`
- 回滚锚点：`672d465e-727c-479b-aae2-d2773063a8c2`（批 4.2）
- 构建 buildId：`JXittb3gK11RR45yfvFY2`

---

## 1 · 数据侧 4 条 SQL（逐条 rowcount + 回读）

| # | 语句 | rowcount | 回读值 |
|---|---|---|---|
| 1.1a | `jisun` → `country_code='china'` | **1** | `jisun \| country_code=china \| is_published=false` |
| 1.1b | `supplier` → `country_code='china'` | **1** | `supplier \| country_code=china \| is_published=false` |
| 1.1c | `guangdong-junchi-…` → `country_code='china'` | **1** | `… \| country_code=china \| is_published=false` |
| 1.2 | `u-w-y-company-limited` → `english_name='UWYES'` | **1** | `en=UWYES` / `legal=U.W.Y Company Limited`（未动） |
| 1.3 | A 级 2 家发布 | **2** | 两家 `pub=true \| pstat=public` |
| 1.4 | 4 条脏数据标记 | **4** | 4 行 `pstat=private \| pub=false` |

**1.4 首次执行失败（已解决）**：`profile_status='rejected'` 触发
`suppliers_profile_status_check` 违例（23514）。该 CHECK 值域仅
`draft / public / unlisted / private`。语句**原子回滚**，4 行零损伤。
按裁决改用 `private`（语义=不展示；`profile_status` 不参与公开闸门，闸门只有 `is_published=true`）。

**范围受控取证**：`profile_status` 分布 = `public × 11` + `draft × 10`；
今日被更新的 `published` 行**恰为 A 级 2 行**；原有 9 家 `updated_at` 全早于今日 ⇒ 未触碰。

> 附带证伪：`xiamen-jings-eyewear` 是原有 9 家**之一**，非第 10 家 ⇒ 目标 `99 = 9 语 × 11 家` 成立。

---

## 2 · 代码侧（批 4.3 落盘）

| 项 | 前 | 后 |
|---|---|---|
| `lib/guides.ts` sha256 | `ed0c9278c78110f2199245a0371942cdbc5e7fb98a6326c80e4d413eb58f7039` | `375565336be0553b7856cbfa733ba9bb2e9723b84f1e23db267fe7985f9bb7bc` |
| 行数 | 9220 | 9340（+120） |
| `git diff --numstat` | — | **120 / 0**（纯新增，零删除） |
| `scripts/g4-desc-idempotency-regression.ts` | `EXPECTED = 120` | `EXPECTED = 180` |
| `tsc --noEmit` | — | **EXIT=0** |

写入器 `scripts/translate-guides-batch43.cjs`：幂等（多行正则 + `m` 标志）、`.bak` 备份、
反演校验（升序摘除 + 累计位移）、读回逐条比对、行尾保持 CRLF。写前自检 **60 条 / 不合规 0**。

**本地 g4 回归**：`补齐字段 180 条（期望 180）｜FAIL 0`，阴性对照 `true` ⇒ `ALL CLEAN`。

---

## 3 · 构建链路 ①-⑦

### ⚠️ 第一次 `next build` 的静默回退事故（已定位并重跑）

第一次构建日志第 37 行出现 **1 次** `[queries] suppliers query failed JWT issued at future`，
`EXIT` 仍为 **0**，但 `/suppliers/*.html` 只有 **92**（`en` 仅 **4** 篇）。

**根因链（已逐环取证）**：

1. `lib/queries.ts: fetchRows()` 出错即 `return null` ⇒ 调用方**静默回落** `STATIC_SUPPLIERS`。
2. `lib/staticData.ts` 的 `STATIC_SUPPLIERS` **恰好 4 条**：
   `shenzhen-precision-electronics` / `guangzhou-textile-factory` / `dongguan-plastic-molding` / `ho-chi-minh-garment`
   —— 与「`en` 恰好剩 4 篇」**逐字吻合**，可据此判定回退。
3. 回退集只有 4 家 ⇒ 其余 7 个 slug `notFound()` ⇒ 不产出 `.html`。
4. 该失败**不是本机时钟问题**：
   - 本机 `date -u` = 2026-09-29T13:18Z（epoch `1790687897`）；
   - `.env` 凭证是**新版 API key**，**不是 JWT**：`sb_publishable_…`(46) / `sb_secret_…`(41)；
   - 直连 + 走代理 `127.0.0.1:7897`，anon 与 service_role 各打 5 次 ⇒ **20/20 全 200**；
   - 仓库内**无自签 JWT**（`jwt.sign` / `jsonwebtoken` / `jose` 全仓 0 命中）；
   - 父进程环境**无残留 `SUPABASE_*`**；`with-proxy.cjs` 只做
     `setGlobalDispatcher(new ProxyAgent(url))`，**不碰 `Date` / `Authorization` 头**（已逐行核）。
5. 结论：Supabase 网关把新格式 key 在**服务端换取内部 JWT**，边缘节点时钟偏斜时 PostgREST
   以「`iat` 在未来」拒绝 ⇒ **服务端瞬时故障，重试即可**。

### 第二次 `next build`（重建后，采用的版本）

| 步骤 | 结果 |
|---|---|
| 重建前连通性门 | `statuses = [200, 200, 200, 200, 200]` |
| ① `next build` | **EXIT=0**，静态页 2288，`[queries]` 失败行 **0** |
| ↳ `/suppliers/*.html`（排除 `/claim.html`） | **99** = 9 语 × 11 家 |
| ↳ `en` 档案页 | **11** |
| ↳ `/guides/*.html`（`-maxdepth 3`） | **423** = 47 × 9 |
| ② `opennext build` | **EXIT=0**，`Worker saved in .open-next/worker.js` |
| ③ populate（`--worker --batch 250` 循环） | 9 批 **DONE**，`2233 / 2233` |
| ④ `--check` | 页面缓存 2111 / fetch 122 / 非预期路径 **0** / 非 `.cache` **0** ⇒ **OK** |
| ⑤ `scrub-next-env.mjs` | 清空 21 处密钥明文，自检通过 |
| ⑥ `verify-opennext-bundle.mjs` | **ALL PASS**，产物内 **en 字典叶子数 = 3126** |
| ⑦ `wrangler deploy` | **成功**，上传 2232 文件，Startup 26 ms |

**计数口径（本轮踩坑，已固化）**：
- 供应商档案页必须 `-not -path "*/claim.html"`（`<slug>/claim` 同层数），否则 99 → 198。
- guides 文章页必须加 `-maxdepth 3`，否则把 `guides/category/*`（54 页）算进去 → 477。
- 坏产物隔离用**根级 `_prune_*`**（`_prune_next_20260929124436`），禁用 `.next_bad_jwt_*`
  之类名字（`.next_*` 会被 `git add -A` 误入库）。

---

## 4 · 部署后验证

| 项 | 结果 |
|---|---|
| `x-opennext-cache` | `/suppliers/u-w-y-company-limited`、`/guides/factory-audit-checklist` 均 **HIT** |
| `g4-desc-idempotency-regression`（部署后） | **180 / 180，FAIL 0**，`ALL CLEAN` |
| `live-meta-verify` 6 页 | **ALL PASS**（canonical 自指 / hreflang 9 语+`x-default` / JSON-LD / title·desc 与本地预渲染逐字一致） |
| A 级 `u-w-y-company-limited` English Name | `<dt>English name</dt><dd>UWYES` ✅（页面内 `UWYES` ×4） |
| A 级两家 Verification level | `Information not independently verified.`；中文页 `该信息未经独立核验。 (0 / 4)` |
| A 级两家风险评分 | **`Risk score` 行整体不渲染**（非 0 顶替）；页面内仅通用说明文案与 `Evidence on file 0` |
| 中文页含 `UWYES` | ✓（×1） |

### 回归（23 个 TS 脚本套件）

**既有失败**：`cs02d 2 / cs11 1 / cs13 1 / cs14 1 / cs22b 1`（共 6 条断言）。
**本轮后**：`cs02d 2 / cs11 1 / cs13 1 / **cs14 3** / cs22b 1`（共 8）。
⇒ **新增 2 条，全在 `cs14`，且全是硬编码计数断言**：

```
FAIL A2 is_published=true == 9（实测 11）
FAIL A3 anon 可见 == 9（实测 11）
```

这两条是**过期断言**（预期值写死 9），由**你已批准的 A 级发布**直接导致，
**不代表产品缺陷**。`cs14 A1（全库 == 10，实测 21）` 属既有漂移，本轮未加重。

### 非 23 套件的 MJS 脚本（历史 Step-0x 基线，长期失效）

`cs01-regression`(10) / `cs02-regression`(25) / `step13-business`(7) / `step13-completeness`(3)
持续失败，原因同类：**基线写死**（如「suppliers 基准 4」「已发布 9 家」「cards=4」），
数据库自 Step-01 起已从 4 户长到 21 户。其中 `step13-completeness A6.1` 与 `A2.3`
（`country='unknown'` 归一后已无该值可验）与本轮数据改动有关，其余为长期陈旧基线。

---

## 5 · 风险与未解决

1. **构建静默回退无护栏**：`next build` 数据源失败时 `EXIT=0` 且不报警，只靠人工数页数。
   建议后续加「构建后自动断言 `语种数 × is_published 行数`」的闸门（需授权，属新工作项）。
2. **`cs14` A2/A3 等过期计数断言**需同步（改测试文件，超出本轮授权，未动）。
3. `cs01/cs02/step13-*` 的 MJS 基线已严重过期，建议归档或重写。
4. `<title>` 仍为英文（独立工作项，未在范围内）。
5. `_prune_*` 目录已累积 13 个，建议清理。
6. `MEMORY.md` 贴 12,288 字节上限，本轮 durable 发现只落当日日志。
