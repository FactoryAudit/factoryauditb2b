const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const slugs = ["guangzhou-sunny-food", "xiamen-jings-eyewear", "shenzhen-jorigin-packaging", "shandong-loyal-industrial", "jiangsu-liquid-damper"];
const trust = ["verification_status", "risk_score", "audit_status", "certifications", "inspection_history", "risk_breakdown", "is_published", "verification_level", "source_type"];
(async () => {
  for (const s of slugs) {
    const r = await fetch(`${BASE}/rest/v1/suppliers?select=*&slug=eq.${s}`, { headers: h });
    const row = (await r.json())[0];
    if (!row) { console.log(`✗ ${s} 未找到`); continue; }
    const t = trust.map((k) => `${k}=${JSON.stringify(row[k])}`).join("  ");
    console.log(`✓ ${s}\n   ${t}`);
  }
})();
