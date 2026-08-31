# AI-SEARCH — AI 搜索与 GEO / AEO 优化

日期：2026-08-29
覆盖：ChatGPT / Perplexity / Claude / Gemini（AI Overviews）/ Copilot / 豆包
相关文档：CRAWLER-ACCESS.md（爬虫配置）、SCHEMA.md（结构化数据）

---

## 〇、一句话结论

**本站最大的 AI 搜索优势已经具备**：365 页全部静态预渲染，HTML 里就有完整答案，AI 爬虫不用执行 JavaScript 就能读到内容。这一点很多 Next.js 站点做不到。

**最大的障碍是 robots.txt 里什么都没写**。既不拒绝也不邀请，等于把可见度交给运气。而且一旦部署到 Cloudflare，默认设置会直接屏蔽掉所有 AI 爬虫，届时全站内容做得再好也不会被引用。

---

## 一、核心概念：训练爬虫 ≠ 检索爬虫

这是最容易搞混、也最容易自伤的一点。**同一个公司有两个爬虫，各管一件事**：

| 类型 | 作用 | 屏蔽后果 |
|---|---|---|
| **检索爬虫** | 实时抓取页面，在 AI 回答里引用你 | **完全失去被该引擎引用的资格** |
| **训练爬虫** | 抓去训练模型，内容进模型参数 | 不进训练数据，但**仍可被引用** |

**关键**：屏蔽训练爬虫不影响被引用；屏蔽检索爬虫则彻底消失。

| 爬虫 | 公司 | 类型 | 本站策略 |
|---|---|---|---|
| `OAI-SearchBot` | OpenAI | 检索（ChatGPT 搜索引用）| **必须允许** |
| `ChatGPT-User` | OpenAI | 用户触发抓取 | 允许 |
| `GPTBot` | OpenAI | 训练 | 允许（新站策略，见 2.2）|
| `PerplexityBot` | Perplexity | 检索 + 索引 | **必须允许** |
| `PerplexityBot-User` | Perplexity | 用户触发 | 允许 |
| `Claude-SearchBot` | Anthropic | 检索 | **必须允许** |
| `Claude-User` | Anthropic | 用户触发 | 允许 |
| `ClaudeBot` / `anthropic-ai` | Anthropic | 训练 | 允许 |
| `Google-Extended` | Google | Gemini 训练 + AI Overviews | **必须允许** |
| `Googlebot` | Google | 传统搜索 + AI Overviews | 允许 |
| `Bingbot` | Microsoft | **ChatGPT 与 Copilot 的索引来源** | **必须允许** |
| `Applebot` | Apple | Siri / Spotlight 搜索 | 允许 |
| `Applebot-Extended` | Apple | Apple Intelligence 训练 | 允许 |
| `CCBot` | Common Crawl | 第三方训练语料 | 允许 |
| `Bytespider` | 字节跳动 | 豆包 / TikTok 训练 | 允许 |
| `Meta-ExternalAgent` | Meta | Llama 训练 + 实时检索 | 允许 |

> `Bingbot` 常被忽略。ChatGPT Search 与 Copilot 大量依赖 Bing 索引，屏蔽 Bing 等于同时失去这两个渠道。

---

## 二、本站爬虫策略

### 2.1 结论：全部允许

| 判断依据 | 本站情况 |
|---|---|
| 站点年龄 | 新站，域名权重几乎为零 |
| 内容性质 | 公开 B2B 服务与工具，无付费墙、无 UGC 隐私风险 |
| 商业目标 | 需要被 AI 引用带来精准流量 |
| 内容壁垒 | 装柜计算器、风险引擎是原创工具，被引用即是品牌曝光 |

**行业共识**：上线不足 6 个月、权重低的商业站点，应当**先允许一切**，优先换取可见度，等 12 个月后再重新评估训练爬虫策略。本站正属于这一类。

### 2.2 部署陷阱（必读）

| 平台 | 风险 | 处理 |
|---|---|---|
| **Cloudflare** | 2024 年起 Bot Fight Mode **默认屏蔽** AI 爬虫，含 OAI-SearchBot、GPTBot、ClaudeBot | 后台 → 安全性 → 机器人 → 关闭"AI 爬虫拦截"，或显式放行 |
| Vercel | Pro 计划有严格机器人规则，AI 爬虫可能被限流或 403 | 加 `vercel.json` 例外 |
| 腾讯云 CDN / EdgeOne | 需确认是否有默认 UA 黑名单 | 上线前实测 |

**验证方法**（部署后必做）：

```bash
curl -A "OAI-SearchBot" https://factoryauditb2b.com/
curl -A "PerplexityBot" https://factoryauditb2b.com/
curl -A "Claude-SearchBot" https://factoryauditb2b.com/
```

返回 403 或 429 就是被拦了。这一步比写一百篇文章都重要。

---

## 三、页面范式：让 AI 能摘走答案

### 3.1 本站样板：`/logistics`

`/logistics` 的结构是目前全站最标准的 AI 友好范式，其余页面照此改造：

```
H1：一句话说清这个页面给什么答案
│
├─ Quick Answer（40–80 词，第一句就给结论）
│   例："A 20GP container holds about 25 CBM of usable space..."
│
├─ 工具本体（WebApplication，可交互）
│
├─ How it works（4 步，编号列表）
│
├─ 数据表（8 种柜型完整规格，表格而非段落）
│
├─ Methodology（算法说明，建立可信度）
│
└─ FAQ（6 组问答，同时输出 FAQPage JSON-LD）
```

### 3.2 AI 摘取答案的四个偏好

