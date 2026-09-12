// 批量把真实申请建入 suppliers（默认 is_published=false + verification_level=unverified）
// 不自动验证、不建证据、不动信任字段。
// 用法: node --env-file=.env scripts/cs07-batch-create-applicants.mjs
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SVC) { console.error("缺少环境变量"); process.exit(1); }

const hdrs = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// 来源标记（可空列，用于后台溯源；不污染信任字段）
const SRC = { source_type: "supplier_application", source_name: "Resend inbox 2026-09" };

// 5 家真实申请（排除已存在的 nanjing-mxcomm）
const payloads = [
  {
    slug: "guangzhou-sunny-food",
    legal_name: "Guangzhou Sunny Food Co., Ltd.",
    display_name: "LIAN YI GROUP / 广州太阳食品",
    country_code: "china",
    city: "Guangzhou",
    industry_code: "food",
    business_type: "Manufacturer",
    main_products: ["Soy Sauce", "Vinegar", "Chili Sauce"],
    export_markets: [],
    certifications: [],
    is_published: false,
    verification_level: "unverified",
    ...SRC,
  },
  {
    slug: "xiamen-jings-eyewear",
    legal_name: "Xiamen Jings Eyewear Co., Ltd.",
    display_name: "厦门镜雅光学",
    country_code: "china",
    city: "Xiamen",
    industry_code: "eyewear",
    business_type: "Manufacturer",
    main_products: ["Optical Frames", "Sunglasses"],
    export_markets: [],
    certifications: [],
    registration_number: "91350206302967241N",
    is_published: false,
    verification_level: "unverified",
    ...SRC,
  },
  {
    slug: "shenzhen-jorigin-packaging",
    legal_name: "J-Origin Packaging Co., Ltd.",
    display_name: "深圳嘉源美包装",
    country_code: "china",
    city: "Shenzhen",
    industry_code: "packaging",
    business_type: "Manufacturer",
    main_products: ["Packaging", "Custom Boxes"],
    export_markets: [],
    certifications: [],
    is_published: false,
    verification_level: "unverified",
    ...SRC,
  },
  {
    slug: "shandong-loyal-industrial",
    legal_name: "Shandong Loyal Industrial Co., Ltd.",
    country_code: "china",
    city: "Shandong",
    industry_code: "machinery",
    business_type: "Manufacturer",
    main_products: ["Industrial Equipment"],
    export_markets: [],
    certifications: [],
    is_published: false,
    verification_level: "unverified",
    ...SRC,
  },
  {
    slug: "jiangsu-liquid-damper",
    legal_name: "Jiangsu Liquid Damper Machinery Technology Co., Ltd.",
    country_code: "china",
    city: "Jiangsu",
    industry_code: "machinery",
    business_type: "Manufacturer",
    main_products: ["Liquid Damper", "Vibration Control Machinery"],
    export_markets: [],
    certifications: [],
    is_published: false,
    verification_level: "unverified",
    ...SRC,
  },
];

// 前置校验：现有 slug 不得冲突
const before = await fetch(`${URL}/rest/v1/suppliers?select=slug&limit=100`, { headers: hdrs });
const existing = (await before.json()).map((r) => r.slug);
const clashes = payloads.filter((p) => existing.includes(p.slug));
if (clashes.length) {
  console.error("slug 冲突，中止：", clashes.map((c) => c.slug));
  process.exit(1);
}
console.log(`现有 suppliers: ${existing.length} 行；待插入: ${payloads.length} 行（无冲突）\n`);

let ok = 0, fail = 0;
for (const p of payloads) {
  try {
    const res = await fetch(`${URL}/rest/v1/suppliers`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify(p),
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`✗ ${p.slug} -> HTTP ${res.status}: ${text}`);
      fail++;
      continue;
    }
    const row = JSON.parse(text)[0];
    console.log(`✓ ${p.slug} -> id=${row.id} published=${row.is_published} vlevel=${row.verification_level}`);
    ok++;
  } catch (e) {
    console.log(`✗ ${p.slug} -> 异常: ${e.message}`);
    fail++;
  }
}

// 验证：插入后行数
const after = await fetch(`${URL}/rest/v1/suppliers?select=count`, { headers: { ...hdrs, Prefer: "count=exact" } });
const afterCount = after.headers.get("content-range");
console.log(`\n结果: 成功 ${ok} / 失败 ${fail}`);
console.log("插入后 suppliers content-range:", afterCount);

// 列出全部（确认新行都在，且都是 unpublished+unverified）
const all = await fetch(`${URL}/rest/v1/suppliers?select=slug,legal_name,is_published,verification_level&order=slug`, { headers: hdrs });
console.log("\n当前全部 suppliers:");
for (const r of await all.json()) console.log(`  ${r.slug} | ${r.legal_name} | published=${r.is_published} | vlevel=${r.verification_level}`);
