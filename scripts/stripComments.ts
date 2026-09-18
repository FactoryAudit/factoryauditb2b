// scripts/stripComments.ts —— 剥离 TS/TSX 注释的**唯一正确口径**
//
// 为什么不能再用「先块注释、再行注释」两段正则：
//
//   实测（2026-09-18，cs05）：
//     components/AccountMenu.tsx 第 88 行的**行注释里含 `/*`**
//       // /login 页面与 /api/auth/* 后端都还在，需要时可直接输入 URL 访问，
//     先跑块注释正则 /\/\*[\s\S]*?\*\//g 时，这个 `/*` 被当成块注释起点，
//     一路吞到第 183 行的 `*/}`，把中间约 95 行**真实代码**整段删掉。
//     后果：正向断言「该文件读 me.planTier」假 FAIL；
//     更危险的是**反向断言**（"源码禁止某写法"）会因为代码被删而轻易通过 = 假 PASS。
//
//   两段正则的顺序救不了这种输入 —— 必须先判断「当前处在代码 / 注释 / 字符串哪一种状态」。
//
// 本实现是一个逐字符状态机：
//   · 字符串（' " `）整段原样保留 ⇒ `https://` 不会被误当行注释切掉（不需要 `(^|[^:])` 那种守卫）；
//   · 行注释遇到换行才结束 ⇒ 行注释里的 `/*` 不会再被当成块注释；
//   · 块注释保留换行 ⇒ 剥完的文本行号与原文对齐，便于定位；
//   · 处理 `\` 转义与模板串，`\`` 内结束。
//
// 已知边界（够用即可，别当通用 JS 解析器）：
//   · 不解析正则字面量 `/.../ `，因此正则里若出现 `//` 或 `/*` 会被误判为注释。
//     本仓库脚本扫描的目标文件里目前没有这种写法；真遇到再升级。
//   · 不处理 `<!-- -->`（HTML），本仓库源码用不到。
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  type Mode = "code" | "line" | "block" | "sq" | "dq" | "tpl";
  let mode: Mode = "code";

  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];

    if (mode === "code") {
      if (c === "/" && c2 === "/") {
        mode = "line";
        i += 2;
        continue;
      }
      if (c === "/" && c2 === "*") {
        mode = "block";
        i += 2;
        continue;
      }
      if (c === "'") mode = "sq";
      else if (c === '"') mode = "dq";
      else if (c === "`") mode = "tpl";
      out += c;
      i++;
      continue;
    }

    if (mode === "line") {
      if (c === "\n") {
        mode = "code";
        out += c;
      }
      i++;
      continue;
    }

    if (mode === "block") {
      if (c === "*" && c2 === "/") {
        mode = "code";
        i += 2;
        continue;
      }
      if (c === "\n") out += c; // 保留换行，行号不错位
      i++;
      continue;
    }

    // ---- 字符串内部：逐字保留，只处理转义与结束引号 ----
    if (c === "\\") {
      out += c + (c2 ?? "");
      i += 2;
      continue;
    }
    if (mode === "sq" && c === "'") mode = "code";
    else if (mode === "dq" && c === '"') mode = "code";
    else if (mode === "tpl" && c === "`") mode = "code";
    out += c;
    i++;
    continue;
  }

  return out;
}

/**
 * 剥注释器的自检用例。
 * 各回归脚本可直接复用 —— 否则「剥错了」这件事本身没人会发现（正是 2026-09-18 的教训）。
 * expectPresent = 剥完后 marker 是否还应当存在。
 */
export const STRIP_COMMENTS_SELFTEST: Array<{
  name: string;
  input: string;
  marker: string;
  expectPresent: boolean;
}> = [
  {
    name: "行注释里的 /* 不会误启块注释（会吞掉后面真实代码）",
    input: "// 见 /api/auth/* 路由\nconst KEEP = 1;\n",
    marker: "const KEEP = 1;",
    expectPresent: true,
  },
  {
    name: "字符串里的 // 与 /* 原样保留（https:// 不被切）",
    input: 'const u = "https://a.b/c"; /* x */ const v = 2;',
    marker: "https://a.b/c",
    expectPresent: true,
  },
  {
    name: "块注释内容被删除",
    input: "/* gone */ const w = 3;",
    marker: "gone",
    expectPresent: false,
  },
  {
    name: "行注释内容被删除（反向断言据此才可信）",
    input: "// isPaid ? x : y\nconst z = 1;",
    marker: "isPaid ?",
    expectPresent: false,
  },
  {
    name: "块注释保留换行（行号不错位）",
    input: "a\n/* 1\n2\n3 */\nb",
    marker: "a\n\n\n\nb",
    expectPresent: true,
  },
];
