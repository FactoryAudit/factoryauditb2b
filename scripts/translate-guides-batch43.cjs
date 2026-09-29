#!/usr/bin/env node
/**
 * scripts/translate-guides-batch43.cjs
 *
 * 第 4 批「guides 9 语补全」—— 批 4.3 写入器：
 *   #21–30 十篇 × 6 语 = 60 条 **新增** metaDescJa/Es/De/Fr/Pt/Ar。
 *
 * 设计（沿用 batch42 骨架；本批无「值替换」项）：
 *   1. **内联数据**（不依赖任何一次性文件 / 外部 API）。
 *   2. **幂等**：目标篇若已存在 metaDescJa 整组 → 跳过该篇（重复跑不重复插入）。
 *   3. **写前自检**：长度（下限 ja 60 / ar 90 / 其他 120；上限 ja 90 / 其他 158）
 *      + 句末标点 + 无破折号 + 无悬空尾标点；
 *      任一条不合规 → 打印明细并 **exit 1 且不写文件**。
 *   4. **只新增**：反演 = 摘掉插入行（升序 + 位移），必须与原文**逐行相等**。
 *   5. **备份**：写入前 `lib/guides.ts` → `lib/guides.ts.bak`；读回校验失败自动还原。
 *   6. 行尾（CRLF/LF）保持不变。
 *
 * 预算口径镜像 `lib/pageMeta.ts`（CJK 占比 > 0.1 → 90，否则 158）⇒ 产出的串对
 * `trimMetaDescription` 幂等；真实幂等性由 `scripts/g4-desc-idempotency-regression.ts` 二次确证。
 *
 * 用法：
 *   node scripts/translate-guides-batch43.cjs --dry   # 只校验 + 打印锚点（不写文件）
 *   node scripts/translate-guides-batch43.cjs         # 校验通过后写入
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
// 本轮裁决：ar 不受 120 下限约束，目标区间 90–158（上限仍走 DESC_LATIN_BUDGET）
const DESC_AR_MIN = 90;
const SENTENCE_END_RE = /[.。!！?？]/;
const TRAILING_WRAP_RE = /["'”’»)\]）]*$/;
const DANGLING_TAIL_RE = /[\s,;:，、；：\-–—]+$/u;

// ── 数据（内联）：批 4.3 的 #21–30 十篇 × 6 语 = 60 条 ───────────────────
const DATA43 = /*__DATA43__*/ {
  "brand-reputation-pr-crisis": {
    ja: "サプライヤーの不祥事が自社ブランドの危機になる仕組みを解説します。予兆の捉え方と、評判を守りながら供給を止めない対応手順を示します。",
    es: "Cómo un escándalo de un proveedor se convierte en una crisis de tu propia marca. Señales de alerta temprana y un plan para proteger la reputación.",
    de: "Wie ein Skandal beim Lieferanten zur Krise der eigenen Marke wird. Frühwarnsignale und ein Ablaufplan, der den Ruf langfristig schützt.",
    fr: "Comment un scandale chez un fournisseur devient une crise de votre propre marque. Signaux d'alerte précoces et plan pour protéger la réputation.",
    pt: "Como um escândalo num fornecedor se torna uma crise da sua própria marca. Sinais de alerta precoce e um plano para proteger a reputação.",
    ar: "كيف تتحول فضيحة المورد إلى أزمة لعلامتك التجارية. إشارات الإنذار المبكر وخطة استجابة تحمي السمعة دون قطع التوريد.",
  },
  "chinese-supplier-scam-red-flags": {
    ja: "中国サプライヤー詐欺の典型的な危険信号を解説します。支払いを急かす圧力、確認できない法人、偽の証明書と、支払い前の見極め方を示します。",
    es: "Las señales de alarma más comunes de una estafa de proveedor chino. Presión para pagar rápido, entidad no verificable y certificados falsos.",
    de: "Die häufigsten Warnsignale eines Betrugs durch chinesische Lieferanten. Zahlungsdruck, nicht prüfbare Firma und gefälschte Zertifikate.",
    fr: "Les signaux d'alarme les plus courants d'une arnaque de fournisseur chinois. Pression au paiement, entité invérifiable et faux certificats.",
    pt: "Os sinais de alerta mais comuns de fraude de fornecedor chinês. Pressão para pagar rápido, entidade não verificável e certificados falsos.",
    ar: "أكثر إشارات التحذير شيوعاً في احتيال الموردين الصينيين. الضغط للدفع السريع، وعدم إمكانية التحقق من الكيان، والشهادات المزيفة، وكيفية كشفها قبل الدفع.",
  },
  "how-to-check-china-company-registration": {
    ja: "中国企業の工商登記を確認する手順を解説します。統一社会信用コード、法人名、経営範囲を公開登記システムで照合し、不一致の意味を示します。",
    es: "Cómo verificar el registro mercantil de una empresa china. Compare el código de crédito social, la razón social y el objeto social en el registro público.",
    de: "So prüfen Sie das Handelsregister einer chinesischen Firma. Kreditcode, Firmenname und Geschäftsbereich im öffentlichen Register abgleichen.",
    fr: "Comment vérifier l'immatriculation d'une entreprise chinoise. Comparez le code de crédit social, la raison sociale et l'objet social au registre public.",
    pt: "Como verificar o registo comercial de uma empresa chinesa. Compare o código de crédito social, a razão social e o objeto social no registo público.",
    ar: "كيفية التحقق من السجل التجاري لشركة صينية. طابق رمز الائتمان الاجتماعي والاسم القانوني ونطاق النشاط في السجل العام، وما تعنيه التناقضات.",
  },
  "alibaba-trade-assurance-safe-payment": {
    ja: "アリババ Trade Assurance が保証する範囲と限界を解説します。エスクロー決済と出荷前検査を組み合わせ、安全に調達する方法を示します。",
    es: "Qué cubre Alibaba Trade Assurance y dónde termina su protección. Cómo combinar el pago en custodia con una inspección para comprar sin arriesgar el anticipo.",
    de: "Was Alibaba Trade Assurance abdeckt und wo der Schutz endet. Wie Sie Treuhandzahlung und Inspektion für eine sichere Beschaffung kombinieren.",
    fr: "Ce que couvre Alibaba Trade Assurance et où sa protection s'arrête. Comment associer paiement sous séquestre et inspection pour un approvisionnement sûr.",
    pt: "O que o Alibaba Trade Assurance cobre e onde termina a proteção. Como combinar pagamento em custódia com inspeção para comprar com segurança.",
    ar: "ما يغطيه Alibaba Trade Assurance وأين تنتهي حمايته. كيفية الجمع بين الدفع عبر حساب الأمان والفحص قبل الشحن لشراء آمن.",
  },
  "verify-supplier-before-deposit": {
    ja: "手付金を払う前にサプライヤーを確認する手順を解説します。法人照合、試作、ビデオ通話、取引先照会で前払いを守る方法を示します。",
    es: "Una secuencia de verificación antes de pagar el anticipo. Compruebe la entidad, la muestra, la videollamada y las referencias antes de transferir dinero.",
    de: "Eine Prüfreihenfolge vor der Anzahlung. Firma, Muster, Videoanruf und Referenzen klären, bevor Sie Geld an einen Lieferanten überweisen.",
    fr: "Une séquence de vérification avant de verser l'acompte. Vérifiez l'entité, l'échantillon, la visioconférence et les références avant tout virement.",
    pt: "Uma sequência de verificação antes de pagar o sinal. Confirme a entidade, a amostra, a videochamada e as referências antes de transferir qualquer valor.",
    ar: "خطوات التحقق من المورد قبل دفع الدفعة المقدمة. تحقّق من الكيان والعيّنة ومكالمة الفيديو والمراجع قبل تحويل أي مبلغ.",
  },
  "common-b2b-procurement-fraud": {
    ja: "B2B 調達でよくある詐欺の手口を整理します。偽工場、幽霊出荷、請求先のすり替え、証明書の使い回しと、それぞれの防ぎ方を示します。",
    es: "Los métodos de fraude más habituales en compras B2B. Fábricas falsas, envíos fantasma, desvío de facturas y certificados reutilizados, y cómo frenar cada uno.",
    de: "Die gängigen Betrugsmuster im B2B-Einkauf. Scheinfabriken, Phantomlieferungen, umgeleitete Rechnungen und wiederverwendete Zertifikate samt Abwehr.",
    fr: "Les procédés de fraude courants dans les achats B2B. Fausses usines, expéditions fantômes, détournement de factures et certificats réutilisés, et leur parade.",
    pt: "Os métodos de fraude mais comuns em compras B2B. Fábricas falsas, envios fantasma, desvio de faturas e certificados reutilizados, e como travá-los.",
    ar: "أساليب الاحتيال الشائعة في المشتريات بين الشركات. المصانع الوهمية، والشحنات غير الموجودة، وتحويل الفواتير، وإعادة استخدام الشهادات.",
  },
  "what-is-quality-management-system": {
    ja: "品質マネジメントシステム（QMS）を平易に解説します。PDCA サイクルと、証明書ではなく仕組みで判断すべき理由を示します。",
    es: "Qué es un sistema de gestión de la calidad (SGC), explicado de forma sencilla. El ciclo PDCA y por qué conviene juzgar el sistema y no solo el certificado.",
    de: "Ein Qualitätsmanagementsystem (QMS) einfach erklärt. Der PDCA-Zyklus und warum Käufer das System bewerten sollten, nicht nur das Zertifikat.",
    fr: "Qu'est-ce qu'un système de management de la qualité (SMQ), expliqué simplement. Le cycle PDCA et pourquoi juger le système plutôt que le certificat.",
    pt: "O que é um sistema de gestão da qualidade (SGQ), explicado de forma simples. O ciclo PDCA e porque se deve avaliar o sistema, não apenas o certificado.",
    ar: "شرح مبسّط لنظام إدارة الجودة (QMS). دورة التخطيط والتنفيذ والتحقق والتصحيح، ولماذا ينبغي تقييم النظام لا الشهادة وحدها.",
  },
  "iso-9001-vs-iso-13485": {
    ja: "ISO 9001 と ISO 13485 の違いを解説します。それぞれが合う業種と、医療機器向けの体系が必要になる条件を示します。",
    es: "La diferencia real entre ISO 9001 e ISO 13485. Cuándo hace falta un sistema de grado sanitario antes de comprar a un proveedor.",
    de: "Der Unterschied zwischen ISO 9001 und ISO 13485. Wann ein System nach Medizinproduktestandard vor dem Einkauf nötig ist.",
    fr: "La vraie différence entre ISO 9001 et ISO 13485. Quand un système de niveau dispositif médical s'impose avant de s'approvisionner.",
    pt: "A diferença real entre ISO 9001 e ISO 13485. Quando é exigido um sistema de nível de dispositivo médico antes de comprar.",
    ar: "الفرق الفعلي بين ISO 9001 وISO 13485. متى يُشترط نظام بمعيار الأجهزة الطبية قبل الشراء، وكيف تُقرأ شهادة المورد.",
  },
  "manufacturing-quality-control-process": {
    ja: "製造現場の品質管理工程を解説します。受入 IQC、工程内 IPQC、最終 FQC、出荷 OQC の四つの関門と、注文を守る要点を示します。",
    es: "Cómo controla la calidad una fábrica a lo largo de la línea. Las cuatro puertas IQC, IPQC, FQC y OQC y qué protege realmente tu pedido.",
    de: "Wie eine Fabrik Qualität entlang der Linie steuert. Die vier Kontrollstufen IQC, IPQC, FQC und OQC und was Ihr Auftrag davon braucht.",
    fr: "Comment une usine contrôle la qualité le long de la ligne. Les quatre étapes IQC, IPQC, FQC et OQC et ce qui protège vraiment votre commande.",
    pt: "Como uma fábrica controla a qualidade ao longo da linha. As quatro etapas IQC, IPQC, FQC e OQC e o que realmente protege o seu pedido.",
    ar: "كيف يضبط المصنع الجودة على طول خط الإنتاج. مراحل الفحص الأربع: استلام المواد، وأثناء التصنيع، والفحص النهائي، وفحص ما قبل الشحن.",
  },
  "ppap-production-part-approval": {
    ja: "PPAP（生産部品承認プロセス）を解説します。求められる 18 要素、適用される場面と、量産前にサプライヤーを承認する進め方を示します。",
    es: "Qué es el PPAP, sus 18 elementos y cuándo se aplica. Cómo calificar a un proveedor y aprobar la pieza antes de la producción en serie.",
    de: "Was PPAP ist, seine 18 Elemente und wann es greift. Wie Sie einen Lieferanten vor der Serienfertigung freigeben und die Serienreife belegen.",
    fr: "Qu'est-ce que le PPAP, ses 18 éléments et quand il s'applique. Comment qualifier un fournisseur et approuver la pièce avant la production de série.",
    pt: "O que é o PPAP, os seus 18 elementos e quando se aplica. Como qualificar um fornecedor e aprovar a peça antes da produção em série.",
    ar: "ما هو PPAP (عملية اعتماد أجزاء الإنتاج) وعناصره الثمانية عشر ومتى يُطبَّق. كيفية اعتماد المورد قبل الإنتاج الكمي وضمان ثبات الجودة.",
  },
};

