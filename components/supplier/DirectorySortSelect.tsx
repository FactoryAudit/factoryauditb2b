"use client";

// 目录页排序下拉（aguato 样式）：Best match / Company name。
// 用 useRouter + window.location.search（只在用户 onChange 时读），
// 不在渲染期读 searchParams ⇒ 预渲染页无 CSR bailout 风险。

import { useRouter } from "next/navigation";

export default function DirectorySortSelect({
  value,
  scoreLabel,
  nameLabel,
}: {
  value: "score" | "name";
  scoreLabel: string;
  nameLabel: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-[#6d6b66]">
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          const params = new URLSearchParams(window.location.search);
          if (v === "score") params.delete("sort");
          else params.set("sort", v);
          params.delete("page");
          const qs = params.toString();
          router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, {
            scroll: false,
          });
        }}
        className="border border-[#d3d1c7] rounded-md px-3 py-1.5 text-sm text-[#3f4650] bg-white"
      >
        <option value="score">{scoreLabel}</option>
        <option value="name">{nameLabel}</option>
      </select>
    </label>
  );
}
