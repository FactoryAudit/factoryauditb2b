# Guides 9 语补全 —— 第 4 批方案（待确认后执行）

- 现状：`lib/guides.ts` **47 篇指南**，只有 `metaDescEn` + `metaDescZh`；
  `app/[locale]/guides/**` 用 `pickZhPair(locale, En, Zh)`（`lib/tw.ts:67`）取值 ⇒
  zh → zh、zh-TW → 繁化(zh)、**其余 7 语（en/ja/es/de/fr/pt/ar）全部回退英文**。
- 缺口规模：**47 × 6 = 282 页**（ja/es/de/fr/pt/ar）当前显示英文描述。
- 目标：补齐 ja / es / de / fr / pt / ar 六语 `metaDesc`，使 9 语各自有本地化描述。

---

## 1. 47 篇 slug 清单 + 搜索量估计

> **口径声明**：下表为**意图定性分级**（高 / 中 / 长尾），依据是搜索意图强度与词性，
> **不是实测搜索量**（本机无关键词工具）。若需实测值，需接入 Ahrefs / Google Keyword Planner / Semrush。
> 分级用途是**排批次**，不是选词终判。

### 批 4.1（本次首批 10 篇，核心交易意图优先）

| # | slug | 分类 | 意图分级 | 依据 |
|---|---|---|---|---|
| 1 | how-to-verify-a-chinese-supplier | verification | **高** | 采购决策入口词，直接对应付费动机 |
| 2 | factory-audit-checklist | audit | **高** | 清单型高点击词，工具化检索 |
| 3 | supplier-risk-assessment-guide | risk | **高** | 风险评估是平台核心价值词 |
| 4 | smeta-vs-bsci-social-audit-comparison | compliance | 中 | 对比词，决策中段 |
| 5 | how-to-read-a-factory-audit-report | audit | 中 | 已有报告者的下游需求 |
| 6 | how-to-audit-a-factory-in-vietnam | sea | 中 | 国别词（SEA 板块唯一入口之一） |
| 7 | pre-shipment-inspection-checklist | audit | **高** | 验货高频词，工具化检索 |
| 8 | what-is-a-factory-audit | audit | **高** | 定义型头部词，AI 引用率高 |
| 9 | supplier-evaluation-checklist | verification | **高** | 清单 + 年份词（2026），常青 |
| 10 | on-site-vs-desk-audit | audit | 中 | 方式对比，决策中段 |

### 批 4.2（11–20）

| # | slug | 分类 | 分级 |
|---|---|---|---|
| 11 | third-party-audit-pain-points | risk | 中 |
| 12 | capacity-audit-guide | audit | 中 |
| 13 | aql-sampling-standard-fri | audit | **高** |
| 14 | ppi-vs-dupro-inspection | audit | 中 |
| 15 | full-inspection-100-percent | audit | 中 |
| 16 | fba-rejection-inspection | audit | 中 |
| 17 | failed-inspection-dispute | audit | 长尾 |
| 18 | ethical-audit-mandatory-requirements | compliance | 中 |
| 19 | sa8000-certification-guide | compliance | 中 |
| 20 | esg-supplier-audit-guide | compliance | 中 |

### 批 4.3（21–30）

| # | slug | 分类 | 分级 |
|---|---|---|---|
| 21 | brand-reputation-pr-crisis | risk | 长尾 |
| 22 | chinese-supplier-scam-red-flags | risk | **高** |
| 23 | how-to-check-china-company-registration | risk | **高** |
| 24 | alibaba-trade-assurance-safe-payment | risk | **高** |
| 25 | verify-supplier-before-deposit | risk | **高** |
| 26 | common-b2b-procurement-fraud | risk | 中 |
| 27 | what-is-quality-management-system | audit | 中 |
| 28 | iso-9001-vs-iso-13485 | audit | 中 |
| 29 | manufacturing-quality-control-process | audit | 中 |
| 30 | ppap-production-part-approval | audit | 长尾 |

### 批 4.4（31–40）

