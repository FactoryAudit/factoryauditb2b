// 只读：从 Resend 批量取入驻申请邮件正文，定位目标工厂
// 用途：确认"工厂填的完整信息是否还在邮件里"，为档案补数提供事实依据
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const KEY = env.MAIL_HTTP_KEY;

const IDS = [
  "08e271d6-8ef4-4579-b9af-079f4ca2f7e8",
  "10629671-7b37-46b8-8786-738f75d29094",
  "91b9d8d5-6aa4-4aa2-8b8c-bedbd7bf0bcb",
  "ed83e73e-daab-4ad6-acfb-0fc9e138400b",
  "224881cc-2c8a-4d16-93e0-10ce0d135ca5",
  "19882dc5-8e34-49b2-b212-611d6629e58c",
  "fbda0098-65ea-4e42-9b71-bf5f9401957d",
  "809a8fb7-f258-4493-bfdd-5a4c8c71f020",
  "b06f128f-b048-4216-900d-8bdbe241bd61",
  "03031abe-9e5c-4f0b-abe1-52cb0b4e665f",
  "7469172a-00b5-4e7a-b22b-9092ec108f8b",
  "350b87dc-c618-48b3-8e2d-68b87e453828",
  "f36a57ce-fe3e-40be-87ba-ad6bd22edd74",
];

const pick = (body, label) => (body.match(new RegExp(label + ":\\s*(.*)")) || [])[1]?.trim() || "";

const run = async () => {
  const out = [];
  for (const id of IDS) {
    const r = await fetch("https://api.resend.com/emails/" + id, {
      headers: { authorization: "Bearer " + KEY },
    });
    const j = await r.json();
    const body = String(j.text || "");
    const rec = {
      id,
      name: pick(body, "Company Name"),
      city: pick(body, "City"),
      email: pick(body, "Email"),
      website: pick(body, "Website"),
      regno: pick(body, "Registration Number"),
      body,
    };
    out.push(rec);
    console.log(
      [rec.name || "(空)", rec.city, rec.email, "| " + String(j.subject).slice(-36)].join(" | ")
    );
    await new Promise((x) => setTimeout(x, 250));
  }

  mkdirSync(".workbuddy/artifacts", { recursive: true });
  writeFileSync(
    ".workbuddy/artifacts/applications-dump.txt",
    out.map((o) => "===== " + o.id + " =====\n" + o.body).join("\n\n"),
    "utf8"
  );
  console.log("\n已存 .workbuddy/artifacts/applications-dump.txt");

  const hit = out.filter((o) => /太阳|LIAN YI|chainkwo|sunny/i.test(o.body));
  console.log("命中广州太阳食品的邮件数：" + hit.length);
  for (const h of hit) console.log("  -> " + h.id + " | " + h.name);
};

run().catch((e) => console.log("ERR " + e.message));
