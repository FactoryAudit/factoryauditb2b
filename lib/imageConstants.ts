// lib/imageConstants.ts —— 客户端安全的工厂照分类与限额常量
//
// ⚠️ 不得 import 任何服务端模块（createAdminClient / next/headers / supabase）。
//    供客户端组件（FactoryPhotoUploader）引用，避免把服务端依赖打进客户端包。
//    服务端 lib/supplierImages.ts 从此文件再导出，保持对外 API 不变。

/** 12 个工厂图片分类（§16） */
export const IMAGE_CATEGORIES = [
  "factory_exterior",
  "workshop",
  "production_line",
  "equipment",
  "qc_area",
  "warehouse",
  "office",
  "finished_goods",
  "packaging",
  "materials",
  "laboratory",
  "other",
] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export function isImageCategory(v: string): v is ImageCategory {
  return (IMAGE_CATEGORIES as readonly string[]).includes(v);
}

export const MAX_FACTORY_PHOTOS = 12;
