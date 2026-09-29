# 构建双闸门验证报告（preflight / postflight）

- 验证时间：2026-09-29 22:14 – 22:19（GMT+8）
- 被测提交：`66ecdbc`（tag `build-guards`）——`scripts/build-preflight-check.mjs` + `scripts/build-postflight-check.mjs` + `RELEASE-RULES.md` 规则 0
- 结论：**五个场景全部符合预期（5/5 PASS，场景 5 须用 36 篇形态的 fixture）**，另附 1 项实测告警取证、1 组 `set -e -o pipefail` 停链语义对照

## 环境快照

| 项 | 值 |
|---|---|
| HEAD | `66ecdbc feat(build-guards): 九步发布链路 —— preflight/postflight 双闸门入库 + RELEASE-RULES 规则 0` |
| 代理 | `FAB2B_PROXY=http://127.0.0.1:7897`（banner 实测 `[with-proxy] 全局 fetch 走代理 http://127.0.0.1:7897`） |
| 产物 | `suppliers = 99`（11×9，排除 `*/claim.html`）、`guides = 423`（47×9，`-maxdepth 3`） |
| BUILD_ID | `6F-EkI0Wt4t_XKUMwFm_l`（第 1 步实测构建） |
| 构建日志 | `outputs/_next_20260929221507.log`（EXIT=0，2m27s，失败行 0） |
| 基线 | `.tmp/preflight-baseline.json`（`expectedSuppliers:11, expectedGuides:47, localeCount:9`） |
| 配对不变式 | 基线 `22:15:01` < BUILD_ID `22:16:51` < 日志 mtime `22:17:32` ✓ |

---

## 场景 1：preflight 正常

命令：`node scripts/build-preflight-check.mjs`

```
[preflight] 已忽略环境里的代理变量 http://127.0.0.1:5701（本机已知它不转发 supabase）；如确需使用请显式设 FAB2B_PROXY=http://127.0.0.1:5701
[preflight] 数据源 OK：supabase，is_published=true 共 11 行（HTTP 200，1 次尝试，代理=http://127.0.0.1:7897）
EXPECTED_SUPPLIERS=11, EXPECTED_GUIDES=47
[preflight] 派生产物基线（构建后逐字比对）：/suppliers/*.html=99（11×9，排除 */claim.html）、/guides/*.html=423（47×9，-maxdepth 3）
[preflight] 已落盘基线：.tmp\preflight-baseline.json（供第 1.5 步 build-postflight-check.mjs 读取）
[preflight] ▶ 下一步（第 1.5 步）跑 `node scripts/build-postflight-check.mjs --log outputs/_next_<时间戳>.log` 时会读这个基线；**第 1.5 步不得跳过**。
```

exit code：`0` ✅（三条预期行逐字命中）

---

## 场景 2：preflight 失败

命令：`FAB2B_PROXY=http://127.0.0.1:9999 node scripts/build-preflight-check.mjs`

```
[preflight] 已忽略环境里的代理变量 http://127.0.0.1:5701（本机已知它不转发 supabase）；如确需使用请显式设 FAB2B_PROXY=http://127.0.0.1:5701
[preflight] 第 1/3 次查询失败：fetch failed / connect ECONNREFUSED 127.0.0.1:9999 [ECONNREFUSED]
[preflight] 第 2/3 次查询失败：fetch failed / connect ECONNREFUSED 127.0.0.1:9999 [ECONNREFUSED]
[preflight] 第 3/3 次查询失败：fetch failed / connect ECONNREFUSED 127.0.0.1:9999 [ECONNREFUSED]

❌ 数据源失败，中止构建
   原因：Supabase 查询失败（3 次尝试均失败，代理=http://127.0.0.1:9999）：fetch failed / connect ECONNREFUSED 127.0.0.1:9999 [ECONNREFUSED]

   `next build` 不会因数据源失败而报错 —— 它会静默回落到
   lib/staticData.ts 的内置常量并**照常 EXIT 0**，产出缺页的坏站点。
   请先修好数据源（或显式设 SUPPLIER_DATA_SOURCE=static）再构建。
```

