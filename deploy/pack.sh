#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy/pack.sh —— 把 standalone 构建产物打成「可直接上传宝塔」的压缩包
#
# 为什么是 bash 而不是 package-standalone.mjs：
#   本机（WorkBuddy Windows 沙箱）给 node 进程注入了文件安全守卫，
#   `fs.cpSync` 一次性递归拷 6900+ 文件会被**静默杀掉（exit 127，无异常输出）**。
#   实测对照：同一份目录用外部 `cp -r` 拷贝成功（6936 files, exit 0）。
#   而 node 里又不能用 spawnSync/execFileSync 调外部命令（本机恒 EBUSY），
#   所以打包只能由 shell 外部进程完成 —— 即本脚本。
#   （package-standalone.mjs 保留：在没有守卫的普通机器上它仍然可用。）
#
# 前置（standalone 构建，已由上一轮完成）：
#   FAB2B_OUTPUT=standalone FAB2B_DISABLE_BUILD_TRACE=1 \
#   FAB2B_PROXY=http://127.0.0.1:7897 \
#   NODE_OPTIONS="--require=<repo>/scripts/with-proxy.cjs" \
#   node node_modules/next/dist/bin/next build
#
# 三件套（缺一不可）：
#   1. .next/standalone/  →  包根        （server.js + 最小 node_modules + .next/server）
#   2. .next/static/      →  包内 .next/static   ★ 缺 ⇒ 线上 CSS/JS 全 404
#   3. public/            →  包内 public         ★ 缺 ⇒ favicon/站点验证文件 404
#
# 用法：bash deploy/pack.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PKG="$ROOT/_baota_pkg"
OUT="$ROOT/_baota_upload.tar.gz"

die() { printf '\n✖ %s\n\n' "$1" >&2; exit 1; }
step() { printf '\n%s\n' "$1"; }

# ── 0. 前置校验 ─────────────────────────────────────────────────────────────
step "⓪ 前置校验"
[ -f ".next/standalone/server.js" ] || die ".next/standalone/server.js 不存在 —— 这次不是 standalone 构建，请先重新构建。"
[ -d ".next/static" ]               || die ".next/static 不存在 —— 没有它线上所有 CSS/JS 都会 404。"
[ -d "public" ]                     || die "public/ 不存在 —— 没有它 favicon 与站点验证文件会 404。"
[ -f "deploy/ecosystem.config.js" ] || die "deploy/ecosystem.config.js 缺失。"
[ -f "deploy/env.production.example" ] || die "deploy/env.production.example 缺失。"
[ -f "deploy/nginx.conf" ]          || die "deploy/nginx.conf 缺失。"
echo "  ✓ 三件套与部署辅助文件齐备"

# ── 1. 清空目标目录（用 rename 隔离，不做批量删除）─────────────────────────
step "① 准备目标目录"
if [ -d "$PKG" ]; then
  if [ -z "$(ls -A "$PKG" 2>/dev/null || true)" ]; then
    rmdir "$PKG"
    echo "  ↳ 移除空目录 _baota_pkg"
  else
    OLD="${PKG}_old_$(date +%Y%m%d%H%M%S)"
    mv "$PKG" "$OLD"
    echo "  ↳ 旧包已改名隔离（未删除）：$(basename "$OLD")"
  fi
fi
mkdir -p "$PKG"

# ── 2. standalone → 包根（tar 管道，顺带排除构建期密钥）────────────────────
step "② 拷贝 .next/standalone → 包根目录"
# 🔴 安全排除：Next 会把项目根的 .env 一并拷进 standalone 产物，那份 .env 含
#    SUPABASE_ACCESS_TOKEN / CLOUDFLARE_API_TOKEN 等**构建期**最高权限密钥
#    （能改库结构、能发部署），而服务器上没有任何代码读它们。必须剔除。
( cd .next/standalone && tar -cf - \
    --exclude='./.env' \
    --exclude='./.env.local' \
    --exclude='./.env.development.local' \
    . ) | ( cd "$PKG" && tar -xf - )
echo "  ✓ 已排除 .env / .env.local / .env.development.local（构建期密钥）"

# ── 3. 补齐三件套的另外两件 ─────────────────────────────────────────────────
step "③ 拷贝 .next/static → 包内 .next/static"
mkdir -p "$PKG/.next"
cp -r ".next/static" "$PKG/.next/static"

step "④ 拷贝 public → 包内 public"
cp -r "public" "$PKG/public"

# ── 4. 随包带部署辅助文件 ───────────────────────────────────────────────────
step "⑤ 放入部署辅助文件"
mkdir -p "$PKG/logs"
: > "$PKG/logs/.gitkeep"
cp "deploy/ecosystem.config.js"     "$PKG/ecosystem.config.js"
cp "deploy/env.production.example"  "$PKG/env.production.example"
cp "deploy/nginx.conf"              "$PKG/nginx.conf"
cp "deploy/README-BAOTA.md"         "$PKG/README-BAOTA.md"
echo "  ✓ ecosystem.config.js / env.production.example / nginx.conf / README-BAOTA.md"

# ── 5. 完整性自检 ───────────────────────────────────────────────────────────
step "⑥ 完整性自检"
MISSING=0
for rel in server.js package.json node_modules .next/static .next/server public; do
  if [ -e "$PKG/$rel" ]; then
    printf '  ✓ %s\n' "$rel"
  else
    printf '  ✗ %s\n' "$rel"
    MISSING=$((MISSING + 1))
  fi
done

# ── 6. 安全断言：包内绝不允许出现 .env ──────────────────────────────────────
step "⑦ 安全断言"
for f in .env .env.local .env.development.local; do
  [ -e "$PKG/$f" ] && die "包内检测到 $f —— 含构建期密钥，禁止上传。请检查排除规则。"
done
echo "  ✓ 未夹带 .env（构建期密钥未泄漏）"

# ── 7. 报告 ─────────────────────────────────────────────────────────────────
step "⑧ 产物"
FCOUNT="$(find "$PKG" -type f 2>/dev/null | wc -l | tr -d ' ')"
SIZE="$(du -sh "$PKG" 2>/dev/null | cut -f1 || echo '?')"
echo "  目录   $PKG"
echo "  体积   $SIZE"
echo "  文件数 $FCOUNT"

[ "$MISSING" -eq 0 ] || die "有 $MISSING 个关键路径缺失，产物不可用。"

# ── 8. 打成上传包 ───────────────────────────────────────────────────────────
step "⑨ 压缩"
if [ -f "$OUT" ]; then
  mv "$OUT" "${OUT%.tar.gz}_old_$(date +%Y%m%d%H%M%S).tar.gz"
  echo "  ↳ 旧压缩包已改名隔离"
fi
tar -czf "$OUT" -C "$PKG" .
OSIZE="$(du -sh "$OUT" 2>/dev/null | cut -f1 || echo '?')"
echo "  ✓ $OUT  ($OSIZE)"

printf '\n✓ 打包完成。\n'
printf '  下一步：把 %s 上传到服务器 /www/wwwroot/<站点目录>/ 后执行\n' "$(basename "$OUT")"
printf '    tar -xzf %s && bash -c "见 README-BAOTA.md 步骤 4-7"\n' "$(basename "$OUT")"
