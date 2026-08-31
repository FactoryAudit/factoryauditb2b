# FactoryAuditB2B — 六语言 i18n 落地 + 全站去 AI 味（2026-08-29）

## 一、多语言架构（6 种语言，零新增依赖）

| 语言 | URL 形式 |
|---|---|
| English（默认） | `/tools`（**无前缀**）|
| 简体中文 | `/zh/tools` |
| Español | `/es/tools` |
| Deutsch | `/de/tools` |
| Français | `/fr/tools` |
| Português | `/pt/tools` |

英文保持无前缀 → 现有 URL 完全不变，**SEO 零损失**；新增语言只需加一份字典 JSON。

### 新增文件
| 文件 | 作用 |
|---|---|
| `i18n/config.ts` | 语言定义、`localePath`、`switchLocalePath` |
| `i18n/getDictionary.ts` | 字典加载器（类型以 `en.json` 为准，缺 key 会类型报错）|
| `i18n/hreflang.ts` | hreflang 映射与 canonical |
| `middleware.ts` | 无前缀 URL 内部 rewrite 到 `/en`（地址栏不变）；`/en/*` 301 到无前缀 |
| `components/LocaleSwitcher.tsx` | 语言切换器，保留当前页面 |
| `i18n/dictionaries/*.json` | 6 份字典 |

### 路由改造
所有页面移入 `app/[locale]/`，`app/` 根只保留 `api`、`globals.css`、`llms.txt`、`robots.ts`、`sitemap.ts`。

### riskEngine 重构：文案与结构分离
`lib/riskEngine.ts` 只保留 `DIMENSION_STRUCTURE`（题目 + 选项风险等级，**零展示文案**），全部文案迁到字典。符合项目「单一事实来源」约定，也是多语言的前提。

## 二、去 AI 味

主因是**破折号滥用 57 处**，其次是否定式排比与三段式堆砌。

| 原文（AI 味） | 重写后 |
|---|---|
| "A smarter way to source from China and Asia. … — all in one platform." | "We look up the registration, walk the floor and read the audit paperwork for factories in China and across Asia. You get the documents, photos and findings, then decide whether to place the order." |
| "Every tool is a real utility — not a blog post." | "Seven tools for checking suppliers and preparing audits. No account needed, and no email wall on the basic result." |
| "More data → better matching, sharper risk scores, richer SEO — a compounding moat." | "Each verification and audit stays in the supplier's file. A company cannot quietly reset its history with us." |
| "It is decision-support, not a substitute for official third-party verification…" | "It is not a substitute for an independent verification, a factory audit or legal advice." |

首页三条价值主张从抽象口号（Evidence First / Human + AI / Supplier Intelligence）改为具体行为描述：
**What verified actually means** / **People make the call** / **Every check stays on the record**

原则写进 `MEMORY.md`：禁破折号修辞、禁 "not X but Y"、禁营销术语，用具象细节替代抽象概括。

## 三、多语言 SEO
- 每页 `alternates.languages` 输出 9 个变体（6 语言 + en-US / zh-Hans / pt-BR / x-default）
- `sitemap.ts`：每条路径生成 6 条语言 URL，各带完整 hreflang → **1218 条 URL / 10962 个 hreflang 变体**
- `llms.txt` 新增 `## Languages` 段

## 四、验证结果

- `next build` **EXIT_CODE=0**，**365 个静态页**
- **42 条路由巡检全部 200，0 失败**（6 语言 × 7 路径）
- 6 语言标题实测渲染正确：

| 语言 | 标题 |
|---|---|
| English | Supplier Risk Calculator |
| 中文 | 供应商风险计算器 |
| Español | Calculadora de riesgo del proveedor |
| Deutsch | Lieferanten-Risikorechner |
| Français | Calculateur de risque fournisseur |
| Português | Calculadora de risco do fornecedor |

- `html lang` 正确（en / zh-CN / es / de / fr / pt-BR）
- 6 份字典 JSON 全部合法，key 与 en 完全一致（0 缺失 / 0 多余）

## 五、复现命令

```bash
cd /f/AI-验厂SEO网站

# 构建（必须先重定向 home 环境变量，否则 EPERM）
export NODE_OPTIONS=""
export HOMEDRIVE=F: HOMEPATH='\wb_home' USERPROFILE='F:\wb_home'
export APPDATA='F:\wb_home\AppData\Roaming' LOCALAPPDATA='F:\wb_home\AppData\Local' HOME='F:\wb_home'
export TEMP='F:\wb_home\temp' TMP='F:\wb_home\temp' TMPDIR='F:\wb_home\temp'
export npm_config_cache='F:\wb_home\npm-cache'
mkdir -p "$USERPROFILE/AppData/Roaming" "$USERPROFILE/AppData/Local" "$TEMP" "$npm_config_cache"
npm run build >> build.log 2>&1      # 日志落盘，别直接 tail

# 启服
NODE_OPTIONS="" nohup npx next start -p 3000 > .next_start_3000.log 2>&1 &

# 六语言巡检（注意别拼出尾斜杠，/zh/ 会 308 到 /zh）
for l in "" "/zh" "/es" "/de" "/fr" "/pt"; do
  for p in "" "/tools" "/tools/supplier-risk-calculator" "/services/supplier-verification"; do
    printf "%-6s %-40s %s\n" "${l:-/en}" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$l$p)"
  done
done
```

## 六、待办

- **剩余 15 个页面未接入字典**（各语言下仍显示英文，任务 #45）：
  rfq、pricing、knowledge、logistics、inspectors（含中文硬编码）、login、suppliers、supplier 详情页、audit-guide、factory-audit/request、audit-checklist、supplier-scorecard、audit-report-analyzer、supplier-document-checker、supplier-risk-assessment
- PRD 剩余：China Supplier Risk Calculator、Factory Audit Cost Calculator
- RFQ / 验厂申请表单未持久化到 Rfq / AuditRequest 表
- 上线：SQLite→PostgreSQL 迁移、真实 DeepSeek key、支付与会员门控
