// lib/pickGuideDesc.ts — 指南 meta description 的唯一取值入口（9 语）
//
// 背景：`Guide` 曾只有 `metaDescEn` / `metaDescZh` 两套，页面用
//   `pickZhPair(locale, g.metaDescEn, g.metaDescZh)`
// 取值 ⇒ 除 en / zh / zh-TW 外的 6 个语种（ja, es, de, fr, pt, ar）全部回退英文，
// 共 47 × 6 = 282 页显示的是英文描述。第 4 批起按批补齐这 6 个语种。
//
// 为什么单独成文件而不写进 `lib/guides.ts`：
//   `lib/guides.ts` 是**纯数据文件**（全文件零 import）。把取值逻辑（需依赖
//   `lib/tw.ts` 的繁化运行时与 `i18n/config` 的 Locale 类型）塞进去，会让这个
//   9000+ 行的数据文件对运行时工具产生依赖。数据与取值逻辑分离，且此处是**唯一**收口点。
//
// 缺失即回退 `metaDescEn` ⇒ 未补齐的语种行为与补齐前逐字一致（不会渲染空描述），
// 因此本函数可以先行上线、由后续批次逐批填入 metaDescJa/…/metaDescAr。

import type { Guide } from "./guides";
import type { Locale } from "@/i18n/config";
import { twText } from "./tw";
import { trLookup } from "./contentI18n";

export function pickGuideDesc(locale: Locale, g: Guide): string {
  switch (locale) {
    case "zh":
      return g.metaDescZh;
    // zh-TW 复用 zh 文案并就地繁化（与 lib/tw.ts 的既有策略一致，不改 tw.ts）
    case "zh-TW":
      return twText(g.metaDescZh);
    case "ja":
      return g.metaDescJa ?? trLookup("ja", g.metaDescEn) ?? g.metaDescEn;
    case "es":
      return g.metaDescEs ?? trLookup("es", g.metaDescEn) ?? g.metaDescEn;
    case "de":
      return g.metaDescDe ?? trLookup("de", g.metaDescEn) ?? g.metaDescEn;
    case "fr":
      return g.metaDescFr ?? trLookup("fr", g.metaDescEn) ?? g.metaDescEn;
    case "pt":
      return g.metaDescPt ?? trLookup("pt", g.metaDescEn) ?? g.metaDescEn;
    case "ar":
      return g.metaDescAr ?? trLookup("ar", g.metaDescEn) ?? g.metaDescEn;
    default:
      return g.metaDescEn;
  }
}
