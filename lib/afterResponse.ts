// lib/afterResponse.ts —— 让「响应之后再跑」的副作用（发信、埋点、写日志）真正跑完。
//
// ── 为什么需要它（R84 事故，2026-10-11，线上必现）────────────────────────────
//
// Cloudflare Workers 的**硬约束**：一旦 Response 返回给客户端，该请求的 execution
// context 就被判定结束；**未被 `ctx.waitUntil()` 注册的 pending Promise 会被直接取消**。
//
// 于是本仓库里所有 `void someAsync()` 的写法（fire-and-forget）在生产**全部失效**：
//   · `void notifyAdminNewAuditRequest(...)` / `void notifyAuditRequestReceived(...)`
//     → 管理员收不到验厂申请通知、买家收不到回执（R79 加的邮件通知**线上从没发出去过**）；
//   · `void insertLead(...)` 同理（只因其写库快，偶尔在取消前抢跑成功，于是更难察觉）。
//
// 判据（本次实测）：生产 `wrangler tail` 抓 `POST /api/audit/request - Ok`，
// 日志里**一条 `[notify]` 都没有** —— 若 sendMail 真跑过，成功失败都必有日志。
// 「零日志」= Promise 根本没被执行完就被取消了。
//
// ⚠️ 本地门（Node）测不出：Node 不会取消 pending Promise。这类缺陷
//    **只有线上 tail + 收件箱**才能抓到。
//
// ── 修法 ────────────────────────────────────────────────────────────────────
// 统一走 `runAfterResponse()`，底层用 Next 官方的 `after()`（`next/server`）：
// OpenNext 通过 `runWithOpenNextRequestContext({ waitUntil })`（见
// @opennextjs/aws/dist/core/requestHandler.js）把 Worker 的 `ctx.waitUntil`
// 注入到 Next 的 request store，`after()` 正是从那里取 `waitUntil`。
// 因此 `after()` 在 Cloudflare 上是**接到 ctx.waitUntil**的；在本地 Node dev 下
// Next 会退化为「响应后尽快跑」。
//
// 若 `after()` 因环境抛出（`waitUntil` 不可用），退化为直接执行 —— 绝不能因为
// 「兜底机制不可用」而让副作用彻底消失（那正是本 bug 的成因）。
//
// 用法（替换所有 `void foo().catch(...)`）：
//   runAfterResponse(notifyAdminNewAuditRequest({...}), "audit/request admin notify");
//
// 仍建议配 `.catch()`：waitUntil 只保证跑完，不吞异常。

import { after } from "next/server";

/** 让一个 Promise 在响应返回后仍然跑完。返回原始 Promise 便于链式 `.catch()`。 */
export function runAfterResponse<T>(promise: Promise<T>, label?: string): Promise<T> {
  try {
    // `after()` 必须在请求作用域内调用（Route Handler / Server Action）。
    after(async () => {
      try {
        await promise;
      } catch (e) {
        console.error(`[afterResponse] 任务失败${label ? ` (${label})` : ""}`, e);
      }
    });
  } catch (e) {
    // 非请求作用域 / waitUntil 不可用：退化为普通执行，别让副作用消失。
    console.error(`[afterResponse] after() 不可用，退化为直接执行${label ? ` (${label})` : ""}`, e);
    void promise.catch((err) => console.error(`[afterResponse] 任务失败${label ? ` (${label})` : ""}`, err));
  }
  return promise;
}
