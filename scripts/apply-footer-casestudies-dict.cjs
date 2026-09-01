/**
 * 补 footer.caseStudies。
 *
 * 背景：页脚 Case Studies 链接的文案此前是硬编码英文，8 个非英文站点会露英文。
 * 现在改读 dict.caseStudies，这里把键写进 9 份字典。
 * en / zh 手写，其余语言回退英文（既有惯例）。脚本幂等。
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

const LABEL = { en: "Case Studies", zh: "案例研究" };

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!dict.footer) throw new Error(`${locale}.json 缺少 footer 块`);
  dict.footer.caseStudies = LABEL[locale] ?? LABEL.en;
  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${locale}: footer.caseStudies=${dict.footer.caseStudies}`);
}

console.log("done");
