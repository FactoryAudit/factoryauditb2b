#!/usr/bin/env node
/**
 * scripts/translate-guides-batch42.cjs
 *
 * 第 4 批「guides 9 语补全」—— 批 4.2 写入器：
 *   ① 批 4.1 ja 回补 6 条（对既有 `metaDescJa` 做**值替换**）
 *   ② #11–20 十篇 × 6 语 = 60 条（**新增** metaDescJa/Es/De/Fr/Pt/Ar）
 *
 * 设计（沿用 batch4 骨架，新增「值替换」能力）：
 *   1. **内联数据**（不依赖任何一次性文件 / 外部 API）。
 *   2. **幂等**：替换项已是新值 → 跳过；插入项已存在 metaDescJa 整组 → 跳过该篇。
 *   3. **写前自检**：长度（下限 ja 60 / 其他 120；上限 ja 90 / 其他 158）
 *      + 句末标点 + 无破折号 + 无悬空尾标点；
 *      任一条不合规 → 打印明细并 **exit 1 且不写文件**。
 *   4. **只新增 + 只改 6 行**：反演 = 摘掉插入行（升序 + 位移）+ 把替换行换回旧值，
 *      必须与原文**逐行相等**。
 *   5. **备份**：写入前 `lib/guides.ts` → `lib/guides.ts.bak`；读回校验失败自动还原。
 *   6. 行尾（CRLF/LF）保持不变。
 *
 * 预算口径镜像 `lib/pageMeta.ts`（CJK 占比 > 0.1 → 90，否则 158）⇒ 产出的串对
 * `trimMetaDescription` 幂等；真实幂等性由 `scripts/g4-desc-idempotency-regression.ts` 二次确证。
 *
 * 用法：
 *   node scripts/translate-guides-batch42.cjs --dry   # 只校验 + 打印（不写文件）
 *   node scripts/translate-guides-batch42.cjs         # 校验通过后写入
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
const DESC_CJK_MIN = 60;
const DESC_LATIN_MIN = 120;
const SENTENCE_END_RE = /[.。!！?？]/;
const TRAILING_WRAP_RE = /["'”’»)\]）]*$/;
const DANGLING_TAIL_RE = /[\s,;:，、；：\-–—]+$/u;

// ── 数据（内联）─────────────────────────────────────────────────────────
// ① 批 4.1 ja 回补：6 篇，值替换
const JA_FIX = /*__JA_FIX__*/ {
  "how-to-read-a-factory-audit-report": "工場監査報告書の読み方を解説します。重大な指摘から確認し、根拠を照合してから判断する手順と、見落としやすい記録の確認点を示します。",
  "factory-audit-checklist": "工場監査チェックリストの項目を解説します。品質、生産管理、社会コンプライアンス、監査員が求める記録と事前準備の要点を網羅します。",
  "how-to-audit-a-factory-in-vietnam": "ベトナムで工場監査を行う手順を解説します。登記の確認、実際の生産拠点の検証、コンプライアンス確認と、事前に準備すべき書類をまとめます。",
  "smeta-vs-bsci-social-audit-comparison": "SMETA と BSCI の社会的監査を項目ごとに比較します。それぞれの範囲、実施主体、コストと期間、自社に合う選び方を解説します。",
  "what-is-a-factory-audit": "B2B の工場監査とは何か、なぜ海外バイヤーに必要なのかを解説します。監査の種類と、自社製品に合う第三者監査機関の選び方も示します。",
  "supplier-evaluation-checklist": "2026 年版のサプライヤー評価チェックリストです。合法性、生産能力、ESG、品質体制に加え、必要な書類と記録の確認点を網羅します。"
};
// ② 批 4.2：#11–20 十篇 × 6 语（含 16 条补足终稿）
const DATA42 = /*__DATA42__*/ {
  "third-party-audit-pain-points": {
    "ja": "第三者監査でよくある問題点を整理します。連絡の遅れ、指摘事項の不明確さ、報告後のフォロー不足への対処と事前準備を示します。",
    "es": "Los problemas más habituales en las auditorías de terceros: retrasos en la comunicación, hallazgos poco claros y falta de acciones tras el informe.",
    "de": "Typische Probleme bei Audits durch Dritte: Kommunikationsverzögerungen, unklare Feststellungen und fehlende Maßnahmen nach dem Bericht.",
    "fr": "Les problèmes les plus courants des audits tiers : retards de communication, constats flous et absence d'actions après le rapport.",
    "pt": "Os problemas mais comuns nas auditorias de terceiros: atrasos na comunicação, achados pouco claros e falta de ações após o relatório.",
    "ar": "المشكلات الأكثر شيوعاً في تدقيق الأطراف الثالثة: تأخر التواصل، والملاحظات غير الواضحة، وغياب الإجراءات بعد التقرير، وكيفية تجنّبها مسبقاً."
  },
  "capacity-audit-guide": {
    "ja": "工場の生産能力を審査する手順を解説します。設備、人員、稼働率、ボトルネックを確認し、実際に供給できる数量と発注前の確認点を見極めます。",
    "es": "Cómo auditar la capacidad real de una fábrica. Revise equipos, plantilla, tasa de utilización y cuellos de botella antes de firmar un pedido.",
    "de": "So prüfen Sie die tatsächliche Kapazität einer Fabrik. Anlagen, Personal, Auslastung und Engpässe klären, bevor Sie einen Auftrag vergeben.",
    "fr": "Comment auditer la capacité réelle d'une usine. Vérifiez équipements, effectifs, taux d'utilisation et goulots d'étranglement avant de commander.",
    "pt": "Como auditar a capacidade real de uma fábrica. Verifique equipamentos, pessoal, taxa de utilização e gargalos antes de fazer o pedido.",
    "ar": "كيفية تدقيق الطاقة الإنتاجية الفعلية للمصنع. تحقّق من المعدات والموظفين ومعدل التشغيل ومواقع الاختناق قبل إصدار أمر الشراء."
  },
  "aql-sampling-standard-fri": {
    "ja": "出荷前検査で使う AQL 抜き取り基準を解説します。欠陥クラスの分類、二表方式、ロット合格の判定と不合格時の対応を示します。",
    "es": "Cómo aplicar el estándar AQL en inspecciones previas al embarque. Clases de defectos, tabla doble y criterios de aceptación del lote.",
    "de": "So wenden Sie die AQL-Stichprobennorm bei Vorversandinspektionen an. Fehlerklassen, doppelte Tabelle und Annahmekriterien für Lose.",
    "fr": "Comment appliquer la norme AQL en inspection avant expédition. Classes de défauts, table double et critères d'acceptation du lot.",
    "pt": "Como aplicar a norma AQL em inspeções antes do embarque. Classes de defeitos, tabela dupla e critérios de aceitação do lote.",
    "ar": "كيفية تطبيق معيار AQL في فحوص ما قبل الشحن. أصناف العيوب والجدول المزدوج ومعايير قبول الدفعة أو رفضها، وكيفية توثيق نتائج الفحص."
  },
  "ppi-vs-dupro-inspection": {
    "ja": "PPI（生産前検査）と DUPRO（生産中検査）の違いを比較します。目的、実施タイミング、確認項目、費用対効果を示します。",
    "es": "PPI frente a DUPRO: diferencias entre la inspección previa a la producción y la inspección durante la producción. Objetivos, momentos y coste.",
    "de": "PPI gegenüber DUPRO: Unterschiede zwischen Vorproduktions- und Währendproduktions-Inspektion. Zweck, Zeitpunkt, Umfang und Kosten-Nutzen.",
    "fr": "PPI et DUPRO : différences entre l'inspection avant production et l'inspection en cours de production. Objectifs, moments et rentabilité.",
    "pt": "PPI versus DUPRO: diferenças entre a inspeção antes da produção e a inspeção durante a produção. Objetivos, momentos e custo-benefício.",
    "ar": "مقارنة بين PPI (فحص ما قبل الإنتاج) وDUPRO (فحص أثناء الإنتاج). الأهداف والتوقيت ونطاق الفحص والعائد على التكلفة ومتى يصلح كل منهما."
  },
  "full-inspection-100-percent": {
    "ja": "100% 全数検査の使いどころを解説します。抜き取り検査との違い、費用、対象となる製品、導入すべきケースと費用対効果の判断基準を示します。",
    "es": "Cuándo recurrir a la inspección 100 % de la producción. Diferencias con el muestreo, coste y casos en los que merece la pena.",
    "de": "Wann eine 100-%-Vollprüfung sinnvoll ist. Unterschiede zur Stichprobe, Kosten und Fälle, in denen sie sich lohnt, samt ihrer Grenzen.",
    "fr": "Quand recourir à l'inspection à 100 % de la production. Différences avec l'échantillonnage, coût et cas où elle se justifie.",
    "pt": "Quando recorrer à inspeção 100 % da produção. Diferenças face à amostragem, custo e casos em que se justifica, e os seus limites.",
    "ar": "متى يُلجأ إلى الفحص الكامل 100% للإنتاج. الفروق عن أخذ العينات والتكلفة والحالات التي يستحق فيها ذلك، وحدوده العملية وبدائله."
  },
  "fba-rejection-inspection": {
    "ja": "FBA で拒否された出荷を検査で挽回する方法を解説します。ラベル、包装、数量の不一致を特定し、再出荷の判断基準を示します。",
    "es": "Cómo una inspección rescata un envío rechazado por FBA. Identifique errores de etiquetado, embalaje o cantidad antes de reenviar.",
    "de": "Wie eine Inspektion eine von FBA abgelehnte Sendung rettet. Kennzeichnungs-, Verpackungs- und Mengenfehler vor dem Neuversand klären.",
    "fr": "Comment une inspection sauve un envoi refusé par FBA. Identifiez les erreurs d'étiquetage, d'emballage ou de quantité avant de réexpédier.",
    "pt": "Como uma inspeção salva um envio rejeitado pela FBA. Identifique erros de rotulagem, embalagem ou quantidade antes de reenviar.",
    "ar": "كيفية إنقاذ شحنة مرفوضة من FBA بالفحص. حدّد أخطاء الملصقات والتغليف والكمية، وتحقّق من مطابقة الطلب ووثّق النتائج قبل إعادة الشحن."
  },
  "failed-inspection-dispute": {
    "ja": "検査不合格時の係争解決手順を解説します。証拠の保全、再検査の可否、返品・修理・値引きの交渉材料と、期限内に決着させる進め方を示します。",
    "es": "Cómo resolver una disputa tras una inspección fallida. Conservación de pruebas, posibilidad de reinspección y negociación de devoluciones.",
    "de": "So lösen Sie einen Streit nach einer fehlgeschlagenen Inspektion. Beweissicherung, Nachinspektion und Verhandlung von Rückgabe oder Rabatt.",
    "fr": "Comment résoudre un litige après une inspection échouée. Conservation des preuves, ré-inspection et négociation d'un retour ou d'une remise.",
    "pt": "Como resolver um litígio após uma inspeção reprovada. Conservação de provas, reinspeção e negociação de devolução ou desconto.",
    "ar": "كيفية حل نزاع بعد فشل الفحص. حفظ الأدلة وإمكانية إعادة الفحص، والتفاوض على الإرجاع أو الإصلاح أو الخصم، مع توثيق المراسلات."
  },
  "ethical-audit-mandatory-requirements": {
    "ja": "倫理監査（SMETA、BSCI、SA8000 など）の必須要件を整理します。児童労働、強制労働、労働時間、賃金、安全衛生の観点を示します。",
    "es": "Requisitos obligatorios en auditorías éticas (SMETA, BSCI, SA8000). Trabajo infantil, trabajo forzoso, horas, salarios y seguridad.",
    "de": "Pflichtanforderungen ethischer Audits (SMETA, BSCI, SA8000). Kinderarbeit, Zwangsarbeit, Arbeitszeiten, Löhne und Arbeitssicherheit.",
    "fr": "Exigences obligatoires des audits éthiques (SMETA, BSCI, SA8000). Travail des enfants, travail forcé, heures, salaires et sécurité.",
    "pt": "Requisitos obrigatórios em auditorias éticas (SMETA, BSCI, SA8000). Trabalho infantil, trabalho forçado, horas, salários e segurança.",
    "ar": "المتطلبات الإلزامية في التدقيق الأخلاقي (SMETA وBSCI وSA8000). عمالة الأطفال والعمل الجبري وساعات العمل والأجور والسلامة."
  },
  "sa8000-certification-guide": {
    "ja": "SA8000 認証の取得手順を解説します。対象範囲、審査項目、審査期間、維持にかかる費用と更新の要件、審査で問われる記録を示します。",
    "es": "Cómo obtener la certificación SA8000. Alcance, criterios de auditoría, duración, coste de mantenimiento y requisitos de renovación.",
    "de": "So erlangen Sie die SA8000-Zertifizierung. Geltungsbereich, Auditkriterien, Dauer, laufende Kosten und Anforderungen zur Erneuerung.",
    "fr": "Comment obtenir la certification SA8000. Périmètre, critères d'audit, durée, coûts de maintien et conditions de renouvellement.",
    "pt": "Como obter a certificação SA8000. Âmbito, critérios de auditoria, duração, custos de manutenção e requisitos de renovação.",
    "ar": "كيفية الحصول على شهادة SA8000. النطاق ومعايير التدقيق والمدة وتكاليف الصيانة وشروط التجديد، وأبرز أسباب عدم الاجتياز وكيفية تجنّبها."
  },
  "esg-supplier-audit-guide": {
    "ja": "ESG 観点でのサプライヤー監査を解説します。環境、社会、ガバナンスの評価項目と、EU 規制を踏まえた準備、求められる証拠を示します。",
    "es": "Cómo auditar a un proveedor desde la perspectiva ESG. Criterios ambientales, sociales y de gobernanza y preparación ante la normativa de la UE.",
    "de": "Lieferantenaudits aus ESG-Sicht. Kriterien für Umwelt, Soziales und Unternehmensführung sowie Vorbereitung auf EU-Vorgaben.",
    "fr": "Comment auditer un fournisseur sous l'angle ESG. Critères environnementaux, sociaux et de gouvernance et préparation aux règles de l'UE.",
    "pt": "Como auditar um fornecedor na perspetiva ESG. Critérios ambientais, sociais e de governação e preparação face às regras da UE.",
    "ar": "كيفية تدقيق المورد من منظور ESG. معايير البيئة والمجتمع والحوكمة، والاستعداد لمتطلبات الاتحاد الأوروبي، والأدلة المطلوبة وطريقة جمعها."
  }
};

