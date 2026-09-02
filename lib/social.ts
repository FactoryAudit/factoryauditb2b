/**
 * 全站社媒入口单一事实来源。
 * URL 为空表示该平台尚未开通，页面不渲染对应图标（禁假链接铁律）。
 * 开通后把主页 URL 填进对应平台即可，无需改页面。
 */
export type SocialPlatform = "facebook" | "youtube" | "linkedin";

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { platform: "facebook", url: "https://www.facebook.com/huawenli21" },
  { platform: "youtube", url: "" },
  { platform: "linkedin", url: "" },
];

/** 已配置真实 URL 的社媒入口（空 URL 自动剔除） */
export function activeSocialLinks(): SocialLink[] {
  return SOCIAL_LINKS.filter((s) => s.url.trim().length > 0);
}
