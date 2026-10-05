-- =============================================================================
-- Migration 033 —— P1-16：已发布供应商的官方英文名回填（数据迁移）
--
-- ⚠️ 性质：**纯数据回填**。只写 `english_name` 一列，不动表结构、不动其它列。
--    每条 UPDATE 均带 `AND english_name IS NULL` ⇒ 幂等，且绝不覆盖已有人工值。
--
-- 背景：`suppliers.english_name` 列早已存在（lib/queries.ts:426 消费），
--   但 32 家已发布供应商里有 21 家的 `legal_name` 是中文，且 `english_name` 为 NULL，
--   于是英文站详情页的公司名/H1 直接渲染中文法人名。
--
-- 取值来源：逐家从「企业官网自称」或「权威公开来源（交易所资料/年报/官方文件/官方展会名录）」
--   取得，**无一条为中文直译或臆造**；每条的证据原文与出处见
--   outputs/_supplier_english_names.proposed.json（字段 evidence / evidence_url）。
--   其中 2 条 confidence=medium（xdshoe / puzzletoy，官网不可达，取自第三方权威名录）。
--
-- 回滚：把本迁移涉及的 21 行 `english_name` 置回 NULL 即可（写入前 21 行全为 NULL，已只读取证）。
--
-- 回填（21 条）：
--   chinabaixue                        Jiangsu Baixue Electric Appliances Co., Ltd.  [own-site/high]
--   chinasealant                       Guangzhou Baiyun Technology Co., Ltd.  [own-site/high]
--   cleanst                            Jinhua Jieling Housewares Co.,Ltd  [own-site/high]
--   cnushas                            Zhejiang Ushas Cosmetics Co., Ltd  [own-site/high]
--   cuori                              Cuori Electrical Appliances (Group) Company Limited  [own-site/high]
--   eastups                            East Group Co., Ltd.  [other-public-source/high]
--   eko                                EKO Development Limited  [own-site/high]
--   era                                ERA Co., Ltd.  [own-site/high]
--   jiajiachina                        Zhejiang JiaJia Ride-on Co.,Ltd.  [own-site/high]
--   jinmao                             Tianjin Jinmao Group  [own-site/high]
--   kelitong                           Zhuhai Kelitong Electronic Co., Ltd.  [own-site/high]
--   midearef                           Guangzhou Midea Hualing Refrigerator Co., Ltd.  [other-public-source/high]
--   nanjing-mxcomm                     Nanjing Maxon O.E. Tech. Co., Ltd.  [own-site/high]
--   petproducts                        Hangzhou Tianyuan Pet Products Co.,Ltd.  [own-site/high]
--   plusrite                           Plusrite Electric (China) Co., Ltd  [own-site/high]
--   puzzletoy                          Taizhou Shiwanxin Toy Co., Ltd.  [other-public-source/medium]
--   uechairs                           UE Furniture Co., Ltd.  [other-public-source/high]
--   wscfurniture                       Zhejiang Wanchang Furniture Co., Ltd.  [own-site/high]
--   xdshoe                             Guangdong XDDD Footwear Co., Ltd.  [other-public-source/medium]
--   ywbaolong                          Yiwu Baolong Packing Material Technology Co., Ltd.  [own-site/high]
--   zhengte                            Zhejiang Zhengte Co., Ltd.  [other-public-source/high]
-- =============================================================================

BEGIN;

UPDATE public.suppliers SET english_name = $en$Jiangsu Baixue Electric Appliances Co., Ltd.$en$
  WHERE slug = 'chinabaixue' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Guangzhou Baiyun Technology Co., Ltd.$en$
  WHERE slug = 'chinasealant' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Jinhua Jieling Housewares Co.,Ltd$en$
  WHERE slug = 'cleanst' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Zhejiang Ushas Cosmetics Co., Ltd$en$
  WHERE slug = 'cnushas' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Cuori Electrical Appliances (Group) Company Limited$en$
  WHERE slug = 'cuori' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$East Group Co., Ltd.$en$
  WHERE slug = 'eastups' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$EKO Development Limited$en$
  WHERE slug = 'eko' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$ERA Co., Ltd.$en$
  WHERE slug = 'era' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Zhejiang JiaJia Ride-on Co.,Ltd.$en$
  WHERE slug = 'jiajiachina' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Tianjin Jinmao Group$en$
  WHERE slug = 'jinmao' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Zhuhai Kelitong Electronic Co., Ltd.$en$
  WHERE slug = 'kelitong' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Guangzhou Midea Hualing Refrigerator Co., Ltd.$en$
  WHERE slug = 'midearef' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Nanjing Maxon O.E. Tech. Co., Ltd.$en$
  WHERE slug = 'nanjing-mxcomm' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Hangzhou Tianyuan Pet Products Co.,Ltd.$en$
  WHERE slug = 'petproducts' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Plusrite Electric (China) Co., Ltd$en$
  WHERE slug = 'plusrite' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Taizhou Shiwanxin Toy Co., Ltd.$en$
  WHERE slug = 'puzzletoy' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$UE Furniture Co., Ltd.$en$
  WHERE slug = 'uechairs' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Zhejiang Wanchang Furniture Co., Ltd.$en$
  WHERE slug = 'wscfurniture' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Guangdong XDDD Footwear Co., Ltd.$en$
  WHERE slug = 'xdshoe' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Yiwu Baolong Packing Material Technology Co., Ltd.$en$
  WHERE slug = 'ywbaolong' AND english_name IS NULL;

UPDATE public.suppliers SET english_name = $en$Zhejiang Zhengte Co., Ltd.$en$
  WHERE slug = 'zhengte' AND english_name IS NULL;

INSERT INTO public.schema_migrations (version, note)
VALUES (
  '033',
  'P1-16: backfill suppliers.english_name for 21 published suppliers whose legal_name was Chinese. Data-only, idempotent (guarded by english_name IS NULL). Evidence: outputs/_supplier_english_names.proposed.json.'
)
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
