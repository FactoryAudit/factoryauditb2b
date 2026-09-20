import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("step12-dump.json", "utf8"));
console.log("=== RFQS ===");
for (const r of d.rfqs || []) {
  console.log(
    r.reference_id, "|", String(r.product).slice(0, 40),
    "|pub=" + r.is_public, "|status=" + r.status,
    "|st=" + r.source_type, "|sp=" + r.source_path, "|ind=" + r.industry_code
  );
}
console.log("=== rfq_matches schema ===");
console.log(JSON.stringify(d.rfqMatchesSchema));
console.log("=== rfq_matches count ===", JSON.stringify(d.rfqMatchesCount));
