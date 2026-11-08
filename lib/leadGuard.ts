// lib/leadGuard.ts
//
// 线索表单的反灌水判定 —— 只做**判断**，不做 IO。
//
// 为什么抽成纯函数：判定逻辑的正确性必须能在不写生产库的前提下被验证。
// 塞在 app/api/lead/route.ts 里就只能起服务、发真表单、落真数据才能测，
// 而「探针对生产库只读」「碰表单的探针必须 fail-closed」是硬约束。
// 抽出来之后，同一份代码既能被路由调用，也能被 node 脚本逐条喂输入验证。
//
// 两类信号，严重程度不同：
//
//   honeypot —— 页面上的隐藏输入框 hp_note。真人看不见、tabIndex=-1、不参与朗读，
//               能填上来的必定是自动填表脚本。命中即**丢弃**：不落库、不发信。
//
//   fast     —— 表单从挂载到提交的耗时 < MIN_FILL_MS。只说明「快」，不等于「假」：
//               浏览器自动填充 + 一句短留言完全可能在几秒内提交。
//               因此**只标记、不拦截**，信号写进 payload.botSignals 供运营多看一眼。
//               宁可让运营多点一次，也不能把真实买家无声丢掉。
//
// 阈值取 6000ms 的理由：真人从「看到表单」到「读完 5 个占位符提示并落键」极少低于 6 秒；
//   低于 6 秒的提交在历史线索里没有一例来自正常买家。但即便如此也不据此丢数据。

export const HONEYPOT_FIELD = "hp_note";
export const MIN_FILL_MS = 6000;

export type LeadGuardVerdict = {
  /** true ⇒ 调用方应静默丢弃（对外仍返回成功） */
  drop: boolean;
  /** 命中的信号，正常提交为空数组 */
  signals: string[];
  /** 规整后的耗时；缺失/非法/负数为 null */
  elapsedMs: number | null;
};

/**
 * @param honeypot 蜜罐字段的原始值（任何类型都接受，非空即命中）
 * @param elapsedMs 客户端上报的表单停留毫秒数（任何类型都接受）
 */
export function inspectLeadSubmission(input: {
  honeypot?: unknown;
  elapsedMs?: unknown;
}): LeadGuardVerdict {
  const hp = input.honeypot;
  const honeypotFilled =
    hp !== null && hp !== undefined && String(hp).trim().length > 0;

  const raw = input.elapsedMs;
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : NaN;
  // Number.isFinite 同时挡掉 NaN / Infinity / "abc"；负数视为无效（时钟回拨或伪造）
  const elapsedMs = Number.isFinite(n) && n >= 0 ? n : null;

  const signals: string[] = [];
  if (elapsedMs !== null && elapsedMs < MIN_FILL_MS) signals.push("fast");

  return { drop: honeypotFilled, signals, elapsedMs };
}
