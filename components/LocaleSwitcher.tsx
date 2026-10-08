"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_META, switchLocalePath, type Locale } from "@/i18n/config";

// 语言切换器：按当前路径切换到另一种语言，保留所在页面。
// 英文落在无前缀地址，其他语言带前缀。
//
// 2026-10-08 改版（顶栏控件统一 · 方案 A）：原生 <select> → 自绘「地球 + 语言名 + 细箭头」胶囊。
// 改版原因（三条都在真机上可复现，不是审美偏好）：
//   1) 原生 select 的下拉箭头由**操作系统**绘制，Windows / macOS / 移动端三套外观，
//      同一份代码在三端长得不一样；自绘后三端一致。
//   2) 原生 select 只有 py-1（≈28px 高）、圆角 6px，而同排的 RFQ 主按钮是 48px ——
//      矮 20px 且圆角不齐，在 1280px 顶栏里像临时拼上去的。改后统一 40px / 圆角 9px。
//   3) 原来只有「英语」两个字，没有任何「这是语言选择器」的视觉暗示；现在补了地球图标。
//
// 两种呈现方式：
//   popup （默认，顶栏 ≥1280px）：点击后在下方浮出面板，点击外部 / Esc 关闭；
//   inline（移动端抽屉 <1280px）：在抽屉内**就地展开** —— 抽屉是 overflow-y-auto 容器，
//     浮层会被裁切并把滚动区撑高（实测会连带把底部 RFQ 按钮顶出视口），故改为文档流内展开。
//
// 无障碍：触发器 aria-haspopup/aria-expanded + aria-label（字典 t.nav.language）；
//   面板 role="menu" + 每项 role="menuitemradio" + aria-checked，键盘 Tab/Esc 可用。
// 文案：全部取自字典（languageLabel）与 LOCALE_META（语言自称名），零硬编码字符串。
export default function LocaleSwitcher({
  current,
  languageLabel,
  variant = "popup",
}: {
  current: Locale;
  languageLabel: string;
  /** popup = 顶栏浮层面板（默认）；inline = 移动端抽屉内就地展开 */
  variant?: "popup" | "inline";
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 只有浮层模式需要「点外部关闭」；inline 模式在抽屉里，再点一次触发器即可收起。
  useEffect(() => {
    if (!open || variant !== "popup") return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === current) return;
    router.push(switchLocalePath(pathname, next));
  }

  return (
    <div ref={wrapRef} className={variant === "inline" ? "w-full" : "relative shrink-0"}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={languageLabel}
        title={languageLabel}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[9px] border border-[#ddd9d0] bg-white ps-2.5 pe-2 text-[13px] font-semibold text-[#171717] transition-colors hover:border-[#171717] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e07a49]"
      >
        {/* 地球图标：补齐「这是语言选择器」的视觉暗示（原先没有） */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width={16}
          height={16}
          fill="none"
          stroke="#6d6b66"
          strokeWidth={1.6}
          focusable="false"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.5 2.6 2.5 15.4 0 18-2.5-2.6-2.5-15.4 0-18z" />
        </svg>
        <span>{LOCALE_META[current].name}</span>
        {/* 细箭头：与站点其他下拉（Solutions / More）同一套视觉语言 */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width={13}
          height={13}
          fill="none"
          stroke="#6d6b66"
          strokeWidth={2.4}
          strokeLinecap="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          focusable="false"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={languageLabel}
          className={
            variant === "popup"
              ? // end-0 而非 right-0：阿拉伯语（dir=rtl）下整块顶栏左右镜像，
                // 用物理 right-0 会把面板推到屏幕外。
                "absolute end-0 top-full z-40 mt-2 w-[188px] rounded-xl border border-[#ebe8e1] bg-white p-1.5 shadow-lg"
              : "mt-2 w-full rounded-xl border border-[#ebe8e1] bg-white p-1.5"
          }
        >
          {LOCALES.map((l) => {
            const active = l === current;
            return (
              <button
                key={l}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(l)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-start text-[13px] transition-colors ${
                  active
                    ? "bg-[#f7e7de] font-semibold text-[#c96235]"
                    : "text-[#171717] hover:bg-[#f5f3ee]"
                }`}
              >
                <span>{LOCALE_META[l].name}</span>
                {active && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    width={13}
                    height={13}
                    fill="none"
                    stroke="#c96235"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    focusable="false"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