function budgetOf(text) {
  const total = [...text].length;
  const cjk = (text.match(new RegExp(CJK_SRC, "g")) || []).length;
  return cjk / total > CJK_DESC_RATIO ? DESC_CJK_BUDGET : DESC_LATIN_BUDGET;
}
const minOf = (lang) => (lang === "ja" ? DESC_CJK_MIN : DESC_LATIN_MIN);
const maxOf = (lang) => (lang === "ja" ? DESC_CJK_BUDGET : DESC_LATIN_BUDGET);

/** 单条校验：返回 { len, budget, errs[] } */
function checkOne(text, lang) {
  const errs = [];
  if (typeof text !== "string" || !text.trim()) return { len: 0, budget: 0, errs: ["空串"] };
  const len = [...text].length;
  const budget = budgetOf(text);
  const lo = minOf(lang);
  const hi = maxOf(lang);
  if (len > budget) errs.push(`长度 ${len} > 预算 ${budget}`);
  if (len > hi) errs.push(`长度 ${len} > 口径上限 ${hi}`);
  if (len < lo) errs.push(`长度 ${len} < 口径下限 ${lo}`);
  const body = text.replace(TRAILING_WRAP_RE, "");
  if (!SENTENCE_END_RE.test(body.slice(-1))) errs.push("结尾无句末标点");
  if (DANGLING_TAIL_RE.test(text)) errs.push("结尾有悬空标点");
  if (/[—–]/.test(text)) errs.push("含破折号 — / –");
  return { len, budget, errs };
}

