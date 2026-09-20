import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("i18n/dictionaries/en.json", "utf8"));
let n = 0;
(function walk(o) {
  if (o === null || o === undefined) return;
  if (typeof o === "object" && !Array.isArray(o)) {
    for (const k of Object.keys(o)) walk(o[k]);
  } else {
    n++;
  }
})(d);
const labels = d?.rfq?.form?.labels;
const out = [];
out.push("en leaf count = " + n);
out.push("rfq.form.labels exists = " + Boolean(labels));
out.push("keys = " + (labels ? Object.keys(labels).join(",") : "-"));
out.push("has messageHint = " + Boolean(labels && labels.messageHint));
out.push("submit = " + (labels ? labels.submit : "-"));
console.log(out.join("\n"));
