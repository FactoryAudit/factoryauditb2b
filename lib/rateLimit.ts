/**
 * 轻量内存限流（固定窗口）。
 *
 * 适用场景：单实例部署（云主机 / 单机 Docker）。
 * 若要横向扩容到多实例，内存计数会各算各的，届时需换成 Redis 或平台自带限流。
 *
 * 设计原则：
 * - fail-open：限流本身出错时放行，绝不因为限流把正常用户挡在门外
 * - 自动清理过期桶，避免 Map 无限增长
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// 每 10 分钟清理一次过期桶
let lastSweep = Date.now();
const SWEEP_INTERVAL = 10 * 60 * 1000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * @param key   限流键，通常是 IP + 业务名
 * @param limit 窗口内允许的请求数
 * @param windowMs 窗口长度（毫秒）
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  try {
    const now = Date.now();
    sweep(now);

    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
    }

    b.count += 1;
    if (b.count > limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
      };
    }
    return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
  } catch {
    // 限流出错时放行，避免误伤真实用户
    return { ok: true, remaining: limit, retryAfterSec: 0 };
  }
}

/**
 * 生成限流身份键：IP + User-Agent 哈希。
 *
 * 为什么带 UA：反向代理/沙箱可能把所有人的 IP 折叠成同一个值
 * （例如本地开发环境所有请求的 x-forwarded-for 都是 127.0.0.1），
 * 纯按 IP 限流会变成「一个人超限，全站被封」。
 * 追加 UA 哈希后：同一浏览器共享一个桶（仍限 5 次/小时），
 * 不同浏览器/UA 各算各的，避免误伤。
 *
 * 注意：UA 与代理头都可被伪造，限流本身只是启发式防护，
 * 目的不是对抗有意的攻击者，而是挡住脚本灌数据，同时绝不误伤真实用户（fail-open 哲学）。
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  let ip = "";
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) ip = first;
  }
  if (!ip) {
    const real = h.get("x-real-ip");
    if (real) ip = real.trim();
  }
  if (!ip) {
    const cf = h.get("cf-connecting-ip");
    if (cf) ip = cf.trim();
  }
  if (!ip) ip = "direct";
  const ua = h.get("user-agent") || "";
  let hash = 0;
  for (let i = 0; i < ua.length; i++) {
    hash = (hash * 31 + ua.charCodeAt(i)) >>> 0;
  }
  return `${ip}:${hash.toString(36)}`;
}

/** 限制字符串长度，防止超长输入撑爆数据库 / 邮件正文 */
export function clamp(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}