/** 全量自检；返回不合规条数 */
function validateAll() {
  let n = 0;
  let bad = 0;
  for (const [slug, text] of Object.entries(JA_FIX)) {
    n++;
    const { len, budget, errs } = checkOne(text, "ja");
    if (errs.length) {
      bad++;
      console.log(`  ✗ [ja-fix] ${slug} [${len}/${budget}] ${errs.join("; ")}`);
    }
  }
  for (const slug of Object.keys(DATA42)) {
    for (const lg of LANGS) {
      n++;
      const { len, budget, errs } = checkOne(DATA42[slug][lg], lg);
      if (errs.length) {
        bad++;
        console.log(`  ✗ ${slug}/${lg} [${len}/${budget}] ${errs.join("; ")}`);
      }
    }
  }
  console.log(`[写前自检] 共 ${n} 条，不合规 ${bad}`);
  return bad;
}

/** 定位 slug 块（返回 { si, end, block }） */
function locate(lines, slug) {
  const si = lines.findIndex((l) => l === `    slug: "${slug}",`);
  if (si < 0) return null;
  let end = lines.findIndex((l, i) => i > si && /^    slug: "/.test(l));
  if (end < 0) end = lines.length;
  return { si, end, block: lines.slice(si, end) };
}

/**
 * 定位某字段的「值行」。仓库里两种写法并存，必须都支持：
 *   A) 内联：`    metaDescZh: "…",`      → 值行 == key 行
 *   B) 多行：`    metaDescZh:` + `      "…",` → 值行 == key 行 + 1
 */
function valueLineOf(si, block, keyName) {
  const ki = block.findIndex((l) => new RegExp(`^\\s+${keyName}:`).test(l));
  if (ki < 0) return null;
  const inline = new RegExp(`^\\s+${keyName}:\\s*["']`).test(block[ki]);
  return { ki, inline, line: inline ? si + ki : si + ki + 1 };
}

/** 从值行提取字符串字面量（兼容 A/B 两种格式），失败返回 null */
function extractString(line) {
  const m = (line || "").match(/^\s+(?:[A-Za-z][A-Za-z0-9]*:\s*)?("(?:[^"\\]|\\.)*")\s*,?\s*$/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function main() {
  const dry = process.argv.includes("--dry");

  const slugsFix = Object.keys(JA_FIX);
  const slugsAdd = Object.keys(DATA42);
  console.log(`批 4.2：ja 回补 ${slugsFix.length} 条（替换）｜新增 ${slugsAdd.length} 篇 × ${LANGS.length} 语 = ${slugsAdd.length * LANGS.length} 条`);
  if (slugsFix.length !== 6) {
    console.error(`✗ 期望 6 条 ja 回补，实际 ${slugsFix.length}`);
    process.exit(1);
  }
  if (slugsAdd.length !== 10) {
    console.error(`✗ 期望 10 篇新增，实际 ${slugsAdd.length}`);
    process.exit(1);
  }
  for (const slug of slugsAdd) {
    for (const lg of LANGS) {
      if (typeof DATA42[slug][lg] !== "string") {
        console.error(`✗ ${slug} 缺 ${lg}`);
        process.exit(1);
      }
    }
  }
  // 两组 slug 不得重叠（否则替换与插入互相干扰）
  const overlap = slugsFix.filter((s) => slugsAdd.includes(s));
  if (overlap.length) {
    console.error(`✗ 替换组与新增组存在重叠：${overlap.join(", ")}`);
    process.exit(1);
  }

  if (validateAll() > 0) {
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

  // 2) 规划替换（6 条 ja 回补）
  const replPlan = [];
  let replSkipped = 0;
  for (const [slug, newVal] of Object.entries(JA_FIX)) {
    const loc = locate(original, slug);
    if (!loc) {
      console.error(`✗ 未找到 slug 块：${slug}`);
      process.exit(1);
    }
    const v = valueLineOf(loc.si, loc.block, "metaDescJa");
    if (!v) {
      console.error(`✗ ${slug} 尚无 metaDescJa，无法替换`);
      process.exit(1);
    }
    const raw = original[v.line] || "";
    const oldVal = extractString(raw);
    if (oldVal === null) {
      console.error(`✗ ${slug} metaDescJa 值行格式不符预期：${JSON.stringify(raw)}`);
      process.exit(1);
    }
    if (oldVal === newVal) {
      replSkipped++;
      continue;
    }
    // 保持原行格式（内联行替换为内联行；多行值行替换为值行），否则会丢掉 key
    const newLine = v.inline
      ? `    metaDescJa: ${JSON.stringify(newVal)},`
      : `      ${JSON.stringify(newVal)},`;
    replPlan.push({ slug, line: v.line, oldLine: raw, newLine });
  }

  // 3) 规划插入（10 篇 × 6 语）
  const insPlan = [];
  let insSkipped = 0;
  for (const slug of slugsAdd) {
    const loc = locate(original, slug);
    if (!loc) {
      console.error(`✗ 未找到 slug 块：${slug}`);
      process.exit(1);
    }
    if (/^\s+metaDescJa:/m.test(loc.block.join("\n"))) {
      insSkipped++;
      continue;
    }
    const zv = valueLineOf(loc.si, loc.block, "metaDescZh");
    if (!zv) {
      console.error(`✗ 未找到 metaDescZh：${slug}`);
      process.exit(1);
    }
    if (extractString(original[zv.line]) === null) {
      console.error(`✗ metaDescZh 值行不符合预期：${slug} → ${JSON.stringify(original[zv.line])}`);
      process.exit(1);
    }
    const ins = [];
    for (const lg of LANGS) {
      ins.push(`    ${FIELD[lg]}:`);
      ins.push(`      ${JSON.stringify(DATA42[slug][lg])},`);
    }
    insPlan.push({ slug, after: zv.line, ins });
  }

  if (replPlan.length === 0 && insPlan.length === 0) {
    console.log(`幂等：替换 ${replSkipped}/6 条已是新值、新增 ${insSkipped}/10 篇已存在，无事可做。`);
    return;
  }
  console.log(
    `待替换 ${replPlan.length} 条（已是新值跳过 ${replSkipped}）｜待插入 ${insPlan.length} 篇（已存在跳过 ${insSkipped}），共 ${insPlan.reduce((a, p) => a + p.ins.length, 0)} 行`
  );

  // 4) 应用：先替换（行数不变），再插入（倒序，避免位移）
  const result = original.slice();
  for (const p of replPlan) result[p.line] = p.newLine;
  for (const p of insPlan.slice().sort((a, b) => b.after - a.after)) {
    result.splice(p.after + 1, 0, ...p.ins);
  }

  // 5) 反演校验：先摘插入（升序 + 位移累计），再把替换行换回旧值 ⇒ 必须与原文逐行相等
  const replay = result.slice();
  let removed = 0;
  for (const p of insPlan.slice().sort((a, b) => a.after - b.after)) {
    const idx = p.after + 1;
    const chunk = replay.splice(idx, p.ins.length);
    if (chunk.join("\n") !== p.ins.join("\n")) {
      console.error(`✗ 反演失败（插入块不连续）：${p.slug} @ 行 ${idx}`);
      process.exit(1);
    }
    removed += p.ins.length;
  }
  for (const p of replPlan) replay[p.line] = p.oldLine;
  if (
    result.length !== original.length + removed ||
    replay.length !== original.length ||
    replay.some((l, i) => l !== original[i])
  ) {
    console.error("✗ 反演失败：除「新增行」与「6 条替换」外存在其他改动，拒绝写入");
    process.exit(1);
  }
  console.log(`反演校验通过：新增 ${removed} 行 + 替换 ${replPlan.length} 行，其余逐行未变`);

  // 6) 备份 + 写入
  fs.copyFileSync(TARGET, BACKUP);
  console.log(`已备份 lib/guides.ts → lib/guides.ts.bak`);
  fs.writeFileSync(TARGET, result.join(eol), "utf8");

  // 7) 读回校验
  const back = fs.readFileSync(TARGET, "utf8").split(/\r?\n/);
  let readbackBad = 0;
  const readVal = (lines, slug, field) => {
    const loc = locate(lines, slug);
    if (!loc) return "__NO_BLOCK__";
    const v = valueLineOf(loc.si, loc.block, field);
    if (!v) return "__NO_FIELD__";
    const got = extractString(lines[v.line]);
    return got === null ? "__PARSE_ERR__" : got;
  };
  for (const [slug, v] of Object.entries(JA_FIX)) {
    if (readVal(back, slug, "metaDescJa") !== v) {
      readbackBad++;
      console.log(`  ✗ 读回不一致 [ja-fix] ${slug}`);
    }
  }
  for (const slug of slugsAdd) {
    for (const lg of LANGS) {
      if (readVal(back, slug, FIELD[lg]) !== DATA42[slug][lg]) {
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
  const total = slugsFix.length + slugsAdd.length * LANGS.length;
  console.log(`读回校验通过：${total}/${total} 条与数据一致`);
  console.log(`行尾保持：${eol === "\r\n" ? "CRLF" : "LF"}`);
  console.log("✅ 写入完成");
}

main();
