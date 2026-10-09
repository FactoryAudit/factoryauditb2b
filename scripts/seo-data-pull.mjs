#!/usr/bin/env node
// scripts/seo-data-pull.mjs —— 从 GSC + GA4 拉真实数据并生成分析报告
//
// 为什么零依赖：仓库没有 googleapis / google-auth-library，而本机沙箱装包不稳定。
// 认证只需 RS256 签一个 JWT 换 access_token，node:crypto 就能做，不必引依赖。
//
// 用法：
//   node scripts/seo-data-pull.mjs                 # 拉最近 28 天，输出 outputs/seo-data-<日期>.md
//   node scripts/seo-data-pull.mjs --days 90
//   node scripts/seo-data-pull.mjs --probe         # 只验权限通不通，不拉数据
//
// 凭据（沿用项目既有约定，见 .env.example）：
//   GOOGLE_SERVICE_ACCOUNT_JSON = 服务账号 JSON 的**文件路径**
//   GOOGLE_SA_JSON              = 或直接内联 JSON 字符串
//   GA4_PROPERTY_ID             = GA4 数字 Property ID（可选；不填会尝试自动发现）
//
// 需要的权限（都是只读，最小权限）：
//   GSC：把服务账号邮箱加为**受限用户**（Restricted）—— 够读全部查询/页面数据
//   GA4：把同一邮箱加为 **Viewer**
//   两个 API 需在同一个 GCP 项目里启用：Google Search Console API / Google Analytics Data API

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── .env 加载（Next 只内联 NEXT_PUBLIC_*，普通变量得自己读）────────────────
function loadEnv() {
  const f = path.join(ROOT, ".env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

// ── 参数 ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const DAYS = Number(arg("--days", "28"));
const PROBE_ONLY = argv.includes("--probe");
const SITE = process.env.SITE_HOST || "factoryauditb2b.com";

// ── 凭据 ────────────────────────────────────────────────────────────────
function loadServiceAccount() {
  const inline = process.env.GOOGLE_SA_JSON;
  if (inline && inline.trim()) {
    try { return JSON.parse(inline); } catch { return { __err: "GOOGLE_SA_JSON 不是合法 JSON" }; }
  }
  const p = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (p && p.trim()) {
    const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
    if (!fs.existsSync(abs)) return { __err: `找不到密钥文件：${abs}` };
    try { return JSON.parse(fs.readFileSync(abs, "utf8")); } catch { return { __err: `密钥文件不是合法 JSON：${abs}` }; }
  }
  return null;
}

const HELP = `
未检测到 Google 服务账号凭据 —— 这一步需要你在浏览器里操作，照着做即可：

【一、建服务账号并下载密钥】
  1. 打开 https://console.cloud.google.com/  （用你验证过 GSC 的那个 Google 账号登录）
  2. 顶部「选择项目」→「新建项目」→ 名字随便填（如 factoryaudit-seo）→ 创建，并确保已选中它
  3. 左侧菜单「API 和服务」→「库」→ 分别搜索并启用这两个：
        · Google Search Console API
        · Google Analytics Data API
     （两个都要启用；GA4 那个是**最常被漏的一步**，漏了会报 SERVICE_DISABLED）
  4. 左侧「API 和服务」→「凭据」→「+ 创建凭据」→「服务账号」
        · 名称填 gsc-ga4-reader
        · 角色这一步**直接跳过**（GSC/GA4 的权限不在这里给，在各自后台给）→「完成」
  5. 点刚建好的服务账号 →「密钥」标签 →「添加密钥」→「创建新密钥」→ 选 **JSON** → 创建
     ⇒ 浏览器会下载一个 .json 文件。**这就是密钥，等同于密码。**

【二、把密钥交给本项目】
  6. 把下载的 .json 重命名为 google-sa.json，放到项目的 secrets/ 目录下
     （目录不存在就新建；该目录已在 .gitignore 里，不会被提交）
  7. 在 .env 里加一行：
        GOOGLE_SERVICE_ACCOUNT_JSON="secrets/google-sa.json"

【三、把服务账号邮箱授权给这两个后台】（邮箱在 JSON 里的 client_email 字段）
  8. Search Console：打开 https://search.google.com/search-console →
     左侧「设置」→「用户和权限」→「添加用户」→ 粘贴该邮箱 →
     权限选 **受限 / Restricted**（只读足够）→ 添加
  9. GA4：打开 https://analytics.google.com → 左下角齿轮「管理」→
     属性列「属性访问管理」→ 右上「+」→「添加用户」→ 粘贴同一邮箱 →
     角色选 **查看者 / Viewer** → 添加
 10. （可选）GA4 数字 Property ID：GA4「管理」→「属性设置」里那个纯数字
     （不是 G-XXXXXXX 那种衡量 ID）。填进 .env 的 GA4_PROPERTY_ID；不填本脚本会尝试自动发现。

完成后运行：node scripts/seo-data-pull.mjs
`;

// ── JWT → access_token（RS256，零依赖）────────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getToken(sa, scope) {
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    })
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const sig = b64url(signer.sign(sa.private_key));
  const jwt = `${header}.${claim}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`取 token 失败 HTTP ${res.status}：${JSON.stringify(j).slice(0, 300)}`);
  return j.access_token;
}

async function api(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 保留原文 */ }
  return { ok: res.ok, status: res.status, json, text };
}

const explain = (status, what) => {
  if (status === 401) return `${what}：401 —— 密钥无效或 API 未启用`;
  if (status === 403)
    return `${what}：403 —— 服务账号还没被授权。请检查「把服务账号邮箱加为 GSC 受限用户 / GA4 查看者」这一步是否做了`;
  return `${what}：HTTP ${status}`;
};

// ── GSC ────────────────────────────────────────────────────────────────
async function gsc(token) {
  const sites = await api("https://searchconsole.googleapis.com/webmasters/v3/sites", token);
  if (!sites.ok) return { error: explain(sites.status, "GSC 站点列表") };
  const all = (sites.json?.siteEntry || []).map((s) => s.siteUrl);
  const siteUrl =
    all.find((u) => u === `sc-domain:${SITE}`) ||
    all.find((u) => u.includes(SITE)) ||
    null;
  if (!siteUrl) return { error: `GSC 里找不到 ${SITE} 的属性。服务账号可见的属性：${all.join(", ") || "（无）"}` };

  const end = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10); // GSC 有 2 天延迟
  const start = new Date(Date.now() - (DAYS + 2) * 864e5).toISOString().slice(0, 10);
  const query = async (dims, rowLimit = 200) => {
    const r = await api(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      token,
      { method: "POST", body: JSON.stringify({ startDate: start, endDate: end, dimensions: dims, rowLimit }) }
    );
    return r.ok ? r.json?.rows || [] : { __error: explain(r.status, `GSC ${dims.join("+")}`) };
  };
  return {
    siteUrl,
    range: `${start} ~ ${end}`,
    byQuery: await query(["query"]),
    byPage: await query(["page"], 500),
  };
}

// ── GA4 ────────────────────────────────────────────────────────────────
async function ga4(token, propertyId) {
  let pid = propertyId;
  if (!pid) {
    const acc = await api("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", token);
    if (acc.ok) {
      for (const a of acc.json?.accountSummaries || []) {
        for (const p of a.propertySummaries || []) {
          if ((p.displayName || "").toLowerCase().includes("factoryaudit")) {
            pid = (p.property || "").replace("properties/", "");
            break;
          }
        }
        if (pid) break;
      }
      if (!pid) {
        const first = acc.json?.accountSummaries?.[0]?.propertySummaries?.[0];
        if (first) pid = (first.property || "").replace("properties/", "");
      }
    }
  }
  if (!pid) return { error: "拿不到 GA4 Property ID（可在 .env 里显式设置 GA4_PROPERTY_ID）" };

  const run = async (body) => {
    const r = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (r.ok) return r.json;
    return { __error: explain(r.status, "GA4 runReport") + " " + (r.text || "").slice(0, 160) };
  };
  const DATE = { dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: "today" }] };
  return {
    propertyId: pid,
    channel: await run({ ...DATE, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }, { name: "totalUsers" }] }),
    landing: await run({
      ...DATE,
      dimensions: [{ name: "sessionDefaultChannelGroup" }, { name: "landingPagePlusQueryString" }],
      metrics: [{ name: "sessions" }],
      limit: 200,
    }),
  };
}

// ── 报告 ────────────────────────────────────────────────────────────────
const md = [];
const P = (s = "") => md.push(s);

(async () => {
  const sa = loadServiceAccount();
  if (!sa || sa.__err || !sa.client_email) {
    console.log(sa?.__err ? `凭据有问题：${sa.__err}\n` : "");
    console.log(HELP);
    process.exit(sa?.__err ? 1 : 0);
  }
  console.log(`服务账号：${sa.client_email}\n`);
  const SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
  ];

  let token;
  try {
    token = await getToken(sa, SCOPES.join(" "));
    console.log("✓ 认证成功（JWT → access_token）");
  } catch (e) {
    console.error("✗ " + e.message);
    process.exit(1);
  }

  const g = await gsc(token);
  const a = await ga4(token, process.env.GA4_PROPERTY_ID);

  console.log(g.error ? "✗ " + g.error : `✓ GSC 可读：${g.siteUrl}`);
  console.log(a.error ? "✗ " + a.error : `✓ GA4 可读：properties/${a.propertyId}`);

  if (PROBE_ONLY) {
    process.exit(g.error || a.error ? 1 : 0);
  }

  P(`# SEO 真实数据报告（${new Date().toISOString().slice(0, 10)}）`, "");
  P(`- 站点：${SITE}`);
  P(`- 数据窗口：最近 ${DAYS} 天`);
  P(`- 服务账号：\`${sa.client_email}\``);
  P("");

  if (g.error) P(`> ⚠️ GSC 数据缺失：${g.error}`, "");
  else {
    P(`## 一、GSC 搜索表现（${g.range}）`, "");
    const byQ = Array.isArray(g.byQuery) ? g.byQuery : [];
    const byP = Array.isArray(g.byPage) ? g.byPage : [];
    const totalClicks = byQ.reduce((s, r) => s + (r.clicks || 0), 0);
    const totalImp = byQ.reduce((s, r) => s + (r.impressions || 0), 0);
    P(`合计：**${Math.round(totalClicks)} 次点击 / ${Math.round(totalImp)} 次曝光**（按查询去重后相加）`, "");

    P(`### 1.1 曝光最高的 20 个查询`, "");
    P("| 查询 | 点击 | 曝光 | CTR | 平均排名 |", "|---|---|---|---|---|");
    for (const r of byQ.slice(0, 20))
      P(`| ${r.keys?.[0] || ""} | ${Math.round(r.clicks || 0)} | ${Math.round(r.impressions || 0)} | ${((r.ctr || 0) * 100).toFixed(1)}% | ${(r.position || 0).toFixed(1)} |`);
    P("");

    // 距离首页一步之遥（最值得动手的）
    const striking = byP
      .filter((r) => r.position > 10 && r.position <= 20 && r.impressions >= 5)
      .sort((x, y) => y.impressions - x.impressions)
      .slice(0, 15);
    P(`### 1.2 「差一点上首页」的页面（排名 11–20 且曝光 ≥5）`, "");
    if (!striking.length) P("（无）", "");
    else {
      P("| 页面 | 曝光 | 平均排名 | CTR |", "|---|---|---|---|");
      for (const r of striking)
        P(`| ${String(r.keys?.[0] || "").replace(/^https?:\/\/[^/]+/, "")} | ${Math.round(r.impressions || 0)} | ${(r.position || 0).toFixed(1)} | ${((r.ctr || 0) * 100).toFixed(1)}% |`);
      P("");
    }

    // 有曝光但 0 点击（标题/描述没吸引力）
    const zeroCtr = byP.filter((r) => r.clicks === 0 && r.impressions >= 20).sort((x, y) => y.impressions - x.impressions).slice(0, 15);
    P(`### 1.3 有曝光但零点击的页面（曝光 ≥20，标题/描述需重写）`, "");
    if (!zeroCtr.length) P("（无）", "");
    else {
      P("| 页面 | 曝光 | 平均排名 |", "|---|---|---|");
      for (const r of zeroCtr)
        P(`| ${String(r.keys?.[0] || "").replace(/^https?:\/\/[^/]+/, "")} | ${Math.round(r.impressions || 0)} | ${(r.position || 0).toFixed(1)} |`);
      P("");
    }

    // 缺口：sitemap 收录了、但 GSC 一条曝光都没有的页面
    const withImp = new Set(byP.map((r) => String(r.keys?.[0] || "")));
    let sitemapUrls = [];
    try {
      const sm = await (await fetch(`https://${SITE}/sitemap.xml`)).text();
      sitemapUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    } catch { /* 忽略 */ }
    if (sitemapUrls.length) {
      const en = sitemapUrls.filter((u) => !/factoryauditb2b\.com\/(zh-TW|zh|es|de|fr|pt|ja|ar)(\/|$)/.test(u));
      const gap = en.filter((u) => !withImp.has(u));
      P(`### 1.4 内容缺口：英文页共 ${en.length} 条，其中 **${gap.length} 条在 ${DAYS} 天内 0 曝光**`, "");
      P("（这些就是「写了但没被搜到」的页面 —— 是内容投入方向的第一手依据）", "");
      const byPrefix = {};
      for (const u of gap) {
        const k = u.replace(`https://${SITE}`, "").split("/")[1] || "/";
        byPrefix["/" + k] = (byPrefix["/" + k] || 0) + 1;
      }
      P("| 板块 | 0 曝光页数 |", "|---|---|");
      for (const [k, v] of Object.entries(byPrefix).sort((x, y) => y[1] - x[1]))
        P(`| ${k} | ${v} |`);
      P("");
      fs.writeFileSync(path.join(ROOT, ".tmp-seo-gap.txt"), gap.join("\n"));
      P(`> 0 曝光页面的完整清单已写入 \`.tmp-seo-gap.txt\`（${gap.length} 条）`, "");
    }
  }

  P("---", "");
  if (a.error) P(`> ⚠️ GA4 数据缺失：${a.error}`, "");
  else {
    P(`## 二、GA4 流量（最近 ${DAYS} 天，property ${a.propertyId}）`, "");
    const rows = (o) => (o?.rows || []).map((r) => ({ dims: r.dimensionValues.map((d) => d.value), mets: r.metricValues.map((m) => Number(m.value)) }));
    if (a.channel?.__error) P(`> ⚠️ 渠道报告失败：${a.channel.__error}`, "");
    else {
      P("### 2.1 按渠道", "");
      P("| 渠道 | 会话 | 用户 |", "|---|---|---|");
      for (const r of rows(a.channel).sort((x, y) => y.mets[0] - x.mets[0]))
        P(`| ${r.dims[0]} | ${r.mets[0]} | ${r.mets[1]} |`);
      P("");
    }
    if (a.landing?.__error) P(`> ⚠️ 落地页报告失败：${a.landing.__error}`, "");
    else {
      const organic = rows(a.landing).filter((r) => /organic/i.test(r.dims[0])).sort((x, y) => y.mets[0] - x.mets[0]).slice(0, 25);
      P(`### 2.2 自然搜索入口页 Top ${organic.length}（唯一真正验证 SEO 的表）`, "");
      if (!organic.length) P("（最近窗口内自然搜索没有落地页数据）", "");
      else {
        P("| 落地页 | 会话 |", "|---|---|");
        for (const r of organic) P(`| ${String(r.dims[1] || "").split("?")[0]} | ${r.mets[0]} |`);
        P("");
      }
    }
  }

  const out = path.join(ROOT, "outputs", `seo-data-${new Date().toISOString().slice(0, 10)}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md.join("\n"), "utf8");
  console.log(`\n✅ 报告已生成：${path.relative(ROOT, out)}`);
})();
