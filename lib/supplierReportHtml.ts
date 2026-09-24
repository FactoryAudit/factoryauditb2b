// lib/supplierReportHtml.ts —— 单供应商「核验报告」独立 HTML 生成器（管理员后台下载用）
//
// 与 lib/standardReportHtml.ts 的区别：
//   - standardReportHtml 是**虚构样张**（全站统一的演示数据）。
//   - 本文件是**真实数据**报告：内容只来自传入的 SupplierReportInput
//     （由后台从 DB 取真实记录后组装）。没有的数据就直接不渲染 —— 反伪造铁律，绝不编造。
//
// 设计约束（与 standardReportHtml 一致）：
//   - 自包含（内联 CSS + 内联脚本），可离线打开、可打印为 PDF。
//   - 双语（en/zh）写进 data-en / data-zh，初始显示 lang；保留语言切换按钮。
//   - 纯函数、无服务端依赖，可被客户端组件直接 import 生成 Blob 下载。

import {
  overallLevel,
  LEVEL_COLOR,
  type RiskLevel,
} from "@/lib/riskEngine";
import { LEVEL_SCOPE } from "@/lib/verification";

export type ReportLang = "en" | "zh";

type Bi = { en: string; zh: string };

export type SupplierReportAudit = {
  auditType: string;
  auditDate: string;
  auditorName: string | null;
  auditorOrg: string | null;
  result: string | null;
  verificationStatus: string;
  findingsCritical: number;
  findingsMajor: number;
  findingsMinor: number;
  notes: string | null;
};

export type SupplierReportInput = {
  legalName: string;
  slug: string;
  countryCode: string;
  city: string | null;
  industryCode: string | null;
  businessType: string | null;
  established: number | null;
  employees: string | null;
  mainProducts: string[];
  exportMarkets: string[];
  certifications: string[];
  auditStatus: string | null;
  inspectionHistory: number;
  riskScore: number | null;
  verificationLevel: string;
  /** CS-D #19：由服务端用 resolveVerificationBadge 推导并本地化后注入；
   *  报告不再自行判断 verification_level / is_verified，与 Public Profile 同源。 */
  verificationBadgeLabel?: string;
  audits: SupplierReportAudit[];
  generatedAt: string;
};

// ---- 双语标签（后台内部文档，按既有惯例用内联 Bi，不进 9 语字典）----
const DOC_UI = {
  title: { en: "Supplier Verification Report", zh: "供应商核验报告" } as Bi,
  issuedBy: { en: "Issued by", zh: "出具方" } as Bi,
  generatedOn: { en: "Generated on", zh: "生成时间" } as Bi,
  langToggle: { en: "EN / 中文", zh: "EN / 中文" } as Bi,
  print: { en: "Print / Save as PDF", zh: "打印 / 另存为 PDF" } as Bi,
  riskScore: { en: "Risk score", zh: "风险评分" } as Bi,
  verificationLevel: { en: "Verification level", zh: "核验等级" } as Bi,
  verificationStatus: { en: "Verification status", zh: "核验状态" } as Bi,
  verificationScope: { en: "Verification scope", zh: "核验范围" } as Bi,
  auditHistory: { en: "Audit & verification history", zh: "审核与核验记录" } as Bi,
  profile: { en: "Supplier profile", zh: "供应商档案" } as Bi,
  noAudits: {
    en: "No on-file audit or verification events.",
    zh: "暂无在档的审核或核验事件。",
  } as Bi,
  disclaimer: {
    en: "This document reflects the verification records on file with FactoryAuditB2B as of the generation date. It is a summary of platform-held evidence, not an independent certification or a guarantee of current supplier conduct.",
    zh: "本报告反映截至生成日期 FactoryAuditB2B 在档的核验记录，为平台掌握证据的汇总，并非独立认证，也不构成对供应商当前经营状况的担保。",
  } as Bi,
};

const FIELD_LABELS: Record<string, Bi> = {
  location: { en: "Location", zh: "所在地" },
  industry: { en: "Industry", zh: "行业" },
  businessType: { en: "Business type", zh: "企业类型" },
  established: { en: "Established", zh: "成立年份" },
  employees: { en: "Employees", zh: "员工人数" },
  mainProducts: { en: "Main products", zh: "主营产品" },
  exportMarkets: { en: "Export markets", zh: "出口市场" },
  certifications: { en: "Certifications", zh: "认证" },
  auditStatus: { en: "Audit status", zh: "审核状态" },
  inspectionHistory: { en: "Inspection history", zh: "验厂历史" },
};

