import Link from "next/link";
import { activeSocialLinks, type SocialPlatform } from "@/lib/social";

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

/**
 * 社媒入口图标行。仅渲染 lib/social.ts 中已配置真实 URL 的平台，
 * 未开通的平台不出现（禁假链接）。aria-label 用平台名（品牌名不翻译）。
 */
export default function SocialLinks({ className = "" }: { className?: string }) {
  const links = activeSocialLinks();
  if (links.length === 0) return null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {links.map((s) => (
        <Link
          key={s.platform}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ICONS[s.platform].label}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6eef6] text-[#0f4c81] transition hover:bg-[#0f4c81] hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden>
            <path d={ICONS[s.platform].path} />
          </svg>
        </Link>
      ))}
    </div>
  );
}