| # | slug | 分类 | 分级 |
|---|---|---|---|
| 31 | supplier-quality-audit-checklist | audit | 中 |
| 32 | verify-alibaba-supplier-before-paying | verification | **高** |
| 33 | china-factory-or-trading-company | verification | **高** |
| 34 | china-supplier-risk-assessment-framework | risk | 中 |
| 35 | when-to-order-china-factory-audit | audit | 中 |
| 36 | china-factory-audit-cost | audit | **高** |
| 37 | supplier-verification-vs-factory-audit-vs-inspection | verification | 中 |
| 38 | eu-forced-labour-regulation-china-suppliers | compliance | 中 |
| 39 | eudr-supplier-due-diligence-china | compliance | 中 |
| 40 | digital-product-passport-supplier-data | compliance | 长尾 |

### 批 4.5（41–47，收尾 7 篇）

| # | slug | 分类 | 分级 |
|---|---|---|---|
| 41 | smeta-7-supplier-audit-buyer-guide | compliance | 中 |
| 42 | rba-vap-vs-smeta-vs-bsci | compliance | 中 |
| 43 | china-plus-one-supplier-qualification | sea | 中 |
| 44 | buyer-ready-china-supplier | china | 长尾 |
| 45 | china-factory-audit-mid-autumn-national-day-scheduling | audit | 长尾 |
| 46 | china-us-trade-talks-2026-inspection-audit-planning | risk | 长尾 |
| 47 | q4-shipment-window-factory-audit-inspection-combination | audit | 长尾 |

---

## 2. 分批方案

| 批 | 篇数 | 内容 | 说明 |
|---|---|---|---|
| 4.1 | **10** | #1–10 | 核心交易意图（verification / audit / risk 头部） |
| 4.2 | 10 | #11–20 | 质检 + 合规深度（AQL/PPI/SA8000/ESG） |
| 4.3 | 10 | #21–30 | 防骗 + 反诈（高转化簇） |
| 4.4 | 10 | #31–40 | 国别 + 框架 + 法规（EU/EUDR/DPP） |
| 4.5 | 7 | #41–47 | 时效性 + 长尾收尾 |
| **合计** | **47** | | 每批 10 篇 × 6 语 = **60 条 desc/批** |

**每批节奏建议**：写 desc → 本地校验（预算/句末）→ 写入 → 构建 + 抽 3 页线上验证 → 下一批。
**不动**：zh / zh-TW 转换逻辑、`lib/guides.ts` 既有 EN/ZH 文案、正文（quickAnswer 等）。

---

## 3. 第一批 10 篇 × 6 语 desc 候选（可直接评审）

**校验结果：60/60 合规** —— 总长 ≤ 预算（ja 判定为 CJK 主导 → 90；es/de/fr/pt/ar → 158）、
均双句、均句末标点收尾、无破折号、无营销词/无据声称。最长 157（de，批 4.1 #1）。

### 1. how-to-verify-a-chinese-supplier
- ja `64/90`：中国のサプライヤーを検証する手順を解説します。登記名の照合、統一社会信用コードの確認、実際の工場所在地の確認までを順に示します。
- es `136/158`：Cómo verificar a un proveedor chino paso a paso. Coteje el nombre registrado, compruebe el código de crédito y confirme la fábrica real.
- de `157/158`：So prüfen Sie einen chinesischen Lieferanten Schritt für Schritt. Gleichen Sie den Firmennamen ab, prüfen Sie den Kreditcode und bestätigen Sie den Standort.
- fr `138/158`：Comment vérifier un fournisseur chinois étape par étape. Comparez le nom enregistré, vérifiez le code de crédit et confirmez le site réel.
- pt `133/158`：Como verificar um fornecedor chinês passo a passo. Compare o nome registado, verifique o código de crédito e confirme a fábrica real.
- ar `108/158`：كيفية التحقق من مورد صيني خطوة بخطوة. قارن الاسم المسجَّل، وتحقّق من رمز الائتمان، وأكّد موقع المصنع الفعلي.

### 2. factory-audit-checklist
- ja `56/90`：工場監査チェックリストの項目を解説します。品質、生産管理、社会コンプライアンス、監査員が求める記録を網羅します。
- es `146/158`：Una lista de comprobación para auditorías de fábrica. Cubre la calidad, el control de producción, el cumplimiento social y los registros exigidos.
- de `133/158`：Eine Checkliste für die Werksauditierung. Sie deckt Qualität, Produktionskontrolle, Sozialcompliance und die verlangten Nachweise ab.
- fr `143/158`：Une liste de contrôle pour l'audit d'usine. Elle couvre la qualité, le contrôle de production, la conformité sociale et les documents demandés.
- pt `142/158`：Uma lista de verificação para auditoria de fábrica. Abrange a qualidade, o controlo de produção, a conformidade social e os registos exigidos.
- ar `101/158`：قائمة تحقق لتدقيق المصنع. تشمل الجودة وضبط الإنتاج والامتثال الاجتماعي والسجلات التي يطلبها المدققون.