function budgetOf(text) {
  const total = [...text].length;
  const cjk = (text.match(new RegExp(CJK_SRC, "g")) || []).length;
  return cjk / total > CJK_DESC_RATIO ? DESC_CJK_BUDGET : DESC_LATIN_BUDGET;
}
const minOf = (lang) => (lang === "ja" ? DESC_CJK_MIN : lang === "ar" ? DESC_AR_MIN : DESC_LATIN_MIN);
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
  for (const slug of Object.keys(DATA43)) {
    for (const lg of LANGS) {
      n++;
      const { len, budget, errs } = checkOne(DATA43[slug][lg], lg);
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

  const slugsAdd = Object.keys(DATA43);
  console.log(`批 4.3：新增 ${slugsAdd.length} 篇 × ${LANGS.length} 语 = ${slugsAdd.length * LANGS.length} 条`);
  if (slugsAdd.length !== 10) {
    console.error(`✗ 期望 10 篇新增，实际 ${slugsAdd.length}`);
    process.exit(1);
  }
  for (const slug of slugsAdd) {
    for (const lg of LANGS) {
      if (typeof DATA43[slug][lg] !== "string") {
        console.error(`✗ ${slug} 缺 ${lg}`);
        process.exit(1);
      }
    }
  }

  if (validateAll() > 0) {
    console.error("✗ 存在不合规 desc，拒绝写入（文件未改动）");
    process.exit(1);
  }

  // 1) 读取 + 解析
  const src = fs.readFileSync(TARGET, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const original = src.split(/\r?\n/);

  // 2) 规划插入（10 篇 × 6 语）——锚点 = metaDescZh 值行之后
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
      ins.push(`      ${JSON.stringify(DATA43[slug][lg])},`);
    }
    insPlan.push({ slug, after: zv.line, ins });
  }

  if (insPlan.length === 0) {
    console.log(`幂等：新增 ${insSkipped}/10 篇已存在，无事可做。`);
    return;
  }

  if (dry) {
    console.log(`--dry：校验通过，未写文件。锚点规划如下（插入于 metaDescZh 值行之后，行号从 1 计）：`);
    for (const p of insPlan) {
      console.log(`  · ${p.slug.padEnd(44)} metaDescZh 值行 @ ${p.after + 1}  → 插入 ${p.ins.length} 行`);
    }
    console.log(`待插入 ${insPlan.length} 篇（已存在跳过 ${insSkipped}），共 ${insPlan.reduce((a, p) => a + p.ins.length, 0)} 行。行尾=${eol === "\r\n" ? "CRLF" : "LF"}`);
    return;
  }
  console.log(`待插入 ${insPlan.length} 篇（已存在跳过 ${insSkipped}），共 ${insPlan.reduce((a, p) => a + p.ins.length, 0)} 行`);

  // 3) 应用：倒序插入，避免位移
  const result = original.slice();
  for (const p of insPlan.slice().sort((a, b) => b.after - a.after)) {
    result.splice(p.after + 1, 0, ...p.ins);
  }

  // 4) 反演校验：摘插入（升序 + 位移累计）⇒ 必须与原文逐行相等
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
  if (result.length !== original.length + removed || replay.length !== original.length || replay.some((l, i) => l !== original[i])) {
    console.error("✗ 反演失败：除「新增行」外存在其他改动，拒绝写入");
    process.exit(1);
  }
  console.log(`反演校验通过：新增 ${removed} 行，其余逐行未变`);

  // 5) 备份 + 写入
  fs.copyFileSync(TARGET, BACKUP);
  console.log(`已备份 lib/guides.ts → lib/guides.ts.bak`);
  fs.writeFileSync(TARGET, result.join(eol), "utf8");

  // 6) 读回校验
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
  for (const slug of slugsAdd) {
    for (const lg of LANGS) {
      if (readVal(back, slug, FIELD[lg]) !== DATA43[slug][lg]) {
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
  const total = slugsAdd.length * LANGS.length;
  console.log(`读回校验通过：${total}/${total} 条与数据一致`);
  console.log(`行尾保持：${eol === "\r\n" ? "CRLF" : "LF"}`);
  console.log("✅ 写入完成");
}

main();
