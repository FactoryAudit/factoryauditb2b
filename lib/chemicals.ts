// lib/chemicals.ts —— CS-02B Chemical Intelligence（最小可用版本）
//
// 目标：把「化工产品 → 应用 → 下游行业 → 中国供应商 → 证据 → Buyer RFQ」这条链跑通。
//
// 🔴 收尾冲刺期的三条硬约束（用户 2026-09-13 指令）：
//   1. **不做庞大化工数据库**：只收录能与站内已有真实行业（塑料 / 食品饮料 / 化妆品 /
//      包装 / 家具）产生真实内链的原料，一期 6 个。后续按真实询盘再扩。
//   2. **不做大规模程序化页面**：不生成 CAS 号页、不生成「化学品 × 国家 × 认证」矩阵。
//      SEO 扩张暂停（用户指令 §六），本层只为跑通链路。
//   3. **不编造**：CAS RN 全部通过校验位算法校验（见 cs02b 回归 B1）；
//      应用 / 合规只写可公开核验的常识，不写价格、不写产能、不写「我们审核过 N 家」。
//      没有对应供应商就明确说没有，绝不用占位数据填充。
//
// 内容本地化与 lib/industryContent.ts 一致：只维护 en/zh 两版，
// zh-TW 由 pickZhPair 就地繁化，其余 6 个语言渲染英文正文。
// 新增中文正文后必须重跑 scripts/gen-tw-mapping.py（其 SRC_FILES 已含本文件）。

export type H2Copy = { en: string; zh: string };

export type Chemical = {
  slug: string;
  nameEn: string;
  nameZh: string;
  /** CAS RN（连字符格式）。校验位已核验。 */
  cas: string;
  synonyms: { en: string[]; zh: string[] };
  /** 应用：买家实际怎么用它、通常怎么定规格 */
  application: H2Copy;
  /** 合规要点：买家通常索取什么文件。只写「要什么」，不写「我们发什么证」。 */
  compliance: H2Copy;
  /** 下游行业 code（必须存在于 STATIC_INDUSTRIES，否则是死链） */
  downstream: string[];
};

