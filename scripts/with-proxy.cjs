// scripts/with-proxy.cjs
// 把 Node 全局 fetch（undici）指向本机系统代理。
//
// 为什么需要：本站 build 期要读 Supabase（.env 里 SUPPLIER_DATA_SOURCE=supabase）。
//   本机**直连** `<ref>.supabase.co` 会被重置（curl: Recv failure / fetch: ECONNRESET），
//   但 Windows 系统代理（127.0.0.1:7897）可达 —— 已验证返回 401（缺 apikey，符合预期）。
//   不加这个 preload，`next build` 会静默回落静态数据：供应商从 9 家掉到 4 家、
//   5 个 /suppliers/<slug> 页面消失且**零报错**（只有一行 [queries] ... fetch failed）。
//
// 用法：
//   NODE_OPTIONS="--require ./scripts/with-proxy.cjs" node node_modules/next/dist/bin/next build
// 覆盖代理地址：FAB2B_PROXY=https://127.0.0.1:8080 ...
'use strict';

const url =
  process.env.FAB2B_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  'http://127.0.0.1:7897';

try {
  const { setGlobalDispatcher, ProxyAgent } = require('undici');
  setGlobalDispatcher(new ProxyAgent(url));
  if (!process.env.FAB2B_PROXY_QUIET) console.log(`[with-proxy] 全局 fetch 走代理 ${url}`);
} catch (e) {
  console.warn(`[with-proxy] 未启用（${e.message}）——请确认 node_modules/undici 存在`);
}