| 偏好 | 做法 | 反例 |
|---|---|---|
| **答案前置** | 第一段直接给结论，不铺垫 | 先写 300 字行业背景再给答案 |
| **结构化** | 表格、编号列表、小标题 | 大段连续文字 |
| **有数字** | 具体数值、单位、日期 | "很快""大约""多种" |
| **可独立理解** | 每段自带上下文，不依赖上文 | "如上所述""这一点" |

### 3.3 Q&A 句式设计

用户会这样问 AI：**"一个 20GP 能装多少箱货？"**

页面里就要有一句能直接被摘走的话：

```
A 20GP container fits about 25 CBM of cartons. For standard
60 × 40 × 40 cm boxes, that is roughly 225 cartons, limited by
volume rather than the 28-tonne payload limit.
```

**写法要点**：
- 主句回答核心问题，一句话说完
- 紧跟一个具体例子（带数字）
- 补一个限定条件（"而非受载重限制"），显示专业度
- 不写"在当今竞争激烈的市场环境中"这类废话

### 3.4 每个工具页都要配的 FAQ 类型

| 问题类型 | 示例 |
|---|---|
| 定义 | "What does 20GP mean?" |
| 计算 | "How many cartons fit in a 40HQ?" |
| 比较 | "What is the difference between 40GP and 40HQ?" |
| 边界 | "Can I load a container to its full payload limit?" |
| 实操 | "How much clearance should I leave between cartons?" |

FAQ 内容必须与页面可见文本一致，且输出 FAQPage JSON-LD。

---

## 四、实体优化（Entity SEO）

AI 判断"该信谁"靠实体识别。本站需要让 AI 明确这三件事：**你是谁、你覆盖什么、你的权威依据是什么**。

### 4.1 组织实体

`Organization` schema 已输出。待补（见 SCHEMA.md 2）：

- `sameAs`：关联 LinkedIn / X 真实账号（**有才填，不要编**）
- `areaServed`：9 个国家的 ISO 代码
- `contactPoint`：支持邮箱 + 6 种服务语言

### 4.2 领域实体词表

以下词汇应在页面文案中**自然、一致地出现**，不要堆砌：

| 类别 | 实体词 |
|---|---|
| 审核体系 | SMETA, BSCI, WRAP, SA8000, RBA, ICTI, CTPAT |
| 管理体系 | ISO 9001, ISO 14001, ISO 45001, ISO 27001, ISO 13485, IATF 16949 |
| 产品合规 | CE, UL, CCC, BRC, HACCP, GMP, FSSC 22000 |
| 反贿赂 | ISO 37001, ISO 28000 |
| 国家 | China, Vietnam, Thailand, India, Indonesia, Bangladesh, Pakistan, Turkey, Mexico |
| 柜型 | 20GP, 40GP, 40HQ, 45HQ, 20RF, 40RF, 20OT, 40OT |

### 4.3 免责声明（提升可信度的反直觉做法）

AI 倾向于引用**表述克制**的来源。以下声明应保留在相关页面：

- 平台不颁发 SMETA / BSCI 证书，只做审核与验证服务
- 风险评分是决策辅助，不替代独立第三方验证
- 装柜计算是几何估算，实际装载受装箱方式、货物变形影响

这类声明看似"示弱"，实际显著提高被引用概率。

---

## 五、llms.txt：保持，但不要指望

`app/llms.txt/route.ts` 已实现，内容由 taxonomy 驱动，随数据库自动更新。

**现实**：目前没有可靠证据表明主流 AI 引擎会用 llms.txt 做排名或引用决策。它的价值在于：

1. 对人和脚本友好，便于理解站点结构
2. 万一未来被采用，已经占好位置
3. 维护成本极低（已自动化）

**不要为它投入额外时间**。真正影响可见度的是爬虫可达性、页面结构、结构化数据这三件事。

---

## 六、效果监测

| 方法 | 操作 | 频率 |
|---|---|---|
| 手动抽查 | 在 ChatGPT / Perplexity 问核心问题，看是否被引用 | 每月 |
| 服务器日志 | 统计各 AI 爬虫的抓取量 | 每月 |
| Bing Webmaster Tools | 提交 sitemap，监控 Bing 索引（影响 ChatGPT / Copilot）| 上线即做 |
| Google Search Console | 监控 AI Overviews 展现 | 每月 |

**监测用问题清单**（每月固定问一遍，记录是否出现本站）：

```
1. How do I verify a factory in China?
2. What is a SMETA audit?
3. How many cartons fit in a 20GP container?
4. What does factory audit cost?
5. China factory audit checklist
```

---

## 七、执行清单

| 优先级 | 任务 | 位置 | 预估 |
|---|---|---|---|
| P0 | robots.ts 显式声明全部 AI 爬虫 Allow | `app/robots.ts` | 30 分钟 |
| P0 | 部署后 `curl -A` 实测 3 个检索爬虫不被拦 | 部署流程 | 10 分钟 |
| P0 | 检查 CDN / WAF 是否默认屏蔽 AI 爬虫 | 腾讯云 / Cloudflare 后台 | 20 分钟 |
| P1 | 16 个缺 metadata 的页面补 Quick Answer 段落 | 各 page.tsx | 1 天 |
| P1 | 6 个工具页各补 5 类 FAQ + FAQPage schema | 各 tool 页面 | 1 天 |
| P1 | Organization 补 sameAs / areaServed / contactPoint | `app/[locale]/layout.tsx` | 1 小时 |
| P1 | Bing Webmaster Tools 提交 sitemap | 外部 | 20 分钟 |
| P2 | 建立月度 AI 引用监测表 | 文档 | 1 小时 |
