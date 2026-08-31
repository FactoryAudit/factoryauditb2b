#!/usr/bin/env node
/**
 * 补齐 ja / ar 旧版站点文案（MyMemory 免费接口，断点续传）。
 *
 * 为什么需要：ja.json / ar.json 的旧版内容（风险工具、核查清单、首页等）
 * 仍是英文占位，因为 Google 翻译一直 429、MyMemory 有每日配额。
 *
 * 用法（配额恢复后运行，可反复跑，只补未翻译项）：
 *   node scripts/fill-ja-ar.cjs
 *
 * - 只翻译「与英文完全相同」的条目，已翻译项（pricing / aiChat / about / 落地页）绝不覆盖
 * - 占位符 {n}/{industry}/{country} 与品牌名做掩码，防止被翻译破坏
 * - 缓存写入 .workbuddy/fill-cache.json，中断后重跑自动续传
 */
const fs = require("fs");
const path = require("path");

const D = path.join(process.cwd(), "i18n", "dictionaries");
const CACHE = path.join(process.cwd(), ".workbuddy", "fill-cache.json");

const PLACE = [
  ["{n}", "PHA"], ["{done}", "PHB"], ["{total}", "PHC"],
  ["{weight}", "PHD"], ["{industry}", "PHE"], ["{country}", "PHF"],
];
const BRAND = [
  ["privacy@factoryauditb2b.com", "ZMAIL1"],
  ["legal@factoryauditb2b.com", "ZMAIL2"],
  ["FactoryAuditB2B.com", "ZBRDZ"],
  ["FactoryAuditB2B", "ZBRND"],
  ["factoryauditb2b.com", "ZDOMZ"],
  ["Incoterms", "ZINCTZ"],
];

function mask(s) {
  for (const [k, v] of BRAND) s = s.split(k).join(v);
  for (const [k, v] of PLACE) s = s.split(k).join(v);
  return s;
}
function unmask(s) {
  for (const [k, v] of PLACE) s = s.split(v).join(k);
  for (const [k, v] of BRAND) s = s.split(v).join(k);
  return s;
}

async function mm(text, tgt) {
  const url = "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text) + "&langpair=en|" + tgt;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const d = await res.json();
  const status = String(d.responseStatus);
  if (status !== "200") throw new Error("status=" + status + " " + (d.responseDetails || "").slice(0, 60));
  const out = d.responseData.translatedText;
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) throw new Error("quota");
  return out;
}

function flatPaths(d, p = "") {
  const out = {};
  if (d && typeof d === "object" && !Array.isArray(d)) {
    for (const k of Object.keys(d)) Object.assign(out, flatPaths(d[k], p + "/" + k));
  } else if (Array.isArray(d)) {
    d.forEach((v, i) => Object.assign(out, flatPaths(v, p + "/" + i)));
  } else {
    out[p] = d;
  }
  return out;
}

function setPath(root, pathStr, value) {
  const parts = pathStr.replace(/^\//, "").split("/");
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    node = /^\d+$/.test(seg) ? node[Number(seg)] : node[seg];
  }
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) node[Number(last)] = value;
  else node[last] = value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const en = JSON.parse(fs.readFileSync(path.join(D, "en.json"), "utf8"));
  const E = flatPaths(en);
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};

  for (const tgt of ["ja", "ar"]) {
    const fp = path.join(D, tgt + ".json");
    const d = JSON.parse(fs.readFileSync(fp, "utf8"));
    const F = flatPaths(d);
    const todo = Object.keys(E).filter(
      (k) => k in F && typeof F[k] === "string" && typeof E[k] === "string" &&
        E[k].length > 2 && F[k] === E[k]
    );
    console.log(`=== ${tgt}: 待翻译 ${todo.length} 条 ===`);

    let done = 0;
    for (const k of todo) {
      const key = tgt + "||" + E[k];
      if (key in cache) { setPath(d, k, cache[key]); done++; continue; }
      try {
        let out = mask(E[k]).length <= 430
          ? unmask(await mm(mask(E[k]), tgt))
          : unmask(await mm(mask(E[k]).slice(0, 430), tgt));
        setPath(d, k, out);
        cache[key] = out;
        done++;
      } catch (e) {
        if (/quota|429/i.test(String(e))) {
          console.log("  配额用尽，停止。已保存 " + done + " 条，稍后重跑续传。");
          break;
        }
      }
      await sleep(350);
      if (done % 40 === 0) {
        fs.writeFileSync(fp, JSON.stringify(d, null, 2));
        fs.writeFileSync(CACHE, JSON.stringify(cache));
        console.log(`  进度 ${done}/${todo.length}`);
      }
    }
    fs.writeFileSync(fp, JSON.stringify(d, null, 2));
    fs.writeFileSync(CACHE, JSON.stringify(cache));
    console.log(`  ${tgt} 本轮完成 ${done} 条`);
  }
  console.log("DONE");
})();
