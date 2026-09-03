"use client";

// components/QuotaBanner.tsx —— 免费额度用尽时的升级引导（固定底栏）
//
// 为什么要有这个组件：
//   额度用尽是**最强的付费意图信号** —— 用户刚看完 5 家，正处在"还想继续看"的状态。
//   但原先只把提示挂在 UnlockedValue 的 title 属性上：鼠标悬停才看得见，
//   移动端基本无效，等于把这个信号白白浪费掉。
//
// 为什么是固定底栏，而不是插在页面顶部：
//   插顶部会在 /api/me 返回后把整页内容往下推，产生一次 CLS。
//   这站是 SEO 站，Core Web Vitals 不能让。固定底栏零布局抖动，
//   而且跟着滚动走，曝光比顶部横幅更高。
//
// 整页只渲染一次：
//   UnlockedValue 在一页里会出现十几次，但引导只需要一条。
//   底层的 useUnlocked 有模块级缓存，所以这里再调一次不会多发请求。
//
// 只给"该看到的人"看：
//   游客（还没注册）、付费会员（不限量）、额度没用完的人都不该看到 ——
//   对他们是纯噪音，噪音会让人忽略真正重要的提示。

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUnlocked } from "./UnlockedValue";
import { ANALYTICS_EVENTS } from "@/lib/suppliers";
import { localePath, type Locale } from "@/i18n/config";

// 关掉后本次会话不再出现 —— 用户明确表示不想看，就别再烦他
const DISMISS_KEY = "quotaBannerDismissed";

export type QuotaBannerDict = {
  /** 按钮文案 */
  cta: string;
  /** 服务端没返回 quotaMessage 时的兜底说明（字典缺键等极端情况） */
  fallback: string;
  /** 关闭按钮的无障碍标签 */
  dismissLabel: string;
};

export default function QuotaBanner({
  slug,
  locale,
  contentLocale,
  labels,
}: {
  slug: string;
  /** 真实界面语言，用于拼站内链接（如 /de/membership） */
  locale: Locale;
  /**
   * 内容语言（en / zh / zh-TW），只用于取解锁数据。
   *
   * ⚠️ 必须和页面上 UnlockedValue 用的是同一个值，否则会多发一次请求：
   *    useUnlocked 的模块级缓存键是 `${slug}|${locale}|${tier}`，
   *    传不同的 locale 就是不同的键 —— 明明同一份数据却要请求两遍。
   */
  contentLocale: string;
  labels: QuotaBannerDict;
}) {
  const { data, loading } = useUnlocked(slug, contentLocale);
  // 初值 true = 默认不显示，挂载后才读 sessionStorage。
  // 这样服务端渲染与首帧都不会闪一下底栏（避免闪烁也算一种布局抖动）。
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // 隐私模式下 sessionStorage 可能抛错，忽略即可（底栏会一直显示，不影响功能）
    }
  }, []);

  if (loading || !data?.quotaExceeded || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 存不了就只是关不掉，不因此报错
    }
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0f172a] px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.25)]"
      // 移动端底部安全区（iPhone 小黑条），不能被系统手势条盖住按钮
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="container mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/90">
          {data.quotaMessage ?? labels.fallback}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={localePath(locale, "/membership")}
            data-track={ANALYTICS_EVENTS.unlockGateCta}
            data-track-value="quota"
            className="shrink-0 rounded-lg bg-[#d4232a] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
          >
            {labels.cta}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label={labels.dismissLabel}
            className="shrink-0 rounded p-1.5 text-white/60 transition hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
