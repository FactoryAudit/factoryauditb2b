const TIMEOUT = 8000;
async function get(u) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    const body = await r.text();
    return { code: r.status, len: body.length };
  } catch (e) {
    return { code: 0, err: e.name + ":" + e.message };
  } finally {
    clearTimeout(t);
  }
}
(async () => {
  console.log("example.com ->", JSON.stringify(await get("https://example.com")));
  console.log("factoryauditb2b.com ->", JSON.stringify(await get("https://factoryauditb2b.com")));
  console.log("workers.dev ->", JSON.stringify(await get("https://factoryauditb2b.factoryauditb2b.workers.dev")));
})();
