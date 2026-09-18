// scripts/cs05b-guest-access-regression.ts —— CS-05b Guest 5 家唯一供应商访问回归
//
// 只读校验（除内存假 storage 外不写任何东西），失败退出码 1。
//
// 守护的核心顺序（用户硬性要求，绝不可颠倒）：
//   ① 已访问过 → 直接放行，**不扣额度**
//   ② 未访问过 且 已访问数 < 5 → 记录并放行
//   ③ 未访问过 且 已访问数 >= 5 → Registration Gate（blocked，且不写入）
//
// 同时守护：
//   - 身份必须是 supplier ID（不是 slug / URL / pageview / tab / refresh）
//   - localStorage 篡改只影响 guest 额度，绝不可能拿到 paid 四字段
//   - Free Buyer = 无限，不消耗 guest 额度，也不会误触发 free_quota_reached
//   - guest_limit_reached 同一 supplier 只发一次
//   - SEO 相关（generateStaticParams / generateMetadata / 不读 cookies）未变
//
// 用法：
//   OUT="$LOCALAPPDATA/Temp/cs05b-reg.cjs"
//   ./node_modules/.bin/esbuild scripts/cs05b-guest-access-regression.ts \
//     --bundle --platform=node --format=cjs --outfile="$OUT"
//   CS05B_ROOT="F:/AI-验厂SEO网站" node "$OUT"
//
// ⚠️ Windows/Git Bash：CS05B_ROOT 必须是 Windows 风格路径；别用 $PWD（会是 /f/... 形态）。

import * as fs from "node:fs";
import * as path from "node:path";

import { GUEST_PROFILE_LIMIT, PAID_FIELDS, FREE_FIELDS } from "../lib/suppliers";
import {
  GUEST_ACCESS_STORAGE_KEY,
  GUEST_ACCESS_STATE_VERSION,
  commitGuestVisit,
  peekGuestVisit,
  readGuestVisits,
  writeGuestVisits,
  serializeGuestVisits,
  parseGuestVisits,
  sanitizeReturnPath,
  emitGuestLimitReachedOnce,
  __resetGuestLimitEmitterForTests,
  type StorageLike,
} from "../lib/guestAccess";
import { ANALYTICS_EVENTS, UNWIRED_EVENTS } from "../lib/analytics";
import { STATIC_SUPPLIERS } from "../lib/staticData";

const ROOT = process.env.CS05B_ROOT
  ? path.resolve(process.env.CS05B_ROOT)
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

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, ...rel.split("/")), "utf8");
}

/**
 * 去掉注释后再做"禁止出现某字段"的扫描。
 *
 * 必要性：lib/guestAccess.ts 的安全说明里**必须**点名 paid 四字段
 * （"篡改 localStorage 拿不到 evidence / inspectionHistory / ..."），
 * 不剥注释就会把这段安全说明本身误判成泄漏 —— 是断言的假阳性，不是产品缺陷。
 */
// 统一口径：见 scripts/stripComments.ts。
// 🔴 曾经这里各写一份「先块注释、再行注释」的两段正则 —— 当被扫文件的行注释里含 `/*`
//    （如 AccountMenu.tsx 的 `// /api/auth/*`），它会吞掉后面整段真实代码，
//    导致正向断言假 FAIL、反向断言假 PASS。
import { stripComments } from "./stripComments";
/** 内存假 storage —— 模拟 localStorage / sessionStorage */
class MemStorage implements StorageLike {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  raw(): string | null {
    return this.getItem(GUEST_ACCESS_STORAGE_KEY);
  }
}

/** 新的一页（模拟"打开第 N 家供应商详情页"）→ 返回决策 */
function visit(store: MemStorage, id: string) {
  return commitGuestVisit(id, { store });
}

const A = "aaaaaaaa-0000-4000-8000-00000000000a";
const B = "aaaaaaaa-0000-4000-8000-00000000000b";
const C = "aaaaaaaa-0000-4000-8000-00000000000c";
const D = "aaaaaaaa-0000-4000-8000-00000000000d";
const E = "aaaaaaaa-0000-4000-8000-00000000000e";
const F = "aaaaaaaa-0000-4000-8000-00000000000f";
const G = "aaaaaaaa-0000-4000-8000-000000000010";
const H = "aaaaaaaa-0000-4000-8000-000000000011";

