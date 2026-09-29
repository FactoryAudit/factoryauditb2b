#!/usr/bin/env bash
# scripts/release.sh —— 九步发布链路的唯一入口
#
# 与 RELEASE-RULES.md 规则 0 一一对应。
# 任何一步失败即停（set -e -o pipefail）。
#
# 用法：
#   bash scripts/release.sh
#
# 注意：
#   - 本脚本是 bash，不是 JS。cf-release.cjs 挂在 spawnSync 恒 EBUSY，不可用。
#   - 第 0 步和第 1.5 步是闸门，不得跳过。
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
echo "✅ 发布完成"
echo "   日志：$LOG"