### 3. supplier-risk-assessment-guide
- ja `60/90`：サプライヤーリスク評価の仕組みを六つの次元で解説します。どの証拠がスコアを動かすのか、結果をどう行動に移すかを示します。
- es `145/158`：Cómo funciona la evaluación de riesgo de proveedores en seis dimensiones. Vea qué evidencia mueve la puntuación y cómo actuar según el resultado.
- de `144/158`：Wie die Lieferantenrisikobewertung über sechs Dimensionen funktioniert. Sehen Sie, welche Nachweise die Bewertung verändern und wie Sie handeln.
- fr `141/158`：Comment fonctionne l'évaluation du risque fournisseur sur six dimensions. Voyez quelles preuves font bouger le score et comment agir ensuite.
- pt `138/158`：Como funciona a avaliação de risco de fornecedores em seis dimensões. Veja que evidências alteram a pontuação e como agir com o resultado.
- ar `103/158`：كيف يعمل تقييم مخاطر الموردين عبر ستة أبعاد. تعرّف على الأدلة التي تغيّر الدرجة وكيف تتعامل مع النتيجة.

### 4. smeta-vs-bsci-social-audit-comparison
- ja `59/90`：SMETA と BSCI の社会的監査を項目ごとに比較します。それぞれの範囲、実施主体、自社に合う選び方を解説します。
- es `128/158`：Comparación de las auditorías sociales SMETA y BSCI, ámbito por ámbito. Vea qué cubre cada una, quién las realiza y cómo elegir.
- de `126/158`：SMETA und BSCI im Vergleich, Bereich für Bereich. Sehen Sie, was jedes Programm abdeckt, wer es durchführt und wie Sie wählen.
- fr `130/158`：Comparaison des audits sociaux SMETA et BSCI, domaine par domaine. Voyez ce que chacun couvre, qui les réalise et comment choisir.
- pt `126/158`：Comparação das auditorias sociais SMETA e BSCI, âmbito por âmbito. Veja o que cada uma cobre, quem as realiza e como escolher.
- ar `111/158`：مقارنة بين تدقيق SMETA وBSCI الاجتماعي، مجالاً بمجال. تعرّف على ما يغطيه كل منهما ومن ينفّذه وكيف تختار الأنسب.

### 5. how-to-read-a-factory-audit-report
- ja `50/90`：工場監査報告書の読み方を解説します。重大な指摘から確認し、根拠を照合してから判断する手順を示します。
- es `136/158`：Cómo leer un informe de auditoría de fábrica sin perder el hilo. Lea primero los hallazgos críticos, revise la evidencia y luego decida.
- de `145/158`：So lesen Sie einen Werksauditbericht richtig. Prüfen Sie zuerst die kritischen Feststellungen, gleichen Sie die Nachweise ab und entscheiden Sie.
- fr `133/158`：Comment lire un rapport d'audit d'usine sans perdre le fil. Lisez d'abord les constats critiques, vérifiez les preuves, puis décidez.
- pt `135/158`：Como ler um relatório de auditoria de fábrica sem se perder. Veja primeiro os achados críticos, confirme as evidências e depois decida.
- ar `101/158`：كيفية قراءة تقرير تدقيق المصنع دون ارتباك. اقرأ البنود الحرجة أولاً، وتحقّق من الأدلة، ثم اتخذ قرارك.

