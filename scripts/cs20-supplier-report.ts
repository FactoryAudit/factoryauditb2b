// scripts/cs20-supplier-report.ts
//
// CS-20（每工厂报告正文编辑器）交付回归。
//
// 跑法：
//   node scripts/run-regression.mjs cs20-supplier-report CS20_ROOT
//
// 分层：
//   A 冻结层：en 字典叶子数（本 CS 不新增任何字典键 ⇒ 常量必须仍是 3028）
//   B 净化器：NULL ≠ 0 / 越界拒绝 / 截断 / 未知键丢弃 / kind 互斥
//   C 模板  ：13 章骨架可用，且**零虚构值**（不得携带样张任何结论性数据）
//   D 渲染器：空章节不渲染、未评分显示「—」、未标注不显示「已核验」、免责声明兜底
//   E 迁移  ：supabase/cs20 两张脚本的结构与收权口径（含 MAINTAIN、aclexplode）
//   F 源码安全：API 有闸门与限流、编辑器默认不预选「已核验」、页面已接入
//   G 数据层（需 .env）：真实往返 —— 写 null 读回仍是 null（不是 0），随后清理
//
// ⚠️ 不得使用 top-level await（通用运行器打成 cjs）。整段包在 async IIFE 内。

import fs from "node:fs";
import path from "node:path";

const ROOT = (process.env.CS20_ROOT ?? process.cwd()).replace(/\\/g, "/");

// 自读 .env（运行器不加载 .env）—— 否则 G 段会退化，形成假 PASS
try {
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore */
}

import {
  DEFAULT_DISCLAIMER,
  REPORT_LIMITS,
  reportProgress,
  sanitizeReportDoc,
  sectionHasContent,
  type SupplierReportDoc,
} from "@/lib/supplierReports";
import { emptyReportTemplate } from "@/lib/supplierReportTemplate";
import { buildReportDocHtml } from "@/lib/supplierReportDocHtml";

let pass = 0;
let fail = 0;
let skip = 0;

function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? "  :: " + extra : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? "  :: " + extra : ""}`);
  }
}
function skipped(name: string, why: string) {
  skip++;
  console.log(`  SKIP  ${name}  :: ${why}`);
}
function section(t: string) {
  console.log("\n=== " + t + " ===");
}
function read(p: string): string {
  return fs.readFileSync(path.join(ROOT, p), "utf8");
}
/** 剥注释：先块注释、再行注释（(^|[^:]) 防切 https://） */
// 统一口径：见 scripts/stripComments.ts。
// 🔴 曾经这里各写一份「先块注释、再行注释」的两段正则 —— 当被扫文件的行注释里含 `/*`
//    （如 AccountMenu.tsx 的 `// /api/auth/*`），它会吞掉后面整段真实代码，
//    导致正向断言假 FAIL、反向断言假 PASS。
import { stripComments } from "./stripComments";
function countLeaves(obj: unknown): number {
  if (obj === null || typeof obj !== "object") return 1;
  if (Array.isArray(obj)) return obj.reduce<number>((a, x) => a + countLeaves(x), 0);
  return Object.values(obj as Record<string, unknown>).reduce<number>(
    (a, x) => a + countLeaves(x),
    0
  );
}

/** 造一份最小可用报告（用于渲染器断言） */
function docWith(p: Partial<SupplierReportDoc>): SupplierReportDoc {
  return {
    reportNumber: "",
    reportDate: "",
    preparedFor: "",
    overallScore: null,
    scoreNote: "",
    sections: [],
    actions: [],
    disclaimerEn: "",
    disclaimerZh: "",
    status: "draft",
    ...p,
  };
}

const HTML_OPTS = {
  supplierName: "Probe Factory Co., Ltd.",
  slug: "probe-factory",
  generatedAt: "2026-09-18T00:00:00.000Z",
};

const EN_LEAF = 3028;