`grep -c "数据源失败，中止构建"` = `1`；exit code：`1` ✅
副作用核对：失败路径**未改写**基线（基线仍为场景 1 写入的 `checkedAt 2026-09-29T14:14:20.724Z`）✓

---

## 场景 3：postflight 正常

前置：当前好产物（99/423）+ 好日志 `outputs/_next_20260929221507.log`

### 3A 显式 `--log`

命令：`node scripts/build-postflight-check.mjs --log outputs/_next_20260929221507.log`

```
[postflight] 期望值来源 = .tmp/preflight-baseline.json：EXPECTED_SUPPLIERS=11, EXPECTED_GUIDES=47
[postflight] 语种数 = 9（i18n/config.ts）
[postflight] ③ 构建日志 = outputs/_next_20260929221507.log → 失败行 0 ✓
[postflight] ① /suppliers/*.html = 99（期望 11 × 9 = 99）✓
[postflight] ② /guides/*.html = 423（期望 47 × 9 = 423）✓
POSTFLIGHT_OK
```

exit code：`0` ✅

### 3B 自动挑选（不传 `--log`）

```
[postflight] 期望值来源 = .tmp/preflight-baseline.json：EXPECTED_SUPPLIERS=11, EXPECTED_GUIDES=47
[postflight] 语种数 = 9（i18n/config.ts）
[postflight] ③ 构建日志 = outputs\_next_20260929221507.log（自动选中） → 失败行 0 ✓
[postflight] ① /suppliers/*.html = 99（期望 11 × 9 = 99）✓
[postflight] ② /guides/*.html = 423（期望 47 × 9 = 423）✓
POSTFLIGHT_OK
```

exit code：`0` ✅（自动挑中带时间戳的最新日志，零告警）

---

## 场景 4：postflight 失败

命令：`EXPECTED_SUPPLIERS=99 EXPECTED_GUIDES=47 node scripts/build-postflight-check.mjs`

```
[postflight] 期望值来源 = 环境变量：EXPECTED_SUPPLIERS=99, EXPECTED_GUIDES=47
[postflight] 语种数 = 9（i18n/config.ts）
[postflight] ③ 构建日志 = outputs\_next_20260929221507.log（自动选中） → 失败行 0 ✓
[postflight] ① /suppliers/*.html = 99（期望 99 × 9 = 891）✗
[postflight] ② /guides/*.html = 423（期望 47 × 9 = 423）✓

❌ 构建产物不符
   · 第 ① 项不符：/suppliers/*.html 实得 99，期望 891。
      实得与期望差 792 篇；先查第 ③ 项（构建日志）定位数据源。

   ⛔ 已中止九步链路：**不要**继续第 2 步 `opennext build` / populate / deploy。
      先诊断数据源（第 ③ 项日志最先给出证据），再从第 1 步重跑。
```

`grep -c "构建产物不符"` = `1`；exit code：`1` ✅
（③ 项先执行、先打印：日志干净是「因」，页数不符只是「果」）

---

## 附：实测告警取证（配对检查真的会响）

本轮第一次跑场景 3 时，**顺序是「先构建、后重跑第 0 步」**（第 0 步在 22:14:20 落盘，BUILD_ID 在 22:01:13 写入），postflight 立刻打出：

```
[postflight] ⚠️ 基线（2026-09-29T14:14:20.731Z）晚于本次构建（2026-09-29T14:01:13.326Z）—— 第 0 步似乎是在构建**之后**补跑的，基线反映的不是构建当时的数据源状态。
```

exit 仍为 `0`、仍打印 `POSTFLIGHT_OK`（告警不拦截，只刺眼）。随后按 ⓪→①→①.5 的真实顺序重跑（新基线 22:15:01 + 新构建 22:17:32），场景 3 转干净。
⇒ 这条告警**不是**假告警：它准确指出「基线反映的不是构建当时的数据源状态」——那正是它要防的误判前提。修复前的旧判据（「基线早于 BUILD_ID ⇒ 疑似不配对」）才是假告警，因为**基线早于 BUILD_ID 本来就是正确流程**（基线由第 0 步写、BUILD_ID 由第 1 步写）。