### 6. how-to-audit-a-factory-in-vietnam
- ja `56/90`：ベトナムで工場監査を行う手順を解説します。登記の確認、実際の生産拠点の検証、コンプライアンスの確認をまとめます。
- es `136/158`：Cómo auditar una fábrica en Vietnam antes de pagar el anticipo. Confirme el registro, verifique la planta real y revise el cumplimiento.
- de `136/158`：So auditieren Sie eine Fabrik in Vietnam vor der Anzahlung. Prüfen Sie die Registrierung, den tatsächlichen Standort und die Compliance.
- fr `122/158`：Comment auditer une usine au Vietnam avant de verser l'acompte. Vérifiez l'immatriculation, le site réel et la conformité.
- pt `122/158`：Como auditar uma fábrica no Vietname antes do sinal. Confirme o registo, verifique a unidade real e reveja a conformidade.
- ar `98/158`：كيفية تدقيق مصنع في فيتنام قبل دفع الدفعة المقدمة. تحقّق من التسجيل والموقع الفعلي وراجع الامتثال.

### 7. pre-shipment-inspection-checklist
- ja `52/90`：出荷前検査のチェックリストを解説します。数量、作り、機能、包装、ラベル、積み込みの確認項目をまとめます。
- es `133/158`：Una lista de verificación para la inspección previa al embarque. Revise cantidad, fabricación, función, embalaje, etiquetado y carga.
- de `132/158`：Eine Checkliste für die Vorversandinspektion. Geprüft werden Menge, Verarbeitung, Funktion, Verpackung, Kennzeichnung und Verladung.
- fr `136/158`：Une liste de contrôle pour l'inspection avant expédition. Vérifiez quantité, fabrication, fonction, emballage, étiquetage et chargement.
- pt `135/158`：Uma lista de verificação para a inspeção antes do embarque. Verifique quantidade, fabrico, função, embalagem, rotulagem e carregamento.
- ar `92/158`：قائمة تحقق لفحص ما قبل الشحن. تحقّق من الكمية والصناعة والوظيفة والتغليف والملصقات والتحميل.

### 8. what-is-a-factory-audit
- ja `59/90`：B2B の工場監査とは何か、なぜ海外バイヤーに必要なのかを解説します。自社製品に合う第三者監査機関の選び方も示します。
- es `132/158`：Qué es una auditoría de fábrica B2B y por qué la necesitan los compradores. Vea cómo elegir una firma de auditoría para su producto.
- de `121/158`：Was ein B2B-Werksaudit ist und warum Übersee-Einkäufer ihn brauchen. So wählen Sie eine Prüfgesellschaft für Ihr Produkt.
- fr `136/158`：Ce qu'est un audit d'usine B2B et pourquoi les acheteurs en ont besoin. Voyez comment choisir un cabinet d'audit adapté à votre produit.
- pt `139/158`：O que é uma auditoria de fábrica B2B e porque os compradores precisam dela. Veja como escolher uma empresa de auditoria para o seu produto.
- ar `107/158`：ما هو تدقيق المصنع في سياق B2B ولماذا يحتاجه المشترون. تعرّف على كيفية اختيار جهة تدقيق خارجية تناسب منتجك.

### 9. supplier-evaluation-checklist
- ja `59/90`：2026 年版のサプライヤー評価チェックリストです。合法性、生産能力、ESG、品質体制と必要な書類・記録を網羅します。
- es `131/158`：Una lista de evaluación de proveedores 2026 sobre legalidad, capacidad y ESG. Cubre el sistema de calidad y los registros exigidos.
- de `139/158`：Eine Lieferantenbewertungs-Checkliste 2026 zu Legalität, Kapazität und ESG. Sie deckt das Qualitätssystem und die geforderten Nachweise ab.
- fr `134/158`：Une liste d'évaluation fournisseur 2026 sur la légalité, la capacité et l'ESG. Elle couvre le système qualité et les documents exigés.
- pt `134/158`：Uma lista de avaliação de fornecedores 2026 sobre legalidade, capacidade e ESG. Abrange o sistema de qualidade e os registos exigidos.
- ar `105/158`：قائمة تقييم الموردين لعام 2026 تغطّي الشرعية والقدرة الإنتاجية وESG. وتشمل نظام الجودة والسجلات المطلوبة.

### 10. on-site-vs-desk-audit
- ja `53/90`：現地監査とデスク監査の違いを解説します。それぞれの使いどころと、安全な調達のための組み合わせ方を示します。
- es `130/158`：Auditoría presencial frente a auditoría documental. Vea cuándo funciona cada una y cómo combinarlas para un abastecimiento seguro.
- de `143/158`：Vor-Ort-Audit gegenüber Schreibtisch-Audit. Sehen Sie, wann welches Verfahren passt und wie Sie beide für eine sichere Beschaffung kombinieren.
- fr `119/158`：Audit sur site ou audit sur dossier. Voyez quand chacun convient et comment les combiner pour un approvisionnement sûr.
- pt `131/158`：Auditoria presencial versus auditoria documental. Veja quando cada uma funciona e como combiná-las para um aprovisionamento seguro.
- ar `91/158`：التدقيق الميداني مقابل التدقيق المكتبي. تعرّف على متى يصلح كل منهما وكيف تجمعهما لشراء آمن.

