#!/usr/bin/env node
/**
 * scripts/translate-guides-batch4.cjs
 *
 * 第 4 批「guides 9 语补全」—— 批 4.1：前 10 篇 × 6 语（ja/es/de/fr/pt/ar）= 60 条
 * meta description 写入 `lib/guides.ts`。
 *
 * 设计要点：
 *   1. **内联数据**：60 条 desc 直接内联在本文件（不依赖外部 API / 不依赖一次性草稿）。
 *   2. **幂等**：某篇已存在 `metaDescJa:` 整组字段则跳过该篇；全部存在即「无事可做」退出 0。
 *   3. **写前自检**：60 条全部通过「长度 ≤ 预算 / 句末标点 / 双句 / 无破折号」才落盘；
 *      任一条不合规 → 打印明细并 **exit 1 且不写文件**。
 *   4. **只新增不修改**：插入后逐条反演（把插入行摘掉应与原文逐行相等），
 *      保证「只有新增行、无修改行」；行尾（CRLF）保持不变。
 *   5. **备份**：写入前 `lib/guides.ts` → `lib/guides.ts.bak`；读回校验失败即自动从备份还原。
 *
 * 预算口径与 `lib/pageMeta.ts` 完全镜像（CJK 占比 > 0.1 → 90，否则 158），
 * 因此本脚本产出的串对 `trimMetaDescription` **幂等**（收口函数零命中）。
 * 真正的幂等性由 `scripts/_g4_verify.ts`（跑真实收口函数）二次确证。
 *
 * 用法：
 *   node scripts/translate-guides-batch4.cjs --dry    # 只校验 + 打印（不写文件）
 *   node scripts/translate-guides-batch4.cjs          # 校验通过后写入
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "lib", "guides.ts");
const BACKUP = TARGET + ".bak";

const LANGS = ["ja", "es", "de", "fr", "pt", "ar"];
const FIELD = {
  ja: "metaDescJa",
  es: "metaDescEs",
  de: "metaDescDe",
  fr: "metaDescFr",
  pt: "metaDescPt",
  ar: "metaDescAr",
};

// ── 预算与收口口径（镜像 lib/pageMeta.ts，勿单独改动）─────────────────────
const CJK_SRC = "[\\u3000-\\u9fff\\u3040-\\u30ff\\uac00-\\ud7af]";
const CJK_DESC_RATIO = 0.1;
const DESC_CJK_BUDGET = 90;
const DESC_LATIN_BUDGET = 158;
const SENTENCE_END_RE = /[.。!！?？]/;
const TRAILING_WRAP_RE = /["'”’»)\]）]*$/;
const DANGLING_TAIL_RE = /[\s,;:，、；：\-–—]+$/u;

// ── 批 4.1 的 60 条 desc（10 篇 × 6 语）────────────────────────────────
const DATA = /*__BATCH4_DATA__*/ {
  "how-to-verify-a-chinese-supplier": {
    "ja": "中国のサプライヤーを検証する手順を解説します。登記名の照合、統一社会信用コードの確認、実際の工場所在地の確認までを順に示します。",
    "es": "Cómo verificar a un proveedor chino paso a paso. Coteje el nombre registrado, compruebe el código de crédito y confirme la fábrica real.",
    "de": "So prüfen Sie einen chinesischen Lieferanten Schritt für Schritt. Gleichen Sie den Firmennamen ab, prüfen Sie den Kreditcode und den Standort.",
    "fr": "Comment vérifier un fournisseur chinois étape par étape. Comparez le nom enregistré, vérifiez le code de crédit et confirmez le site réel.",
    "pt": "Como verificar um fornecedor chinês passo a passo. Compare o nome registado, verifique o código de crédito e confirme a fábrica real.",
    "ar": "كيفية التحقق من مورد صيني خطوة بخطوة. قارن الاسم المسجَّل، وتحقّق من رمز الائتمان، وأكّد موقع المصنع الفعلي."
  },
  "factory-audit-checklist": {
    "ja": "工場監査チェックリストの項目を解説します。品質、生産管理、社会コンプライアンス、監査員が求める記録を網羅します。",
    "es": "Una lista de comprobación para auditorías de fábrica. Cubre la calidad, el control de producción, el cumplimiento social y los registros exigidos.",
    "de": "Eine Checkliste für die Werksauditierung. Sie deckt Qualität, Produktionskontrolle, Sozialcompliance und die verlangten Nachweise ab.",
    "fr": "Une liste de contrôle pour l'audit d'usine. Elle couvre la qualité, le contrôle de production, la conformité sociale et les documents demandés.",
    "pt": "Uma lista de verificação para auditoria de fábrica. Abrange a qualidade, o controlo de produção, a conformidade social e os registos exigidos.",
    "ar": "قائمة تحقق لتدقيق المصنع. تشمل الجودة وضبط الإنتاج والامتثال الاجتماعي والسجلات التي يطلبها المدققون."
  },
  "supplier-risk-assessment-guide": {
    "ja": "サプライヤーリスク評価の仕組みを六つの次元で解説します。どの証拠がスコアを動かすのか、結果をどう行動に移すかを示します。",
    "es": "Cómo funciona la evaluación de riesgo de proveedores en seis dimensiones. Vea qué evidencia mueve la puntuación y cómo actuar según el resultado.",
    "de": "Wie die Lieferantenrisikobewertung über sechs Dimensionen funktioniert. Sehen Sie, welche Nachweise die Bewertung verändern und wie Sie handeln.",
    "fr": "Comment fonctionne l'évaluation du risque fournisseur sur six dimensions. Voyez quelles preuves font bouger le score et comment agir ensuite.",
    "pt": "Como funciona a avaliação de risco de fornecedores em seis dimensões. Veja que evidências alteram a pontuação e como agir com o resultado.",
    "ar": "كيف يعمل تقييم مخاطر الموردين عبر ستة أبعاد. تعرّف على الأدلة التي تغيّر الدرجة وكيف تتعامل مع النتيجة."
  },
  "smeta-vs-bsci-social-audit-comparison": {
    "ja": "SMETA と BSCI の社会的監査を項目ごとに比較します。それぞれの範囲、実施主体、自社に合う選び方を解説します。",
    "es": "Comparación de las auditorías sociales SMETA y BSCI, ámbito por ámbito. Vea qué cubre cada una, quién las realiza y cómo elegir.",
    "de": "SMETA und BSCI im Vergleich, Bereich für Bereich. Sehen Sie, was jedes Programm abdeckt, wer es durchführt und wie Sie wählen.",
    "fr": "Comparaison des audits sociaux SMETA et BSCI, domaine par domaine. Voyez ce que chacun couvre, qui les réalise et comment choisir.",
    "pt": "Comparação das auditorias sociais SMETA e BSCI, âmbito por âmbito. Veja o que cada uma cobre, quem as realiza e como escolher.",
    "ar": "مقارنة بين تدقيق SMETA وBSCI الاجتماعي، مجالاً بمجال. تعرّف على ما يغطيه كل منهما ومن ينفّذه وكيف تختار الأنسب."
  },
  "how-to-read-a-factory-audit-report": {
    "ja": "工場監査報告書の読み方を解説します。重大な指摘から確認し、根拠を照合してから判断する手順を示します。",
    "es": "Cómo leer un informe de auditoría de fábrica sin perder el hilo. Lea primero los hallazgos críticos, revise la evidencia y luego decida.",
    "de": "So lesen Sie einen Werksauditbericht richtig. Prüfen Sie zuerst die kritischen Feststellungen, gleichen Sie die Nachweise ab und entscheiden Sie.",
    "fr": "Comment lire un rapport d'audit d'usine sans perdre le fil. Lisez d'abord les constats critiques, vérifiez les preuves, puis décidez.",
    "pt": "Como ler um relatório de auditoria de fábrica sem se perder. Veja primeiro os achados críticos, confirme as evidências e depois decida.",
    "ar": "كيفية قراءة تقرير تدقيق المصنع دون ارتباك. اقرأ البنود الحرجة أولاً، وتحقّق من الأدلة، ثم اتخذ قرارك."
  },
  "how-to-audit-a-factory-in-vietnam": {
    "ja": "ベトナムで工場監査を行う手順を解説します。登記の確認、実際の生産拠点の検証、コンプライアンスの確認をまとめます。",
    "es": "Cómo auditar una fábrica en Vietnam antes de pagar el anticipo. Confirme el registro, verifique la planta real y revise el cumplimiento.",
    "de": "So auditieren Sie eine Fabrik in Vietnam vor der Anzahlung. Prüfen Sie die Registrierung, den tatsächlichen Standort und die Compliance.",
    "fr": "Comment auditer une usine au Vietnam avant de verser l'acompte. Vérifiez l'immatriculation, le site réel et la conformité.",
    "pt": "Como auditar uma fábrica no Vietname antes do sinal. Confirme o registo, verifique a unidade real e reveja a conformidade.",
    "ar": "كيفية تدقيق مصنع في فيتنام قبل دفع الدفعة المقدمة. تحقّق من التسجيل والموقع الفعلي وراجع الامتثال."
  },
  "pre-shipment-inspection-checklist": {
    "ja": "出荷前検査のチェックリストを解説します。数量、作り、機能、包装、ラベル、積み込みに加え、サンプルと記録の確認項目もまとめます。",
    "es": "Una lista de verificación para la inspección previa al embarque. Revise cantidad, fabricación, función, embalaje, etiquetado y carga.",
    "de": "Eine Checkliste für die Vorversandinspektion. Geprüft werden Menge, Verarbeitung, Funktion, Verpackung, Kennzeichnung und Verladung.",
    "fr": "Une liste de contrôle pour l'inspection avant expédition. Vérifiez quantité, fabrication, fonction, emballage, étiquetage et chargement.",
    "pt": "Uma lista de verificação para a inspeção antes do embarque. Verifique quantidade, fabrico, função, embalagem, rotulagem e carregamento.",
    "ar": "قائمة تحقق لفحص ما قبل الشحن. تحقّق من الكمية والصناعة والوظيفة والتغليف والملصقات والتحميل."
  },
  "what-is-a-factory-audit": {
    "ja": "B2B の工場監査とは何か、なぜ海外バイヤーに必要なのかを解説します。自社製品に合う第三者監査機関の選び方も示します。",
    "es": "Qué es una auditoría de fábrica B2B y por qué la necesitan los compradores. Vea cómo elegir una firma de auditoría para su producto.",
    "de": "Was ein B2B-Werksaudit ist und warum Übersee-Einkäufer ihn brauchen. So wählen Sie eine Prüfgesellschaft für Ihr Produkt.",
    "fr": "Ce qu'est un audit d'usine B2B et pourquoi les acheteurs en ont besoin. Voyez comment choisir un cabinet d'audit adapté à votre produit.",
    "pt": "O que é uma auditoria de fábrica B2B e porque os compradores precisam dela. Veja como escolher uma empresa de auditoria para o seu produto.",
    "ar": "ما هو تدقيق المصنع في سياق B2B ولماذا يحتاجه المشترون. تعرّف على كيفية اختيار جهة تدقيق خارجية تناسب منتجك."
  },
  "supplier-evaluation-checklist": {
    "ja": "2026 年版のサプライヤー評価チェックリストです。合法性、生産能力、ESG、品質体制と必要な書類・記録を網羅します。",
    "es": "Una lista de evaluación de proveedores 2026 sobre legalidad, capacidad y ESG. Cubre el sistema de calidad y los registros exigidos.",
    "de": "Eine Lieferantenbewertungs-Checkliste 2026 zu Legalität, Kapazität und ESG. Sie deckt das Qualitätssystem und die geforderten Nachweise ab.",
    "fr": "Une liste d'évaluation fournisseur 2026 sur la légalité, la capacité et l'ESG. Elle couvre le système qualité et les documents exigés.",
    "pt": "Uma lista de avaliação de fornecedores 2026 sobre legalidade, capacidade e ESG. Abrange o sistema de qualidade e os registos exigidos.",
    "ar": "قائمة تقييم الموردين لعام 2026 تغطّي الشرعية والقدرة الإنتاجية وESG. وتشمل نظام الجودة والسجلات المطلوبة."
  },
  "on-site-vs-desk-audit": {
    "ja": "現地監査とデスク監査の違いを解説します。コスト、確度、対象範囲の違いと、それぞれの使いどころ、安全な調達に向けた組み合わせ方を示します。",
    "es": "Auditoría presencial frente a auditoría documental. Vea cuándo funciona cada una y cómo combinarlas para un abastecimiento seguro.",
    "de": "Vor-Ort-Audit gegenüber Schreibtisch-Audit. Sehen Sie, wann welches Verfahren passt und wie Sie beide für eine sichere Beschaffung kombinieren.",
    "fr": "Audit sur site ou audit sur dossier. Voyez quand chacun convient et comment les combiner pour un approvisionnement sûr.",
    "pt": "Auditoria presencial versus auditoria documental. Veja quando cada uma funciona e como combiná-las para um aprovisionamento seguro.",
    "ar": "التدقيق الميداني مقابل التدقيق المكتبي. تعرّف على متى يصلح كل منهما وكيف تجمعهما لشراء آمن."
  }
};

