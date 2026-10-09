#!/usr/bin/env bash
# scripts/release.sh —— 发布链路的唯一入口
#
# 与 RELEASE-RULES.md 一一对应：第 0~7 步（含链内 1.6）= 规则 0（九步），第 8 步 = 规则 5（落地对拍）。
# 任何一步失败即停（set -e -o pipefail）。
#
# 用法：
#   bash scripts/release.sh
#
# 注意：
#   - 本脚本是 bash，不是 JS。cf-release.cjs 挂在 spawnSync 恒 EBUSY，不可用。
#   - 四道闸门不得跳过：第 0 步（数据源门）、第 1.5 步（产物门）、
#     第 1.6 步（R25 登录墙产物门）、第 8 步（落地门）。
#   - 第 8 步失败 ⇒ 退出码 1，但**站点其实已经部署了**：那是「未通过验收」，不是「发布失败」。
set -e -o pipefail
cd "$(dirname "$0")/.."

# ── 环境前置（RELEASE-RULES.md 规则 0「前置动作」）──────────────────────────
# 本机实测：环境里预置 HTTP(S)_PROXY=http://127.0.0.1:5701（不转发 supabase），
# 且 NODE_OPTIONS 已被宿主占用（node-language-shim.cjs）。两者叠加会让
# `next build` 拿不到数据源却**照常 EXIT 0**（静默回退到内置静态常量），
# 所以必须在这里矫正好 —— 下面是 2026-09-29 实测通过的那套组合：
#   · FAB2B_PROXY                  显式指向可用代理（with-proxy.cjs 只认它）
#   · NODE_OPTIONS                 注入 with-proxy.cjs，让全局 fetch 走代理
#   · FAB2B_DISABLE_BUILD_TRACE=1  不带 ⇒ EPERM .next\trace 秒崩
#   · NEXT_TELEMETRY_DISABLED=1    关遥测网络请求
# 全部用「已有值优先」，外部显式赋值可覆盖。
REPO_ROOT="$PWD"
export FAB2B_PROXY="${FAB2B_PROXY:-http://127.0.0.1:7897}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
export FAB2B_DISABLE_BUILD_TRACE="${FAB2B_DISABLE_BUILD_TRACE:-1}"
case "${NODE_OPTIONS:-}" in
  *with-proxy.cjs*) ;;
  *) export NODE_OPTIONS="--require=$REPO_ROOT/scripts/with-proxy.cjs" ;;
esac
# ──────────────────────────────────────────────────────────────────────────

echo "=== 第 0 步：preflight（数据源门）==="
node scripts/build-preflight-check.mjs
echo ""
echo "=== 隔离旧产物 ==="
node -e "const fs=require('fs');if(fs.existsSync('.next'))fs.renameSync('.next','_prune_next_'+Date.now());if(fs.existsSync('.open-next'))fs.renameSync('.open-next','_prune_opennext_'+Date.now())"
echo ""
echo "=== 第 1 步：next build ==="
LOG="outputs/_next_$(date +%Y%m%d%H%M%S).log"
node node_modules/next/dist/bin/next build 2>&1 | tee "$LOG"
echo ""
echo "=== 第 1.5 步：postflight（产物门）==="
node scripts/build-postflight-check.mjs --log "$LOG"
echo ""
echo "=== 第 1.6 步：R25 登录墙产物门（访问控制）==="
# 为什么必须在链内、且必须在 deploy 之前：
#   本门读的是 `.next/server/app` 的**预渲染产物**，而 `.next` 在本脚本开头就被改名隔离后重建
#   ⇒ 只有链内这一份才是「即将被部署的那份」；而它排在第 7 步之前 ⇒ 门失败时站点尚未变更。
# 为什么显式检查存在性：探针是本地未入库文件（.gitignore 的 scripts/_*.cjs），
#   缺失时绝不能静默跳过 —— 访问控制门不可省。
# 判据与自证记录见 RELEASE-RULES.md 规则 0「第 1.6 步的自证记录」。
[ -f scripts/_r25_verify_wall.cjs ] || { echo "缺少 scripts/_r25_verify_wall.cjs —— 访问控制门不可省，中止"; exit 1; }
node scripts/_r25_verify_wall.cjs
echo ""
echo "=== 第 2 步：opennext build ==="
node node_modules/@opennextjs/cloudflare/dist/cli/index.js build
echo ""
echo "=== 第 3 步：populate 缓存 ==="
while :; do
out=$(node scripts/populate-static-assets-cache.cjs --worker --batch 250 2>&1)
echo "$out"
echo "$out" | grep -q "DONE" && break
done
echo ""
echo "=== 第 4 步：populate --check ==="
node scripts/populate-static-assets-cache.cjs --check
echo ""
echo "=== 第 5 步：scrub-next-env ==="
node scripts/scrub-next-env.mjs
echo ""
echo "=== 第 6 步：verify-opennext-bundle ==="
node scripts/verify-opennext-bundle.mjs
echo ""
echo "=== 第 7 步：wrangler deploy ==="
OPEN_NEXT_DEPLOY=true node node_modules/wrangler/bin/wrangler.js deploy
echo ""
echo "=== 第 8 步：落地对拍（RELEASE-RULES.md 规则 5）==="
# 判据：md5(线上响应体) 必须 == md5(.next/server/app 下的预渲染产物)。
# 为什么不能只看内容探针：预渲染产物带 s-maxage=31536000（边缘理论可缓存一年），
# 而改文案/加区块/加 FAQ 都是「在旧内容上加东西」（超集）⇒ 旧版页面对新断言照样命中，
# 探针会在旧版本上假绿。md5 逐字节相等才排除这种可能。
# 刚 deploy 返回时边缘可能仍命中上一版 ⇒ 留 6 次 × 20s 的传播窗口。
if node scripts/verify-live-md5.cjs --retries=6 --delay=20000; then
  :
else
  echo ""
  echo "⚠️ 部署已执行，但**落地对拍未通过**（不是「没部署」，是「部署的内容没被证实」）。"
  echo "   按上方诊断顺序排查；若判定为传播窗口，直接复跑："
  echo "     node scripts/verify-live-md5.cjs --retries=10 --delay=20000"
  exit 1
fi
echo ""
echo "=== 第 9 步：通知搜索引擎（IndexNow，非致命）==="
# 为什么排在第 8 步之后：只把**已通过落地对拍**的 URL 通知给 Bing，避免推没上线的页面。
# 为什么非致命（末尾 `|| echo` 兜底）：收录通知是尽力而为，失败不该阻断一次已经成功且已验证的发布。
# 原理：sitemap-diff 对比本地缓存算出**新增** URL，再把增量推给 IndexNow。
# IndexNow 覆盖 Bing + Yandex；Bing 索引又是 ChatGPT 搜索的来源之一，故对 AI 检索亦有价值。
node scripts/post-publish-submit.cjs || echo "⚠️ IndexNow 提交失败（非致命，发布仍然有效）"
echo ""
echo "✅ 发布完成（已含落地对拍 LIVE_MD5_OK）"
echo "   日志：$LOG"
