// scripts/cs05-access-regression.ts —— CS-05 Supplier Access V2 访问模型回归（只读，fail 时退出码 1）
//
// 守护三件事：
//   1) Guest / Free / Founder 的访问语义（含「Free = unlimited」）
//   2) /api/me 不再谎报 profilesRemaining: 5（旧实现会让客户端把游客额度误读成 Free 额度）
//   3) paid intelligence 四个字段在任何非 paid 档位都不可见（安全红线）
//
// 用法：
//   OUT="$LOCALAPPDATA/Temp/cs05-reg.cjs"
//   ./node_modules/.bin/esbuild scripts/cs05-access-regression.ts \
//     --bundle --platform=node --format=cjs --outfile="$OUT"
//   CS05_ROOT="F:/AI-验厂SEO网站" node "$OUT"
//
// ⚠️ Windows/Git Bash：CS05_ROOT 必须是 Windows 风格路径；别用 $PWD（会是 /f/... 形态）。

import * as fs from "node:fs";
import * as path from "node:path";
// 剥注释统一走共享实现（两段正则会在「行注释里含 /*」时吞掉真实代码，见该文件头注释）
import { stripComments, STRIP_COMMENTS_SELFTEST } from "./stripComments";
import {
  GUEST_PROFILE_LIMIT,
  COMPARE_MAX_SUPPLIERS,
  FREE_FIELDS,
  PAID_FIELDS,
} from "../lib/suppliers";
import {
  buildMeResponse,
  canAccess,
  visibleFieldsFor,
  guestProfileLimit,
  hasUnlimitedBasicAccess,
  basicAccessFor,
  withinGuestLimit,
} from "../lib/access";

const ROOT = process.env.CS05_ROOT
  ? path.resolve(process.env.CS05_ROOT)
  : process.cwd();

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

/** 读源码并**剥掉注释**再判定 —— 注释里提到某个名字不等于代码还在引用它。
 *  （这条经验来自 CS-05b：曾因安全注释必须点名 paid 字段而误报 FAIL。） */