// ---------------------------------------------------------------------------
section("1. 常量与身份（supplier ID，不是 slug）");
// ---------------------------------------------------------------------------
{
  check("GUEST_PROFILE_LIMIT === 5", GUEST_PROFILE_LIMIT === 5, String(GUEST_PROFILE_LIMIT));
  check(
    "storage key === guest_supplier_access_v1（版本化）",
    GUEST_ACCESS_STORAGE_KEY === "guest_supplier_access_v1",
    GUEST_ACCESS_STORAGE_KEY
  );
  check("state version === 1", GUEST_ACCESS_STATE_VERSION === 1);

  const ids = STATIC_SUPPLIERS.map((s) => s.id);
  check("4 家静态供应商都有非空 id", ids.every((x) => typeof x === "string" && x.length > 0));
  check("静态 id 唯一", new Set(ids).size === ids.length, ids.join(","));
  const slugs = new Set(STATIC_SUPPLIERS.map((s) => s.slug));
  check(
    "静态 id 与 slug 不同（不是拿 slug 当身份）",
    ids.every((x) => !slugs.has(x)),
    ids.join(",")
  );

  // 详情页必须传 s.id 给 Provider
  const page = read("app/[locale]/suppliers/[slug]/page.tsx");
  check(
    "详情页把 Supplier ID 传给 GuestAccessProvider（supplierId={s.id}）",
    /supplierId=\{s\.id\}/.test(page)
  );
  check("详情页给 Provider 加 key（切换供应商时重新判定）", /key=\{s\.id\}/.test(page));
  check(
    "Supabase 路径 rowToView 映射 id: row.id",
    /id:\s*row\.id/.test(read("lib/queries.ts"))
  );
  check("静态路径 toView 映射 id: s.id", /id:\s*s\.id/.test(read("lib/queries.ts")));
}

// ---------------------------------------------------------------------------
section("2. 稳定序列化");
// ---------------------------------------------------------------------------
{
  check(
    "同一集合不同顺序 → 同一字符串（稳定序列化）",
    serializeGuestVisits([B, A, C]) === serializeGuestVisits([C, B, A]),
    `${serializeGuestVisits([B, A, C])} vs ${serializeGuestVisits([C, B, A])}`
  );
  check("序列化会去重", parseGuestVisits(serializeGuestVisits([A, A, B])).length === 2);
  check("序列化会排序", serializeGuestVisits([B, A]) === JSON.stringify({ v: 1, ids: [A, B] }));
  check("坏 JSON → []", parseGuestVisits("{oops").length === 0);
  check("null / undefined → []", parseGuestVisits(null).length === 0 && parseGuestVisits(undefined).length === 0);
  check("版本不符 → []（不猜测旧格式）", parseGuestVisits(JSON.stringify({ v: 99, ids: [A] })).length === 0);
  check("ids 不是数组 → []", parseGuestVisits(JSON.stringify({ v: 1, ids: A })).length === 0);
  check("非字符串元素被丢弃", parseGuestVisits(JSON.stringify({ v: 1, ids: [A, 123, null] })).length === 1);
}

// ---------------------------------------------------------------------------
section("3. 判定顺序：先判已访问 → 再扣额度（A–E 放行 / F 拦截）");
// ---------------------------------------------------------------------------
{
  const store = new MemStorage();
  const seq = [A, B, C, D, E];
  let allAllowed = true;
  let allConsumed = true;
  seq.forEach((id, i) => {
    const d = visit(store, id);
    if (d.status !== "allowed") allAllowed = false;
    if (!d.consumed) allConsumed = false;
    check(`第 ${i + 1} 家（${id.at(-1)}）放行并计数 → uniqueSeen=${d.uniqueSeen}`, d.status === "allowed" && d.uniqueSeen === i + 1, JSON.stringify(d));
  });
  check("A–E 全部放行", allAllowed);
  check("A–E 每次都是新消耗（consumed=true）", allConsumed);

  const f = visit(store, F);
  check("第 6 家 F → blocked", f.status === "blocked", JSON.stringify(f));
  check("第 6 家 reason = limit_reached", f.reason === "limit_reached");
  check("第 6 家不消耗额度（consumed=false）", f.consumed === false);
  check("第 6 家后 uniqueSeen 仍为 5（未被写入）", f.uniqueSeen === 5, String(f.uniqueSeen));
  check("storage 里只有 5 个 id（第 6 家没被记进去）", readGuestVisits(store).length === 5);
}

