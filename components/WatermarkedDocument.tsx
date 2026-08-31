// components/WatermarkedDocument.tsx — 加水印的公开证件图
//
// 为什么需要：营业执照挂在公网，必然会被截图。水印的目的不是防下载，
// 是让每一张流出去的截图都能说明「这份文件是被谁、在什么时间、为了什么用途公开的」。
//
// 实现要点：
// - 斜向（-30°）大面积重复水印，裁剪边缘也跑不掉
// - 半透明，不影响阅读关键字段
// - 叠加文档编号与验证日期
// - 图片用 next/image 之外的方式：证件图可能含敏感信息，禁止被搜索引擎图片索引

export interface WatermarkInfo {
  line1: string;
  line2: string;
  verified: string;
  documentId: string;
}

export default function WatermarkedDocument({
  src,
  alt,
  watermark,
}: {
  src: string;
  alt: string;
  watermark: WatermarkInfo;
}) {
  const block = (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      style={{
        // 斜向重复铺满，截图任何一块都会带上水印
        backgroundImage: `repeating-linear-gradient(-30deg, transparent 0 110px, rgba(15,76,129,0.10) 110px 220px)`,
      }}
    >
      <div
        className="absolute inset-0 flex flex-wrap items-center justify-center gap-y-24 gap-x-10"
        style={{ transform: "rotate(-30deg) scale(1.6)" }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="text-center text-[#0f4c81] opacity-[0.16]">
            <div className="text-sm font-extrabold tracking-wider">{watermark.line1}</div>
            <div className="text-[10px] font-bold tracking-widest">{watermark.line2}</div>
            <div className="text-[10px] mt-1">
              {watermark.verified}
              {watermark.documentId ? ` · ${watermark.documentId}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <figure className="relative rounded-lg border border-[#e2e8f0] bg-white p-3">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-auto rounded"
          loading="lazy"
          decoding="async"
        />
        {block}
      </div>
      <figcaption className="mt-3 text-xs text-[#64748b] space-y-0.5">
        <div className="font-semibold text-[#0f172a]">{watermark.line1}</div>
        <div>{watermark.line2}</div>
        <div>{watermark.verified}</div>
        {watermark.documentId && <div>{watermark.documentId}</div>}
      </figcaption>
    </figure>
  );
}