function readModuleSource(rel: string): string {
  return fs
    .readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ---------------------------------------------------------------------------
section("1. 常量与命名（防止把 Guest limit 误当成 Free limit）");
// ---------------------------------------------------------------------------
{
  check("GUEST_PROFILE_LIMIT === 5", GUEST_PROFILE_LIMIT === 5, `实际 ${GUEST_PROFILE_LIMIT}`);
  check("guestProfileLimit() 与常量一致", guestProfileLimit() === GUEST_PROFILE_LIMIT);

  // 源码扫描：访问判定文件不得再引用 FREE_PROFILE_LIMIT
  const accessSrc = fs.readFileSync(path.join(ROOT, "lib", "access.ts"), "utf8");
  const unlockedSrc = fs.readFileSync(
    path.join(ROOT, "app", "api", "suppliers", "[slug]", "unlocked", "route.ts"),
    "utf8"
  );
  check(
    "lib/access.ts 不再引用 FREE_PROFILE_LIMIT",
    !/FREE_PROFILE_LIMIT/.test(accessSrc)
  );
  check(
    "unlocked 路由不再引用 FREE_PROFILE_LIMIT",
    !/FREE_PROFILE_LIMIT/.test(unlockedSrc)
  );
  // CS-05c：该常量已**彻底删除**（说明文字里提到它不算引用，故先剥注释再判定）。
  // 从「@deprecated 但仍在」升级为「不存在」—— 只要它还在导出，就还有人可能误用。
  const suppliersSrc = readModuleSource("lib/suppliers.ts");
  check(
    "lib/suppliers.ts 已彻底移除 FREE_PROFILE_LIMIT（导出语句不存在）",
    !/export\s+const\s+FREE_PROFILE_LIMIT\b/.test(suppliersSrc),
    "仍存在 export const FREE_PROFILE_LIMIT"
  );
  check(
    "FREE_PROFILE_LIMIT 没有可从 lib/suppliers 导入的出口",
    !/FREE_PROFILE_LIMIT\s*,/.test(suppliersSrc) &&
      !/\{\s*FREE_PROFILE_LIMIT/.test(suppliersSrc)
  );
  check(
    "COMPARE_MAX_SUPPLIERS === 5（对比工具上限的单一事实来源）",
    COMPARE_MAX_SUPPLIERS === 5,
    `实际 ${COMPARE_MAX_SUPPLIERS}`
  );
}

// ---------------------------------------------------------------------------
section("2. 访问语义：Guest limited / Free unlimited / Founder unlimited");
// ---------------------------------------------------------------------------
{
  check("hasUnlimitedBasicAccess(visitor) === false", hasUnlimitedBasicAccess("visitor") === false);
  check("hasUnlimitedBasicAccess(free) === true（Free 不再是每月 5 家）", hasUnlimitedBasicAccess("free") === true);
  check("hasUnlimitedBasicAccess(founding_buyer) === true", hasUnlimitedBasicAccess("founding_buyer") === true);

  check('basicAccessFor("visitor") === "guest_limited"', basicAccessFor("visitor") === "guest_limited");
  check('basicAccessFor("free") === "unlimited"', basicAccessFor("free") === "unlimited");
  check('basicAccessFor("free", isAdmin=true) === "unlimited"', basicAccessFor("free", true) === "unlimited");

  // Guest 5 家边界：0..4 可看，5 起不可再看新的
  check("withinGuestLimit(0) === true", withinGuestLimit(0) === true);
  check("withinGuestLimit(4) === true（第 5 家仍可看）", withinGuestLimit(4) === true);
  check("withinGuestLimit(5) === false（已看满 5 家）", withinGuestLimit(5) === false);
  check("withinGuestLimit(6) === false", withinGuestLimit(6) === false);

  // CS-05a 刻意不放开 guest 对 free 层的访问（避免 05b 计数上线前的过度授权窗口）
  check(
    "canAccess(visitor,'free') 在 CS-05a 仍为 false（授予在 05b）",
    canAccess("visitor", "free") === false
  );
  check("canAccess(free,'free') === true", canAccess("free", "free") === true);
  check("canAccess(free,'paid') === false（Free 不得获得 paid intelligence）", canAccess("free", "paid") === false);
  check("canAccess(founding_buyer,'paid') === true", canAccess("founding_buyer", "paid") === true);
}

// ---------------------------------------------------------------------------
section("3. paid intelligence 红线（任何档位变更都不得泄漏）");
// ---------------------------------------------------------------------------
{
  const visitorFields = visibleFieldsFor("visitor");
  const freeFields = visibleFieldsFor("free");
  const paidFields = visibleFieldsFor("founding_buyer");

  const leakedInVisitor = PAID_FIELDS.filter((f) => visitorFields.includes(f));
  const leakedInFree = PAID_FIELDS.filter((f) => freeFields.includes(f));
  check("visitor 可见字段不含任何 paid 字段", leakedInVisitor.length === 0, leakedInVisitor.join(","));
  check("free 可见字段不含任何 paid 字段", leakedInFree.length === 0, leakedInFree.join(","));
  check(
    "founding_buyer 可见字段包含全部 paid 字段",
    PAID_FIELDS.every((f) => paidFields.includes(f))
  );
  check(
    "paid 字段清单未被 CS-05 改动（仍为 4 项）",
    PAID_FIELDS.length === 4,
    PAID_FIELDS.join(",")
  );
  check(
    "free 层 = CS-05 的 4 项 basic 字段 + CS-12 的 4 项产能字段 + CS-16 的 5 项联系/属地字段",
    FREE_FIELDS.length === 13 &&
      ["established", "employees", "exportMarkets", "auditStatus"].every((f) =>
        (FREE_FIELDS as readonly string[]).includes(f)
      ),
    FREE_FIELDS.join(",")
  );
}

// ---------------------------------------------------------------------------
section("4. /api/me 契约（禁止再返回误导性的 profilesRemaining: 5）");
// ---------------------------------------------------------------------------
{
  const guest = buildMeResponse({
    tier: "visitor",
    planTier: "visitor",
    profilesUsed: 0,
    currentPeriodEnd: null,
    email: null,
    isAdmin: false,
  });
  check("guest.tier === 'visitor'", guest.tier === "visitor");
  check('guest.basicAccess === "guest_limited"', guest.basicAccess === "guest_limited");
  check('guest.quotaScope === "guest"（明确是 guest 额度）', guest.quotaScope === "guest");
  check("guest.guestProfileLimit === 5", guest.guestProfileLimit === 5, String(guest.guestProfileLimit));
  check(
    "guest.profilesRemaining 不再返回 5（服务端不掌握游客用量）",
    guest.profilesRemaining !== 5,
    String(guest.profilesRemaining)
  );
  check("guest.profilesRemaining === null", guest.profilesRemaining === null, String(guest.profilesRemaining));
  check("guest.profilesLimit === 5（表达的是 guest 上限）", guest.profilesLimit === 5, String(guest.profilesLimit));

  const free = buildMeResponse({
    tier: "free",
    planTier: "free",
    profilesUsed: 3,
    currentPeriodEnd: null,
    email: "x@y.com",
    isAdmin: false,
  });
  check('free.basicAccess === "unlimited"', free.basicAccess === "unlimited");
  check('free.quotaScope === "none"', free.quotaScope === "none");
  check("free.guestProfileLimit === null", free.guestProfileLimit === null);
  check("free.profilesLimit === null（不再有 5 家上限）", free.profilesLimit === null, String(free.profilesLimit));
  check("free.profilesRemaining === null（不再显示剩余 5 家）", free.profilesRemaining === null, String(free.profilesRemaining));

  const founder = buildMeResponse({
    tier: "founding_buyer",
    planTier: "founding_buyer",
    profilesUsed: 0,
    currentPeriodEnd: "2030-01-01T00:00:00Z",
    email: "x@y.com",
    isAdmin: false,
  });
  check('founder.basicAccess === "unlimited"', founder.basicAccess === "unlimited");
  check("founder.profilesRemaining === null", founder.profilesRemaining === null);
  check("founder.currentPeriodEnd 透传", founder.currentPeriodEnd === "2030-01-01T00:00:00Z");

  const admin = buildMeResponse({
    tier: "free",
    planTier: "free",
    profilesUsed: 0,
    currentPeriodEnd: null,
    email: "a@b.com",
    isAdmin: true,
  });
  check('admin(isAdmin) basicAccess === "unlimited"', admin.basicAccess === "unlimited");
  check("admin.quotaScope === 'none'", admin.quotaScope === "none");

  // ---- 权限口径 / 账单口径必须分开（2026-09-18 修）----
  // 真实 /api/me 对管理员的处理：tier 被提到 founding_buyer（否则他会被自己的闸门挡住），
  // 但 DB 里 plan 仍是 free。显示层若读 tier，就等于替一个没买过会员的人
  // 宣布「当前套餐：Founding Buyer」—— 陈述了不存在的套餐。
  const adminReal = buildMeResponse({
    tier: "founding_buyer",
    planTier: "free",
    profilesUsed: 0,
    currentPeriodEnd: null,
    email: "a@b.com",
    isAdmin: true,
  });
  check("admin.tier 仍是 founding_buyer（权限未被削弱）", adminReal.tier === "founding_buyer");
  check(
    "admin.planTier 保持真实套餐 free（不跟着 tier 被提档）",
    adminReal.planTier === "free",
    adminReal.planTier
  );
  check(
    "两者在这个样例里确实不同（这条断言本身能捕捉回归）",
    adminReal.tier !== adminReal.planTier
  );
  check(
    "非管理员时 planTier === tier（两个口径只在 admin 处分叉）",
    free.planTier === free.tier && founder.planTier === founder.tier
  );
  check("访客 planTier === 'visitor'", guest.planTier === "visitor");
}

// ---------------------------------------------------------------------------
section("5. 源码扫描：不得残留旧的 Free 5 家额度逻辑");
// ---------------------------------------------------------------------------
{
  const unlocked = fs.readFileSync(
    path.join(ROOT, "app", "api", "suppliers", "[slug]", "unlocked", "route.ts"),
    "utf8"
  );
  check("unlocked 路由不再有 quotaExceeded 免费额度闸门", !/profilesUsed >= /.test(unlocked));
  check("unlocked 路由不再调用 recordProfileView", !/recordProfileView\(/.test(unlocked));
  check("unlocked 路由不再调用 hasProfileView", !/hasProfileView\(/.test(unlocked));

  const me = fs.readFileSync(path.join(ROOT, "app", "api", "me", "route.ts"), "utf8");
  check("/api/me 不再查询 getProfileUsage", !/getProfileUsage/.test(me));
}

// ---------------------------------------------------------------------------
section("6. 套餐显示必须读账单口径 planTier，不得拿权限口径 tier 顶替");
// ---------------------------------------------------------------------------
{
  // 🔴 剥注释统一走 scripts/stripComments.ts 的状态机，**不要**在这里或任何脚本里
  //    再写「先块注释、再行注释」的两段正则。
  //
  // 实测踩到（2026-09-18）：AccountMenu.tsx 第 88 行的**行注释里含 `/*`**
  //   // /login 页面与 /api/auth/* 后端都还在，需要时可直接输入 URL 访问，
  // 两段正则会把这个 `/*` 当成块注释起点，一路吞到第 183 行的 `*/}`，
  // 把中间约 95 行真实代码（含 planTier 那两行）整段删掉：
  //   正向断言 → 假 FAIL（本次就是这样被抓出来的）；
  //   反向断言 → 假 PASS（代码被删了，自然"不含"被禁写法）—— 这个更危险，静默失效。
  //
  // 所以先给剥注释器本身做自检：它错了，下面所有断言都不成立。
  for (const c of STRIP_COMMENTS_SELFTEST) {
    check(
      `剥注释器自检：${c.name}`,
      stripComments(c.input).includes(c.marker) === c.expectPresent
    );
  }

  const me = stripComments(
    fs.readFileSync(path.join(ROOT, "app", "api", "me", "route.ts"), "utf8")
  );
  check(
    "/api/me 显式计算 planTier（直接来自 resolveTier(record)）",
    /const planTier\s*=\s*resolveTier\(record\)/.test(me)
  );
  check(
    "/api/me 的 tier 仍由 isAdmin 提到 founding_buyer（权限不回退）",
    /const tier\s*=\s*isAdmin\s*\?\s*"founding_buyer"\s*:\s*planTier/.test(me)
  );

  // 跨行块匹配，不做「单行含某 token」判定
  const blocks = [...me.matchAll(/buildMeResponse\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
  check("/api/me 共有三处 buildMeResponse 调用", blocks.length === 3, String(blocks.length));
  check(
    "三处响应体都传了 planTier（含两处降级分支）",
    blocks.length === 3 && blocks.every((b) => /planTier/.test(b)),
    blocks.filter((b) => !/planTier/.test(b)).length + " 处缺失"
  );

  for (const rel of ["components/AccountPanel.tsx", "components/AccountMenu.tsx"]) {
    const file = path.join(ROOT, ...rel.split("/"));
    const src = stripComments(fs.readFileSync(file, "utf8"));
    check(`${rel} 读 me.planTier 决定套餐显示`, /me\.planTier\s*===\s*"founding_buyer"/.test(src));
    check(
      `${rel} 套餐文案不再由 isPaid 三元决定`,
      !/isPaid\s*\?/.test(src),
      "仍在用 isPaid 决定显示内容"
    );
    check(`${rel} 仍用 hasPaidAccess 控制升级入口`, /!hasPaidAccess\s*&&/.test(src));
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(56)}`);
console.log(`CS-05 ACCESS REGRESSION  PASS=${pass}  FAIL=${fail}`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("=".repeat(56));
process.exit(fail === 0 ? 0 : 1);