const VL_LABELS: Record<string, Bi> = {
  unverified: { en: "Unverified", zh: "未核验" },
  self_assessment: { en: "Self-assessment", zh: "工厂自述" },
  platform_assessment: { en: "Platform assessment", zh: "平台评估" },
  on_site_audit: { en: "On-site audit", zh: "现场核验" },
  third_party_audit: { en: "Third-party audit", zh: "第三方审核" },
};

const AUDIT_TYPE_LABELS: Record<string, Bi> = {
  self_assessment: { en: "Self-assessment", zh: "工厂自述" },
  platform_assessment: { en: "Platform assessment", zh: "平台评估" },
  on_site_audit: { en: "On-site audit", zh: "现场核验" },
  third_party_audit: { en: "Third-party audit", zh: "第三方审核" },
};

const RESULT_LABELS: Record<string, Bi> = {
  pass: { en: "Pass", zh: "通过" },
  pass_with_findings: { en: "Pass with findings", zh: "有条件通过" },
  fail: { en: "Fail", zh: "未通过" },
  pending: { en: "Pending", zh: "待定" },
};

const AUDIT_STATUS_LABELS: Record<string, Bi> = {
  PENDING: { en: "Pending", zh: "待审核" },
  VERIFIED: { en: "Verified", zh: "已核验" },
  REJECTED: { en: "Rejected", zh: "已驳回" },
  EXPIRED: { en: "Expired", zh: "已过期" },
};

const SCOPE_LABELS: Record<string, Bi> = {
  "Business identity": { en: "Business identity", zh: "企业身份" },
  "Registration records": { en: "Registration records", zh: "注册文件" },
  "Certification documents": { en: "Certification documents", zh: "认证文件" },
  "Audit documentation": { en: "Audit documentation", zh: "审核文件" },
  "Factory address": { en: "Factory address", zh: "工厂地址" },
  "Production capability": { en: "Production capability", zh: "生产能力" },
  "On-site audit findings": { en: "On-site audit findings", zh: "现场审核发现" },
  "Quality system": { en: "Quality system", zh: "质量体系" },
};

const LEVEL_FROM_VL: Record<string, number> = {
  unverified: 0,
  self_assessment: 1,
  platform_assessment: 2,
  on_site_audit: 3,
  third_party_audit: 4,
};

