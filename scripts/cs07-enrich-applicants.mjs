// 补全 5 家真实申请的供应商资料（仅描述性字段，不动任何信任字段）
// 保持 is_published=false，待用户确认后再发布。
// 用法: node --env-file=.env scripts/cs07-enrich-applicants.mjs
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !SVC) { console.error("缺少环境变量"); process.exit(1); }
const hdrs = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// 仅描述性字段；信任字段一律不出现在 body 里（保持 null/[]/unverified）
const patch = {
  "guangzhou-sunny-food": {
    legal_name: "Guangzhou Sunny Food Co., Ltd.",
    display_name: "LIAN YI GROUP / 广州太阳食品",
    city: "Guangzhou",
    industry_code: "food-beverage",
    main_products: ["Soy Sauce", "Rice Vinegar", "Chili Sauce", "Condiments"],
    employees: "101-500",
    website: "https://www.chainkwo.com",
    phone: "13632358041",
  },
  "xiamen-jings-eyewear": {
    display_name: "厦门镜雅光学",
    city: "Xiamen",
    industry_code: "eyewear",
    main_products: ["Optical Frames", "Sunglasses", "Reading Glasses", "Prescription Eyewear", "OEM/ODM Eyewear"],
    website: "https://www.jingseyewear.com",
    phone: "+8618959231841",
    registration_number: "91350206302967241N",
  },
  "shenzhen-jorigin-packaging": {
    legal_name: "Shenzhen Jiayuanmei Packaging Materials Co., Ltd.",
    display_name: "J-Origin Packaging / 深圳嘉源美包装",
    city: "Shenzhen",
    industry_code: "packaging",
    main_products: ["Poly Mailers", "Kraft Paper Bags", "Garbage Bags", "Ziplock Bags", "Flexible Packaging"],
    website: "https://www.joriginpackaging.com",
  },
  "shandong-loyal-industrial": {
    city: "Jinan",
    industry_code: "machinery",
    main_products: ["Food Processing Machinery", "Snack Food Extrusion Lines", "Industrial Microwave Drying Equipment", "Corn Flakes Lines", "Pet Food Lines", "Pasta and Macaroni Lines", "Biscuit Production Lines", "Frying Equipment", "Mesh Belt Dryers"],
    employees: "501-1000",
    website: "https://loyal-machine.com",
    phone: "+86 132 5667 4591",
  },
  "jiangsu-liquid-damper": {
    city: "Jiangsu",
    industry_code: "machinery",
    main_products: ["Industrial Hydraulic Shock Absorbers", "Heavy-duty Buffers", "Wire Rope Vibration Isolators", "Rubber Vibration Isolators"],
    website: "https://www.vibroabsorber.com",
  },
};

let ok = 0, fail = 0;
for (const [slug, body] of Object.entries(patch)) {
  try {
    const res = await fetch(`${BASE}/rest/v1/suppliers?slug=eq.${slug}`, {
      method: "PATCH",
      headers: hdrs,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) { console.log(`✗ ${slug} -> HTTP ${res.status}: ${text}`); fail++; continue; }
    const row = JSON.parse(text)[0];
    console.log(`✓ ${slug} -> city=${row.city} industry=${row.industry_code} products=${row.main_products?.length} website=${row.website ?? "-"} published=${row.is_published}`);
    ok++;
  } catch (e) { console.log(`✗ ${slug} -> 异常: ${e.message}`); fail++; }
}
console.log(`\n补全结果: 成功 ${ok} / 失败 ${fail}（is_published 保持 false，待确认后发布）`);
