// 探针：看清 /en/industrial-clusters 的跳转链
const BASE = process.argv[2] || "https://factoryauditb2b.com";
const path = process.argv[3] || "/en/industrial-clusters";
const r1 = await fetch(BASE + path, { redirect: "manual", headers: { "user-agent": "probe" } });
console.log("status=", r1.status);
console.log("location=", r1.headers.get("location"));
console.log("server=", r1.headers.get("server"));
console.log("cf-ray=", r1.headers.get("cf-ray"));
const r2 = await fetch(BASE + path, { redirect: "follow", headers: { "user-agent": "probe" } });
console.log("final status=", r2.status, "final url=", r2.url);
const t = await r2.text();
console.log("len=", t.length);
console.log("title=", (t.match(/<title>(.*?)<\/title>/s) || [])[1]);
