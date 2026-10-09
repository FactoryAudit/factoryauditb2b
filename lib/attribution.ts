// lib/attribution.ts —— 首次触达归因的**服务端读取层**
//
// 背景（2026-10-10 实测发现）：
//   leads 表有 6 个归因列（utm_source / utm_medium / utm_campaign / referrer /
//   landing_page / first_touch_at），lib/leads.ts 也有完整映射，但**29 条数据全部为 NULL**。
//   根因：6 个 API 调用点（app/api/lead、audit/request、supplier-claim、
//   supplier-register ×2、verify-supplier/request）**一个都没传这些字段**。
//   ⇒ 后果：询盘从哪来永远无法得知，所有获客渠道的取舍只能靠猜。
//
// 设计：不逐个改 6 个调用点（改了也会被以后新增的入口绕过），
//   而是**在这一层兜底** —— insertLead 自己从请求上下文取。
//   调用方若显式传入，则以调用方为准（显式优先）。
//
// 数据来源优先级：
//   ① 首次触达 cookie（fab_ft）—— 由 components/AnalyticsTracker.tsx 在访客首次落地时写入。
//      这是唯一能拿到「首次」语义的来源（跨页面跳转后 URL 上的 utm 就没了）。
//   ② 本次请求的 Referer 头 —— 至少能记下「表单是在哪个页面提交的」。
//   ③ 都没有 ⇒ 一律写 NULL，**绝不编造来源**（沿用 leads 表的既有语义）。
//
// 纯逻辑（cookie 解析/组装）在 lib/attribution-parse.ts，本文件只做框架粘合。

import { cookies, headers } from "next/headers";
import {
  ATTR_COOKIE,
  EMPTY_ATTRIBUTION,
  cleanAttributionValue,
  parseAttributionCookie,
  type Attribution,
} from "@/lib/attribution-parse";

export {
  ATTR_COOKIE,
  ATTR_MAX_AGE,
  ATTR_KEYS,
  parseAttributionCookie,
  buildAttributionCookie,
  EMPTY_ATTRIBUTION,
} from "@/lib/attribution-parse";
export type { Attribution } from "@/lib/attribution-parse";

/**
 * 读取本次请求的归因信息。
 *
 * 在 Route Handler / Server Action 内调用（这两处才能用 next/headers）。
 * 任何异常都吞掉并返回空值 —— 归因是附加信息，**失败绝不能让一条询盘写不进去**。
 */
export async function readAttribution(): Promise<Attribution> {
  // ① 首次触达 cookie
  try {
    const store = await cookies();
    const fromCookie = parseAttributionCookie(store.get(ATTR_COOKIE)?.value);
    if (fromCookie) return fromCookie;
  } catch {
    /* next/headers 不可用（如构建期）⇒ 走兜底 */
  }

  // ② 本次请求的 Referer
  try {
    const h = await headers();
    const ref = cleanAttributionValue(h.get("referer"));
    if (ref) {
      // 只有 referrer 与 landing_page 是可确证的；utm 系与 first_touch_at 无从得知，
      // 保持 NULL —— 宁缺毋滥。
      return { ...EMPTY_ATTRIBUTION, referrer: ref, landingPage: ref };
    }
  } catch {
    /* 同上 */
  }

  return { ...EMPTY_ATTRIBUTION };
}
