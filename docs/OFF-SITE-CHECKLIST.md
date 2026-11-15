# 站外推广照做清单（需本人登录操作）

> 站内 SEO/GEO 技术底子已做到 90 分（robots 放行 AI 检索爬虫、llms.txt 完整、40+ 页面结构化数据、53 篇指南、工具页 FAQ）。
> 当前最大短板在**站外权威**：Google/Bing 没验证收录、目录外链≈0。以下每一项都要你本人登录点击，文哥替你填不了的只有「登录 + 点确认」。

---

## 一、Google Search Console（最高优先，必做）

Google 是核心流量入口，先做这个。

1. 打开 https://search.google.com/search-console/welcome
2. 用 Google 账号登录（没有就注册一个，免费）
3. 点「新增资源」，类型选 **网域（Domain）**，输入 `factoryauditb2b.com`，点继续
4. 页面会给你一条 TXT 记录（形如 `google-site-verification=xxxx`）
5. 去 Cloudflare（cloudflare.com 登录你的域名）→ 点 `factoryauditb2b.com` → 左侧 **DNS → 记录** → 新增：
   - 类型：`TXT`
   - 名称：`@`
   - 内容：把 Google 给的那串 `google-site-verification=...` 整条粘贴进去
   - 保存（TTL 默认即可，不用开代理/橙云）
6. 回到 GSC 点「验证」。DNS 生效一般几分钟，最长 48 小时；失败就等半小时再点
7. 验证通过后，左侧 **Sitemap** → 输入 `sitemap.xml` → 提交
   - 站点实际 sitemap 索引地址：`https://factoryauditb2b.com/sitemap.xml`（含 9 语子地图，自动展开）
8. 之后 Google 会在几天到几周内陆续收录，不用手动干预

---

## 二、Bing Webmaster Tools（第二优先）

Bing 同时喂养着 ChatGPT 等 AI 引擎，对 GEO 也有帮助。

1. 打开 https://www.bing.com/webmasters
2. 登录微软账号（没有注册一个）
3. 点「Import from Google Search Console」→ 授权后一键导入，**不用重新验证**
   - 若不想导入，就手动加 `factoryauditb2b.com`，验证方式同上（DNS TXT 或文件）
4. 导入后，左侧 **Sitemap** → 提交 `https://factoryauditb2b.com/sitemap.xml`

---

## 三、NAP 一致性（先确认，再到处填）

NAP = 名称（Name）/ 地址（Address）/ 电话（Phone）。**所有目录、社媒主页必须用同一套信息**，Google 靠这个判断「是不是同一家真实公司」。不一致反而减分。

目前已确定的统一信息：

| 项 | 值 |
|---|---|
| 品牌名 | FactoryAuditB2B |
| 法律主体（英文） | Jiangmen Zhiyu Technology Co., Ltd. |
| 法律主体（中文） | 江门智煜科技有限公司 |
| 网站 | https://factoryauditb2b.com |
| 客服邮箱 | support@factoryauditb2b.com |
| 电话/WhatsApp | +86 136 4260 6807 |

**需要你拍板补一条**：注册地址的**城市 + 详细地址**（上面「江门」是从公司名推断的，我没有你的工商注册地址原文）。你在目录里填地址时，把下面这条填成你真实登记的信息，之后所有地方照抄，不要每次写得不一样：

- 英文地址（统一格式）：`___（街道/区）, Jiangmen, Guangdong, China`
- 中文地址（统一格式）：`中国广东省江门市___`

---

## 四、B2B 目录提交（外链，按优先级）

这些是「验厂/质检/外贸」买家常查的目录。**只填上面 NAP 信息 + 一句真实简介**，不要编审核员人数、客户数、认证。

### 免费、价值高（先做这 3 个）
| 目录 | 网址 | 说明 |
|---|---|---|
| Made-in-China | made-in-china.com | 中国制造商最相关，免费会员可挂公司页 |
| Global Sources | globalsources.com | 老牌外贸目录，可申请供应商页 |
| Europages | europages.com | 欧洲买家常用，免费基础页 |

### 免费、一般（有时间再做）
| 目录 | 网址 | 说明 |
|---|---|---|
| Kompass | kompass.com | 全球 B2B 名录 |
| TradeIndia | tradeindia.com | 印度买家多 |
| ExportHub | exporthub.com | 免费基础页 |
| Alibaba | alibaba.com | 流量最大，但完整效果需付费；免费也能建基本店铺页 |

> 提交时的「公司简介」统一用这句（不要自由发挥）：
> 「FactoryAuditB2B（江门智煜科技有限公司）为全球买家提供工厂验厂、供应商核验、出货前检验与装柜监装服务，帮助买家在付款前核实供应商真实资质。」

---

## 五、社交媒体主页（E-E-A-T + 外链，1 小时做完）

Google 现在很看重「这家公司有真实运营痕迹」。建主页并把网址回填到网站（站内已预留 `sameAs` 字段，建好后告诉我，文哥帮你接上结构化数据）。

1. **LinkedIn 公司主页**（B2B 最优先）：linkedin.com → 创建 Company Page → 填 NAP 信息 + 网址
2. **Facebook 主页**：facebook.com/pages/create → 选「公司或品牌」
3. **X（原 Twitter）**：创建账号，简介写 NAP

建好后把三个主页链接发给文哥，我写进站内的 `sameAs` 结构化数据（社媒档案），让 Google 把账号和官网关联起来。

---

## 六、内容分发（外链，持续做）

把站内已有的 53 篇指南挑几篇发出去，文末带官网链接：

- LinkedIn 发长文（选 3–5 篇，改写开头）
- Medium / 知乎 / 公众号【化工群】各发 1–2 篇（公众号按文哥惯例加导流语）
- 每篇链接回官网对应页面

---

## 优先级总览

| 顺序 | 事项 | 耗时 | 效果 |
|---|---|---|---|
| 1 | Google Search Console 验证 + 提 sitemap | 15 分钟 | 最高 |
| 2 | Bing Webmaster 导入 + 提 sitemap | 10 分钟 | 高 |
| 3 | 确认 NAP 统一地址 | 5 分钟 | 高（决定后续一致性） |
| 4 | 建 LinkedIn/Facebook/X 主页 | 1 小时 | 中高 |
| 5 | 提交 3 个高价值目录 | 1 小时 | 中 |
| 6 | 内容分发 | 持续 | 中长期 |
