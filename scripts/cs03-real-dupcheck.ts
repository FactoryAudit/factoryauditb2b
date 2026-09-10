import { createAdminClient } from "@/lib/supabaseAdmin";
import { validateSupplierCreateInput, normalizeName, domainOf } from "@/lib/supplierCreate";
import { findDuplicateSupplier } from "@/lib/adminData";

// 只读：重复检查（不创建）
const TRACKING_ID = "3c5b757b-dba6-4e70-9f8e-566f1befe3a0";

async function main() {
  const db = createAdminClient();
  if (!db) { console.error("no db"); process.exit(1); }

  const body = {
    slug: "nanjing-mxcomm",
    legal_name: "南京麦克森OE科技有限公司",
    country_code: "china",
    city: "Nanjing",
    business_type: "Manufacturer",
    display_name: "南京麦克森OE科技有限公司",
    website: "https://www.mxcomm.cn/",
    phone: "+86-25-86380932",
    source_url: "https://factoryauditb2b.com/en/join-supplier-network",
    source_type: "SUPPLIER_REGISTRATION",
    source_name: "Public Supplier Registration",
    main_products: ["工业无线接入点", "无线桥接器", "嵌入式Wi-Fi模块及板卡", "工业以太网交换机和串口设备服务器"],
    certificationClaims: [],
  };

  const v = validateSupplierCreateInput(body);
  if (!v.ok) { console.error("VALIDATION FAIL", v); process.exit(1); }
  const input = v.value;

  const { data: all } = await db
    .from("suppliers")
    .select("slug, website, legal_name, city, country_code, phone, address, registration_number");
  const rows = (all ?? []) as Array<Record<string, string | null>>;

  const normIn = normalizeName(input.legal_name);
  const domIn = domainOf(input.website);

  const checks = {
    slug: rows.filter((r) => r.slug === input.slug).map((r) => r.slug),
    website_domain: domIn
      ? rows.filter((r) => domainOf(r.website) === domIn).map((r) => r.slug)
      : "skipped (no website)",
    phone: input.phone ? rows.filter((r) => r.phone === input.phone).map((r) => r.slug) : "skipped (no phone)",
    legal_name: rows.filter((r) => normalizeName(r.legal_name ?? "") === normIn).map((r) => r.slug),
    country_city_name: rows
      .filter(
        (r) =>
          r.country_code === input.country_code &&
          (r.city ?? "").toLowerCase() === input.city.toLowerCase() &&
          normalizeName(r.legal_name ?? "").includes(normIn.slice(0, 4))
      )
      .map((r) => r.slug),
    address: input.address ? rows.filter((r) => r.address === input.address).map((r) => r.slug) : "skipped (no address)",
    registration_number: input.registration_number
      ? rows.filter((r) => r.registration_number === input.registration_number).map((r) => r.slug)
      : "skipped (no regno)",
  };

  const authoritative = await findDuplicateSupplier(input);

  console.log(
    JSON.stringify(
      {
        tracking_id: TRACKING_ID,
        normalized_input: input,
        total_suppliers: rows.length,
        per_dimension: checks,
        findDuplicateSupplier_result: authoritative, // null = 无重复
        verdict: authoritative ? "DUPLICATE — STOP" : "CLEAR — safe to create",
      },
      null,
      2
    )
  );
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