function budgetOf(text) {
  const total = [...text].length;
  const cjk = (text.match(new RegExp(CJK_SRC, "g")) || []).length;
  return cjk / total > CJK_DESC_RATIO ? DESC_CJK_BUDGET : DESC_LATIN_BUDGET;
}

/** 单条校验：返回 { len, budget, errs[] } */
function checkOne(text) {
  const errs = [];
  if (typeof text !== "string" || !text.trim()) return { len: 0, budget: 0, errs: ["空串"] };
  const len = [...text].length;
  const budget = budgetOf(text);
  if (len > budget) errs.push(`长度 ${len} > 预算 ${budget}`);
  const body = text.replace(TRAILING_WRAP_RE, "");
  if (!SENTENCE_END_RE.test(body.slice(-1))) errs.push("结尾无句末标点");
  if (DANGLING_TAIL_RE.test(text)) errs.push("结尾有悬空标点");
  const terms = (text.match(/[.。!！?？]/g) || []).length;
  if (terms < 2) errs.push(`句末标点仅 ${terms} 个（要求 ≥2：双句）`);
  if (/[—–]/.test(text)) errs.push("含破折号 — / –");
  return { len, budget, errs };
}

/** 全量校验；返回不合规条数 */
function validateAll(tag) {
  let n = 0;
  let bad = 0;
  for (const slug of Object.keys(DATA)) {
    for (const lg of LANGS) {
      const text = DATA[slug][lg];
      n++;
      const { len, budget, errs } = checkOne(text);
      if (errs.length) {
        bad++;
        console.log(`  ✗ ${slug}/${lg} [${len}/${budget}] ${errs.join("; ")}`);
      }
    }
  }
  console.log(`[${tag}] 共 ${n} 条，不合规 ${bad}`);
  return bad;
}