配套的**陈旧日志保险**（自动挑中的日志 `mtime < BUILD_ID mtime − 60s` ⇒ 告警）本轮未触发（3B 挑中的正是本次日志）。

---

## 集成位置

🔴 **结论：当前没有任何可执行入口调用这两个闸门。**

`grep -rln "build-preflight-check\|build-postflight-check"` 在仓库内仅命中 5 处：`RELEASE-RULES.md`、两个脚本自身、`.workbuddy/memory/{MEMORY.md,2026-09-29.md}`。
`scripts/cf-release.cjs` 命中 `0` 处（该脚本在本机 `spawnSync` 恒 EBUSY，本就不可用）；`package.json` 无任何 release/guard 脚本。

⇒ 集成是**文档级 + 人工按序执行**：唯一权威位置是 `RELEASE-RULES.md` **规则 0**（九步表 / 失败处理 / 四条 grep 契约）。没有任何机制在有人跳过第 0 步或第 1.5 步时阻止他。

### 集成位置更新（22:34）

已补 `scripts/release.sh`（bash，`set -e -o pipefail`），它是**第一个真正调用两个闸门的可执行入口**：
`release.sh:37` → `node scripts/build-preflight-check.mjs`（第 0 步）、`release.sh:47` → `node scripts/build-postflight-check.mjs --log "$LOG"`（第 1.5 步）。
⇒ §集成位置的缺口已闭合；剩余唯一软肋是「入口本身靠人记得去敲」（无自动化触发器）。
⚠️ `release.sh` **尚未端到端跑过**（跑它=一次真实 deploy）；其停链语义已用对照实验单独证明（见下 §release.sh 验证）。

---

## RELEASE-RULES.md 的 diff（vs 上一版，即提交 `66ecdbc`）

`git show --numstat 66ecdbc -- RELEASE-RULES.md` → `79	0	RELEASE-RULES.md`（**只加不改**，规则 1–4 原文一字未动）

