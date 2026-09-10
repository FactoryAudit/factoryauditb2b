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
import {
  GUEST_PROFILE_LIMIT,
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

// ---------------------------------------------------------------------------
section("1. 常量与命名（防止把 Guest limit 误当成 Free limit）");
// ---------------------------------------------------------------------------
{
  check("GUEST_PROFILE_LIMIT === 5", GUEST_PROFILE_LIMIT === 5, `实际 ${GUEST_PROFILE_LIMIT}`);
  check("guestProfileLimit() 与常量一致", guestProfileLimit() === GUEST_PROFILE_LIMIT);

  // 源码扫描：访问判定文件不得再引用被废弃的 FREE_PROFILE_LIMIT
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
  check(
    "lib/suppliers.ts 已把 FREE_PROFILE_LIMIT 标记 @deprecated",
    /@deprecated[\s\S]{0,400}FREE_PROFILE_LIMIT/.test(
      fs.readFileSync(path.join(ROOT, "lib", "suppliers.ts"), "utf8")
    )
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
    "free 层仍为 4 项 basic 字段（CS-05 不扩不减）",
    FREE_FIELDS.length === 4,
    FREE_FIELDS.join(",")
  );
}

// ---------------------------------------------------------------------------
section("4. /api/me 契约（禁止再返回误导性的 profilesRemaining: 5）");
// ---------------------------------------------------------------------------
{
  const guest = buildMeResponse({
    tier: "visitor",
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
    profilesUsed: 0,
    currentPeriodEnd: null,
    email: "a@b.com",
    isAdmin: true,
  });
  check('admin(isAdmin) basicAccess === "unlimited"', admin.basicAccess === "unlimited");
  check("admin.quotaScope === 'none'", admin.quotaScope === "none");
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
console.log(`\n${"=".repeat(56)}`);
console.log(`CS-05 ACCESS REGRESSION  PASS=${pass}  FAIL=${fail}`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("=".repeat(56));
process.exit(fail === 0 ? 0 : 1);
