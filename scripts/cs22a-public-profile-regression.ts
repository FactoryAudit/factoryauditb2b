// scripts/cs22a-public-profile-regression.ts
//
// CS-22 / CS-A（公开供应商档案页）交付回归。
//
// 跑法（DB 段可选；不带 .env 则 DB 段自动 SKIP，其余全部照跑）：
//   node scripts/run-regression.mjs cs22a-public-profile-regression CS22A_ROOT
//
// 分层：
//   A 冻结层：en 字典叶子数 + 五处断言同源（3114）
//   B P0-A 归属：唯一裁决层 + 旧的两处手写 email 比对已消失 + 不建 answers 表
//   C P0-B 数据模型：verification_items.assessment_id 已就位，无 supplier_assessment_answers
//   D P0-C 图片限额：5MB / 10MB / 20MB / 12 张 / 5 张每项 / 50 张 / 200MB / 800×600
//   E P0-D 公私分离：公开侧没有读取 original 的出口
//   F CS-A 页面：徽章 / 详情 / 历史 / 照片 / 分享 已接进 /suppliers/[slug]
//   G 数据层（可选）：真实 DB 不变量
//
// ⚠️ 不得使用 top-level await：通用运行器打成 cjs。整段包在 async IIFE 内。

import fs from "node:fs";
import path from "node:path";
// 项目铁律：剥注释只用 scripts/stripComments.ts（逐字符状态机 + SELFTEST），
// 禁用两段正则 —— 行注释里含块注释起始符时会把真实代码一起吞掉。
// 本回归所有"代码里不得出现 X"的断言都必须先剥注释，
// 否则会命中解释性注释里的字面量，产生假 FAIL。
import { stripComments } from "./stripComments";