```diff
@@ -5,6 +5,85 @@
 
 ---
 
+## 规则 0：构建必须走九步链路（第 0 步与第 1.5 步不得跳过）
+
+> 本规则描述**当前唯一可用的发布链路**。
+> 它同时更正本文档其它位置对 `cf-release.cjs` 的描述：本机 `spawnSync` 恒 EBUSY，
+> 该脚本在 `populate` 分批派生子进程时必然失败（`第 1 批失败（exit=null）`），**不可用**。
+
+### 九步
+
+| 步 | 命令 | 通过标志 |
+|---|---|---|
+| **0** | `node scripts/build-preflight-check.mjs` | `EXPECTED_SUPPLIERS=<n>, EXPECTED_GUIDES=<m>` |
+| **1** | `node node_modules/next/dist/bin/next build 2>&1 \| tee outputs/_next_$(date +%Y%m%d%H%M%S).log` | 日志 0 行 `query failed` |
+| **1.5** | `node scripts/build-postflight-check.mjs --log outputs/_next_<上一步时间戳>.log` | `POSTFLIGHT_OK` |
+| 2 | `node node_modules/@opennextjs/cloudflare/dist/cli/index.js build` | — |
+| 3 | 循环 `node scripts/populate-static-assets-cache.cjs --worker --batch 250` 至输出 `DONE` | 末行 `DONE` |
+| 4 | `node scripts/populate-static-assets-cache.cjs --check` | `[populate] OK` |
+| 5 | `node scripts/scrub-next-env.mjs` | 打印清空处数 |
+| 6 | `node scripts/verify-opennext-bundle.mjs` | `ALL PASS`（含 en 叶子数闸门） |
+| 7 | `OPEN_NEXT_DEPLOY=true node node_modules/wrangler/bin/wrangler.js deploy` | 输出新版本 UUID |
+
+**任一步 exit != 0 ⇒ 立即停止，不执行后续步骤。**
+
+⚠️ 第 3 步必须是**外层 shell 循环**：脚本自身的主模式靠 `spawnSync` 派生子进程，本机必挂。
+
+### 第 0 步与第 1.5 步为什么不得跳过
+
+`next build` 的**数据源失败不报错**。`lib/queries.ts` 的设计是
+「Supabase 查不到 → 静默回落 `lib/staticData.ts` 的 `STATIC_SUPPLIERS`」，于是：
+
+- 供应商 11 家 → 4 家（`STATIC_SUPPLIERS` 恰好 4 条）
+- `/suppliers/<slug>` 预渲染产物 99 篇 → 36 篇（`en` 目录只剩 4 篇）
+- `next build` **EXIT 仍为 0**，日志里只留一行 `[queries] suppliers query failed`
+
+⇒ 没有第 0 步，坏构建照样往下走；没有第 1.5 步，
+要等 `opennext build` + `populate` + `deploy` 全部跑完、**缺页站点已经上线**才发现。
+
+### 前置动作（仅当第 1 步要重建时才需要）
+
+```bash
+export NEXT_TELEMETRY_DISABLED=1
+export FAB2B_DISABLE_BUILD_TRACE=1    # 不带 ⇒ EPERM .next\trace 秒崩
+export FAB2B_PROXY=http://127.0.0.1:7897   # 不带 ⇒ 被环境里的 :5701 劫持
+export NODE_OPTIONS="--require F:/AI-验厂SEO网站/scripts/with-proxy.cjs"
+
+# 清 Data Cache（规则 1）+ 避开 safe-delete 护栏：整包改名挪走，不要 rm -rf
+node -e "const fs=require('fs');if(fs.existsSync('.next'))fs.renameSync('.next','_prune_next_'+Date.now())"
+```
+
+### 第 1 步的日志名必须带时间戳
+
+`outputs/_next_$(date +%Y%m%d%H%M%S).log`
+
+第 1.5 步在没有显式 `--log` 时，会在 `outputs/` 里自动挑选最新的 next|build 日志。
+带时间戳的名字能**唯一确定「本次构建」**；否则可能被 `_g42_build1.log` 这类历史日志抢走 ——
+用**上一轮的干净日志**替**本轮的坏产物**背书，就是一次假 PASS。
+（自动挑选到历史命名时，第 1.5 步会打印告警，但告警不等于拦截，所以命名规范必须遵守。）
+
+### 失败处理
+
+| 失败步 | 处理 |
+|---|---|
+| **第 0 步** | 先诊断**数据源**：代理是否 `:7897`、`.env` 里 `SUPABASE_SERVICE_ROLE_KEY` 是否齐、数据库 `suppliers where is_published=true` 是否有行。修好后**从第 0 步重跑**。 |
+| **第 1.5 步** | **不继续**第 2 步。失败块第一行是**第 ③ 项（构建日志）**的证据（刻意排在最前：日志里有失败痕迹是「因」，页数不符只是「果」）；据此定位后**从第 1 步重跑**（第 0 步已通过，不必重跑）。 |
+| 第 3/4 步 | 复制未跑完 ⇒ 继续循环 `--worker`；契约不符 ⇒ 重跑第 2 步 + 第 3 步。 |
+
+### 输出契约（可被外层脚本 grep）
+
+| 场景 | 输出 | exit |
+|---|---|---|
+| preflight 成功 | `EXPECTED_SUPPLIERS=<n>, EXPECTED_GUIDES=<m>` | 0 |
+| preflight 失败 | 含子串 `数据源失败，中止构建` | 1 |
+| postflight 成功 | `POSTFLIGHT_OK` | 0 |
+| postflight 失败 | 含子串 `构建产物不符` | 1 |
+
+⚠️ 用 `tee` 的第 1 步在 `set -e` 下**必须**同时 `set -o pipefail`，
+否则管道退出码取 `tee` 的（恒 0），"任一步失败即停"会静默失效。
+
+---
+
 ## 规则 1（最重要）：数据库修改 → 正式发布时必须重新 build/deploy
```

完整字节级 diff 存档：`outputs/_vfy_release-rules.diff`

---

## 场景 5：回退指纹测试（合成产物，22:33 补测）

触发条件（源码 `scripts/build-postflight-check.mjs:446-452`）：
`supplierPages.length === STATIC_SUPPLIERS.length(4) × localeCount(9) === 36`。

### 5-A 原样 recipe（只建 `en/`，4 篇）—— 指纹**不**触发

