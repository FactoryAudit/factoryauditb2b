"use client";

// components/supplier/DirectoryWallBanner.tsx —— /suppliers 的登录墙提示条（阶段 1）
//
// 语义：未登录访客在目录页顶部看到的一条说明 + 登录入口。
//   真实公司名此时**不在页面上**（卡片渲染的是骨架条，见 DirectoryView.tsx）。
//
// 🔴 两条实现要点：
//   1. 判断只看 `me.authenticated`，**不看 `loading`**。
//      初始 loading 态的 me 恒为 visitor（见 AuthProvider），与预渲染出的
//      锁定视图一致 ⇒ 未登录访客（绝大多数）首屏即可见，且**无 JS 也能看到**。
//      代价：已登录用户会看到它消失一次 —— 这是方案 A 的既定代价，
//      且与"列表由锁定刷新为完整"发生在同一次 auth 解析里，视觉上是一体的。
//   2. 文案**全部由服务端传入**（复用既有键），本组件不硬编码任何句子：
//      · title       ← login.h1            （"Sign in"）
//      · note        ← login.metaDesc      （"Sign in to your … view supplier profiles …"）
//      · cta         ← login.form.submit   （"Sign in"）
//      · noAccount   ← login.noAccount     （"Don't have an account?"）
//      · registerCta ← login.registerLink  （"Create a free account"）
//      ⇒ 阶段 1 因此**零新增翻译键**（9 语叶子数闸门 3192 保持不变）。
//
// 埋点说明：本组件刻意**不发埋点**。原因：lib/analytics.ts 的三桶互斥铁律要求
//   事件名有明确归属（*_cta_click / *_view / *_submit），而"登录墙 CTA 点击"
//   尚无对应常量；擅自复用 `supplier_profile_view` 之类会把浏览层与点击层混桶。
//   当前可测路径已足够：登录页有 loginView；锁定卡片点击有
//   `supplier_profile_view` + value="locked"。

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function DirectoryWallBanner({
  loginHref,
  registerHref,
  title,
  note,
  cta,
  noAccount,
  registerCta,
}: {
  /** /login?next=<目录页>（已带语言前缀） */
  loginHref: string;
  /** /register（已带语言前缀） */
  registerHref: string;
  title: string;
  note: string;
  cta: string;
  noAccount: string;
  registerCta: string;
}) {
  const { me } = useAuth();

  if (me.authenticated) return null;

  return (
    <section className="card p-6 border-[#f0d7b4] bg-[#fff4e0]">
      <h2 className="text-lg font-bold text-[#171717]">{title}</h2>
      <p className="text-sm text-[#8a5410] mt-1 max-w-2xl">{note}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={loginHref} className="btn btn-primary font-semibold">
          {cta}
        </Link>
        <span className="text-sm text-[#8a5410]">
          {noAccount}{" "}
          <Link href={registerHref} className="underline font-medium">
            {registerCta}
          </Link>
        </span>
      </div>
    </section>
  );
}
