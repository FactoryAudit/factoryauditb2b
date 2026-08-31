"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_META, switchLocalePath, type Locale } from "@/i18n/config";

// 语言切换器：按当前路径切换到另一种语言，保留所在页面。
// 英文落在无前缀地址，其他语言带前缀。
export default function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">Language</span>
      <select
        aria-label="Language"
        value={current}
        onChange={(e) => router.push(switchLocalePath(pathname, e.target.value as Locale))}
        className="border border-[#e2e8f0] rounded-md px-2 py-1 text-sm text-[#0f172a] bg-white hover:border-[#0f4c81] focus:outline-none focus:border-[#0f4c81]"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_META[l].name}
          </option>
        ))}
      </select>
    </label>
  );
}
