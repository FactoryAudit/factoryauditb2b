import Link from "next/link";
import { activeSocialLinks, type SocialPlatform } from "@/lib/social";
import { contactConfigured } from "@/lib/contact";
import { localePath, type Locale } from "@/i18n/config";

const ICONS: Record<SocialPlatform, { label: string; path: string }> = {
  facebook: {
    label: "Facebook",
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  youtube: {
    label: "YouTube",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  linkedin: {
    label: "LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
};

/** 微信图标（两个聊天气泡），单色 fill-current，品牌绿 #07C160。 */
const WECHAT_PATH =
  "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z";

/**
 * 社媒入口图标行。仅渲染 lib/social.ts 中已配置真实 URL 的平台，
 * 未开通的平台不出现（禁假链接）。aria-label 用平台名（品牌名不翻译）。
 *
 * 额外固定渲染一个微信图标（品牌绿），点击跳站内 /contact#wechat 扫码 ——
 * 微信是联系方式而非社媒主页，不进 sameAs，故不纳入 SOCIAL_LINKS。
 * locale 用于拼站内锚点链接（带语言前缀）；未传时回退无前缀路径。
 */
export default function SocialLinks({
  className = "",
  locale,
}: {
  className?: string;
  locale?: Locale;
}) {
  const links = activeSocialLinks();
  const showWechat = contactConfigured();
  if (links.length === 0 && !showWechat) return null;

  const wechatHref = locale
    ? `${localePath(locale, "/contact")}#wechat`
    : "/contact#wechat";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {links.map((s) => (
        <Link
          key={s.platform}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ICONS[s.platform].label}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f3ee] text-[#171717] transition hover:bg-[#171717] hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden>
            <path d={ICONS[s.platform].path} />
          </svg>
        </Link>
      ))}
      {showWechat && (
        <Link
          href={wechatHref}
          aria-label="WeChat"
          title="WeChat"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f3ee] text-[#07C160] transition hover:bg-[#07C160] hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden>
            <path d={WECHAT_PATH} />
          </svg>
        </Link>
      )}
    </div>
  );
}