(async () => {
  /* ======================================================================= */
  section("A. 冻结层：本 CS 不新增任何字典键");
  /* ======================================================================= */
  {
    const en = JSON.parse(read("i18n/dictionaries/en.json"));
    const leaves = countLeaves(en);
    check("A1 en 字典叶子数未变（仍 3028）", leaves === EN_LEAF, `实际 ${leaves}`);

    // 本 CS 是纯后台内部工具：不新增 9 语字典键，也不改任何字典文件
    const dicts = fs
      .readdirSync(path.join(ROOT, "i18n/dictionaries"))
      .filter((f) => f.endsWith(".json"));
    check("A2 词典文件齐 9 语", dicts.length === 9, `实际 ${dicts.length}`);

    const zh = JSON.parse(read("i18n/dictionaries/zh.json"));
    check(
      "A3 9 语键集与 en 一致（无孤儿键）",
      Object.keys(zh).length === Object.keys(en).length,
      `zh ${Object.keys(zh).length} vs en ${Object.keys(en).length}`
    );
  }

  /* ======================================================================= */
  section("B. 净化器：NULL ≠ 0 与白名单");
  /* ======================================================================= */
  {
    const base = { sections: [], actions: [] };

    const r1 = sanitizeReportDoc({ ...base, overallScore: null });
    check(
      "B1 overallScore=null ⇒ null（不是 0）",
      r1.ok && r1.doc.overallScore === null,
      r1.ok ? `实际 ${JSON.stringify(r1.doc.overallScore)}` : r1.error
    );

    const r2 = sanitizeReportDoc({ ...base, overallScore: 0 });
    check("B2 overallScore=0 ⇒ 保留 0（真实分数不被吞）", r2.ok && r2.doc.overallScore === 0);

    const r3 = sanitizeReportDoc({ ...base, overallScore: 101 });
    check("B3 overallScore=101 ⇒ invalid_score", !r3.ok && r3.error === "invalid_score");

    const r4 = sanitizeReportDoc({ ...base, overallScore: -1 });
    check("B4 overallScore=-1 ⇒ invalid_score", !r4.ok && r4.error === "invalid_score");

    const r5 = sanitizeReportDoc({ ...base, overallScore: 82.5 });
    check("B5 overallScore=82.5 ⇒ invalid_score（只要整数）", !r5.ok && r5.error === "invalid_score");

    const r6 = sanitizeReportDoc({ ...base, overallScore: "82" });
    check("B6 overallScore=\"82\" ⇒ 82", r6.ok && r6.doc.overallScore === 82);

    const r7 = sanitizeReportDoc({ ...base, overallScore: "" });
    check("B7 overallScore=\"\" ⇒ null（空不等于 0）", r7.ok && r7.doc.overallScore === null);

    const r8 = sanitizeReportDoc({ ...base, foo: "bar", hack: { x: 1 } });
    check(
      "B8 未知键被丢弃",
      r8.ok && !("foo" in (r8.doc as unknown as Record<string, unknown>)) && !("hack" in (r8.doc as unknown as Record<string, unknown>))
    );

    const longNo = "X".repeat(500);
    const r9 = sanitizeReportDoc({ ...base, reportNumber: longNo });
    check(
      "B9 超长字段被截断",
      r9.ok && r9.doc.reportNumber.length === REPORT_LIMITS.reportNumber,
      r9.ok ? `${r9.doc.reportNumber.length}` : r9.error
    );

    const r10 = sanitizeReportDoc({ ...base, reportDate: "18/09/2026" });
    check("B10 非法日期 ⇒ 空串（不代填）", r10.ok && r10.doc.reportDate === "");

    const r11 = sanitizeReportDoc({ ...base, status: "published" });
    check("B11 非法 status ⇒ 回落 draft", r11.ok && r11.doc.status === "draft");

    const r12 = sanitizeReportDoc("nope");
    check("B12 非对象 ⇒ invalid_body", !r12.ok && r12.error === "invalid_body");

    const r13 = sanitizeReportDoc({ ...base, actions: Array(200).fill({ en: "x", zh: "y" }) });
    check("B13 actions 超长数组被截断到上限", r13.ok && r13.doc.actions.length === REPORT_LIMITS.actions);

    // kind 互斥：fields 章不得残留 items/bullets；list 章不得残留 fields
    const r14 = sanitizeReportDoc({
      ...base,
      sections: [
        {
          no: "01",
          kind: "fields",
          fields: [{ lEn: "L", lZh: "标签", v: "值", level: "reported" }],
          items: [{ titleEn: "残留" }],
          bullets: [{ en: "残留", zh: "残留" }],
        },
        {
          no: "02",
          kind: "list",
          bullets: [{ en: "ok", zh: "好" }],
          fields: [{ lEn: "残留", v: "x" }],
        },
      ],
    });
    if (r14.ok) {
      const [s1, s2] = r14.doc.sections;
      check("B14 kind=fields ⇒ items/bullets 被清空", s1.items.length === 0 && s1.bullets.length === 0);
      check("B15 kind=list ⇒ fields 被清空", s2.fields.length === 0 && s2.bullets.length === 1);
      check("B16 来源分级原样保留（reported）", s1.fields[0].level === "reported");
    } else {
      check("B14 kind=fields ⇒ items/bullets 被清空", false, r14.error);
      check("B15 kind=list ⇒ fields 被清空", false, r14.error);
      check("B16 来源分级原样保留（reported）", false, r14.error);
    }

    // 非法来源分级回落 null（未标注），绝不默认成 verified
    const r17 = sanitizeReportDoc({
      ...base,
      sections: [{ no: "01", kind: "fields", fields: [{ lEn: "L", v: "v", level: "verified_ish" }] }],
    });
    check(
      "B17 非法 level ⇒ null（不得回落成 verified）",
      r17.ok && r17.doc.sections[0].fields[0].level === null
    );

    // 🔴 statusCol 的 null 不得被 Number(null)=0 吞掉
    const r18 = sanitizeReportDoc({
      ...base,
      sections: [
        {
          no: "01",
          kind: "table",
          table: {
            headers: [{ en: "A", zh: "甲" }, { en: "B", zh: "乙" }, { en: "C", zh: "丙" }],
            rows: [["1", "2", "3", "多余列会被截掉"]],
            statusCol: null,
          },
        },
      ],
    });
    if (r18.ok) {
      const t = r18.doc.sections[0].table;
      check("B18 statusCol=null ⇒ null（不是 0）", t !== null && t.statusCol === null, JSON.stringify(t?.statusCol));
      check("B19 表格列数严格对齐表头", t !== null && t.rows[0].length === 3, `实际 ${t?.rows[0].length}`);
    } else {
      check("B18 statusCol=null ⇒ null（不是 0）", false, r18.error);
      check("B19 表格列数严格对齐表头", false, r18.error);
    }

    const r20 = sanitizeReportDoc({
      ...base,
      sections: [
        { no: "01", kind: "table", table: { headers: [{ en: "A", zh: "甲" }], rows: [["1"]], statusCol: 5 } },
      ],
    });
    check("B20 statusCol 越界 ⇒ null", r20.ok && r20.doc.sections[0].table?.statusCol === null);

    const r21 = sanitizeReportDoc({
      ...base,
      sections: [{ no: "01", kind: "table", table: { headers: [], rows: [["x"]] } }],
    });
    check("B21 空表头 ⇒ table 置 null（不渲染空表）", r21.ok && r21.doc.sections[0].table === null);

    // 总量超限：40 章 × 100 条 × 2500 字 ≈ 2,000 万字符，稳超 40 万上限
    const hugeBullets = Array(100).fill({ en: "y".repeat(2500), zh: "中".repeat(2500) });
    const hugeSections = Array(40).fill({ no: "01", kind: "list", bullets: hugeBullets });
    const r22 = sanitizeReportDoc({ ...base, sections: hugeSections });
    check("B22 总量超限 ⇒ too_large", !r22.ok && r22.error === "too_large", r22.ok ? "未被拦住" : r22.error);

    // 单章内的数组越长越截断（不能靠 doc 总量兜底）
    const r23 = sanitizeReportDoc({
      ...base,
      sections: [{ no: "01", kind: "list", bullets: Array(500).fill({ en: "x", zh: "y" }) }],
    });
    check(
      "B23 单章 bullets 超长被截断",
      r23.ok && r23.doc.sections[0].bullets.length === REPORT_LIMITS.bullets,
      r23.ok ? `实际 ${r23.doc.sections[0].bullets.length}` : r23.error
    );
  }

  /* ======================================================================= */
  section("C. 模板：13 章骨架可用，且零虚构值");
  /* ======================================================================= */
  {
    const tpl = emptyReportTemplate();

    check("C1 模板 13 章", tpl.sections.length === 13, `实际 ${tpl.sections.length}`);
    check("C2 章节标题齐全（骨架可用）", tpl.sections.every((s) => s.titleZh.trim() && s.titleEn.trim()));
    check("C3 overallScore=null（不预填分数）", tpl.overallScore === null);
    check(
      "C4 报告编号/日期/对象全空（系统不代填）",
      tpl.reportNumber === "" && tpl.reportDate === "" && tpl.preparedFor === ""
    );
    check("C5 建议行动为空（不预填结论）", tpl.actions.length === 0);
    check(
      "C6 所有字段值清空",
      tpl.sections.every((s) => s.fields.every((f) => f.v === ""))
    );
    check(
      "C7 所有字段来源分级为 null（未标注）",
      tpl.sections.every((s) => s.fields.every((f) => f.level === null))
    );
    check(
      "C8 所有表格无数据行",
      tpl.sections.every((s) => !s.table || s.table.rows.length === 0)
    );
    check(
      "C9 时间轴/列表条目全空",
      tpl.sections.every((s) => s.items.length === 0 && s.bullets.length === 0)
    );
    check("C10 免责声明已兜底（非空）", tpl.disclaimerEn.trim() !== "" && tpl.disclaimerZh.trim() !== "");

    // 🔴 最关键的一条：模板序列化后不得出现样张的任何结论性数据
    const tplJson = JSON.stringify(tpl);
    const FORBIDDEN = [
      "Shenzhen XX",
      "CNY 8,000,000",
      "8,000,000",
      "CN-XXXX",
      "4403960",
      "SDD-2026",
      "SHAREHOLDER",
      "Shareholder A",
      "5.4M",
      "450,000",
      "22 min",
      "BSCI (amfori)",
      "OHSAS 18001",
      "91440300MA5E",
      "Zhang XX",
      "Li XX",
    ];
    const leaked = FORBIDDEN.filter((k) => tplJson.includes(k));
    check("C11 模板不含样张任何虚构数据", leaked.length === 0, leaked.length ? `泄漏：${leaked.join(", ")}` : "");

    // 🔴 引言必须不含数字（含数字 = 引用了某个具体工厂的数据，例如样张的「总分 82/100」）
    const introWithDigit = tpl.sections.filter(
      (s) => /\d/.test(s.introEn) || /\d/.test(s.introZh)
    );
    check(
      "C12 模板引言不含数字（不携带样张的具体数据）",
      introWithDigit.length === 0,
      introWithDigit.length ? `泄漏章节：${introWithDigit.map((s) => s.no).join(", ")}` : ""
    );
    check(
      "C13 样张「执行摘要」引言（含 82/100）已被剔除",
      tpl.sections[0].introZh === "" && tpl.sections[0].introEn === ""
    );

    const prog = reportProgress(tpl);
    check("C14 进度显示 0/13（有标题不算已填）", prog.filled === 0 && prog.total === 13, `实际 ${prog.filled}/${prog.total}`);
    check(
      "C15 模板所有章都被判定为「空」（导出件不出现空标题）",
      tpl.sections.every((s) => !sectionHasContent(s))
    );

    // 但「只有标题、无正文」时渲染件只出标题 —— 见 D 段
  }

  /* ======================================================================= */
  section("D. 渲染器：空章不渲染 / 未评分显示 — / 未标注不显示已核验");
  /* ======================================================================= */
  {
    const emptyHtml = buildReportDocHtml(docWith({}), "zh", HTML_OPTS);
    check("D1 纯空文档不含任何 <section>", !/<section>/.test(emptyHtml));
    check("D2 空文档仍含免责声明兜底", emptyHtml.includes("不构成认证"));
    check("D3 空文档仍含报告头（供应商名）", emptyHtml.includes("Probe Factory Co., Ltd."));
    check("D4 自包含：内联 style + script", emptyHtml.includes("<style>") && emptyHtml.includes("<script>"));
    check("D5 noindex（后台内部件不入索引）", emptyHtml.includes('name="robots"') && emptyHtml.includes("noindex"));
    check(
      "D6 无外部资源引用（可离线打开）",
      !/<(link|img|script)[^>]+(https?:)?\/\//i.test(emptyHtml)
    );

    // 未评分
    check("D7 未评分显示「—」", emptyHtml.includes("—"));
    check("D8 未评分显示「未评分」", emptyHtml.includes("未评分"));
    check(
      "D9 未评分不得出现 0/100 或「低风险」等档位文案",
      !emptyHtml.includes(">0<") && !emptyHtml.includes("低风险") && !emptyHtml.includes("极高风险")
    );

    // 已评分：档位来自确定性映射（高分=低风险；85+ = LOW）
    const scoredHtml = buildReportDocHtml(docWith({ overallScore: 82 }), "zh", HTML_OPTS);
    check("D10 82 分属中等风险档（>=70 <85）", scoredHtml.includes("82") && scoredHtml.includes("中等风险"));
    const lowHtml = buildReportDocHtml(docWith({ overallScore: 92 }), "zh", HTML_OPTS);
    check("D11 92 分属低风险档（>=85）", lowHtml.includes("92") && lowHtml.includes("低风险"));
    const critHtml = buildReportDocHtml(docWith({ overallScore: 20 }), "zh", HTML_OPTS);
    check("D12 20 分属极高风险档（<40），且方向与「高分=低风险」一致", critHtml.includes("极高风险"));
    check(
      "D13 报告日期留空 ⇒ 不渲染该行（不代填今天）",
      !emptyHtml.includes("报告日期") && !emptyHtml.includes("Report date")
    );

    // 来源分级
    const mixHtml = buildReportDocHtml(
      docWith({
        sections: [
          {
            no: "01",
            titleEn: "Fields",
            titleZh: "字段章",
            introEn: "",
            introZh: "",
            kind: "fields",
            fields: [
              { lEn: "Legal name", lZh: "企业名称", v: "Acme Co", level: null },
              { lEn: "Tax id", lZh: "税号", v: "12345", level: "verified" },
              { lEn: "Capacity", lZh: "产能", v: "self said", level: "reported" },
              { lEn: "Litigation", lZh: "涉诉", v: "none found", level: "none" },
            ],
            table: null,
            items: [],
            bullets: [],
          },
        ],
      }),
      "zh",
      HTML_OPTS
    );
    check("D14 未标注 ⇒ 显示「未标注」", mixHtml.includes("未标注"));
    check("D15 已核验 ⇒ 显示「已核验」", mixHtml.includes("已核验"));
    check("D16 企业自报 ⇒ 显示「企业自报」", mixHtml.includes("企业自报"));
    check("D17 无记录 ⇒ 显示「无记录」", mixHtml.includes("无记录"));

    // 未标注那一行**不得**被标成已核验：把该行单独切出来判定
    const rowStart = mixHtml.indexOf("企业名称");
    const rowEnd = mixHtml.indexOf("税号");
    const row = mixHtml.slice(rowStart, rowEnd);
    check(
      "D18 未标注的行内不含「已核验」",
      row.length > 0 && !row.includes("已核验"),
      row.length ? "" : "未能切出该行"
    );

    // 空章节整章不渲染
    const skipHtml = buildReportDocHtml(
      docWith({
        sections: [
          { no: "01", titleEn: "Empty", titleZh: "空章节", introEn: "", introZh: "", kind: "fields", fields: [], table: null, items: [], bullets: [] },
          { no: "02", titleEn: "Filled", titleZh: "有内容章节", introEn: "", introZh: "", kind: "list", fields: [], table: null, items: [], bullets: [{ en: "x", zh: "有内容" }] },
        ],
      }),
      "zh",
      HTML_OPTS
    );
    check("D19 无内容章节的标题不出现", !skipHtml.includes("空章节"));
    check("D20 有内容章节照常渲染", skipHtml.includes("有内容章节") && skipHtml.includes("有内容"));

    // 表头/值缺失与 table 渲染
    const tableHtml = buildReportDocHtml(
      docWith({
        sections: [
          {
            no: "01",
            titleEn: "Cert",
            titleZh: "认证",
            introEn: "",
            introZh: "",
            kind: "table",
            fields: [],
            table: {
              headers: [{ en: "Item", zh: "项目" }, { en: "Status", zh: "状态" }],
              rows: [["ISO 9001", "valid"], ["BSCI", ""]],
              statusCol: 1,
            },
            items: [],
            bullets: [],
          },
        ],
      }),
      "zh",
      HTML_OPTS
    );
    check("D21 表格渲染出表头与数据行", tableHtml.includes("项目") && tableHtml.includes("ISO 9001"));
    check("D22 空单元格显示「—」", tableHtml.includes(">—<") || tableHtml.includes("—"));

    // 🔴 模板残留的空字段行不得渲染；「标了来源分级但没填值」要渲染
    const partialHtml = buildReportDocHtml(
      docWith({
        sections: [
          {
            no: "01",
            titleEn: "Partial",
            titleZh: "部分填写",
            introEn: "",
            introZh: "",
            kind: "fields",
            fields: [
              // 模板残留：只有标签，值与分级都空 ⇒ 不渲染
              { lEn: "Registered capital", lZh: "注册资本", v: "", level: null },
              // 已查但无记录：有分级、无值 ⇒ 要渲染
              { lEn: "Litigation", lZh: "涉诉记录", v: "", level: "none" },
            ],
            table: null,
            items: [],
            bullets: [],
          },
        ],
      }),
      "zh",
      HTML_OPTS
    );
    check(
      "D23 只有标签的空字段行不渲染",
      !partialHtml.includes("注册资本"),
      partialHtml.includes("注册资本") ? "模板空位被渲染成了结论" : ""
    );
    check(
      "D24 「标了来源分级、值留空」照常渲染（表示已查无记录）",
      partialHtml.includes("涉诉记录") && partialHtml.includes("无记录")
    );
    check("D25 该章标题照常渲染（章内有内容）", partialHtml.includes("部分填写"));

    // 免责声明双语 + 语言切换数据属性
    check("D26 双语片段带 data-en/data-zh（可切换）", emptyHtml.includes('data-en="') && emptyHtml.includes('data-zh="'));

    // 草稿标记
    check("D27 草稿状态有 DRAFT 提示", emptyHtml.includes("草稿"));
    const finalHtml = buildReportDocHtml(docWith({ status: "final" }), "zh", HTML_OPTS);
    check("D28 定稿状态无草稿提示", !finalHtml.includes("草稿 ——"));
  }

  /* ======================================================================= */
  section("E. 迁移脚本：结构 + 收权口径");
  /* ======================================================================= */
  {
    const mig = read("supabase/cs20/02_migration.sql");
    const post = read("supabase/cs20/03_postcheck.sql");

    check("E1 建表（幂等）", mig.includes("CREATE TABLE IF NOT EXISTS public.supplier_reports"));
    check("E2 supplier_id NOT NULL UNIQUE（每工厂一行）", /supplier_id\s+uuid\s+NOT NULL UNIQUE/.test(mig));
    check("E3 FK 级联删除", /REFERENCES public\.suppliers\(id\) ON DELETE CASCADE/.test(mig));
    check(
      "E4 分数 CHECK 允许 NULL 且限 0..100",
      /overall_score IS NULL OR \(overall_score >= 0 AND overall_score <= 100\)/.test(mig)
    );
    check("E5 status CHECK（draft/final）", /status IN \('draft', 'final'\)/.test(mig));
    check("E6 jsonb 数组 CHECK", mig.includes("jsonb_typeof(sections) = 'array'") && mig.includes("jsonb_typeof(actions) = 'array'"));
    check("E7 复用既有 set_updated_at 触发器", mig.includes("EXECUTE FUNCTION public.set_updated_at()"));
    check("E8 RLS 开启", mig.includes("ENABLE ROW LEVEL SECURITY"));
    check("E9 仅 admin 可 select 的 policy", mig.includes("CREATE POLICY supplier_reports_admin_select") && mig.includes("USING (public.is_admin())"));
    check("E10 anon 全收", /REVOKE ALL ON public\.supplier_reports FROM anon;/.test(mig));
    check(
      "E11 authenticated 收全部写权限（含 MAINTAIN）",
      /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public\.supplier_reports FROM authenticated;/.test(mig)
    );
    check("E12 authenticated 仅 GRANT SELECT", /GRANT\s+SELECT ON public\.supplier_reports TO authenticated;/.test(mig));
    check("E13 版本登记 020", mig.includes("'020'"));
    check("E14 NOTIFY pgrst reload schema", mig.includes("NOTIFY pgrst, 'reload schema'"));
    check("E15 迁移不含业务数据 DML", !/^\s*(INSERT INTO public\.supplier_reports|UPDATE public\.supplier_reports|DELETE FROM public\.supplier_reports)/m.test(mig));

    check("E16 postcheck 用 aclexplode 判真实 ACL", post.includes("aclexplode"));
    check("E17 postcheck 是只读（无 DDL/DML 关键字）", !/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/.test(post.replace(/--.*$/gm, "")));
    check("E18 postcheck 覆盖 RLS/触发器/版本登记", post.includes("'rls'") && post.includes("'trigger'") && post.includes("'schema_migrations'"));
  }

  /* ======================================================================= */
  section("F. 源码安全与接线");
  /* ======================================================================= */
  {
    const api = stripComments(read("app/api/admin/suppliers/[slug]/report/route.ts"));
    check("F1 API 两个方法都过 requireAdmin", (api.match(/requireAdmin\(\)/g) ?? []).length >= 2);
    check("F2 API 有写限流", api.includes("checkRateLimit"));
    check("F3 API 落库前过净化器", api.includes("sanitizeReportDoc"));
    check("F4 API 无行时下发空模板（不下发样张）", api.includes("emptyReportTemplate"));
    check("F5 API 不回缓存", api.includes("no-store"));
    check(
      "F6 API 不 import 样张数据（standardReport）",
      !api.includes("standardReport")
    );

    const tplSrc = stripComments(read("lib/supplierReportTemplate.ts"));
    check("F7 模板生成器唯一用途就是空模板（导出无「带内容」函数）", /export function emptyReportTemplate/.test(tplSrc) && !/export function .*withContent/.test(tplSrc));
    check("F8 模板生成器只带标题/引言/列名/标签四类结构", tplSrc.includes("titleEn: s.title.en") && tplSrc.includes("lEn: f.label.en") && tplSrc.includes("rows: []"));
    check(
      "F8b 引言有「含数字即丢弃」的守门函数",
      /function reusableIntro/.test(tplSrc) && /!\/\\d\/\.test\(intro\)/.test(tplSrc)
    );

    const editor = stripComments(read("components/admin/SupplierReportEditor.tsx"));
    check("F9 编辑器来源分级默认「未标注」", editor.includes('<option value="">未标注</option>'));
    check(
      "F10 编辑器不预选「已核验」",
      !/defaultValue=\"verified\"|level:\s*\"verified\"|checked.*verified/i.test(editor)
    );
    check("F11 编辑器官网导出走同一渲染器", editor.includes("buildReportDocHtml"));
    check("F12 编辑器总分留空即未评分（不写 0）", editor.includes("return patch({ overallScore: null })"));
    check("F13 章节形态切换有确认（防误清空）", editor.includes("window.confirm"));

    const page = stripComments(read("app/[locale]/admin/suppliers/[slug]/page.tsx"));
    check("F14 工厂详情页已接入编辑器", page.includes("SupplierReportEditor"));
    check("F15 页面无记录时下发空模板", page.includes("emptyReportTemplate()"));
    check("F16 页面把 supplierName 传给编辑器（导出件用真实企业名）", page.includes("supplierName={row.legal_name}"));

    const lib = stripComments(read("lib/supplierReports.ts"));
    check("F17 净化器模块零 import（客户端可安全引用）", !/^\s*import\s/m.test(lib));
    check(
      "F18 净化器的 statusCol 有显式空值短路（防 Number(null)=0）",
      lib.includes('const scRaw = o.statusCol;') && lib.includes('String(scRaw).trim() !== ""')
    );
    check(
      "F19 净化器对 overallScore 也有空值短路（防 Number(\"\")=0）",
      lib.includes('String(rawScore).trim() !== ""')
    );

    const adminData = stripComments(read("lib/adminData.ts"));
    check("F20 写入层 updated_by 由服务端填", adminData.includes("updated_by: ctx?.email ?? ctx?.userId ?? \"system\""));
    check("F21 写入层打审计日志 report.save", adminData.includes('"report.save"'));
    check("F22 落库不把 null 分数补 0", /overall_score:\s*doc\.overallScore,/.test(adminData));
    check("F23 审计日志 targetType 已含 report", adminData.includes('| "report"'));
    check(
      "F24 读回也过净化器（库里脏数据不影响形状）",
      /function docFromReportRow[\s\S]*?sanitizeReportDoc\(/.test(adminData)
    );
  }

  /* ======================================================================= */
  section("G. 数据层：真实往返（null 不许变 0）");
  /* ======================================================================= */
  {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      skipped("G* 数据层", "无 SUPABASE 配置（未加载 .env）");
    } else {
      try {
        const { createAdminClient } = await import("@/lib/supabaseAdmin");
        const { getAdminSupplierReport, saveAdminSupplierReport } = await import("@/lib/adminData");
        const db = createAdminClient();
        if (!db) {
          skipped("G* 数据层", "createAdminClient 未配置");
        } else {
          // 找一个尚未有报告行的供应商，避免覆盖真实数据
          const { data: sups } = await db.from("suppliers").select("slug").order("slug").limit(50);
          const { data: taken } = await db.from("supplier_reports").select("supplier_id");
          const takenIds = new Set(
            ((taken ?? []) as { supplier_id: string }[]).map((r) => r.supplier_id)
          );
          let probeSlug: string | null = null;
          for (const s of ((sups ?? []) as { slug: string }[])) {
            const { data: one } = await db.from("suppliers").select("id").eq("slug", s.slug).maybeSingle();
            const id = (one as { id: string } | null)?.id;
            if (id && !takenIds.has(id)) {
              probeSlug = s.slug;
              break;
            }
          }

          if (!probeSlug) {
            skipped("G* 数据层", "所有供应商都已有报告行，跳过以免覆盖真实数据");
          } else {
            // 用真实 admin 的 userId（admin_audit_log.actor_id 有 profiles FK，
            // 随便编一个 UUID 会触发 FK 失败 —— 虽被 logAdminAction 吞掉，但会污染日志）
            const { data: adminRow } = await db
              .from("profiles")
              .select("id")
              .eq("role", "admin")
              .limit(1)
              .maybeSingle();
            const adminId = (adminRow as { id: string } | null)?.id ?? null;
            const ctx = {
              userId: adminId ?? "cs20-probe",
              email: "cs20-probe@example.com",
            };

            // G1：写「未评分」的报告
            const tpl = emptyReportTemplate();
            const w1 = await saveAdminSupplierReport(probeSlug, tpl, ctx);
            check("G1 空模板可落库", w1.ok, w1.ok ? "" : w1.error);

            const r1 = await getAdminSupplierReport(probeSlug);
            check("G2 读回成功", r1 !== null);
            check(
              "G3 🔴 overall_score 往返仍为 null（不是 0）",
              r1?.doc.overallScore === null && (r1?.doc.overallScore as unknown) !== 0
            );
            check("G4 sections 13 章往返完整", r1?.doc.sections.length === 13, `实际 ${r1?.doc.sections.length}`);
            check("G5 updated_by 为服务端写入的邮箱", r1?.updatedBy === "cs20-probe@example.com", `实际 ${r1?.updatedBy}`);

            // G6：写真实分数 + 内容
            const scored: SupplierReportDoc = {
              ...tpl,
              overallScore: 0,
              reportNumber: "FAB-PROBE-0001",
              reportDate: "2026-09-18",
              status: "final",
              actions: [{ en: "probe", zh: "探针" }],
            };
            const w2 = await saveAdminSupplierReport(probeSlug, scored, ctx);
            check("G6 覆盖保存成功", w2.ok, w2.ok ? "" : w2.error);

            const r2 = await getAdminSupplierReport(probeSlug);
            check("G7 🔴 0 分往返仍是 0（真实分数不被吞成 null）", r2?.doc.overallScore === 0);
            check("G8 报告编号/日期往返", r2?.doc.reportNumber === "FAB-PROBE-0001" && r2?.doc.reportDate === "2026-09-18");
            check("G9 status 往返为 final", r2?.doc.status === "final");
            check("G10 建议行动往返", r2?.doc.actions.length === 1 && r2?.doc.actions[0].zh === "探针");

            // G11：清理（只删自己写的行，先核对 updated_by 标记）
            const { data: rowBefore } = await db
              .from("supplier_reports")
              .select("id, supplier_id, updated_by")
              .eq("updated_by", "cs20-probe@example.com");
            const ids = ((rowBefore ?? []) as { id: string }[]).map((r) => r.id);
            check("G11 探针行确认为本脚本所写", ids.length === 1, `实际 ${ids.length}`);
            const { error: delErr } = await db.from("supplier_reports").delete().in("id", ids);
            check("G12 探针行已清理", !delErr, delErr?.message ?? "");
            const after = await getAdminSupplierReport(probeSlug);
            check("G13 清理后读回为 null", after === null);
          }
        }
      } catch (e) {
        check("G* 数据层执行未抛异常", false, e instanceof Error ? e.message : String(e));
      }
    }
  }

  console.log(`\n[cs20] PASS=${pass} FAIL=${fail} SKIP=${skip}`);
  if (fail > 0) process.exitCode = 1;
})();