---

## 4. 写入方式 + 验证方式（须你确认分支后再动手）

### 4.1 写入位置 —— 两个方案（**这是唯一需要你拍板的点**）

**方案 A（推荐，符合 `lib/guides.ts` 自身设计注释）**：在 `Guide` 接口新增 6 个可选字段
`metaDescJa/Es/De/Fr/Pt/Ar`，**对 47 个 guide 对象逐条追加**（纯新增，不改任何既有 EN/ZH 值），
并把消费点从 `pickZhPair(locale, g.metaDescEn, g.metaDescZh)` 换成一个新的
`pickGuideDesc(locale, g)`（zh→zh、zh-TW→繁化、ja/es/de/fr/pt/ar→对应字段、兜底 en）。
- 优点：与仓库既有「数据放数据文件」原则一致；`lib/guides.ts` 上方注释**就是这么规划的**。
- 风险：脚本会**追加**字段到 `lib/guides.ts`（不改既有内容）。若你坚持「完全零改动该文件」，走方案 B。

**方案 B（零改动 lib/guides.ts）**：新建 `lib/guidesI18n.ts`，导出
`Record<slug, { ja; es; de; fr; pt; ar }>`，消费点优先读取本表、缺失回退 `pickZhPair`。
- 优点：`lib/guides.ts` 一字不动。
- 风险：同一份数据分裂到两个文件，后续维护要记得两处；且偏离仓库既有模式。

> 两者都**不改** zh / zh-TW 转换逻辑（`lib/tw.ts` 不动），也**不触碰正文**（quickAnswer / steps / faq …）。

### 4.2 脚本

新建 `scripts/translate-guides-batch4.cjs`：
- 输入：本次评审通过的 `slug → {ja,es,de,fr,pt,ar}` 映射（内联为常量，不依赖外部机器翻译）；
- 行为：按你选定的方案 A/B 写入；
- **幂等**：已存在同 slug 同语字段则跳过（重复跑不重复插入）；
- 自检：写完立刻校验「总长 ≤ 预算 / 句末标点 / 无破折号」，任一不合规即 exit 1 且不落盘。

### 4.3 验证（写入后）

```bash
# 1) 结构 / 叶子数（F1i 会重算 en 叶子数，新增 TS 字段不影响 3126）
node --env-file=.env scripts/run-regression.mjs cs13-supplier-seo-regression CS13_ROOT

# 2) 类型与构建
node node_modules/typescript/bin/tsc --noEmit          # 期望 EXIT=0
# 本地 9 语抽页：确认 ja/es/de/fr/pt/ar 的指南页 description 已不再是英文

# 3) 部署后（先等传播窗口）
MSYS_NO_PATHCONV=1 node scripts/live-meta-verify.cjs \
  /guides/factory-audit-checklist /ja/guides/factory-audit-checklist \
  /de/guides/factory-audit-checklist /ar/guides/factory-audit-checklist
```
- 断言：上述 4 页 `desc 与本地预渲染逐字一致` + `x-opennext-cache: HIT`；
  ja 页 desc 为日文、de 页为德文、ar 页为阿拉伯文（不再是英文）。

### 4.4 本批**不做**的事

- 不改 `lib/tw.ts`（zh-TW 繁化逻辑）
- 不改任何 guide 的既有 EN / ZH 文案与正文
- 不动字典 `en.json`（叶子数闸门 3126 不受影响）
- 不删除 / 不改写现有 47 篇

---

## 5. 待你确认

1. **写入位置选 A 还是 B？**（A = 追加到 `lib/guides.ts`；B = 新建 `lib/guidesI18n.ts`）
2. 批 4.1 的 10 篇 desc 是否直接采用？如需改词，指出 slug + 语种即可。
3. 搜索量分级是否认可（如需实测值，我需你提供关键词工具/API）。