export const CHEMICALS: Chemical[] = [
  {
    slug: "melamine",
    nameEn: "Melamine",
    nameZh: "三聚氰胺",
    cas: "108-78-1",
    synonyms: {
      en: ["1,3,5-Triazine-2,4,6-triamine", "Cyanuramide"],
      zh: ["蜜胺", "三聚氰酰胺"],
    },
    application: {
      en: "Melamine is used mainly in melamine-formaldehyde resins for laminates, moulding compounds, coatings and tableware. Buyers normally buy it as a white crystalline powder and specify purity, particle size and the resin application it is intended for.",
      zh: "三聚氰胺主要用于三聚氰胺甲醛树脂，制成层压板、模塑料、涂料与餐具。买家通常采购白色结晶粉末，并指定纯度、粒径与目标树脂用途。",
    },
    compliance: {
      en: "Buyers commonly ask for the safety data sheet, a lot-specific certificate of analysis, and — where the goods are intended for food contact — evidence that the finished article meets the food-contact rules of the destination market. Food-contact status applies to the finished article, not to the raw chemical.",
      zh: "买家通常索取安全数据表（SDS）、该批次的分析证书（COA）；若货物用于食品接触，还需成品满足目标市场食品接触法规的证据。食品接触合规针对的是成品，而非原料本身。",
    },
    downstream: ["plastics", "furniture"],
  },
  {
    slug: "titanium-dioxide",
    nameEn: "Titanium dioxide",
    nameZh: "二氧化钛",
    cas: "13463-67-7",
    synonyms: {
      en: ["Titanium(IV) oxide", "Titania", "CI 77891"],
      zh: ["钛白粉", "钛白"],
    },
    application: {
      en: "Titanium dioxide is a white pigment used in coatings, plastics and masterbatch, paper, cosmetics and some food applications. Buyers normally specify the crystal form (rutile or anatase), the surface treatment and the grade, because these determine opacity and dispersion behaviour.",
      zh: "二氧化钛是一种白色颜料，用于涂料、塑料与色母粒、造纸、化妆品以及部分食品用途。买家通常指定晶型（金红石或锐钛型）、表面处理与牌号 —— 这些决定遮盖力与分散性能。",
    },
    compliance: {
      en: "Buyers normally ask for the safety data sheet, a lot-specific certificate of analysis, and written confirmation of the grade and surface treatment. Labelling requirements for titanium dioxide differ by market and have changed in recent years, so confirm the rule currently in force at the destination rather than assuming it.",
      zh: "买家通常索取安全数据表（SDS）、该批次的分析证书（COA），以及牌号与表面处理的书面确认。二氧化钛的标签要求因市场而异且近年有变更，应向目标市场确认现行规则，不要凭经验假设。",
    },
    downstream: ["plastics", "packaging", "cosmetics"],
  },
  {
    slug: "citric-acid",
    nameEn: "Citric acid",
    nameZh: "柠檬酸",
    cas: "77-92-9",
    synonyms: {
      en: ["2-Hydroxypropane-1,2,3-tricarboxylic acid", "E330"],
      zh: ["枸橼酸", "柠檬酸（无水）"],
    },
    application: {
      en: "Citric acid is used as an acidulant and preservative in food and beverages, and as a chelating and cleaning agent in detergents. Buyers normally distinguish between the anhydrous and monohydrate forms and specify food grade versus industrial grade.",
      zh: "柠檬酸在食品饮料中用作酸味剂与防腐剂，在洗涤剂中用作螯合剂与清洗剂。买家通常区分无水物与一水物，并指定食品级或工业级。",
    },
    compliance: {
      en: "For food use, buyers ask for a food-grade specification such as FCC or the European E-number specification, the safety data sheet, a lot-specific certificate of analysis, and statements on heavy metals and allergens.",
      zh: "食品用途下，买家会索取食品级规格（如 FCC 或欧盟 E 编号规格）、安全数据表（SDS）、该批次的分析证书（COA），以及重金属与过敏原声明。",
    },
    downstream: ["food-beverage", "cosmetics"],
  },
  {
    slug: "calcium-carbonate",
    nameEn: "Calcium carbonate",
    nameZh: "碳酸钙",
    cas: "471-34-1",
    synonyms: {
      en: ["Precipitated calcium carbonate (PCC)", "Ground calcium carbonate (GCC)", "CI 77220"],
      zh: ["重质碳酸钙", "轻质碳酸钙"],
    },
    application: {
      en: "Calcium carbonate is used as a filler and extender in plastics, paper, paints, adhesives and construction materials. Buyers normally specify particle size distribution, surface coating and whiteness, because these decide how it behaves in the compound.",
      zh: "碳酸钙在塑料、造纸、涂料、胶粘剂与建材中用作填充料与增量剂。买家通常指定粒径分布、表面处理与白度 —— 这些决定它在配方中的表现。",
    },
    compliance: {
      en: "Buyers usually ask for the safety data sheet, a certificate of analysis covering particle size distribution and whiteness, and — for food or pharmaceutical use — a grade declaration that matches the intended use.",
      zh: "买家通常索取安全数据表（SDS）、覆盖粒径分布与白度的分析证书（COA）；食品或药用用途还需与实际用途相符的等级声明。",
    },
    downstream: ["plastics", "packaging", "furniture"],
  },
  {
    slug: "xanthan-gum",
    nameEn: "Xanthan gum",
    nameZh: "黄原胶",
    cas: "11138-66-2",
    synonyms: {
      en: ["Corn sugar gum", "E415"],
      zh: ["汉生胶", "黄单胞多糖"],
    },
    application: {
      en: "Xanthan gum is a polysaccharide thickener and stabiliser used in food, personal care products and oilfield fluids. Buyers normally specify viscosity grade, mesh size and whether a food grade is required.",
      zh: "黄原胶是一种多糖类增稠剂与稳定剂，用于食品、个人护理产品与油田流体。买家通常指定粘度等级、目数，以及是否需要食品级。",
    },
    compliance: {
      en: "For food use, buyers ask for a food-grade specification, the safety data sheet, a lot-specific certificate of analysis and microbiological limits. Confirm before ordering whether a kosher, halal or allergen statement is required by the destination market.",
      zh: "食品用途下，买家会索取食品级规格、安全数据表（SDS）、该批次的分析证书（COA）与微生物限值。下单前应确认目标市场是否要求洁食、清真或过敏原声明。",
    },
    downstream: ["food-beverage", "cosmetics"],
  },
  {
    slug: "sodium-benzoate",
    nameEn: "Sodium benzoate",
    nameZh: "苯甲酸钠",
    cas: "532-32-1",
    synonyms: {
      en: ["Benzoic acid sodium salt", "E211"],
      zh: ["安息香酸钠", "苯甲酸钠盐"],
    },
    application: {
      en: "Sodium benzoate is a preservative used in acidic foods and beverages and in personal care products. Buyers normally specify food grade versus technical grade and the particle form, and should check the permitted use level in the destination market.",
      zh: "苯甲酸钠是一种防腐剂，用于酸性食品饮料与个人护理产品。买家通常指定食品级或工业级以及粉体/颗粒形态，并应核对目标市场的允许使用量。",
    },
    compliance: {
      en: "Buyers ask for a food-grade specification where applicable, the safety data sheet, a lot-specific certificate of analysis, and confirmation that the intended use level is permitted. Preservative limits differ by market and by food category.",
      zh: "买家会索取适用的食品级规格、安全数据表（SDS）、该批次的分析证书（COA），并确认拟定用量获准。防腐剂限量因市场与食品类别而异。",
    },
    downstream: ["food-beverage", "cosmetics"],
  },
];

export function findChemical(slug: string): Chemical | undefined {
  return CHEMICALS.find((c) => c.slug === slug);
}

/** CAS RN 校验位算法：校验位前的数字从右往左乘 1,2,3… 求和 mod 10 应等于校验位。
 *  只防手抖（打字错误），**不能**证明「这个号确实对应这个物质」——
 *  后者靠人工核对公开来源，回归脚本只守前者。 */
export function casChecksumOk(cas: string): boolean {
  const m = cas.match(/^(\d{2,7})-(\d{2})-(\d)$/);
  if (!m) return false;
  const digits = (m[1] + m[2]).split("").reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (i + 1);
  return sum % 10 === Number(m[3]);
}
