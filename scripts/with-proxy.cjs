// scripts/with-proxy.cjs
// 把 Node 全局 fetch（undici）指向本机可用代理。
//
// 为什么需要：本站 build 期要读 Supabase（.env 里 SUPPLIER_DATA_SOURCE=supabase）。
//   本机**直连** `<ref>.supabase.co` 会被重置（curl: Recv failure / fetch: ECONNRESET，
//   实测 curl 直连 code=000），但本机代理 `127.0.0.1:7897` 可达（实测 code=401，
//   缺 apikey，符合预期）。不加这个 preload，`next build` 会**静默回落静态数据**：
//   供应商 9 家 → 4 家、5 个 /suppliers/<slug> 页面消失，且 **EXIT 仍为 0**
//   （日志里只有若干行 `[queries] suppliers query failed TypeError: fetch failed`）。
//
// ⚠️ 2026-09-29 追加的坑：本会话环境里存在 `HTTPS_PROXY=http://127.0.0.1:5701`
//   （一个**不转发 supabase** 的代理）。旧版脚本按 `FAB2B_PROXY || HTTPS_PROXY || ... || 7897`
//   取值 ⇒ 被劫持到 5701 ⇒ 又一次静默回落（209 次 fetch failed、供应商 4 家）。
//   现在改为：**默认就用 7897**，只有显式设 `FAB2B_PROXY` 或 `FAB2B_TRUST_ENV_PROXY=1`
//   才会采用环境变量里的代理；劫持发生时打印告警。
//
// 用法：
//   NODE_OPTIONS="--require F:/AI-验厂SEO网站/scripts/with-proxy.cjs" node node_modules/next/dist/bin/next build
// 覆盖代理：FAB2B_PROXY=http://127.0.0.1:8080 ...
// 构建后务必自检：`ls .next/server/app/*/suppliers/*.html | wc -l` 应为 9 语 × 9 家 = 81。
'use strict';

const DEFAULT_PROXY = 'http://127.0.0.1:7897';
const AMBIENT =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  '';

const url =
  process.env.FAB2B_PROXY ||
  (process.env.FAB2B_TRUST_ENV_PROXY === '1' ? AMBIENT : '') ||
  DEFAULT_PROXY;

if (AMBIENT && AMBIENT !== url) {
  console.warn(
    `[with-proxy] 已忽略环境里的代理变量 ${AMBIENT}（本机已知它不转发 supabase）；` +
      `如确需使用请显式设 FAB2B_PROXY=${AMBIENT}`,
  );
}

try {
  const { setGlobalDispatcher, ProxyAgent } = require('undici');
  setGlobalDispatcher(new ProxyAgent(url));
  if (!process.env.FAB2B_PROXY_QUIET) console.log(`[with-proxy] 全局 fetch 走代理 ${url}`);
} catch (e) {
  console.warn(`[with-proxy] 未启用（${e.message}）——请确认 node_modules/undici 存在`);
}
