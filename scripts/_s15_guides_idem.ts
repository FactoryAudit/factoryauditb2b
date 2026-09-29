/**
 * stage1.5 探针：guides 47 条 metaDescEn 的「源头 → 收口后」幂等断言
 *
 * 断言三条（缺一不可）：
 *   A. 源头 ≤158（拉丁预算）且结尾有句末标点
 *   B. trimMetaDescription(源头) === 源头      —— 收口零命中（CUT=0）
 *   C. 收口后结尾仍有句末标点（防止 B 通过但文本本身半句话）
 *
 * 用法：node scripts/run-regression.mjs _s15_guides_idem
 */
import { GUIDES } from "../lib/guides";
import { trimMetaDescription } from "../lib/pageMeta";

const SENT = /[.。!！?？]/;
const LIMIT = 158;

let pass = 0;
let fail = 0;
const fails: string[] = [];

console.log("guides 条数: " + GUIDES.length);
console.log("idx  slug                                        srcLen  outLen  endOk  CUT");
console.log("-".repeat(96));

GUIDES.forEach((g, i) => {
  const src = g.metaDescEn;
  const out = trimMetaDescription(src);
  const srcLen = [...src].length;
  const outLen = [...out].length;
  const endOk = SENT.test(src.slice(-1)) && SENT.test(out.slice(-1));
  const cut = src !== out ? 1 : 0;

  const a = srcLen <= LIMIT;
  const b = cut === 0;
  const c = endOk;
  const ok = a && b && c;
  if (ok) pass++;
  else {
    fail++;
    fails.push(g.slug + " [src=" + srcLen + " out=" + outLen + " cut=" + cut + " endOk=" + endOk + "]");
  }

  console.log(
    String(i + 1).padStart(3) +
      "  " +
      g.slug.padEnd(44).slice(0, 44) +
      "  " +
      String(srcLen).padStart(4) +
      "    " +
      String(outLen).padStart(4) +
      "    " +
      (endOk ? "Y" : "N") +
      "     " +
      cut
  );
});

console.log("-".repeat(96));
console.log("PASS=" + pass + "  FAIL=" + fail);
if (fails.length) {
  console.log("\n失败项:");
  for (const f of fails) console.log("  " + f);
}
console.log(fail === 0 ? "\n=> ALL PASS（47/47 幂等）" : "\n=> 有失败项");
process.exit(fail === 0 ? 0 : 1);
