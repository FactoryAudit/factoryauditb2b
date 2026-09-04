import { NextRequest, NextResponse } from "next/server";
import { handleWebhook } from "@/lib/payments";

// POST /api/paypal/webhook —— 接收 PayPal 事件
//
// ★ 关键：必须用 req.text() 拿**未经解析的原始请求体**。
//   一旦 req.json() 再 stringify，键顺序/空白会变化，PayPal 的签名必然对不上，
//   结果是所有 webhook 都被判为验签失败 —— 用户付了钱却永远不开通。
//
// 处理顺序（顺序错了就是事故）：
//   1. 验签         —— 失败一律 400，且不做任何业务动作
//   2. 幂等占位     —— 已处理过的事件直接 200（PayPal 会重复投递）
//   3. 写 memberships
//
// 为什么验签失败要返回 400 而不是 200：
//   伪造请求不该得到"成功"的反馈。PayPal 对 4xx 不会无限重试（重试几次后停止），
//   而真实事件签名一定是对的，不存在"验签失败但其实是真事件"的情况。
//
// 注意：PayPal 支持两类 webhook 验签（证书校验 / API 回传校验），
// 这里用的是 API 回传校验（/v1/notifications/verify-webhook-signature），
// 因为 Workers 环境不方便做证书链校验。详见 lib/payments/paypal.ts。

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const result = await handleWebhook("paypal", rawBody, req.headers);

  // PayPal 只关心 2xx；4xx 会触发重试直到上限。
  // 返回体内容对 PayPal 无意义，但对排查有用，故带上 reason。
  return NextResponse.json(
    { received: result.status === 200, reason: result.reason },
    { status: result.status }
  );
}
