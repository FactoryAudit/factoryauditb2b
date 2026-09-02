# -*- coding: utf-8 -*-
"""
修复风险评分口径相关的全站文案（9 语）。

背景（数字声明审计 —— 用户铁律：禁无据声称）：
  lib/riskEngine.ts 的真实口径是 **8 维 / 28 题 / 权重 12-16-16-12-12-12-10-10 /
  高分=低风险（V1.1 拍板反转）**，但 9 份字典里绝大部分文案仍停留在改造前的旧口径：
    - 说「six dimensions」（其实是 8 维）
    - 说「22 questions」（其实是 28 题）
    - 权重写 15/20/20/15/15/15（其实是 12/16/16/12/12/12/10/10）
    - **说「分数越高风险越大」，与引擎相反**（P0，直接误导用户）
  另修：5 语 pricing.lead 停留在废弃的 Buyer SaaS 档位、4 语 home.toolsLead 缺首句、
  ja 的 risk.faq 是另一套问答且含机翻渣、ar 的问题带双问号。

用法： python scripts/fix-risk-score-copy.py
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "i18n", "dictionaries")
BACKUP_DIR = os.path.join(ROOT, ".workbuddy", "dict-backup-before-riskcopy")
LANGS = ["en", "zh", "zh-TW", "es", "de", "fr", "pt", "ja", "ar"]

# ---------------------------------------------------------------- 1. 风险页 / 卡片 / FAQ

TOOLCARD_DESC = {
    "en": "Score any supplier from 0 to 100 across eight weighted risk dimensions.",
    "zh": "按八个加权维度，为任意供应商打出 0 到 100 的分数。",
    "zh-TW": "按八個加權維度，爲任意供應商打出 0 到 100 的分數。",
    "es": "Puntúa a cualquier proveedor de 0 a 100 en ocho dimensiones de riesgo ponderadas.",
    "de": "Bewertet jeden Lieferanten von 0 bis 100 in acht gewichteten Risikodimensionen.",
    "fr": "Notez n'importe quel fournisseur de 0 à 100 sur huit dimensions de risque pondérées.",
    "pt": "Pontue qualquer fornecedor de 0 a 100 em oito dimensões de risco com pesos.",
    "ja": "8 つの加重リスク次元で、任意のサプライヤーを 0 から 100 まで採点します。",
    "ar": "يسجل أي مورد من صفر إلى 100 عبر ثمانية أبعاد مرجحة للمخاطر.",
}

PAGE_LEAD = {
    "en": "Answer 28 questions about a supplier and get a score from 0 to 100, with the eight dimensions behind it laid out. A higher score means lower risk.",
    "zh": "回答 28 个关于供应商的问题，得到 0 到 100 的分数，并看清构成这个分数的八个维度。分数越高，风险越低。",
    "zh-TW": "回答 28 個關於供應商的問題，得到 0 到 100 的分數，並看清構成這個分數的八個維度。分數越高，風險越低。",
    "es": "Responde 28 preguntas sobre un proveedor y obtén una puntuación de 0 a 100, con las ocho dimensiones que la componen desglosadas. Una puntuación más alta significa menos riesgo.",
    "de": "Beantworten Sie 28 Fragen zu einem Lieferanten und erhalten Sie einen Wert von 0 bis 100, aufgeschlüsselt nach den acht Dimensionen dahinter. Ein höherer Wert bedeutet geringeres Risiko.",
    "fr": "Répondez à 28 questions sur un fournisseur et obtenez un score de 0 à 100, avec le détail des huit dimensions qui le composent. Un score plus élevé signifie un risque plus faible.",
    "pt": "Responda 28 perguntas sobre um fornecedor e receba uma pontuação de 0 a 100, com as oito dimensões por trás dela detalhadas. Quanto maior a pontuação, menor o risco.",
    "ja": "サプライヤーについて 28 問に答えると、8 つの次元で 0–100 のスコアと、加重された内訳が得られます。スコアが高いほどリスクは低くなります。",
    "ar": "أجب عن 28 سؤالاً عن مورد واحصل على نتيجة من صفر إلى 100، مع الأبعاد الثمانية التي تقف خلفها. الدرجة الأعلى تعني مخاطر أقل.",
}

CARD1_BODY = {
    "en": "Eight dimensions, each weighted and shown separately, so you can tell which answers moved the number.",
    "zh": "八个维度各有权重并单独展示，哪一项拉动了分数一目了然。",
    "zh-TW": "八個維度各有權重並單獨展示，哪一項拉動了分數一目瞭然。",
    "es": "Ocho dimensiones, cada una ponderada y mostrada por separado, para que sepas qué respuestas movieron el número.",
    "de": "Acht Dimensionen, jede gewichtet und einzeln ausgewiesen, damit Sie erkennen, welche Antworten die Zahl bewegt haben.",
    "fr": "Huit dimensions, chacune pondérée et affichée séparément, pour identifier les réponses qui ont fait bouger le chiffre.",
    "pt": "Oito dimensões, cada uma com peso e mostrada separadamente, para você saber quais respostas mexeram no número.",
    "ja": "8 つの次元をそれぞれ重み付けして表示するため、どの回答がスコアを動かしたか分かります。",
    "ar": "ثمانية أبعاد، مرجّحة ومعروضة بشكل منفصل، حتى تعرف أي الإجابات حرّكت الرقم.",
}

# en / ar 的 metaDesc 已经是八维版本，不需要动
PAGE_METADESC = {
    "zh": "从公司、质量、合规、生产、供应链、文件、认证与数字足迹八个维度，为供应商打出 0 到 100 的风险分。分数越高，风险越低。免费，无需注册。",
    "zh-TW": "從公司、質量、合規、生產、供應鏈、文件、認證與數位足跡八個維度，爲供應商打出 0 到 100 的風險分。分數越高，風險越低。免費，無需註冊。",
    "es": "Puntúa a cualquier proveedor de 0 a 100 en ocho áreas: empresa, calidad, cumplimiento, producción, cadena de suministro, documentación, certificación y huella digital. Una puntuación más alta significa menos riesgo. Gratis, sin cuenta.",
    "de": "Bewertet jeden Lieferanten von 0 bis 100 in acht Bereichen: Unternehmen, Qualität, Compliance, Produktion, Lieferkette, Dokumentation, Zertifizierung und digitaler Fußabdruck. Ein höherer Wert bedeutet geringeres Risiko. Kostenlos, ohne Konto.",
    "fr": "Notez n'importe quel fournisseur de 0 à 100 sur huit domaines : société, qualité, conformité, production, chaîne d'approvisionnement, documentation, certification et empreinte numérique. Un score plus élevé signifie un risque plus faible. Gratuit, sans compte.",
    "pt": "Pontue qualquer fornecedor de 0 a 100 em oito áreas: empresa, qualidade, conformidade, produção, cadeia de suprimentos, documentação, certificação e pegada digital. Quanto maior a pontuação, menor o risco. Grátis, sem cadastro.",
    "ja": "サプライヤーを企業・品質・コンプライアンス・生産・サプライチェーン・ドキュメント・認証・デジタルフットプリントの 8 領域で 0–100 点評価。スコアが高いほどリスクは低くなります。無料、登録不要。",
}

# FAQ[0]：测什么 —— 八维 + 方向反转（原各语均写「分数越高风险越大」，与引擎相反）
FAQ0_A = {
    "en": "It scores a supplier from 0 to 100 across eight areas: company, quality, compliance, production, supply chain, documentation, certification and digital footprint. A higher score means lower risk.",
    "zh": "它从公司、质量、合规、生产、供应链、文件、认证与数字足迹八个维度，为供应商打出 0 到 100 的分数。分数越高，风险越低。",
    "zh-TW": "它從公司、質量、合規、生產、供應鏈、文件、認證與數位足跡八個維度，爲供應商打出 0 到 100 的分數。分數越高，風險越低。",
    "es": "Puntúa a un proveedor de 0 a 100 en ocho áreas: empresa, calidad, cumplimiento, producción, cadena de suministro, documentación, certificación y huella digital. Una puntuación más alta significa menos riesgo.",
    "de": "Er bewertet einen Lieferanten von 0 bis 100 in acht Bereichen: Unternehmen, Qualität, Compliance, Produktion, Lieferkette, Dokumentation, Zertifizierung und digitaler Fußabdruck. Ein höherer Wert bedeutet geringeres Risiko.",
    "fr": "Il note un fournisseur de 0 à 100 sur huit domaines : société, qualité, conformité, production, chaîne d'approvisionnement, documentation, certification et empreinte numérique. Un score plus élevé signifie un risque plus faible.",
    "pt": "Ela pontua um fornecedor de 0 a 100 em oito áreas: empresa, qualidade, conformidade, produção, cadeia de suprimentos, documentação, certificação e pegada digital. Quanto maior a pontuação, menor o risco.",
    "ja": "企業・品質・コンプライアンス・生産・サプライチェーン・ドキュメント・認証・デジタルフットプリントの 8 領域で 0–100 のスコアを出します。スコアが高いほどリスクは低いことを示します。",
    "ar": "يُقيّم المورد من 0 إلى 100 عبر ثمانية مجالات: الشركة، الجودة، الامتثال، الإنتاج، سلسلة التوريد، الوثائق، التصديق والبصمة الرقمية. الدرجة الأعلى تعني مخاطر أقل.",
}

# FAQ[2]：权重 —— 真实值 12/16/16/12/12/12/10/10
FAQ2_A = {
    "en": "Company 12%, quality 16%, compliance 16%, production 12%, supply chain 12%, documentation 12%, certification 10%, digital footprint 10%. The weights are fixed and shown on the result page.",
    "zh": "公司 12%、质量 16%、合规 16%、生产 12%、供应链 12%、文件 12%、认证 10%、数字足迹 10%。权重固定，并会在结果页上列明。",
    "zh-TW": "公司 12%、質量 16%、合規 16%、生產 12%、供應鏈 12%、文件 12%、認證 10%、數位足跡 10%。權重固定，並會在結果頁上列明。",
    "es": "Empresa 12%, calidad 16%, cumplimiento 16%, producción 12%, cadena de suministro 12%, documentación 12%, certificación 10%, huella digital 10%. Los pesos son fijos y se muestran en la página de resultados.",
    "de": "Unternehmen 12%, Qualität 16%, Compliance 16%, Produktion 12%, Lieferkette 12%, Dokumentation 12%, Zertifizierung 10%, digitaler Fußabdruck 10%. Die Gewichte sind fest und werden auf der Ergebnisseite ausgewiesen.",
    "fr": "Société 12 %, qualité 16 %, conformité 16 %, production 12 %, chaîne d'approvisionnement 12 %, documentation 12 %, certification 10 %, empreinte numérique 10 %. Les pondérations sont fixes et affichées sur la page de résultats.",
    "pt": "Empresa 12%, qualidade 16%, conformidade 16%, produção 12%, cadeia de suprimentos 12%, documentação 12%, certificação 10%, pegada digital 10%. Os pesos são fixos e aparecem na página de resultados.",
    "ar": "الشركة 12٪، الجودة 16٪، الامتثال 16٪، الإنتاج 12٪، سلسلة التوريد 12٪، الوثائق 12٪، التصديق 10٪، البصمة الرقمية 10٪. الأوزان ثابتة وتُعرض على صفحة النتيجة.",
}

# FAQ[4]：能否比较多家 —— /tools/compare 早已上线，原各语写「暂时不能，正在开发」
FAQ4_A = {
    "en": "Yes. Run each supplier through the calculator, then use the comparison tool to put up to five of them side by side on the same eight dimensions.",
    "zh": "可以。对每家供应商分别运行计算器，然后用对比工具把它们放在同一组八个维度上横向比较，一次最多五家。",
    "zh-TW": "可以。對每家供應商分別運行計算器，然後用對比工具把它們放在同一組八個維度上橫向比較，一次最多五家。",
    "es": "Sí. Pasa cada proveedor por la calculadora y luego usa la herramienta de comparación para ver hasta cinco de ellos uno al lado del otro en las mismas ocho dimensiones.",
    "de": "Ja. Führen Sie jeden Lieferanten durch den Rechner und nutzen Sie dann das Vergleichswerkzeug, um bis zu fünf davon in denselben acht Dimensionen nebeneinander zu sehen.",
    "fr": "Oui. Passez chaque fournisseur dans le calculateur, puis utilisez l'outil de comparaison pour en mettre jusqu'à cinq côte à côte sur les mêmes huit dimensions.",
    "pt": "Sim. Rode cada fornecedor pela calculadora e use a ferramenta de comparação para colocar até cinco deles lado a lado nas mesmas oito dimensões.",
    "ar": "نعم. مرّر كل مورد عبر الحاسبة، ثم استخدم أداة المقارنة لوضع ما يصل إلى خمسة منها جنباً إلى جنب على الأبعاد الثمانية نفسها.",
}

# ja 的 risk.faq 是另一套问答（含机翻渣与「下载报告」说法），整条对齐到 en 的 5 条
JA_FAQ = [
    {
        "q": "このツールは何を測定しますか？",
        "a": "企業・品質・コンプライアンス・生産・サプライチェーン・ドキュメント・認証・デジタルフットプリントの 8 領域で 0–100 のスコアを出します。スコアが高いほどリスクは低いことを示します。",
    },
    {
        "q": "スコアは最終的な検証結果ですか？",
        "a": "いいえ。スコアはご入力内容に基づく一次評価です。独立した検証、工場監査、法的助言の代わりにはなりません。",
    },
    {
        "q": "重み付けはどのように決めていますか？",
        "a": "企業 12%、品質 16%、コンプライアンス 16%、生産 12%、サプライチェーン 12%、ドキュメント 12%、認証 10%、デジタルフットプリント 10%。重みは固定で、結果ページに表示されます。",
    },
    {
        "q": "利用に料金はかかりますか？",
        "a": "いいえ。スコアは無料です。書面レポートが欲しい場合はメールアドレスを残していただければ無料でお送りします。検証や監査は有料サービスですが、任意です。",
    },
    {
        "q": "複数のサプライヤーを比較できますか？",
        "a": "はい。各サプライヤーを計算機にかけたうえで、比較ツールを使えば最大 5 社を同じ 8 次元で並べて確認できます。",
    },
]

STEP_OF = {
    "en": "Step {n} of 8",
    "zh": "第 {n} 步，共 8 步",
    "zh-TW": "第 {n} 步，共 8 步",
    "es": "Paso {n} de 8",
    "de": "Schritt {n} von 8",
    "fr": "Étape {n} sur 8",
    "pt": "Etapa {n} de 8",
    "ja": "ステップ {n} / 8",
    "ar": "الخطوة {n} من 8",
}

# ---------------------------------------------------------------- 2. methodology

METH_QUICK = {
    "en": "We score a supplier across eight weighted dimensions: company, quality, compliance, production, supply chain, documentation, certification and digital footprint. Each answer you give maps to one dimension, contributes a weighted risk value, and rolls up into an overall figure out of 100, where a higher score means lower risk. Missing evidence lowers the score rather than being treated as neutral. The weights shown below are read directly from the scoring model, not typed by hand.",
    "zh": "我们从八个加权维度给供应商打分：公司、质量、合规、生产、供应链、文件、认证、数字足迹。你的每个答案归入其中一个维度，按权重计分，再汇总成 100 分制的总分，分数越高代表风险越低。证据缺失会拉低分数，而不是按中性处理。下面显示的权重直接读取自评分模型，不是手工录入的。",
    "zh-TW": "我們從八個加權維度給供應商打分：公司、質量、合規、生產、供應鏈、文件、認證、數位足跡。你的每個答案歸入其中一個維度，按權重計分，再彙總成 100 分制的總分，分數越高代表風險越低。證據缺失會拉低分數，而不是按中性處理。下面顯示的權重直接讀取自評分模型，不是手工錄入的。",
    "es": "Puntuamos a un proveedor en ocho dimensiones ponderadas: empresa, calidad, cumplimiento, producción, cadena de suministro, documentación, certificación y huella digital. Cada respuesta se asigna a una dimensión, aporta un valor de riesgo ponderado y se suma en una cifra global sobre 100, donde una puntuación más alta significa menos riesgo. La falta de evidencia baja la puntuación en lugar de tratarse como neutra. Los pesos que ves abajo se leen directamente del modelo de puntuación, no se escriben a mano.",
    "de": "Wir bewerten einen Lieferanten in acht gewichteten Dimensionen: Unternehmen, Qualität, Compliance, Produktion, Lieferkette, Dokumentation, Zertifizierung und digitaler Fußabdruck. Jede Antwort gehört zu einer Dimension, trägt einen gewichteten Risikowert bei und fließt in einen Gesamtwert von 100 ein, wobei ein höherer Wert geringeres Risiko bedeutet. Fehlende Nachweise senken den Wert, statt neutral behandelt zu werden. Die unten gezeigten Gewichte werden direkt aus dem Scoring-Modell gelesen, nicht von Hand eingetragen.",
    "fr": "Nous notons un fournisseur sur huit dimensions pondérées : société, qualité, conformité, production, chaîne d'approvisionnement, documentation, certification et empreinte numérique. Chaque réponse correspond à une dimension, apporte une valeur de risque pondérée et s'agrège en une note globale sur 100, où un score plus élevé signifie un risque plus faible. L'absence de preuve fait baisser le score au lieu d'être traitée comme neutre. Les pondérations ci-dessous sont lues directement depuis le modèle de notation, pas saisies à la main.",
    "pt": "Classificamos um fornecedor em oito dimensões ponderadas: empresa, qualidade, conformidade, produção, cadeia de suprimentos, documentação, certificação e pegada digital. Cada resposta vai para uma dimensão, contribui com um valor de risco ponderado e resulta numa pontuação global de 0 a 100, em que quanto maior a pontuação, menor o risco. A falta de evidência reduz a pontuação em vez de ser tratada como neutra. Os pesos abaixo são lidos diretamente do modelo de pontuação, não digitados à mão.",
    "ja": "サプライヤーは企業・品質・コンプライアンス・生産・サプライチェーン・ドキュメント・認証・デジタルフットプリントの 8 つの加重次元で評価します。各回答はいずれかの次元に属し、加重されたリスク値として 100 点満点の総合スコアに集約されます。スコアが高いほどリスクは低くなります。証拠が欠けている場合は中立として扱わず、スコアを下げます。以下に示す重みは評価モデルから直接読み込んでおり、手入力ではありません。",
    "ar": "نُقيّم المورد عبر ثمانية أبعاد مرجّحة: الشركة، الجودة، الامتثال، الإنتاج، سلسلة التوريد، الوثائق، التصديق والبصمة الرقمية. كل إجابة تقدّمها تنتمي إلى بُعد واحد، وتساهم بقيمة مخاطر مرجّحة، وتُجمع في نتيجة إجمالية من 100، حيث تعني الدرجة الأعلى مخاطر أقل. غياب الأدلة يخفض الدرجة بدلاً من معاملته كأمر محايد. الأوزان المعروضة أدناه تُقرأ مباشرة من نموذج التقييم، ولا تُدخل يدوياً.",
}

METH_WEIGHTS = {
    "en": "— eight dimensions, {n} inputs, weights summing to {w}.",
    "zh": "— 八个维度，{n} 项输入，权重和 {w}。",
    "zh-TW": "— 八個維度，{n} 項輸入，權重和 {w}。",
    "es": "— ocho dimensiones, {n} entradas, pesos que suman {w}.",
    "de": "- acht Dimensionen, {n} Inputs, Gewichte summieren sich zu {w}.",
    "fr": "— huit dimensions, {n} entrées, poids totalisant {w}.",
    "pt": "— oito dimensões, {n} entradas, pesos somando {w}.",
    "ja": "— 8 つの次元、{n} 件の入力、重みの合計は {w}。",
    "ar": "- ثمانية أبعاد، {n} مدخلات، أوزان تلخ إلى {w}.",
}

# ---------------------------------------------------------------- 3. 定价 / 首页

# en / zh / es / pt 已是「工具免费」版本；zh-TW / de / fr / ja / ar 停在废弃的 Buyer SaaS 档位
PRICING_LEAD = {
    "zh-TW": "工具免費使用。只有當你需要有人到現場查覈供應商時才付費。",
    "de": "Die Tools sind kostenlos. Sie zahlen nur, wenn jemand einen Lieferanten vor Ort prüfen soll.",
    "fr": "Les outils sont gratuits. Vous ne payez que lorsque quelqu'un doit vérifier un fournisseur sur le terrain.",
    "ja": "ツールは無料です。現地でサプライヤーを確認する必要があるときだけお支払いください。",
    "ar": "الأدوات مجانية. تدفع فقط عندما تحتاج إلى شخص يتحقق من المورد على الأرض.",
}

PRICING_FEATURE0 = {
    "zh": "含八维度拆解的供应商风险评估",
    "es": "Evaluación de riesgo del proveedor con desglose en ocho dimensiones",
}

# en / zh / es 的 toolsLead 只剩后半句，缺「八款工具 …」；ar 是整句英文未翻译
HOME_TOOLS_LEAD = {
    "en": "Eight tools for checking suppliers, preparing audits and planning shipments. No account needed, and no email wall on the basic result.",
    "zh": "八款工具，用于核查供应商、准备验厂与规划发运。无需注册，基础结果也不设邮箱门槛。",
    "es": "Ocho herramientas para revisar proveedores, preparar auditorías y planificar envíos. Sin cuenta, y sin muro de correo para el resultado básico.",
    "ar": "ثمانية أدوات لفحص الموردين، والتحضير للتدقيق وتخطيط الشحنات. لا تحتاج إلى حساب، ولا حاجز بريد إلكتروني للحصول على النتيجة الأساسية.",
}

# ---------------------------------------------------------------- 执行

# (说明, JSON 末级键名, dotpath 取值函数, {lang: 新值}) —— 只在提供了新值的语言上生效
# 末级键名用于兜底：当旧值是别的文案的子串（text.count != 1）时，改用 "键名": "旧值" 锚定替换。
PLAN = [
    ("risk 卡片描述 六维→八维", "desc", lambda d: d["toolCards"]["riskCalculator"]["desc"], TOOLCARD_DESC),
    ("risk 页 lead 22→28 题 / 八维 / 方向", "lead", lambda d: d["risk"]["page"]["lead"], PAGE_LEAD),
    ("risk 页 card1Body 六维→八维", "card1Body", lambda d: d["risk"]["page"]["card1Body"], CARD1_BODY),
    ("risk 页 metaDesc 六维→八维", "metaDesc", lambda d: d["risk"]["page"]["metaDesc"], PAGE_METADESC),
    ("risk FAQ[0] 八维 + 评分方向反转", "a", lambda d: d["risk"]["faq"][0]["a"], FAQ0_A),
    ("risk FAQ[2] 权重 12/16/16/12/12/12/10/10", "a", lambda d: d["risk"]["faq"][2]["a"], FAQ2_A),
    ("risk FAQ[4] 比较工具已上线", "a", lambda d: d["risk"]["faq"][4]["a"], FAQ4_A),
    ("risk.ui.stepOf 6→8", "stepOf", lambda d: d["risk"]["ui"]["stepOf"], STEP_OF),
    ("methodology.quickAnswer 八维 + 方向", "quickAnswer", lambda d: d["methodology"]["quickAnswer"], METH_QUICK),
    ("methodology.weightsSumLine 六→八", "weightsSumLine", lambda d: d["methodology"]["weightsSumLine"], METH_WEIGHTS),
    ("pricing.lead 废弃档位→现行口径", "lead", lambda d: d["pricing"]["lead"], PRICING_LEAD),
    ("pricing 免费档首条功能 六→八", "features", lambda d: d["pricing"]["plans"][0]["features"][0], PRICING_FEATURE0),
    ("home.toolsLead 补全首句 / 翻译", "toolsLead", lambda d: d["home"]["toolsLead"], HOME_TOOLS_LEAD),
]


def main() -> int:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    total = 0
    failures = []

    # ---- A. 逐键替换
    for label, last_key, getter, table in PLAN:
        print("\n### " + label)
        for lang in LANGS:
            if lang not in table:
                continue
            path = os.path.join(DICT_DIR, lang + ".json")
            text = io.open(path, encoding="utf-8", newline="").read()
            data = json.loads(text)
            try:
                old = getter(data)
            except Exception as e:
                failures.append("%s/%s 取值失败: %s" % (lang, label, e))
                continue
            new = table[lang]
            if old == new:
                print("  =    %-6s 已是新值" % lang)
                continue
            if text.count(old) == 1:
                needle, replacement = old, new
            else:
                # 旧值是别的文案的子串 → 用 "键名": "旧值" 锚定，避免误伤
                needle = '"%s": "%s"' % (last_key, old)
                replacement = '"%s": "%s"' % (last_key, new)
            if text.count(needle) != 1:
                failures.append(
                    "%s/%s 定位失败（纯值 %d 次，键名锚定 %d 次）"
                    % (lang, label, text.count(old), text.count(needle))
                )
                print("  FAIL %-6s 纯值 %d 次 / 锚定 %d 次" % (lang, text.count(old), text.count(needle)))
                continue
            bak = os.path.join(BACKUP_DIR, lang + ".json")
            if not os.path.exists(bak):
                io.open(bak, "w", encoding="utf-8", newline="").write(text)
            io.open(path, "w", encoding="utf-8", newline="").write(text.replace(needle, replacement))
            total += 1
            print("  OK   %-6s %s -> %s" % (lang, old[:40], new[:40]))

    # ---- B. ja 的 risk.faq 整组对齐
    print("\n### ja risk.faq 整组对齐（原为另一套问答）")
    path = os.path.join(DICT_DIR, "ja.json")
    text = io.open(path, encoding="utf-8", newline="").read()
    data = json.loads(text)
    bak = os.path.join(BACKUP_DIR, "ja.json")
    if not os.path.exists(bak):
        io.open(bak, "w", encoding="utf-8", newline="").write(text)
    for idx, new_item in enumerate(JA_FAQ):
        for field in ("q", "a"):
            old = data["risk"]["faq"][idx][field]
            new = new_item[field]
            if old == new:
                continue
            if text.count(old) != 1:
                failures.append("ja/risk.faq[%d].%s 旧值命中 %d 次" % (idx, field, text.count(old)))
                continue
            text = text.replace(old, new)
            total += 1
            print("  OK   ja faq[%d].%s -> %s" % (idx, field, new[:40]))
    io.open(path, "w", encoding="utf-8", newline="").write(text)

    # ---- C. ar 的问题双问号「؟?」→「؟」
    print("\n### ar risk.faq 问题双问号")
    path = os.path.join(DICT_DIR, "ar.json")
    text = io.open(path, encoding="utf-8", newline="").read()
    data = json.loads(text)
    bak = os.path.join(BACKUP_DIR, "ar.json")
    if not os.path.exists(bak):
        io.open(bak, "w", encoding="utf-8", newline="").write(text)
    for idx, item in enumerate(data["risk"]["faq"]):
        old = item["q"]
        if old.endswith("؟?"):
            new = old[:-1]
            if text.count(old) == 1:
                text = text.replace(old, new)
                total += 1
                print("  OK   ar faq[%d].q: %s -> %s" % (idx, old, new))
    io.open(path, "w", encoding="utf-8", newline="").write(text)

    # ---- D. 复核：JSON 可解析 + CRLF 不变
    print("\n=== 复核 ===")
    for lang in LANGS:
        path = os.path.join(DICT_DIR, lang + ".json")
        raw = io.open(path, "rb").read()
        crlf = raw.count(b"\r\n")
        bare = raw.count(b"\n") - crlf
        json.loads(io.open(path, encoding="utf-8", newline="").read())
        flag = "OK" if bare == 0 else "FAIL(bareLF=%d)" % bare
        print("  %-22s %s CRLF=%d" % (flag, lang, crlf))

    print("\n修改 %d 处。备份在 %s" % (total, BACKUP_DIR))
    if failures:
        print("\n!!! 失败 %d 项：" % len(failures))
        for f in failures:
            print("   - " + f)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
