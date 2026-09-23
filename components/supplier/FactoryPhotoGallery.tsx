import type { PublicFactoryImage } from "@/lib/supplierImages";

/**
 * CS-A #7：工厂照片画廊（公开侧）
 *
 * 三条硬约束：
 *   1. 只渲染服务端筛过的图 —— status=APPROVED 且 visibility=PUBLIC（见
 *      lib/supplierImages.ts 的 listPublicFactoryImages），本组件不做二次筛选，
 *      以免"页面自己又判一遍"产生两套口径。
 *   2. **不加载 original**：src 一律指向 /api/supplier-image/{id}?v=display 或
 *      ?v=thumbnail。该路由不接受 original 参数 —— 原件在结构上没有出口。
 *   3. 固定 width/height + loading="lazy" + decoding="async"，避免布局抖动（CLS）。
 *      DB 没记录宽高时不硬填 0，而是交给浏览器按原始比例排布。
 *
 * 为什么用 <img> 而不是 next/image：
 *   Workers（Free）CPU 配额 10ms/请求，图片优化要走 sharp + 运行时处理，
 *   在这里跑会直接顶爆配额（线上 5xx 的主要成因）。压缩/去 EXIF 已在上传侧
 *   用客户端 canvas 完成，展示侧不做二次转码。
 */

export default function FactoryPhotoGallery({
  images,
  dict,
}: {
  images: PublicFactoryImage[];
  dict: { photosTitle: string; photosEmpty: string };
}) {
  return (
    <section className="mt-8 card p-6">
      <h2 className="text-xl font-bold text-[#0f172a]">{dict.photosTitle}</h2>
      {images.length === 0 ? (
        <p className="mt-3 text-sm text-[#94a3b8]">{dict.photosEmpty}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img) => (
            <li key={img.id} className="overflow-hidden rounded-lg border border-[#e2e8f0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/supplier-image/${img.id}?v=display`}
                alt=""
                loading="lazy"
                decoding="async"
                {...(img.width ? { width: img.width } : {})}
                {...(img.height ? { height: img.height } : {})}
                className="h-auto w-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
