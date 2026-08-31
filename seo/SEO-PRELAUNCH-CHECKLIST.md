# FactoryAuditB2B — 上线前 SEO 检查清单（Pre-launch Checklist）

> 打勾完成。技术项多数已就绪，重点在执行外部动作。

## A. 技术 / 收录（已完成项标 ✅）
- [x] 每个页面有唯一 `<title>` 与 `<meta description>`（layout + `buildPageMetadata` 统一生成）
- [x] `canonical` 逐页正确，英文落无前缀、其余带语言前缀
- [x] `hreflang` 全语言 + `x-default` 正确
- [x] `robots.txt` 放行 Google/Bing 与 AI 搜索/训练爬虫，屏蔽 `/admin` `/api` `/login`
- [x] `sitemap.xml` 程序化覆盖全语言与全部真实页面
- [x] `llms.txt` 面向 AI 引擎的结构化说明已就位
- [x] 全局 Organization + WebSite 结构化数据
- [x] 指南页 Article + BreadcrumbList + FAQPage 结构化数据
- [x] OG / Twitter Card 分享图接入（`public/og-image.png`，1200×630）✅ 本次新增
- [x] `/audit-guide` 仅三国生成，消除薄内容 ✅ 本次新增
- [x] GSC/Bing 验证位接入（配 `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION`）✅ 本次新增
- [ ] 在 `.env` 填入 GSC / Bing 验证码后重新部署

## B. 内容（本次已推进，剩余待排期）
- [x] 指南由 4 篇增至 10 篇 ✅ 本次新增 6 篇
- [ ] 指南补至 30 篇（按 `SEO-KEYWORD-MAP.md` 的 P1 缺口，每月 6–8 篇）
- [ ] 行业页（/industry/[code]）充实真实内容，空供应商页 `noindex`
- [ ] 每篇指南 `related` 互链已接好，确认无死链
- [ ] 全站跑一遍 200 路由校验（脚本 `scripts/smoke-routes.sh`）

## C. 站外 / 权威（上线后第 1 周启动）
- [ ] Google Search Console 提交 sitemap.xml 并申请收录
- [ ] Bing Webmaster Tools 提交 sitemap.xml
- [ ] 提交 5–10 个免费 B2B/采购目录（Clutch / GoodFirms / ExportHub / Kompass 等）
- [ ] 发布首批 1–2 篇客座文章，正文嵌入指南链接
- [ ] LinkedIn / Reddit r/ImportExport / Quora 持续自然引用
- [ ] 配置 GA4 + Search Console 数据联动，每周看展示量/CTR/排名

## D. 体验 / 转化（SEO 间接信号）
- [ ] 移动端 PageSpeed LCP < 2.5s、CLS < 0.1
- [ ] 核心落地页有明确 CTA（RFQ / 验厂请求 / WhatsApp）
- [ ] 404 页有返回首页与搜索入口

## 上线判定
A 全部完成 + C 前 3 项启动 + B 的 30 篇排期明确 = 可上线并进入流量增长期。