const ROOT = (process.env.CS22A_ROOT ?? process.cwd()).replace(/\\/g, "/");

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
function exists(p: string): boolean {
  return fs.existsSync(path.join(ROOT, p));
}
function has(p: string, sub: string): boolean {
  return read(p).includes(sub);
}
/** 剥掉注释后的源码（用于"不得出现 X"类断言，避免命中注释里的字面量） */
function code(p: string): string {
  const src = read(p);
  // SQL 的注释是 `--`，stripComments 只处理 TS/JS —— 分开处理，别混
  if (p.endsWith(".sql")) {
    return src
      .split("\n")
      .filter((l) => !/^\s*--/.test(l))
      .join("\n");
  }
  return stripComments(src);
}
function countLeaves(obj: unknown): number {
  if (obj === null || typeof obj !== "object") return 1;
  if (Array.isArray(obj)) return obj.reduce<number>((a, x) => a + countLeaves(x), 0);
  return Object.values(obj as Record<string, unknown>).reduce<number>((a, x) => a + countLeaves(x), 0);
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

const EN_LEAF = 3114;

(async () => {
  // =========================================================================
  section("A. 冻结层：en 字典叶子数 + 断言同源");
  // =========================================================================
  {
    const en = JSON.parse(read("i18n/dictionaries/en.json"));
    check("A1 en 字典叶子数 = 3114", countLeaves(en) === EN_LEAF, `实际 ${countLeaves(en)}`);
    check("A2 cs06a C8 常量 = 3114", has("scripts/cs06a-directory-regression.ts", "baseKeys.length === 3114"));
    check("A3 cs08 G4 常量 = 3114", has("scripts/cs08-form-regression.ts", "leafCounts[0] === 3114"));
    check("A4 cs12 E4 常量 = 3114", has("scripts/cs12-profile-regression.ts", "enLeaf === 3114"));
    check("A5 cs16 A1 常量 = 3114", has("scripts/cs16-supplier-mgmt-regression.ts", "=== 3114"));
    check("A6 verify-opennext-bundle 常量 = 3114", has("scripts/verify-opennext-bundle.mjs", "3114"));
    const locales = ["zh", "zh-TW", "ja", "es", "de", "fr", "pt", "ar"];
    const enKeys = JSON.stringify(Object.keys(flattenKeys(en)).sort());
    for (const loc of locales) {
      const o = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
      check(
        `A7 ${loc}.json 键集与 en 一致`,
        JSON.stringify(Object.keys(flattenKeys(o)).sort()) === enKeys
      );
    }
    // trustProfile 命名空间：30 键 × 9 语，且无空串（禁占位机器翻译）
    for (const loc of ["en", ...locales]) {
      const d = JSON.parse(read(`i18n/dictionaries/${loc}.json`));
      const tp = d.trustProfile ?? {};
      const keys = Object.keys(tp);
      const empty = keys.filter((k) => typeof tp[k] !== "string" || tp[k].trim() === "");
      check(`A8 ${loc}.trustProfile = 30 键且无空值`, keys.length === 30 && empty.length === 0,
        `键 ${keys.length} / 空 ${empty.length}`);
    }
  }

  // =========================================================================
  section("B. P0-A 供应商归属：唯一服务端裁决层");
  // =========================================================================
  {
    check("B1 lib/supplierAccess.ts 存在", exists("lib/supplierAccess.ts"));
    const sa = read("lib/supplierAccess.ts");
    check("B2 优先取服务端会话身份", sa.includes("getCurrentUser"));
    check("B3 客户端 supplierId 只做一致性校验", sa.includes("claimedSupplierId"));
    check("B4 归属歧义时拒绝（不自选一家）", sa.includes("ambiguous_ownership"));
    check("B5 声明与裁决不一致即 403", sa.includes("ownership_mismatch"));

    // 旧的手写 email 比对必须从数据层消失（否则两套口径）
    const sa2 = read("lib/supplierAssessments.ts");
    check("B6 自评估不再手写 email 比对", !sa2.includes("supEmail !== givenEmail"));
    check("B7 自评估改走统一裁决层", sa2.includes("resolveSupplierAccess"));
    check("B8 写入用裁决后的 supplierId", sa2.includes("supplier_id: supplierId"));

    // 公开页不得把内部 UUID 写进分享链接
    check("B9 分享接口只回 token + slug 路径",
      has("app/api/supplier-share/route.ts", "sharePath") &&
      !has("app/api/supplier-share/route.ts", "supplierId"));
  }

  // =========================================================================
  section("C. P0-B 评估数据模型：复用 responses_json，不建 answers 表");
  // =========================================================================
  {
    const repoFiles: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        const rel = `${dir}/${f}`;
        const st = fs.statSync(path.join(ROOT, rel));
        if (st.isDirectory()) {
          if (!["node_modules", ".git", ".next", ".open-next", ".wrangler", "scripts"].includes(f)) walk(rel);
        } else if (/\.(ts|tsx|sql)$/.test(f)) repoFiles.push(rel);
      }
    };
    walk("lib");
    walk("app");
    walk("components");
    walk("supabase");
    // 剥注释后再查：注释里"我们不建 X 表"是说明，不是引用
    const answersRefs = repoFiles.filter((p) => /supplier_assessment_answers/i.test(code(p)));
    check("C1 全仓代码无 supplier_assessment_answers 表引用", answersRefs.length === 0, answersRefs.join(","));

    check("C2 迁移 03 给 verification_items 加 assessment_id",
      has("supabase/cs22/03_verification_items_assessment.sql", "ADD COLUMN IF NOT EXISTS assessment_id"));
    check("C3 验证项沿用 item_key（question_code），不引入第二套 ID",
      has("supabase/cs22/03_verification_items_assessment.sql", "verification_record_id, item_key"));
    check("C4 迁移为纯增量（无 DROP / DELETE）",
      !/DROP TABLE|DELETE FROM/i.test(read("supabase/cs22/03_verification_items_assessment.sql")));
  }

  // =========================================================================
  section("D. P0-C 图片限额：展示图 5MB / 证据图 10MB / PDF 20MB");
  // =========================================================================
  {
    const si = read("lib/supplierImages.ts");
    check("D1 展示图 5MB", si.includes("MAX_PHOTO_BYTES = 5 * 1024 * 1024"));
    check("D2 证据图 10MB（未被统一成 5MB）", si.includes("MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024"));
    check("D3 PDF 20MB", si.includes("MAX_PDF_BYTES = 20 * 1024 * 1024"));
    check("D4 工厂展示图 12 张", read("lib/imageConstants.ts").includes("MAX_FACTORY_PHOTOS = 12"));
    check("D5 每个验证项 5 份证据", si.includes("MAX_EVIDENCE_PER_ITEM = 5"));
    check("D6 供应商总图 50 张", si.includes("MAX_TOTAL_IMAGES = 50"));
    check("D7 供应商总容量 200MB", si.includes("MAX_TOTAL_BYTES = 200 * 1024 * 1024"));
    check("D8 最低分辨率 800×600", si.includes("MIN_PHOTO_WIDTH = 800") && si.includes("MIN_PHOTO_HEIGHT = 600"));
    check("D9 12 张闸与 50 张闸分开计数", si.includes("factoryPhotoCount"));
    check("D10 5 份/项 与总量闸分开计数", si.includes("evidenceItemCount"));
    check("D11 配额统计同时覆盖展示图与证据图", si.includes("supplier_evidence"));
    check("D12 计数不用 head:true（历史铁律）", !si.includes("head: true"));
  }

  // =========================================================================
  section("E. P0-D 公私分离：公开侧拿不到 original");
  // =========================================================================
  {
    const route = code("app/api/supplier-image/[imageId]/route.ts");
    check("E1 variant 只允许 display/thumbnail", route.includes('new Set(["display", "thumbnail"])'));
    check("E2 代码里不存在 original 分支", !/original/i.test(route));
    const si = read("lib/supplierImages.ts");
    check("E3 公开读取层返回类型不含 original_path",
      !/original_path/.test(si.split("export type PublicFactoryImage")[1]?.split("};")[0] ?? ""));
    check("E4 公开读取强制 APPROVED + PUBLIC",
      si.includes('eq("status", "APPROVED")') && si.includes('eq("visibility", "PUBLIC")'));
    check("E5 档案撤下公开后图片立即失效", si.includes("isProfilePublic(flags)"));
    const page = read("app/[locale]/suppliers/[slug]/page.tsx");
    check("E6 页面图片 src 只走公开代理", page.includes("/api/supplier-image/${img.id}") || has("components/supplier/FactoryPhotoGallery.tsx", "/api/supplier-image/"));
    check("E7 画廊代码不引用 original", !/original/i.test(code("components/supplier/FactoryPhotoGallery.tsx")));
  }

  // =========================================================================
  section("F. CS-A 公开档案页：11 个区块");
  // =========================================================================
  {
    const page = read("app/[locale]/suppliers/[slug]/page.tsx");
    check("F1 复用了既有 /suppliers/[slug]（未新建重复路由）", exists("app/[locale]/suppliers/[slug]/page.tsx"));
    check("F2 未新建 /supplier/[slug] 重复页", !exists("app/[locale]/supplier/[slug]/page.tsx"));
    check("F3 徽章由服务端推导后传入", page.includes("getTrustSnapshot(s.id)"));
    check("F4 徽章组件渲染", page.includes("<VerificationBadge"));
    check("F5 验证详情 + 历史渲染", page.includes("<VerificationDetails"));
    check("F6 工厂照片渲染", page.includes("<FactoryPhotoGallery"));
    check("F7 分享 CTA 渲染", page.includes("<ShareProfileButton"));
    check("F8 浏览埋点已挂", page.includes("<ProfileViewTracker"));
    check("F9 非公开档案不渲染照片/分享", page.includes("profileIsPublic &&"));
    check("F10 noindex 叠加公开闸门", page.includes("isProfileNoindex(flags)"));
    check("F11 组件不自行判定 Verified",
      !/verified\s*===?\s*true/i.test(read("components/supplier/VerificationBadge.tsx")));
    check("F11b 徽章锚点指向详情区块",
      page.includes('"#verification-details"') && has("components/supplier/VerificationDetails.tsx", 'id="verification-details"'));

    const badge = read("components/supplier/VerificationBadge.tsx");
    check("F12 徽章三态 + EXPIRED 齐备",
      ["NONE", "SELF_ASSESSED", "ONLINE_VERIFIED", "ON_SITE_VERIFIED", "EXPIRED"].every((s) => badge.includes(s)));
    check("F13 颜色不是唯一识别（icon + 文字 + 颜色）",
      badge.includes("icon:") && badge.includes("aria-label"));
    check("F13b 有详情时徽章可点（渲染成链接）", badge.includes("href={href}"));

    const det = read("components/supplier/VerificationDetails.tsx");
    check("F14 详情含 Verification ID / 方式 / 范围 / 日期 / 状态",
      ["labelId", "labelMethod", "labelScope", "labelVerifiedAt", "labelExpiresAt", "labelStatus"].every((k) => det.includes(k)));
    check("F15 历史保留过期/撤销记录", det.includes("history.map"));

    const share = read("components/supplier/ShareProfileButton.tsx");
    check("F16 分享只发 slug、不带内部 ID", share.includes("JSON.stringify({ slug })"));
    check("F17 分享失败明确报出（不假装成功）", share.includes("shareFailed"));

    // 页面保持预渲染（不得引入 headers/cookies）。剥注释后再判 ——
    // 页头注释里正是在解释"为什么不能用 await headers()"。
    check("F18 页面未引入请求上下文（保持静态产物）",
      !/headers\(\)|cookies\(\)/.test(code("app/[locale]/suppliers/[slug]/page.tsx")));
  }

  // =========================================================================
  section("G. 数据层（可选）：真实 DB 不变量");
  // =========================================================================
  {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      skipped("G 段", "未配置 SUPABASE_SERVICE_ROLE_KEY，跳过 DB 段");
    } else {
      const q = async (sel: string) => {
        const r = await fetch(`${url}/rest/v1/${sel}`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        return r.ok ? ((await r.json()) as unknown[]) : null;
      };
      const rows = await q('suppliers?select=is_published,profile_status,public_profile_enabled&is_published=eq.true');
      if (!rows) {
        skipped("G1", "DB 不可达");
      } else {
        const bad = (rows as { profile_status?: string | null; public_profile_enabled?: boolean | null }[])
          .filter((r) => r.profile_status !== "public" || r.public_profile_enabled !== true);
        check(`G1 已发布供应商 profile_status='public'（共 ${rows.length} 家）`, bad.length === 0,
          `不合规 ${bad.length}`);
      }
      const vi = await q("verification_items?select=id&limit=1");
      check("G2 verification_items 可访问（assessment_id 已加列）", vi !== null);
    }
  }

  console.log(`\n---- CS-22A REGRESSION: PASS=${pass} FAIL=${fail} SKIP=${skip} ----`);
  if (fail > 0) process.exitCode = 1;
})();
