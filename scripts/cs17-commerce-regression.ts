// scripts/cs17-commerce-regression.ts
//
// CS-17（Commerce V1：可收款的服务订单闭环）交付回归。
//
// 跑法（DB 段可选；不带 .env 则 E 段自动 SKIP，其余照跑）：
//   node scripts/run-regression.mjs .env cs17-commerce-regression CS17_ROOT
//
// 分层：
//   A 冻结层：en 字典叶子数 + 五处断言同源（2939）
//   B 价目表：服务端单一事实源（金额/数量/缺失≠0）
//   C 源码安全：前端不可传金额 + 状态机不可逆向 + 订单页不泄漏
//   D 迁移层：supabase/cs17 两张脚本的结构（表/CHECK/RLS/授权）
//   E 数据层（可选）：真实建单 → 状态流转 → 清理（含 E2E 端到端）
//
// ⚠️ 不得使用 top-level await：通用运行器打成 cjs。整段包在 async IIFE 内。

import fs from "node:fs";
import path from "node:path";

const ROOT = (process.env.CS17_ROOT ?? process.cwd()).replace(/\\/g, "/");

try {
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore */
}

let pass = 0;
let fail = 0;
let skip = 0;

function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? "  :: " + extra : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? "  :: " + extra : ""}`);
  }
}
function skipped(name: string, why: string) {
  skip++;
  console.log(`  SKIP  ${name}  :: ${why}`);
}
function section(t: string) {
  console.log("\n=== " + t + " ===");
}
function read(p: string): string {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}
function has(p: string, sub: string): boolean {
  return read(p).includes(sub);
}
function countLeaves(obj: unknown): number {
  if (obj === null || typeof obj !== "object") return 1;
  if (Array.isArray(obj)) return obj.reduce<number>((a, x) => a + countLeaves(x), 0);
  return Object.values(obj as Record<string, unknown>).reduce<number>(
    (a, x) => a + countLeaves(x),
    0
  );
}
function flattenKeys(obj: unknown, prefix = ""): Record<string, true> {
  const out: Record<string, true> = {};
  if (obj === null || typeof obj !== "object") {
    out[prefix] = true;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => Object.assign(out, flattenKeys(v, `${prefix}[${i}]`)));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    Object.assign(out, flattenKeys(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

/** 剥注释：先块注释、再行注释（(^|[^:]) 防切 https://） */
// 统一口径：见 scripts/stripComments.ts。
// 🔴 曾经这里各写一份「先块注释、再行注释」的两段正则 —— 当被扫文件的行注释里含 `/*`
//    （如 AccountMenu.tsx 的 `// /api/auth/*`），它会吞掉后面整段真实代码，
//    导致正向断言假 FAIL、反向断言假 PASS。
import { stripComments } from "./stripComments";
const EN_LEAF = 2939;

(async () => {
  // =========================================================================
  section("A. 冻结层：en 字典叶子数 + 五处断言同源");
  // =========================================================================
  {
    const en = JSON.parse(read("i18n/dictionaries/en.json"));
    check("A1 en 字典叶子数 = 2939", countLeaves(en) === EN_LEAF, `实际 ${countLeaves(en)}`);
    check("A2 cs06a C8 常量 = 2939", has("scripts/cs06a-directory-regression.ts", "baseKeys.length === 2939"));
    check("A3 cs08 G4 常量 = 2939", has("scripts/cs08-form-regression.ts", "leafCounts[0] === 2939"));
    check("A4 cs12 E4 常量 = 2939", has("scripts/cs12-profile-regression.ts", "enLeaf === 2939"));
    check("A5 cs13 F1i 常量 = 2939", has("scripts/cs13-supplier-seo-regression.ts", "EN_LEAF_COUNT = 2939"));
    check(
      "A6 verify-opennext-bundle 常量 = 2939",
      has("scripts/verify-opennext-bundle.mjs", "cnt !== 2939") &&
        has("scripts/verify-opennext-bundle.mjs", "(期望 2939)")
    );
    const locales = ["zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
    const enKeys = JSON.stringify(Object.keys(flattenKeys(en)).sort());
    for (const loc of locales) {
      const o = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
      check(
        `A7 ${loc}.json 键集与 en 一致`,
        JSON.stringify(Object.keys(flattenKeys(o)).sort()) === enKeys
      );
    }
    // 新增命名空间必须存在（防只改了叶子数忘了加结构）
    check("A8 en 有 checkout 命名空间", typeof en.checkout === "object" && en.checkout !== null);
    check("A9 en 有 order 命名空间", typeof en.order === "object" && en.order !== null);
    check(
      "A10 en 有 admin.orders 命名空间",
      typeof en.admin?.orders === "object" && en.admin.orders !== null
    );
  }

  // =========================================================================
  section("B. 价目表：服务端单一事实源（缺失 ≠ 0）");
  // =========================================================================
  {
    const { SERVICE_CATALOG, priceOrder, formatUsdMinor, canTransition, normalizeQuantity } =
      await import("../lib/commerce");

    check("B1 价目表 6 项", SERVICE_CATALOG.length === 6, `实际 ${SERVICE_CATALOG.length}`);

    // 断言里按 code 取项：这些 code 一定在价目表里，取不到本身就是回归失败。
    // 用 as 断言而不是 ?.—— 让"项不存在"以"值为 undefined"的形式暴露，而不是编译期被静默跳过。
    type ServiceItemT = (typeof SERVICE_CATALOG)[number];
    const bycode = (c: string) => SERVICE_CATALOG.find((s) => s.code === c) as ServiceItemT;
    check("B2 基础核验报告 = USD 99.00", bycode("verification_basic")?.unitAmountMinor === 9900);
    check("B3 专业尽调报告 = USD 129.00", bycode("verification_pro")?.unitAmountMinor === 12900);
    check("B4 现场验厂 = USD 399.00 / man-day", bycode("factory_audit")?.unitAmountMinor === 39900);
    check("B5 验货 = USD 199.00 / man-day", bycode("inspection")?.unitAmountMinor === 19900);
    check("B6 监控与定制 = 待报价（null，绝不是 0）", bycode("monitoring")?.unitAmountMinor === null && bycode("custom")?.unitAmountMinor === null);

    // 数量归一
    check("B7 不可计数服务数量恒为 1", priceOrder(bycode("verification_basic"), 99).quantity === 1);
    check("B8 可计数服务按 man-day 计价", priceOrder(bycode("factory_audit"), 3).amountMinor === 39900 * 3);
    check("B9 数量越界夹取到 30", normalizeQuantity(bycode("factory_audit"), 999) === 30);
    check("B10 数量非法夹取到 1", normalizeQuantity(bycode("factory_audit"), "abc") === 1);

    // 缺失 ≠ 0
    check("B11 待报价金额 amountMinor 为 null", priceOrder(bycode("monitoring"), 1).amountMinor === null);
    check("B12 formatUsdMinor(null) 返回 null", formatUsdMinor(null) === null);
    check("B13 formatUsdMinor(39900) = 'USD 399'", formatUsdMinor(39900) === "USD 399");

    // 状态机
    check("B14 pending_payment → paid 允许", canTransition("pending_payment", "paid"));
    check("B15 paid → pending_payment 禁止（防把已付款退回未付）", !canTransition("paid", "pending_payment"));
    check("B16 cancelled 是终态", !canTransition("cancelled", "paid"));
  }

  // =========================================================================
  section("C. 源码安全：客户端改不了金额");
  // =========================================================================
  {
    const api = stripComments(read("app/api/orders/route.ts"));
    check("C1 下单 API 不读取 body.amount", !/\bbody\.(amount|amountMinor|amountUsd)\b/.test(api));
    check("C2 金额只来自 priceOrder()", api.includes("priceOrder(item, body.quantity)"));
    check("C3 先落库再补收款链接（custom_id 才能带订单号）", api.indexOf("createOrder(") < api.indexOf("createOrderCheckout("));

    const form = stripComments(read("components/OrderForm.tsx"));
    // 只扫**实际请求体**，不扫整个文件：
    // 表单 props 里有 amountText 字段（用于下拉展示价格），扫全文会稳定误报。
    const bodyBlock = form.match(/JSON\.stringify\(\{([\s\S]*?)\}\),\s*cache/);
    check(
      "C4 下单请求体不含任何金额字段",
      bodyBlock !== null && !/amount/i.test(bodyBlock[1]),
      bodyBlock ? "" : "未找到请求体"
    );
    check("C5 下单表单只发 serviceCode/quantity", form.includes("serviceCode") && form.includes("quantity:"));

    const checkoutPage = stripComments(read("app/[locale]/checkout/[ref]/page.tsx"));
    check("C6 订单页 noindex", checkoutPage.includes("index: false"));
    check("C7 订单页不渲染列表（只渲染单条订单）", !checkoutPage.includes("listOrders"));
    check("C8 订单页金额缺失时显示 quoted", checkoutPage.includes("amountText ?? c.quoted"));

    const adminApi = stripComments(read("app/api/admin/orders/[ref]/route.ts"));
    check("C9 后台状态 API 自己调 requireAdmin()", adminApi.includes("requireAdmin()"));
    check("C10 后台状态 API 走 setOrderStatus（状态机唯一实现）", adminApi.includes("setOrderStatus("));
  }

  // =========================================================================
  section("D. 迁移层：supabase/cs17");
  // =========================================================================
  {
    const mig = read("supabase/cs17/02_migration.sql");
    check("D1 建 orders 表", /CREATE TABLE IF NOT EXISTS public\.orders/.test(mig));
    check("D2 reference_id UNIQUE", mig.includes("reference_id    text        NOT NULL UNIQUE"));
    check("D3 status CHECK 四态", mig.includes("'pending_payment', 'paid', 'cancelled', 'refunded'"));
    check("D4 amount_minor CHECK 允许 NULL 且非 0", mig.includes("CHECK (amount_minor IS NULL OR amount_minor > 0)"));
    check("D5 开启 RLS", mig.includes("ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY"));
    check("D6 REVOKE ALL FROM anon", mig.includes("REVOKE ALL ON public.orders FROM anon"));
    check("D7 REVOKE ALL FROM authenticated（订单含 PII，不给任何已登录用户读）", mig.includes("REVOKE ALL ON public.orders FROM authenticated"));
    check("D8 NOTIFY pgrst reload", mig.includes("NOTIFY pgrst, 'reload schema'"));

    const mig2 = read("supabase/cs17/03_add_pay_url.sql");
    check("D9 pay_url 列独立成列（不塞 payload）", mig2.includes("ADD COLUMN IF NOT EXISTS pay_url text"));
  }

  // =========================================================================
  section("E. 数据层（真实建单 → 状态流转 → 清理）");
  // =========================================================================
  {
    const { createAdminClient } = await import("../lib/supabaseAdmin");
    const db = createAdminClient();
    if (!db) {
      skipped("E* 全部 DB 断言", "无 service_role（未注入 .env）");
    } else {
      const { createOrder, getOrderByRef, setOrderStatus, listOrders } = await import(
        "../lib/orders"
      );

      // E1 建单（有金额）
      const r1 = await createOrder({
        serviceCode: "verification_basic",
        serviceName: "CS-17 regression probe",
        quantity: 1,
        amountMinor: 9900,
        email: "cs17-probe@example.com",
        locale: "en",
        sourcePath: "/cs17-regression",
      });
      check("E1 建单成功", r1.stored === true, r1.stored ? String(r1.referenceId) : r1.reason);

      if (!r1.stored) {
        skipped("E2–E8", "建单失败，后续依赖订单号");
      } else {
        const ref = r1.referenceId;
        check("E2 订单号形如 ORD-XXXXXX", /^ORD-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(ref), ref);

        const row = await getOrderByRef(ref);
        check("E3 可按订单号读回", row !== null);
        check("E4 金额落库正确（9900 美分）", row?.amount_minor === 9900, `实际 ${row?.amount_minor}`);
        check("E5 初始状态 = pending_payment", row?.status === "pending_payment");
        check("E6 未配置渠道时 provider 为 null", row?.provider === null);

        // E7 状态流转
        const paid = await setOrderStatus(ref, "paid");
        check("E7 pending_payment → paid 成功", paid.ok === true, paid.ok ? "" : paid.reason);
        const afterPaid = await getOrderByRef(ref);
        check("E8 paid_at 已写入（已收款是事实，退款也不抹掉）", Boolean(afterPaid?.paid_at));

        // E9 反向流转被拒
        const back = await setOrderStatus(ref, "pending_payment");
        check("E9 paid → pending_payment 被状态机拒绝", back.ok === false && back.reason === "invalid_transition");

        // E10 待报价订单
        const r2 = await createOrder({
          serviceCode: "monitoring",
          serviceName: "CS-17 regression probe (quoted)",
          quantity: 1,
          amountMinor: null,
          email: "cs17-probe@example.com",
          locale: "en",
        });
        check("E10 待报价订单建单成功", r2.stored === true);
        if (r2.stored) {
          const q = await getOrderByRef(r2.referenceId);
          check("E11 待报价订单 amount_minor 为 NULL（不是 0）", q?.amount_minor === null && q?.amount_minor !== 0);
        }

        // E12 列表可查
        const rows = await listOrders({ search: "cs17-probe" });
        const found = rows.filter((x) => x.email === "cs17-probe@example.com").length;
        check("E12 后台列表可按邮箱检索到探针订单", found >= 1, `实际 ${found}`);

        // 清理探针数据（这些订单是本脚本自己建的）
        const refs = [ref, r2.stored ? r2.referenceId : null].filter(Boolean) as string[];
        const { error: delErr } = await db.from("orders").delete().in("reference_id", refs);
        check("E13 探针订单已清理", !delErr, delErr?.message ?? "");
        const left = await getOrderByRef(ref);
        check("E14 清理后按号查不到", left === null);
      }
    }
  }

  console.log(`\n[cs17] PASS=${pass} FAIL=${fail} SKIP=${skip}`);
  if (fail > 0) process.exitCode = 1;
})();