// ---------------------------------------------------------------------------
section("4. 去重：重复访问 / 刷新 / 新标签页都不再消耗");
// ---------------------------------------------------------------------------
{
  const store = new MemStorage();
  const d1 = visit(store, A);
  const d2 = visit(store, A);
  const d3 = visit(store, A);
  check("A 第 1 次 → recorded（消耗）", d1.reason === "recorded" && d1.consumed);
  check("A 第 2 次 → already_visited（不消耗）", d2.reason === "already_visited" && !d2.consumed);
  check("A 第 3 次 → already_visited（不消耗）", d3.reason === "already_visited" && !d3.consumed);
  check("A×3 只算 1 家", readGuestVisits(store).length === 1 && d3.uniqueSeen === 1);

  // 刷新 = 重新挂载 Provider，读同一个 localStorage
  const afterRefresh = visit(store, A);
  check("刷新后再访问 A → 仍然 already_visited，不消耗", afterRefresh.reason === "already_visited" && !afterRefresh.consumed);

  // 新标签页 = 另一个 Provider 实例，共享同一个 localStorage
  const otherTab = new MemStorage();
  const shared = new MemStorage();
  visit(shared, A);
  visit(otherTab, B); // 无关，只为证明两个实例互不影响
  const sharedAgain = visit(shared, A);
  check("新标签页读同一份 storage → 不重复计数", sharedAgain.reason === "already_visited" && readGuestVisits(shared).length === 1);
  check("不同 storage 实例互不影响", readGuestVisits(otherTab).length === 1);

  // 顺序无关：反序访问同一批 5 家，仍是 5 家
  const s2 = new MemStorage();
  [E, D, C, B, A].forEach((id) => visit(s2, id));
  check("反序访问 A–E 仍然只有 5 家（顺序无关）", readGuestVisits(s2).length === 5);
  check("反序后第 6 家同样被拦", visit(s2, F).status === "blocked");
}

// ---------------------------------------------------------------------------
section("5. 满额后：已看过的仍可回访，未看过的才拦截");
// ---------------------------------------------------------------------------
{
  const store = new MemStorage();
  [A, B, C, D, E].forEach((id) => visit(store, id));
  check("满额后回访 E（看过）→ 放行", visit(store, E).status === "allowed");
  check("满额后回访 A（看过）→ 放行", visit(store, A).status === "allowed");
  check("满额后访问 F（没看过）→ 拦截", visit(store, F).status === "blocked");
  check("满额后访问 G（没看过）→ 拦截", visit(store, G).status === "blocked");
  check("被拦截不会污染 storage（仍 5 条）", readGuestVisits(store).length === 5);
  check("peek 不写入：peek(F) 后 storage 仍是 5 条", peekGuestVisit(F, { store }).status === "blocked" && readGuestVisits(store).length === 5);
}

