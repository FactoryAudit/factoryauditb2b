/**
 * STEP-06 —— 首页「What do you need?」四入口所需的字典键（九语，幂等）。
 *
 * 挂在既有 home.* 命名空间下（不新建 homepage.*，沿用项目 camelCase 叶子键规范）。
 * 新增 14 个叶子键：
 *   needTitle / needLead
 *   entryFindTitle / entryFindDesc / entryFindCta
 *   entryClusterTitle / entryClusterDesc / entryClusterCta
 *   entryVerifyTitle / entryVerifyDesc / entryVerifyCta
 *   entryRfqTitle / entryRfqDesc / entryRfqCta
 *
 * 另：把现有 home.ctaSecondary 的值从「Free Supplier Check」改写为「Verify a Supplier」
 *   （Hero 次 CTA 改指向 /verify-supplier，见 page.tsx）。只改值，不增删键，
 *   因此不影响 en 叶子数。
 *
 * 🔴 副作用：en 字典叶子数 2912 → 2926（= 2922 字符串 + 4 boolean）。
 *   冻结常量写在 8 处，跑完本脚本执行：node scripts/sync-step06-gates.cjs
 *
 * 跑法：node scripts/apply-step06-i18n.cjs
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");

// 14 个新增叶子键（全字符串）。结构：{ locale: { key: value } }
const NEW = {
  en: {
    needTitle: "What do you need?",
    needLead: "Pick the fastest path for your situation — no account required to start.",
    entryFindTitle: "Find Suppliers",
    entryFindDesc: "Discover manufacturers and suppliers by product, industry, country and capability.",
    entryFindCta: "Browse Suppliers →",
    entryClusterTitle: "Explore Industrial Clusters",
    entryClusterDesc: "Explore manufacturing hubs and supplier clusters by location.",
    entryClusterCta: "Explore Clusters →",
    entryVerifyTitle: "Verify a Supplier",
    entryVerifyDesc: "Already found a supplier? Verify the company before placing an order.",
    entryVerifyCta: "Verify Supplier →",
    entryRfqTitle: "Request Sourcing Help",
    entryRfqDesc: "Tell us what you need and get help identifying suitable suppliers.",
    entryRfqCta: "Submit an RFQ →",
  },
  zh: {
    needTitle: "你需要什么？",
    needLead: "根据你的处境选择最快的路径——无需注册即可开始。",
    entryFindTitle: "寻找供应商",
    entryFindDesc: "按产品、行业、国家和能力筛选制造商与供应商。",
    entryFindCta: "浏览供应商 →",
    entryClusterTitle: "探索产业带",
    entryClusterDesc: "按地区浏览制造中心与供应商集群。",
    entryClusterCta: "浏览产业带 →",
    entryVerifyTitle: "核验供应商",
    entryVerifyDesc: "已经找到供应商？下单前先核验这家公司。",
    entryVerifyCta: "核验供应商 →",
    entryRfqTitle: "请求采购协助",
    entryRfqDesc: "告诉我们你的需求，我们帮你匹配合适的供应商。",
    entryRfqCta: "提交询价 →",
  },
  "zh-TW": {
    needTitle: "你需要什麼？",
    needLead: "根據你的處境選擇最快的路徑——無需註冊即可開始。",
    entryFindTitle: "尋找供應商",
    entryFindDesc: "按產品、行業、國家和能力篩選製造商與供應商。",
    entryFindCta: "瀏覽供應商 →",
    entryClusterTitle: "探索產業帶",
    entryClusterDesc: "按地區瀏覽製造中心與供應商集群。",
    entryClusterCta: "瀏覽產業帶 →",
    entryVerifyTitle: "核驗供應商",
    entryVerifyDesc: "已經找到供應商？下單前先核驗這家公司。",
    entryVerifyCta: "核驗供應商 →",
    entryRfqTitle: "請求採購協助",
    entryRfqDesc: "告訴我們你的需求，我們幫你匹配合適的供應商。",
    entryRfqCta: "提交詢價 →",
  },
  ja: {
    needTitle: "何をお探しですか？",
    needLead: "状況に合わせて最速の経路を選択——登録不要で今すぐ開始できます。",
    entryFindTitle: "サプライヤーを探す",
    entryFindDesc: "製品、業界、国、対応力からメーカーやサプライヤーを探します。",
    entryFindCta: "サプライヤーを見る →",
    entryClusterTitle: "産業クラスターを探索",
    entryClusterDesc: "地域別の製造拠点とサプライヤークラスターを探索します。",
    entryClusterCta: "クラスターを見る →",
    entryVerifyTitle: "サプライヤーを検証",
    entryVerifyDesc: "既にサプライヤーを見つけましたか？発注前に企業を検証しましょう。",
    entryVerifyCta: "サプライヤーを検証 →",
    entryRfqTitle: "調達サポートを依頼",
    entryRfqDesc: "必要なものを教えていただければ、適切なサプライヤーの特定をお手伝いします。",
    entryRfqCta: "RFQを送信 →",
  },
  es: {
    needTitle: "¿Qué necesitas?",
    needLead: "Elige la vía más rápida para tu situación — sin cuenta para empezar.",
    entryFindTitle: "Encontrar proveedores",
    entryFindDesc: "Descubre fabricantes y proveedores por producto, industria, país y capacidad.",
    entryFindCta: "Ver proveedores →",
    entryClusterTitle: "Explorar clústeres industriales",
    entryClusterDesc: "Explora centros manufactureros y clústeres de proveedores por ubicación.",
    entryClusterCta: "Explorar clústeres →",
    entryVerifyTitle: "Verificar un proveedor",
    entryVerifyDesc: "¿Ya encontraste un proveedor? Verifícalo antes de hacer un pedido.",
    entryVerifyCta: "Verificar proveedor →",
    entryRfqTitle: "Solicitar ayuda de abastecimiento",
    entryRfqDesc: "Cuéntanos qué necesitas y te ayudamos a identificar proveedores adecuados.",
    entryRfqCta: "Enviar una RFQ →",
  },
  de: {
    needTitle: "Was brauchst du?",
    needLead: "Wähle den schnellsten Weg für deine Situation — kein Konto nötig zum Start.",
    entryFindTitle: "Lieferanten finden",
    entryFindDesc: "Finde Hersteller und Lieferanten nach Produkt, Branche, Land und Fähigkeit.",
    entryFindCta: "Lieferanten ansehen →",
    entryClusterTitle: "Industrielle Cluster erkunden",
    entryClusterDesc: "Erkunde Produktionsstandorte und Lieferantencluster nach Region.",
    entryClusterCta: "Cluster erkunden →",
    entryVerifyTitle: "Lieferanten prüfen",
    entryVerifyDesc: "Schon einen Lieferanten gefunden? Prüfe das Unternehmen vor der Bestellung.",
    entryVerifyCta: "Lieferant prüfen →",
    entryRfqTitle: "Beschaffungshilfe anfragen",
    entryRfqDesc: "Sag uns, was du brauchst, und wir helfen dir, passende Lieferanten zu finden.",
    entryRfqCta: "RFQ senden →",
  },
  fr: {
    needTitle: "Que cherchez-vous ?",
    needLead: "Choisissez le chemin le plus rapide selon votre situation — aucun compte requis pour commencer.",
    entryFindTitle: "Trouver des fournisseurs",
    entryFindDesc: "Découvrez des fabricants et fournisseurs par produit, secteur, pays et capacité.",
    entryFindCta: "Parcourir les fournisseurs →",
    entryClusterTitle: "Explorer les clusters industriels",
    entryClusterDesc: "Explorez les pôles manufacturiers et clusters de fournisseurs par zone.",
    entryClusterCta: "Explorer les clusters →",
    entryVerifyTitle: "Vérifier un fournisseur",
    entryVerifyDesc: "Vous avez déjà un fournisseur ? Vérifiez l'entreprise avant de commander.",
    entryVerifyCta: "Vérifier le fournisseur →",
    entryRfqTitle: "Demander de l'aide pour l'approvisionnement",
    entryRfqDesc: "Dites-nous ce qu'il vous faut et nous vous aidons à trouver les bons fournisseurs.",
    entryRfqCta: "Envoyer un RFQ →",
  },
  pt: {
    needTitle: "O que você precisa?",
    needLead: "Escolha o caminho mais rápido para sua situação — sem conta para começar.",
    entryFindTitle: "Encontrar fornecedores",
    entryFindDesc: "Descubra fabricantes e fornecedores por produto, setor, país e capacidade.",
    entryFindCta: "Ver fornecedores →",
    entryClusterTitle: "Explorar clusters industriais",
    entryClusterDesc: "Explore polos de manufatura e clusters de fornecedores por localização.",
    entryClusterCta: "Explorar clusters →",
    entryVerifyTitle: "Verificar um fornecedor",
    entryVerifyDesc: "Já encontrou um fornecedor? Verifique a empresa antes de fechar o pedido.",
    entryVerifyCta: "Verificar fornecedor →",
    entryRfqTitle: "Solicitar ajuda de suprimentos",
    entryRfqDesc: "Conte o que você precisa e receba ajuda para identificar fornecedores adequados.",
    entryRfqCta: "Enviar uma RFQ →",
  },
  ar: {
    needTitle: "ماذا تحتاج؟",
    needLead: "اختر أسرع مسار بحسب حالتك — لا حساب مطلوب للبدء.",
    entryFindTitle: "العثور على موردين",
    entryFindDesc: "اكتشف المصنعين والموردين حسب المنتج والصناعة والبلد والقدرة.",
    entryFindCta: "تصفح الموردين ←",
    entryClusterTitle: "استكشف التجمعات الصناعية",
    entryClusterDesc: "استكشف مراكز التصنيع وتجمعات الموردين حسب الموقع.",
    entryClusterCta: "استكشف التجمعات ←",
    entryVerifyTitle: "التحقق من مورّد",
    entryVerifyDesc: "وجدت موردًا بالفعل؟ تحقق من الشركة قبل تقديم الطلب.",
    entryVerifyCta: "تحقق من المورّد ←",
    entryRfqTitle: "اطلب مساعدة التوريد",
    entryRfqDesc: "أخبرنا بما تحتاجه وسنساعدك في تحديد الموردين المناسبين.",
    entryRfqCta: "أرسل طلب عرض سعر ←",
  },
};

// Hero 次 CTA 文案改写（值）
const CTA2 = {
  en: "Verify a Supplier",
  zh: "核验供应商",
  "zh-TW": "核驗供應商",
  ja: "サプライヤーを検証",
  es: "Verificar un proveedor",
  de: "Lieferant prüfen",
  fr: "Vérifier un fournisseur",
  pt: "Verificar um fornecedor",
  ar: "التحقق من مورّد",
};

const LOCALES = Object.keys(NEW);

let changed = 0;

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.log(`SKIP  ${locale}（文件不存在）`);
    continue;
  }
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  obj.home = obj.home || {};
  let added = 0;
  let cta2 = false;

  for (const [k, v] of Object.entries(NEW[locale])) {
    if (k in obj.home) {
      // 已存在则跳过（幂等），不重复计数
      continue;
    }
    obj.home[k] = v;
    added += 1;
  }

  if (obj.home.ctaSecondary !== CTA2[locale]) {
    obj.home.ctaSecondary = CTA2[locale];
    cta2 = true;
  }

  if (added === 0 && !cta2) {
    console.log(`SKIP  ${locale}（已全部存在）`);
    continue;
  }

  const out = JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  fs.writeFileSync(file, out, "utf8");
  changed++;
  console.log(`OK    ${locale}.json 新增 ${added} 键${cta2 ? " + ctaSecondary 改写" : ""}`);
}

// ---- 九语键集一致性自检 ----
function leaves(obj, prefix = "", out = []) {
  if (obj === null || typeof obj !== "object") {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    leaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const enObj = JSON.parse(fs.readFileSync(path.join(DIR, "en.json"), "utf8"));
const enLeaves = leaves(enObj).sort();
console.log(`\nen 字典叶子数 = ${enLeaves.length}`);
const strings = enLeaves.filter(
  (k) => typeof k.split(".").reduce((o, x) => (o == null ? o : o[x]), enObj) === "string"
).length;
console.log(`  = ${strings} 字符串 + ${enLeaves.length - strings} 其他类型`);

// 校验 14 个新键确实在 en 中
const missingNew = Object.keys(NEW.en).filter((k) => !("home" in enObj) || !(k in enObj.home));
if (missingNew.length) {
  console.log(`❌ en.home 缺新键: ${missingNew.join(", ")}`);
} else {
  console.log("✅ en.home 14 个新键齐全");
}

let mismatch = 0;
for (const loc of LOCALES) {
  const o = JSON.parse(fs.readFileSync(path.join(DIR, `${loc}.json`), "utf8"));
  const l = leaves(o).sort();
  const missing = enLeaves.filter((k) => !l.includes(k));
  const extra = l.filter((k) => !enLeaves.includes(k));
  if (missing.length || extra.length) {
    mismatch++;
    console.log(`❌ ${loc}：缺 ${missing.length} 键 / 多 ${extra.length} 键`);
    if (missing.length) console.log(`     缺: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " …" : ""}`);
    if (extra.length) console.log(`     多: ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? " …" : ""}`);
  } else {
    console.log(`✅ ${loc}：键集与 en 完全一致（${l.length}）`);
  }
}

console.log(`\n完成：${changed} 个文件被写入；键集不一致语言数 = ${mismatch}`);
if (mismatch === 0) {
  console.log("→ 下一步：node scripts/sync-step06-gates.cjs（同步 8 处冻结常量 2912 → 2926）");
}