function main() {
  const dry = process.argv.includes("--dry");

  // 0) 数据自检（写前）
  if (!DATA || typeof DATA !== "object" || Object.keys(DATA).length === 0) {
    console.error("✗ 内联数据为空");
    process.exit(1);
  }
  const slugs = Object.keys(DATA);
  console.log(`批 4.1：${slugs.length} 篇 × ${LANGS.length} 语 = ${slugs.length * LANGS.length} 条`);
  if (slugs.length !== 10) {
    console.error(`✗ 期望 10 篇，实际 ${slugs.length} 篇`);
    process.exit(1);
  }
  for (const slug of slugs) {
    for (const lg of LANGS) {
      if (typeof DATA[slug][lg] !== "string") {
        console.error(`✗ ${slug} 缺 ${lg}`);
        process.exit(1);
      }
    }
  }
  if (validateAll("写前自检") > 0) {
    console.error("✗ 存在不合规 desc，拒绝写入（文件未改动）");
    process.exit(1);
  }
  if (dry) {
    console.log("--dry：校验通过，未写文件。");
    return;
  }

  // 1) 读取 + 解析
  const src = fs.readFileSync(TARGET, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const original = src.split(/\r?\n/);

  // 2) 规划插入点（每篇：在 metaDescZh 值行之后插入 6 组字段）
  const plan = [];
  let skipped = 0;
  for (const slug of slugs) {
    const si = original.findIndex((l) => l === `    slug: "${slug}",`);
    if (si < 0) {
      console.error(`✗ 未找到 slug 块：${slug}`);
      process.exit(1);
    }
    let end = original.findIndex((l, i) => i > si && /^    slug: "/.test(l));
    if (end < 0) end = original.length;
    const block = original.slice(si, end);
    // 幂等：该篇已存在 metaDescJa 整组字段则跳过（⚠️ 必须带 m 标志，
    // 否则 ^ 只锚定整串开头，检测永远为假 ⇒ 重复插入 ⇒ 重复键编译错误）
    if (/^\s+metaDescJa:/m.test(block.join("\n"))) {
      skipped++;
      continue;
    }
    const zi = block.findIndex((l) => /^\s+metaDescZh:/.test(l));
    if (zi < 0) {
      console.error(`✗ 未找到 metaDescZh：${slug}`);
      process.exit(1);
    }
    // 值可能在同一行（`metaDescZh: "…"`）或在下一行（仓库现状）
    const hasInlineValue = /["']/.test(block[zi]);
    const valueLine = hasInlineValue ? si + zi : si + zi + 1;
    if (!/^\s+["']/.test(original[valueLine] || "")) {
      console.error(`✗ metaDescZh 值行不符合预期：${slug} → ${JSON.stringify(original[valueLine])}`);
      process.exit(1);
    }
    const ins = [];
    for (const lg of LANGS) {
      ins.push(`    ${FIELD[lg]}:`);
      ins.push(`      ${JSON.stringify(DATA[slug][lg])},`);
    }
    plan.push({ slug, after: valueLine, ins });
  }

  if (plan.length === 0) {
    console.log(`幂等：${skipped} 篇均已存在，无事可做。`);
    return;
  }
  console.log(`待写入 ${plan.length} 篇（已存在跳过 ${skipped} 篇），共插入 ${plan.reduce((a, p) => a + p.ins.length, 0)} 行`);

  // 3) 应用（按行号倒序，避免位移）
  const result = original.slice();
  for (const p of plan.slice().sort((a, b) => b.after - a.after)) {
    result.splice(p.after + 1, 0, ...p.ins);
  }

  // 4) 反演校验：摘掉插入行后必须与原文逐行相等 ⇒ 保证「只新增不修改」
  //    插入是**倒序**做的，因此最终数组 == 原数组在 p1<p2<…<pn 处依次插入 B1…Bn。
  //    摘除必须按**升序**做，且索引恒为 `p.after + 1`（更小的块先被摘掉，
  //    坐标即恢复到原文坐标系）—— 这不是近似，而是与插入方式严格互逆。
  const replay = result.slice();
  let removed = 0;
  for (const p of plan.slice().sort((a, b) => a.after - b.after)) {
    const idx = p.after + 1;
    const chunk = replay.splice(idx, p.ins.length);
    if (chunk.join("\n") !== p.ins.join("\n")) {
      console.error(`✗ 反演失败（插入块不连续）：${p.slug} @ 行 ${idx}`);
      process.exit(1);
    }
    removed += p.ins.length;
  }
  if (
    result.length !== original.length + removed ||
    replay.length !== original.length ||
    replay.some((l, i) => l !== original[i])
  ) {
    console.error("✗ 反演失败：除新增行外存在其他改动，拒绝写入");
    process.exit(1);
  }
  console.log("反演校验通过：除插入行外，原文逐行未变（只新增、不修改）");

  // 5) 备份 + 写入
  fs.copyFileSync(TARGET, BACKUP);
  console.log(`已备份 ${path.relative(ROOT, TARGET)} → ${path.relative(ROOT, BACKUP)}`);
  fs.writeFileSync(TARGET, result.join(eol), "utf8");

  // 6) 读回校验
  const back = fs.readFileSync(TARGET, "utf8").split(/\r?\n/);
  let readbackBad = 0;
  for (const slug of slugs) {
    const si = back.findIndex((l) => l === `    slug: "${slug}",`);
    let end = back.findIndex((l, i) => i > si && /^    slug: "/.test(l));
    if (end < 0) end = back.length;
    const block = back.slice(si, end).join("\n");
    for (const lg of LANGS) {
      const f = FIELD[lg];
      const m = block.match(new RegExp(`^\\s*${f}:\\s*\\n\\s*(\\S.*),\\s*$`, "m"));
      const got = m ? JSON.parse(m[1]) : null;
      if (got !== DATA[slug][lg]) {
        readbackBad++;
        console.log(`  ✗ 读回不一致 ${slug}/${lg}`);
      }
    }
  }
  if (readbackBad > 0) {
    console.error(`✗ 读回校验失败 ${readbackBad} 条，正在从备份还原…`);
    fs.copyFileSync(BACKUP, TARGET);
    console.error("已还原。文件保持原状。");
    process.exit(1);
  }
  console.log(`读回校验通过：${slugs.length * LANGS.length}/${slugs.length * LANGS.length} 条与数据一致`);
  console.log(`行尾保持：${eol === "\r\n" ? "CRLF" : "LF"}`);
  console.log("✅ 写入完成");
}

main();