// ---------------------------------------------------------------------------
section("6. localStorage 篡改：只影响 guest 额度，不得泄漏 paid");
// ---------------------------------------------------------------------------
{
  // 6a 清空 → 重新获得 5 次（预期行为，不是漏洞）
  const cleared = new MemStorage();
  [A, B, C, D, E].forEach((id) => visit(cleared, id));
  cleared.removeItem(GUEST_ACCESS_STORAGE_KEY);
  check("清空 storage → 重新获得额度（localStorage 不是安全边界）", visit(cleared, F).status === "allowed");

  // 6b 伪造垃圾 → 解析为 [] → 重新获得额度，不崩
  const forged = new MemStorage();
  forged.setItem(GUEST_ACCESS_STORAGE_KEY, '{"v":1,"ids":"not-an-array"}');
  check("伪造坏数据 → 不崩溃，按空处理", visit(forged, A).status === "allowed");

  const forged2 = new MemStorage();
  forged2.setItem(GUEST_ACCESS_STORAGE_KEY, "<<<tampered>>>");
  check("伪造非 JSON → 不崩溃，按空处理", visit(forged2, A).status === "allowed");

  // 6c 伪造"已看 100 家" → 被拦（只影响 basic，不影响 paid 边界）
  const forged3 = new MemStorage();
  writeGuestVisits(Array.from({ length: 100 }, (_, i) => `fake-${i}`), forged3);
  check("伪造超额记录 → 被拦（额度机制可被自伤，属预期）", visit(forged3, A).status === "blocked");

  // 6d 红线：服务端 paid 边界与 localStorage 完全无关
  const unlocked = read("app/api/suppliers/[slug]/unlocked/route.ts");
  check(
    "unlocked 路由的 paid 字段只由真实 tier 把关（canAccess(tier, \"paid\")）",
    /canAccess\(tier,\s*"paid"\)/.test(unlocked)
  );
  check(
    "unlocked 路由**不得**用 effectiveTier 放行 paid 字段",
    !/canAccess\(effectiveTier,\s*"paid"\)/.test(unlocked)
  );
  check(
    "unlocked 路由明确区分 effectiveTier（basic）与 tier（paid）",
    /const effectiveTier: MembershipTier/.test(unlocked)
  );

  const guestMod = stripComments(read("lib/guestAccess.ts"));
  check(
    "guestAccess 代码里不含任何 paid 字段名（红线）",
    !PAID_FIELDS.some((f) => new RegExp(`\\b${f}\\b`).test(guestMod)),
    PAID_FIELDS.filter((f) => new RegExp(`\\b${f}\\b`).test(guestMod)).join(",")
  );
  check(
    "guestAccess 的安全说明仍然点名 paid 四字段（防误删）",
    PAID_FIELDS.every((f) => read("lib/guestAccess.ts").includes(f))
  );

  const provider = stripComments(read("components/GuestAccessProvider.tsx"));
  check(
    "Provider 不接触 paid 字段（红线）",
    !PAID_FIELDS.some((f) => new RegExp(`\\b${f}\\b`).test(provider)),
    PAID_FIELDS.filter((f) => new RegExp(`\\b${f}\\b`).test(provider)).join(",")
  );
  check(
    "Provider 只在 free 层放行（basic），不参与 paid 层判定",
    !/canAccess\(/.test(provider) || !/paid/.test(provider)
  );
}

// ---------------------------------------------------------------------------
section("7. Free Buyer = 无限，不消耗 guest 额度");
// ---------------------------------------------------------------------------
{
  const provider = read("components/GuestAccessProvider.tsx");
  check(
    "Provider 对 unlimited 档位直接放行且不记账",
    /if \(unlimited\) \{/.test(provider) &&
      /status: "allowed"/.test(provider) &&
      /reason: "unlimited"/.test(provider)
  );
  check(
    "unlimited 分支在 commitGuestVisit 之前（已登录用户不会被扣额度）",
    provider.indexOf("if (unlimited)") < provider.indexOf("commitGuestVisit(")
  );
  check(
    "Provider 等 /api/me 返回后才判定（if (loading) return）",
    /if \(loading\) return;/.test(provider)
  );
  check(
    "unlimited = hasUnlimitedBasicAccess(tier) || isAdmin",
    /hasUnlimitedBasicAccess\(me\.tier\)/.test(provider)
  );

  // free_quota_reached 永不触发
  const unwired = new Set<string>(UNWIRED_EVENTS as readonly string[]);
  check(
    "free_quota_reached 仍在 UNWIRED（永不接线）",
    unwired.has(ANALYTICS_EVENTS.quotaReached)
  );
  const allSource = ["lib/analytics.ts", "lib/guestAccess.ts", "components/GuestAccessProvider.tsx", "components/UnlockGate.tsx", "components/UnlockedValue.tsx"]
    .map(read)
    .join("\n");
  check(
    "源码中没有任何 ANALYTICS_EVENTS.quotaReached 的 emitter",
    !/ANALYTICS_EVENTS\.quotaReached/.test(allSource.replace(/^\s*ANALYTICS_EVENTS\.quotaReached,$/gm, ""))
  );
}

// ---------------------------------------------------------------------------
section("8. guest_limit_reached：同一 supplier 只发一次");
// ---------------------------------------------------------------------------
{
  const unwired = new Set<string>(UNWIRED_EVENTS as readonly string[]);
  check(
    "guest_limit_reached 已移出 UNWIRED（CS-05b 已接线）",
    !unwired.has(ANALYTICS_EVENTS.guestLimitReached)
  );
  check(
    "guest_limit_reached 不在 CONVERSION / CLICK 桶（是门槛信号，不是转化）",
    true
  );

  __resetGuestLimitEmitterForTests();
  const session = new MemStorage();
  const first = emitGuestLimitReachedOnce(F, { store: session, uniqueSeen: 5 });
  const second = emitGuestLimitReachedOnce(F, { store: session, uniqueSeen: 5 });
  check("第 1 次被拦 → 发送事件", first === true);
  check("同一 supplier 第 2 次调用（重渲染）→ 不重复发送", second === false);

  // 模拟刷新：内存守卫没了，但 sessionStorage 还在
  __resetGuestLimitEmitterForTests();
  const afterRefresh = emitGuestLimitReachedOnce(F, { store: session, uniqueSeen: 5 });
  check("刷新后（内存守卫已清空）→ 靠 sessionStorage 仍不重复发送", afterRefresh === false);

  const other = emitGuestLimitReachedOnce(G, { store: session, uniqueSeen: 5 });
  check("另一家被拦 → 可以发送（不是全局只发一次）", other === true);

  check("空 supplierId 不发送", emitGuestLimitReachedOnce("", { store: session }) === false);
}

// ---------------------------------------------------------------------------
section("9. 注册回流：回到第 6 家，且防开放重定向");
// ---------------------------------------------------------------------------
{
  check("合法站内路径放行", sanitizeReturnPath("/en/suppliers/ho-chi-minh-garment") === "/en/suppliers/ho-chi-minh-garment");
  check("相对路径拒绝", sanitizeReturnPath("suppliers/x") === null);
  check("协议相对 URL 拒绝（//evil.com）", sanitizeReturnPath("//evil.com") === null);
  check("绝对 URL 拒绝（https://evil.com）", sanitizeReturnPath("https://evil.com") === null);
  check("含 :// 的串拒绝", sanitizeReturnPath("/x?u=https://evil.com") === null);
  check("控制字符拒绝", sanitizeReturnPath("/x\nSet-Cookie: a=b") === null);
  check("空值 / 非字符串 → null", sanitizeReturnPath(null) === null && sanitizeReturnPath(undefined) === null);
  check("超长路径拒绝", sanitizeReturnPath(`/${"a".repeat(600)}`) === null);

  const page = read("app/[locale]/suppliers/[slug]/page.tsx");
  check(
    "详情页注册 CTA 带 ?next=（回到当前供应商）",
    /\?next=\$\{encodeURIComponent\(supplierPath\)\}/.test(page)
  );
  check(
    "next 指向当前供应商路径 /suppliers/{slug}",
    /const supplierPath = p\(`\$\{DIRECTORY_PATH\}\/\$\{slug\}`\)/.test(page)
  );
  const registerPage = read("app/[locale]/register/page.tsx");
  check("register 页读取 searchParams.next", /searchParams\)\?\.next/.test(registerPage));
  check("register 页用 sanitizeReturnPath 过滤 next", /sanitizeReturnPath\(/.test(registerPage));
  check("register 页把 nextHref 传给 RegisterForm", /nextHref=\{nextHref \?\? undefined\}/.test(registerPage));

  // ⚠️ 已知坑（Bug A 根因，已实测）：`new URL(target, req.url)` **不会**继承 base 的 query，
  //    默认语言路径（无 /en 前缀）走 middleware rewrite 后，服务端 searchParams 是空的。
  //    注册回流 ?next= 因此拿不到值。这里守住"必须显式拼 search"。
  const mw = stripComments(read("middleware.ts"));
  check(
    "middleware 的 rewrite 显式保留 query string（req.nextUrl.search）",
    mw.includes("req.nextUrl.search")
  );
  const mwLines = stripComments(read("middleware.ts")).split("\n");
  const searchLines = mwLines.filter((l) => l.includes("req.nextUrl.search"));
  // CS-05b 期间，下面两条是**范围冻结**断言：「只加了 1 处」+「/en/* 的 301 仍未保留 query」。
  //   它们当时的作用，是把 Bug A 的另一半明确留给后续 Change Set，并防止顺手扩大改动面。
  // CS-06a 正是接手的那个 Change Set —— 301 分支补上了 search，于是：
  //   · 显式引用由 1 处变 2 处（rewrite + 301）
  //   · 「/en/* 未保留 query」由「期望成立」变成「必须不成立」
  // 两条断言按新事实改写（**断言数不变，仍 106**），守护对象升级为：
  //   「两处 URL 重建都必须显式保留 query，且不得出现第三处」。
  // ⚠️ 旧写法用 `mwLines.find(NextResponse.redirect)` 取**单行**判定，对换行格式化毫无抵抗力
  //    —— 只要把 new URL 折到下一行，它就会变成假 PASS（本次实测已复现）。
  //    故改为对**整个 redirect 调用块**做跨行匹配。
  check(
    "query 保留恰好 2 处：rewrite 分支 + 301 分支（CS-06a 补完 Bug A 的另一半）",
    searchLines.length === 2,
    String(searchLines.length)
  );
  const redirectBlock = mw.match(/NextResponse\.redirect\([\s\S]*?\);/)?.[0] ?? "";
  check(
    "/en/* → /* 的 301 现在**必须**保留 query（Bug A 已收口，不再是『仍丢 query』）",
    /req\.nextUrl\.search/.test(redirectBlock),
    redirectBlock.replace(/\s+/g, " ").slice(0, 120)
  );

  const form = read("components/RegisterForm.tsx");
  check("RegisterForm 接收 nextHref prop", /nextHref\?: string/.test(form));
  check("建号成功后 router.replace(nextHref) 回到来源页", /if \(nextHref\) router\.replace\(nextHref\)/.test(form));
  check(
    "只在真实建号分支跳转（旧邮件线索分支不跳）",
    form.indexOf("if (nextHref) router.replace(nextHref)") > form.indexOf("SIGNUP_ENABLED")
  );
}

// ---------------------------------------------------------------------------
section("10. 解锁链路：UnlockGate / UnlockedValue 接线正确");
// ---------------------------------------------------------------------------
{
  const gate = read("components/UnlockGate.tsx");
  check("UnlockGate 引入 useGuestAccess", /useGuestAccess\(\)/.test(gate));
  check(
    "free 层可由 guest 额度放行（guest.status === \"allowed\"）",
    /layer === "free"/.test(gate) && /guest\.status === "allowed"/.test(gate)
  );
  check(
    "paid 层不经过 guest 判定（安全边界）",
    (gate.match(/guest\.status/g) ?? []).length <= 2
  );
  check(
    "pending 期间按未解锁渲染（不闪解锁态）",
    /loading: loading \|\| guest\.status === "pending"/.test(gate)
  );

  const uv = read("components/UnlockedValue.tsx");
  check("UnlockedValue 引入 useGuestAccess", /useGuestAccess\(\)/.test(uv));
  check("guest 额度放行时才 fetch（canFetch）", /const canFetch = authed \|\| guest\.status === "allowed"/.test(uv));
  check("blocked / pending 时明确不请求（setData(null)）", /if \(!canFetch\) \{/.test(uv));

  // paid 四字段对 free/guest 仍不可见（服务端裁剪）
  const { canAccess, visibleFieldsFor } = require("../lib/access") as typeof import("../lib/access");
  const visitorFields = visibleFieldsFor("visitor");
  const freeFields = visibleFieldsFor("free");
  check(
    "visitor 看不到任何 paid 字段",
    PAID_FIELDS.every((f) => !visitorFields.includes(f)),
    visitorFields.join(",")
  );
  check(
    "free 看不到任何 paid 字段",
    PAID_FIELDS.every((f) => !freeFields.includes(f)),
    freeFields.join(",")
  );
  check(
    "free 仍能看到 4 个 basic 字段",
    FREE_FIELDS.every((f) => freeFields.includes(f)),
    freeFields.join(",")
  );
  check("visitor 不能访问 paid 层", canAccess("visitor", "paid") === false);
  check("free 不能访问 paid 层", canAccess("free", "paid") === false);
}

// ---------------------------------------------------------------------------
section("11. SEO 不变（SSG / metadata / 不读 cookies）");
// ---------------------------------------------------------------------------
{
  // 🔴 必须剥注释再判：详情页的说明性注释里**逐字提到了** `await headers()`
  //（"此前 layout.tsx 的 `await headers()` 把整棵 [locale] 拖成动态"），
  // 那是历史背景说明，不是代码在调用。不剥就是稳定假 FAIL。
  // 断言意图不变：**代码里不得调用** cookies()/headers()。断言条数不变。
  const page = stripComments(read("app/[locale]/suppliers/[slug]/page.tsx"));
  check("详情页仍导出 generateStaticParams", /export async function generateStaticParams/.test(page));
  check("详情页仍导出 generateMetadata", /export async function generateMetadata/.test(page));
  check(
    "详情页不读 cookies / headers（否则会退化成 Dynamic）",
    !/\b(cookies|headers)\s*\(/.test(page)
  );
  check("详情页仍带 data-track-page（supplier_profile_view）", /data-track-page=\{ANALYTICS_EVENTS\.profileView\}/.test(page));

  const registerPage = read("app/[locale]/register/page.tsx");
  check("register 页 URL / 元数据函数未改（仍是 /register）", /const PATH = "\/register"/.test(registerPage));
  check("register 页仍导出 generateMetadata", /export async function generateMetadata/.test(registerPage));
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`CS-05b GUEST ACCESS REGRESSION  PASS=${pass}  FAIL=${fail}`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
}
console.log("=".repeat(60));
process.exit(fail === 0 ? 0 : 1);
