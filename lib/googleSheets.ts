// lib/googleSheets.ts —— Google Sheets CRM 轻量集成（V2.0：无 DB，所有 CRM 走 Sheets）
//
// 工作原理：
//   1. 你在 Google Sheets 建一张表（如「Register CRM」）
//   2. 工具 → 脚本编辑器，写一个 doPost(e) 接收 JSON，append 一行
//   3. 部署 → 网页应用 → 任何人可访问（Execute as: Me），复制 URL 填到
//      .env 的 GOOGLE_SHEETS_REGISTER_WEBHOOK
//   4. 每次注册触发：服务端 POST 到该 URL，Google 把它作为新行写入
//
// 设计要点：
//   - fail-open：未配置 / 网络错误时仅 console.warn，绝不阻塞注册主流程
//   - 无敏感数据：传出的仅是注册表单字段（email/name/company）+ 时间戳 + reference id
//   - 与邮件通道并行：Sheets 是 CRM 备份视图，主通知仍是邮件
//   - 调用方用 Promise.allSettled 包住，与 notify 一起等结果

export interface RegisterSheetRow {
  referenceId: string;
  email: string;
  name: string;
  company: string;
  submittedAt: string; // ISO 8601
  source: string; // "buyer-register"
}

const SHEET_LOG_PREFIX = "[google-sheets]";

/**
 * Append 一行到配置的 Google Sheet。
 * 未配置 webhook URL 或调用失败时静默返回 false，绝不抛错。
 */
export async function appendRegisterRow(
  row: RegisterSheetRow
): Promise<boolean> {
  const webhook = (process.env.GOOGLE_SHEETS_REGISTER_WEBHOOK ?? "").trim();
  if (!webhook) {
    // 未配置不报错：邮件通道是主通知，Sheets 仅是可选 CRM 视图
    return false;
  }

  try {
    // Google Apps Script Web App 的 redirect 重定向会让简单 POST 失败；
    // 这里用 fetch + redirect: "follow" + text/plain（避免 CORS preflight）
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(row),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(
        `${SHEET_LOG_PREFIX} webhook 返回 ${res.status} ${res.statusText}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`${SHEET_LOG_PREFIX} 调用失败（不影响注册主流程）:`, err);
    return false;
  }
}