```bash
mkdir -p .tmp/synthetic-app/en/suppliers
touch .tmp/synthetic-app/en/suppliers/{a,b,c,d}.html
EXPECTED_SUPPLIERS=11 EXPECTED_GUIDES=47 node scripts/build-postflight-check.mjs \
  --app-dir .tmp/synthetic-app --log outputs/_next_20260929221507.log
```
```
[postflight] 期望值来源 = 环境变量：EXPECTED_SUPPLIERS=11, EXPECTED_GUIDES=47
[postflight] 语种数 = 9（i18n/config.ts）
[postflight] ③ 构建日志 = outputs/_next_20260929221507.log → 失败行 0 ✓
[postflight] ① /suppliers/*.html = 4（期望 11 × 9 = 99）✗
[postflight] ② /guides/*.html = 0（期望 47 × 9 = 423）✗

❌ 构建产物不符
   · 第 ① 项不符：/suppliers/*.html 实得 4，期望 99。
   · 第 ② 项不符：/guides/*.html 实得 0，期望 423。
      实得与期望差 95 篇；先查第 ③ 项（构建日志）定位数据源。
      guides 是**静态常量**驱动的，它不符通常意味：`-maxdepth` 口径被改、或 `GUIDES` 数量变了没同步 preflight 基线。

   ⛔ 已中止九步链路：**不要**继续第 2 步 `opennext build` / populate / deploy。
      先诊断数据源（第 ③ 项日志最先给出证据），再从第 1 步重跑。
```
断言：A1 exit=1 ✅ ｜ A2 含「构建产物不符」✅ ｜ **A3 含「STATIC_SUPPLIERS.length(4) × 9」❌（0 命中）** ｜ **A4 含「构建期静默回退到内置静态常量」❌（0 命中）**

原因：4 ≠ 36。`en` 目录只剩 4 篇只是**真实回退的九个语种中的一个**（回退时 9 个语种目录都在，各含 4 篇）。

### 5-B 修正 fixture（9 语种 × 4 篇 = 36）—— 四条断言全过

```bash
for L in en zh zh-TW ja es de fr pt ar; do
  mkdir -p ".tmp/synthetic-app/$L/suppliers"
  for s in shenzhen-precision-electronics guangzhou-textile-factory dongguan-plastic-molding ho-chi-minh-garment; do
    touch ".tmp/synthetic-app/$L/suppliers/$s.html"
  done
done
EXPECTED_SUPPLIERS=11 EXPECTED_GUIDES=47 node scripts/build-postflight-check.mjs \
  --app-dir .tmp/synthetic-app --log outputs/_next_20260929221507.log
```
```
[postflight] 期望值来源 = 环境变量：EXPECTED_SUPPLIERS=11, EXPECTED_GUIDES=47
[postflight] 语种数 = 9（i18n/config.ts）
[postflight] ③ 构建日志 = outputs\_next_20260929221507.log（自动选中） → 失败行 0 ✓
[postflight] ① /suppliers/*.html = 36（期望 11 × 9 = 99）✗
[postflight] ② /guides/*.html = 0（期望 47 × 9 = 423）✗

❌ 构建产物不符
   · 第 ① 项不符：/suppliers/*.html 实得 36，期望 99。
   · 第 ② 项不符：/guides/*.html 实得 0，期望 423。
      ⚠️ 36 = STATIC_SUPPLIERS.length(4) × 9 —— **构建期静默回退到内置静态常量**的铁证（数据源在 build 期失败）。
      实得与期望差 63 篇；先查第 ③ 项（构建日志）定位数据源。
      guides 是**静态常量**驱动的，它不符通常意味：`-maxdepth` 口径被改、或 `GUIDES` 数量变了没同步 preflight 基线。

   ⛔ 已中止九步链路：**不要**继续第 2 步 `opennext build` / populate / deploy。
      先诊断数据源（第 ③ 项日志最先给出证据），再从第 1 步重跑。
```
断言：A1 exit=1 ✅ ｜ A2 ✅ ｜ **A3 ✅** ｜ **A4 ✅**（grep -c 各 1 命中）

