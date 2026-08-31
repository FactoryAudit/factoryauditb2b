"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";

export default function AuthMenu({
  locale,
  labels,
}: {
  locale: Locale;
  labels: { signIn: string; admin: string; signOut: string };
}) {
  const { data: session, status } = useSession();
  // 所有内部链接必须带语言前缀，否则 zh 站点点登录会被 rewrite 到英文页
  const p = (href: string) => localePath(locale, href);

  if (status === "loading") {
    return <span className="btn btn-outline opacity-60">…</span>;
  }

  if (!session?.user) {
    return (
      <Link href={p("/login")} className="btn btn-outline">
        {labels.signIn}
      </Link>
    );
  }

  const role = (session.user as { role?: string }).role;

  return (
    <div className="flex items-center gap-2">
      {role === "ADMIN" && (
        <Link href={p("/admin")} className="btn btn-outline">
          {labels.admin}
        </Link>
      )}
      <span className="text-sm text-[#0f172a] hidden sm:inline max-w-[140px] truncate">
        {session.user.name || session.user.email}
      </span>
      <button onClick={() => signOut({ callbackUrl: p("/") })} className="btn btn-outline">
        {labels.signOut}
      </button>
    </div>
  );
}
