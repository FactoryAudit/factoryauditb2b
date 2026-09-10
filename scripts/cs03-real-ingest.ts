import { createAdminClient } from "@/lib/supabaseAdmin";
import { validateSupplierCreateInput } from "@/lib/supplierCreate";
import { createAdminSupplier, logAdminAction } from "@/lib/adminData";

// 正式摄入（走 CS-03 创建路径：validateSupplierCreateInput → createAdminSupplier）
// 原公开注册的临时 tracking UUID 只进 audit metadata，绝不当作 suppliers.id。
const TRACKING_ID = "3c5b757b-dba6-4e70-9f8e-566f1befe3a0";
const ADMIN_EMAIL = "cn18588770248@gmail.com";

async function main() {
  const db = createAdminClient();
  if (!db) { console.error("no db"); process.exit(1); }

  // 解析 actor（真实 admin 身份，用于审计日志）
  const { data: profs } = await db.from("profiles").select("id, email, role");
  const list = (profs ?? []) as Array<{ id: string; email: string | null; role: string | null }>;
  console.log("=== profiles ===");
  console.log(JSON.stringify(list, null, 2));
  const prof = list.find((p) => (p.email ?? "").toLowerCase() === ADMIN_EMAIL);
  if (!prof) {
    console.error(`ADMIN PROFILE NOT FOUND for ${ADMIN_EMAIL} — abort before create`);
    process.exit(2);
  }
  const ctx = { userId: prof.id, email: prof.email };

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
  if (!v.ok) { console.error("VALIDATION FAIL", JSON.stringify(v)); process.exit(1); }
  const input = v.value;

  const res = await createAdminSupplier(ctx, input);
  console.log("=== create result ===");
  console.log(JSON.stringify(res, null, 2));
  if (!res.ok) process.exit(1);

  // 补充审计：原始 registration tracking id + source metadata
  await logAdminAction(ctx, "supplier.source_metadata", "supplier", res.id, {
    registration_tracking_id: TRACKING_ID,
    source_type: input.source_type,
    source_name: input.source_name,
    source_url: input.source_url,
    note: "original public registration tracking uuid; NOT a suppliers.id",
  });

  console.log("=== RESULT ===");
  console.log("CREATED_ID=" + res.id);
  console.log("CREATED_SLUG=" + res.slug);
  console.log("CERT_INSERTED=" + res.cert_inserted);
  console.log("TRACKING_ID=" + TRACKING_ID);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
