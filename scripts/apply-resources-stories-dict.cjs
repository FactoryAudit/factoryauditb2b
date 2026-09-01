/**
 * 把「案例 + 现场记录」双卡区块的标题加到正确的字典块：resourcesIndex。
 *
 * 踩坑记录（2026-09-01）：resources 页读的是 t.resourcesIndex，不是 t.resourcesPage。
 * 上一版脚本把 storiesTitle 加进了 resourcesPage，还顺手删掉了那里的
 * knowledgeTitle / knowledgeLead（那是 resourcesPage 自己的键，其他页面/后续功能会用到），
 * 导致 build 报 'storiesTitle' does not exist on type ...categoriesTitle...'。
 * 本脚本：① 从 git HEAD 还原 resourcesPage 的 knowledgeTitle / knowledgeLead
 *        ② 清掉误加的 storiesTitle / storiesLead
 *        ③ 把这两个键写进真正被消费的 resourcesIndex
 *
 * en / zh 手写，其余语言按既有惯例回退英文。脚本幂等，可重复执行。
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "i18n", "dictionaries");
const LOCALES = ["en", "zh", "es", "de", "fr", "pt", "ja", "zh-TW", "ar"];

// git 命令在本机沙盒下需要放行，失败则整脚本中止，避免写出半成品
function gitHeadJson(locale) {
  const out = execFileSync("git", ["show", `HEAD:i18n/dictionaries/${locale}.json`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

const STORIES = {
  en: {
    storiesTitle: "Case studies and field notes",
    storiesLead:
      "How the checks work in practice, shown with de-identified examples.",
  },
  zh: {
    storiesTitle: "案例与现场记录",
    storiesLead: "用脱敏示例说明各项检查在实际场景中如何开展。",
  },
};

for (const locale of LOCALES) {
  const file = path.join(DIR, `${locale}.json`);
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  const head = gitHeadJson(locale);
  const block = STORIES[locale] ?? STORIES.en;

  // ① 还原误删的 resourcesPage 键
  if (head.resourcesPage) {
    if (typeof head.resourcesPage.knowledgeTitle === "string") {
      dict.resourcesPage.knowledgeTitle = head.resourcesPage.knowledgeTitle;
    }
    if (typeof head.resourcesPage.knowledgeLead === "string") {
      dict.resourcesPage.knowledgeLead = head.resourcesPage.knowledgeLead;
    }
  }
  // ② 清掉误加的键
  delete dict.resourcesPage.storiesTitle;
  delete dict.resourcesPage.storiesLead;

  // ③ 写进真正被 resources 页消费的块
  if (!dict.resourcesIndex) {
    throw new Error(`${locale}.json 缺少 resourcesIndex 块`);
  }
  dict.resourcesIndex.storiesTitle = block.storiesTitle;
  dict.resourcesIndex.storiesLead = block.storiesLead;

  fs.writeFileSync(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  console.log(`${locale}: resourcesIndex.storiesTitle=${dict.resourcesIndex.storiesTitle}`);
}

console.log("done");
