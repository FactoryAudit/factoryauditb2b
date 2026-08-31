// 域名解析体检：确认站点是否真的存在于公网（SEO 前提）
import dns from "node:dns";
import net from "node:net";

const resolver = new dns.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

const domains = process.argv.slice(2);
if (domains.length === 0) {
  console.error("用法: node scripts/dns-check.mjs <domain> [domain...]");
  process.exit(1);
}

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));

function resolve4(domain) {
  return new Promise((done) => {
    resolver.resolve4(domain, (err, addrs) => {
      done(err ? { ok: false, code: err.code, addrs: [] } : { ok: true, code: "", addrs });
    });
  });
}

for (const d of domains) {
  const r = await resolve4(d);
  const status = r.ok ? "OK" : "FAIL(" + r.code + ")";
  const ip = r.addrs.length ? r.addrs.join(", ") : "-";
  console.log(pad(d, 26) + pad(status, 14) + ip);
}
void net;