⚠️ **指纹行的归属观感问题（已观察到，未修）**：`reasons[]` 与 `extras[]` 是分两段打印的，所以指纹行落在**第 ② 项 reason 之后**，视觉上像是 guides 的诊断，其实它是第 ① 项的。修法=把 `reasons[]` 改成带明细的对象（改动结构，待批）。

清理：`rm -rf .tmp/synthetic-app`（36 → 0 ✓）；真实基线 `.tmp/preflight-baseline.json`（`checkedAt 14:15:01Z`）与真实产物（99/423）**未被 fixture 影响** ✓

---

## scripts/release.sh 验证（22:34）

### 内容 = 你给的原样 + 1 个环境前置块（diff 为证）

```diff
--- .tmp/_rel_user_spec.sh   （你给的正文原样）
+++ scripts/release.sh
@@ -12,6 +12,27 @@
 set -e -o pipefail
 cd "$(dirname "$0")/.."
+
+# ── 环境前置（RELEASE-RULES.md 规则 0「前置动作」）──────────────────────────
+# 本机实测：环境里预置 HTTP(S)_PROXY=http://127.0.0.1:5701（不转发 supabase），
+# 且 NODE_OPTIONS 已被宿主占用（node-language-shim.cjs）。两者叠加会让
+# `next build` 拿不到数据源却**照常 EXIT 0**（静默回退到内置静态常量），
+# 所以必须在这里矫正好 —— 下面是 2026-09-29 实测通过的那套组合：
+#   · FAB2B_PROXY                  显式指向可用代理（with-proxy.cjs 只认它）
+#   · NODE_OPTIONS                 注入 with-proxy.cjs，让全局 fetch 走代理
+#   · FAB2B_DISABLE_BUILD_TRACE=1  不带 ⇒ EPERM .next\trace 秒崩
+#   · NEXT_TELEMETRY_DISABLED=1    关遥测网络请求
+# 全部用「已有值优先」，外部显式赋值可覆盖。
+REPO_ROOT="$PWD"
+export FAB2B_PROXY="${FAB2B_PROXY:-http://127.0.0.1:7897}"
+export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
+export FAB2B_DISABLE_BUILD_TRACE="${FAB2B_DISABLE_BUILD_TRACE:-1}"
+case "${NODE_OPTIONS:-}" in
+  *with-proxy.cjs*) ;;
+  *) export NODE_OPTIONS="--require=$REPO_ROOT/scripts/with-proxy.cjs" ;;
+esac
+# ──────────────────────────────────────────────────────────────────────────
+
 echo "=== 第 0 步：preflight（数据源门）==="
```
其余 12–51 行（九步本体、`while :` 循环、`$(date +%Y%m%d%H%M%S)` 日志名、结尾 `✅ 发布完成`）**逐行与你给的一致**（51 行 → 72 行）。

### 为什么必须加前置块（环境取证）

```
$ env | grep -iE 'proxy'
HTTPS_PROXY=http://127.0.0.1:5701
HTTP_PROXY=http://127.0.0.1:5701
http_proxy=http://127.0.0.1:5701
https_proxy=http://127.0.0.1:5701
$ env | grep '^NODE_OPTIONS'
NODE_OPTIONS=--require="C:/Users/35726/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/cli/vendor/shim/node-language-shim.cjs"
```
⇒ 原样脚本会把这两个变量原封不动传给 `next build`：`with-proxy.cjs` 不在 preload 里 ⇒ 全局 fetch 直连被重置 ⇒ **静默回退（EXIT 仍 0）**，只能等第 1.5 步兜住。
⇒ 注意 `NODE_OPTIONS` **已被占用**，所以不能用 `:=` 判空，必须用 `case` 判「是否已含 with-proxy.cjs」。

### bash -n 与权限

```
$ bash -n scripts/release.sh
bash -n: SYNTAX OK (exit 0)

$ chmod +x scripts/release.sh && ls -l scripts/release.sh
-rwxr-xr-x 1 35726 197609 3267 Sep 29 22:34 scripts/release.sh

$ git config --get core.filemode
false        # ⇒ +x 位不会被 git 记录；因为入口约定写作 `bash scripts/release.sh`，不影响功能
```