const esc = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildSupplierReportHtml(
  input: SupplierReportInput,
  lang: ReportLang
): string {
  const bi = (b: Bi): string =>
    `<span class="bi" data-en="${esc(b.en)}" data-zh="${esc(b.zh)}">${esc(b[lang])}</span>`;

  const vl = LEVEL_FROM_VL[input.verificationLevel] ?? 0;
  const vlLabel =
    VL_LABELS[input.verificationLevel] ?? {
      en: input.verificationLevel,
      zh: input.verificationLevel,
    };

  // ---- 评分块（仅当有真实分数时渲染）----
  let scoreHtml = "";
  if (typeof input.riskScore === "number") {
    const band: RiskLevel = overallLevel(input.riskScore);
    const color = LEVEL_COLOR[band];
    scoreHtml = `
    <div class="scorebox">
      <div class="v" style="color:${color}">${esc(String(input.riskScore))}<small>/100</small></div>
      <div>
        <div class="b">${bi(DOC_UI.riskScore)}</div>
        <div class="band" style="color:${color}">${esc(band)}</div>
      </div>
    </div>`;
  }

  // ---- 核验状态 + 范围 ----
  // CS-D #19：优先用服务端注入的 resolver 状态（与 Public Profile 同源）；
  // 未注入时回退到 legacy verificationLevel（向后兼容旧调用方）。
  const badgeLabel = input.verificationBadgeLabel;
  let verifyHtml = `<div class="kv"><span class="k">${bi(
    badgeLabel ? DOC_UI.verificationStatus : DOC_UI.verificationLevel
  )}</span><span class="v">${esc(
    badgeLabel ?? vlLabel[lang] ?? input.verificationLevel
  )}</span></div>`;
  if (!badgeLabel && vl > 0) {
    const scope = LEVEL_SCOPE[vl as 0 | 1 | 2 | 3 | 4] ?? [];
    const chips = scope
      .map(
        (s) =>
          `<span class="chip">${bi(SCOPE_LABELS[s] ?? { en: s, zh: s })}</span>`
      )
      .join("");
    verifyHtml += `<div class="scope"><span class="k">${bi(
      DOC_UI.verificationScope
    )}</span><div class="chips">${chips}</div></div>`;
  }

  // ---- 档案字段（只渲染有值的）----
  const rows: string[] = [];
  const push = (label: Bi, value: string) => {
    if (value && value.trim())
      rows.push(
        `<div class="kv"><span class="k">${bi(label)}</span><span class="v">${esc(
          value
        )}</span></div>`
      );
  };
  const listStr = (arr: string[]) => arr.filter(Boolean).join("、");
  if (input.city || input.countryCode)
    push(FIELD_LABELS.location, [input.city, input.countryCode].filter(Boolean).join(", "));
  push(FIELD_LABELS.industry, input.industryCode ?? "");
  push(FIELD_LABELS.businessType, input.businessType ?? "");
  push(FIELD_LABELS.established, input.established != null ? String(input.established) : "");
  push(FIELD_LABELS.employees, input.employees ?? "");
  push(FIELD_LABELS.mainProducts, listStr(input.mainProducts));
  push(FIELD_LABELS.exportMarkets, listStr(input.exportMarkets));
  push(FIELD_LABELS.certifications, listStr(input.certifications));
  push(FIELD_LABELS.auditStatus, input.auditStatus ?? "");
  if (input.inspectionHistory)
    push(FIELD_LABELS.inspectionHistory, String(input.inspectionHistory));

  const profileHtml = rows.length
    ? `<section><h2>${bi(DOC_UI.profile)}</h2><div class="kvs">${rows.join(
        ""
      )}</div></section>`
    : "";

  // ---- 审核记录 ----
  let auditHtml = "";
  if (input.audits.length) {
    const body = input.audits
      .map((a) => {
        const rt =
          RESULT_LABELS[a.result ?? ""] ?? {
            en: a.result ?? "—",
            zh: a.result ?? "—",
          };
        const st =
          AUDIT_STATUS_LABELS[a.verificationStatus] ?? {
            en: a.verificationStatus,
            zh: a.verificationStatus,
          };
        const at =
          AUDIT_TYPE_LABELS[a.auditType] ?? {
            en: a.auditType,
            zh: a.auditType,
          };
        const findings =
          a.findingsCritical || a.findingsMajor || a.findingsMinor
            ? `<div class="fnote">${esc(
                `Critical ${a.findingsCritical} · Major ${a.findingsMajor} · Minor ${a.findingsMinor}`
              )}</div>`
            : "";
        const notes = a.notes ? `<div class="fnote">${esc(a.notes)}</div>` : "";
        const auditor = [a.auditorName, a.auditorOrg].filter(Boolean).join(" · ");
        const tagCls =
          a.verificationStatus === "VERIFIED"
            ? "ok"
            : a.verificationStatus === "REJECTED" || a.verificationStatus === "EXPIRED"
            ? "bad"
            : "mut";
        const extra = findings || notes ? `<tr><td colspan="5">${findings}${notes}</td></tr>` : "";
        return `<tr>
          <td>${bi(at)}</td>
          <td>${esc(a.auditDate)}</td>
          <td>${esc(auditor || "—")}</td>
          <td>${bi(rt)}</td>
          <td><span class="tag ${tagCls}">${bi(st)}</span></td>
        </tr>${extra}`;
      })
      .join("");
    auditHtml = `<section><h2>${bi(DOC_UI.auditHistory)}</h2>
      <div class="tw"><table><thead><tr>
        <th>${bi({ en: "Type", zh: "类型" })}</th>
        <th>${bi({ en: "Date", zh: "日期" })}</th>
        <th>${bi({ en: "Auditor", zh: "审核方" })}</th>
        <th>${bi({ en: "Result", zh: "结果" })}</th>
        <th>${bi({ en: "Status", zh: "状态" })}</th>
      </tr></thead><tbody>${body}</tbody></table></div></section>`;
  } else {
    auditHtml = `<section><h2>${bi(DOC_UI.auditHistory)}</h2><p class="note">${bi(
      DOC_UI.noAudits
    )}</p></section>`;
  }

  const genDate = (input.generatedAt || "").slice(0, 10);
  const htmlLang = lang === "zh" ? "zh" : "en";

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(input.legalName)} — ${esc(DOC_UI.title[lang])}</title>
<style>
  :root { --ink:#0f172a; --mut:#64748b; --line:#e2e8f0; --blue:#0f4c81; }
  * { box-sizing:border-box; }
  body { margin:0; background:#f7f9fc; color:var(--ink);
    font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; }
  .wrap { max-width:900px; margin:0 auto; padding:24px 16px 64px; }
  .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
  .toolbar h1 { font-size:20px; margin:0; }
  .btn { border:1px solid var(--blue); background:var(--blue); color:#fff; border-radius:8px; padding:8px 14px; font-size:14px; cursor:pointer; }
  .btn.ghost { background:#fff; color:var(--blue); }
  .paper { background:#fff; border:1px solid var(--line); border-radius:12px; padding:32px; margin-top:16px; box-shadow:0 1px 3px rgba(15,23,42,.06); }
  .rhead { border-bottom:1px solid var(--line); padding-bottom:16px; }
  .rhead .t { font-size:24px; font-weight:800; }
  .rhead .m { margin-top:8px; font-size:12px; color:var(--mut); }
  .scorebox { display:flex; gap:20px; align-items:center; background:#f1f5f9; border-radius:10px; padding:20px; margin-top:24px; }
  .scorebox .v { font-size:44px; font-weight:800; }
  .scorebox .v small { font-size:20px; color:#94a3b8; }
  .scorebox .b { font-weight:700; }
  .scorebox .band { font-weight:700; font-size:18px; }
  .kvs { margin-top:10px; }
  .kv { display:flex; justify-content:space-between; gap:16px; align-items:baseline; border-bottom:1px solid #eef2f7; padding:8px 0; }
  .kv .k { color:var(--mut); }
  .kv .v { text-align:right; font-weight:600; }
  .scope { margin-top:10px; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
  .chip { background:#eef2f7; color:#475569; border-radius:999px; padding:2px 10px; font-size:12px; }
  section h2 { font-size:17px; margin:32px 0 6px; }
  .tw { overflow-x:auto; border:1px solid var(--line); border-radius:8px; margin-top:10px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  thead { background:#f8fafc; color:var(--mut); }
  th { text-align:left; padding:8px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.03em; }
  td { padding:8px 12px; border-top:1px solid #eef2f7; color:#475569; }
  .tag { display:inline-block; border-radius:999px; padding:2px 8px; font-size:10px; font-weight:600; }
  .tag.ok { background:#e8f5ea; color:#1f7a36; }
  .tag.bad { background:#fdecea; color:#b42318; }
  .tag.mut { background:#eef2f7; color:#5b6b7e; }
  .fnote { font-size:12px; color:#94a3b8; padding:4px 12px 8px; }
  .note { font-size:13px; color:var(--mut); }
  .disclaimer { margin-top:24px; border-top:1px solid var(--line); padding-top:16px; font-size:12px; color:var(--mut); }
  @media print { body { background:#fff; } .toolbar { display:none !important; } .paper { border:0; box-shadow:none; padding:0; } .wrap { max-width:none; padding:0; } }
</style>
</head>
<body>
<div class="wrap">
  <div class="toolbar">
    <h1>${esc(DOC_UI.title[lang])}</h1>
    <div>
      <button class="btn ghost" id="langBtn" type="button">${esc(
        DOC_UI.langToggle[lang]
      )}</button>
      <button class="btn" type="button" onclick="window.print()">${esc(
        DOC_UI.print[lang]
      )}</button>
    </div>
  </div>

  <div class="paper">
    <div class="rhead">
      <div class="t">${esc(input.legalName)}</div>
      <div class="m">${bi(DOC_UI.issuedBy)}: FactoryAuditB2B</div>
      <div class="m">${bi(DOC_UI.generatedOn)}: ${esc(genDate)}</div>
      <div class="m">slug: ${esc(input.slug)}</div>
    </div>

    ${scoreHtml}
    ${verifyHtml}

    ${profileHtml}
    ${auditHtml}

    <p class="disclaimer">${bi(DOC_UI.disclaimer)}</p>
  </div>
</div>
<script>
  var lang = "${htmlLang}";
  document.getElementById("langBtn").addEventListener("click", function () {
    lang = lang === "zh" ? "en" : "zh";
    document.querySelectorAll(".bi").forEach(function (el) {
      el.textContent = el.getAttribute("data-" + lang) || el.textContent;
    });
    document.documentElement.lang = lang === "zh" ? "zh" : "en";
  });
</script>
</body>
</html>`;
}

/** 下载文件名（跨消费方统一） */
export function supplierReportFileName(slug: string, lang: ReportLang): string {
  return `factoryauditb2b-${slug}-verification-report-${lang}.html`;
}