### 前置块单元测试（两条分支）

| 用例 | 输入 | 实得 |
|---|---|---|
| 分支① 宿主值不含 with-proxy | 继承 `NODE_OPTIONS=<shim>` | `NODE_OPTIONS=--require=/probe/scripts/with-proxy.cjs`（被替换）✅ |
| 分支② 已含 with-proxy | `NODE_OPTIONS=--require=/x/with-proxy.cjs` | 原样保留（不重复注入）✅ |
| 装上了吗 | `NODE_OPTIONS="--require=…/with-proxy.cjs" FAB2B_PROXY=…:7897 node -e "console.log('preload-ok')"` | 打印 `[with-proxy] 全局 fetch 走代理 http://127.0.0.1:7897` + `preload-ok` ✅（同时证明 `--require=` 等号形式可用） |

### 停链语义对照（证明 `set -e -o pipefail` 真的是承重件）

| 用例 | 脚本头 | 命令 | 实得 |
|---|---|---|---|
| T4 阳性 | `set -e -o pipefail` | `node -e "process.exit(3)" 2>&1 \| tee /dev/null` | `SHOULD_NOT_PRINT_A` **未打印**，`EXIT=3` ✅ |
| T4 阴性对照 | `set -e`（无 pipefail） | 同上 | `SHOULD_NOT_PRINT_B` **打印了** + `REACHED_NEXT_STEP` **也打印了**，`EXIT=0` ❌ ⇒ 退出码被 `tee` 吞掉，链会继续 |
| T5 阳性（第 0/1.5 步形态） | `set -e -o pipefail` | `node -e "process.exit(1)"` | `SHOULD_NOT_PRINT_C` **未打印**，`EXIT=1` ✅ |

### 第 3–6 步的 exit 语义核对（`set -e` 够不够）

| 步 | 脚本 | 核对结果 |
|---|---|---|
| 3 | `populate-static-assets-cache.cjs --worker` | 失败路径 `process.exit(1)`（L173 找不到 SRC 等）；外层 `while :` 的 `out=$(…)` 在 `set -e` 下会中止 ✅ |
| 4 | `populate-static-assets-cache.cjs --check` | `selfCheck()` 四条失败路径全部 `process.exit(1)`（L121 读不到 BUILD_ID / L147 页面缓存为空 / L151 路径契约不符 / L155 源≠目标），成功才 `[populate] OK` ✅ |
| 5 | `scrub-next-env.mjs` | `process.exit(1)` @ L72/L120 ✅ |
| 6 | `verify-opennext-bundle.mjs` | `process.exit(fail === 0 ? 0 : 1)` @ L190 ✅ |

⇒ 第 3–6 步不依赖「grep 输出文本」，`set -e` 足以拦住。

---

## 本轮证据文件

| 文件 | 内容 |
|---|---|
| `outputs/_vfy_s1.log` | 场景 1 逐字输出 |
| `outputs/_vfy_s2.log` | 场景 2 逐字输出（exit 1） |
| `outputs/_vfy_s0_chain.log` | 按序重跑的第 0 步（配对不变式所需的新基线） |
| `outputs/_next_20260929221507.log` | 第 1 步真实构建日志（EXIT=0 / 2m27s / 失败行 0） |
| `outputs/_vfy_s3.log` | 场景 3 首次跑（含配对告警，附证） |
| `outputs/_vfy_s3a.log` / `outputs/_vfy_s3b.log` | 场景 3A 显式 `--log` / 3B 自动挑选 |
| `outputs/_vfy_s4.log` | 场景 4（exit 1） |
| `outputs/_vfy_s5a.log` | 场景 5-A：原样 4 篇 fixture（指纹未触发，A3/A4 不命中） |
| `outputs/_vfy_s5b.log` | 场景 5-B：修正 36 篇 fixture（四条断言全过） |
| `.tmp/_rel_user_spec.sh` | 你给的 `release.sh` 正文原样（用于 diff 证明只多一个前置块） |
| `outputs/_vfy_release-rules.diff` | RELEASE-RULES.md 规则 0 的字节级 diff |
