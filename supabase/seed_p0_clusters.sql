-- =============================================================================
-- STEP 09 ROUTE-02 —— P0 产业带种子数据（8 条）
--
-- ⚠️ 仅含客观地理 / 行业事实，不编造任何供应商数、交易额、评价或指标。
--   供应商关联（cluster_slug）留 NULL：当前 suppliers.cluster_slug 全为 NULL，
--   关联是后续独立 Change Set，不在本次范围。
--
-- 幂等：每条按 slug 去重（已存在则跳过），可反复执行不报错。
-- =============================================================================

INSERT INTO public.industrial_clusters
  (name, slug, country, country_code, region, province, city, industry, industry_tags, description, seo_title, seo_description, is_published, sort_order)
SELECT v.* FROM (VALUES
  ('江门家居厨房用品产业带','jiangmen-home-kitchen','China','CN','South China','Guangdong','Jiangmen','Home & Kitchen',
   ARRAY['home-kitchen','hardware'],
   '江门是中国重要的家居厨房用品与五金制造基地，聚集大量 OEM/ODM 出口工厂，覆盖不锈钢厨具、小家电配件等。',
   'Jiangmen Home & Kitchen Products Manufacturing Cluster | FactoryAuditB2B',
   'Source verified home and kitchen product manufacturers in Jiangmen, Guangdong. Factory audits, supplier verification and RFQ support for B2B buyers.',
   true, 10),

  ('中山照明产业带','zhongshan-lighting','China','CN','South China','Guangdong','Zhongshan','Lighting',
   ARRAY['lighting','led'],
   '中山（古镇）是全球最大的照明灯具制造与集散基地，LED 光源、商业照明、户外灯具供应链完整。',
   'Zhongshan Lighting Manufacturing Cluster | FactoryAuditB2B',
   'Source verified lighting manufacturers in Zhongshan, Guangdong. LED, commercial and outdoor lighting suppliers with factory audit support.',
   true, 20),

  ('佛山家具产业带','foshan-furniture','China','CN','South China','Guangdong','Foshan','Furniture',
   ARRAY['furniture','home-furnishing'],
   '佛山（顺德）是中国最大的家具制造与贸易中心，覆盖软体家具、实木家具、金属家具及配套产业链。',
   'Foshan Furniture Manufacturing Cluster | FactoryAuditB2B',
   'Source verified furniture manufacturers in Foshan, Guangdong. Sofa, wooden and metal furniture suppliers with factory audit support.',
   true, 30),

  ('东莞电子制造产业带','dongguan-electronics','China','CN','South China','Guangdong','Dongguan','Electronics',
   ARRAY['electronics','pcba','consumer-electronics'],
   '东莞是全球电子制造重镇，拥有完整的 PCBA、消费电子、连接器与精密制造供应链，代工与自有品牌并存。',
   'Dongguan Electronics Manufacturing Cluster | FactoryAuditB2B',
   'Source verified electronics manufacturers in Dongguan, Guangdong. PCBA, consumer electronics and EMS suppliers with factory audit support.',
   true, 40),

  ('泰国罗勇汽车制造产业带','rayong-automotive','Thailand','TH','Eastern Thailand',NULL,'Rayong','Automotive',
   ARRAY['automotive','autoparts'],
   '罗勇（Rayong）是泰国东部经济走廊（EEC）核心，聚集整车厂与零部件供应商，是日本及全球车企的制造基地。',
   'Rayong Automotive Manufacturing Cluster | FactoryAuditB2B',
   'Source verified automotive parts manufacturers in Rayong, Thailand. OEM and Tier suppliers with factory audit support.',
   true, 50),

  ('越南北宁电子制造产业带','bac-ninh-electronics','Vietnam','VN','Northern Vietnam',NULL,'Bac Ninh','Electronics',
   ARRAY['electronics','pcba'],
   '北宁（Bac Ninh）是越南北部电子制造中心，大型工厂带动上下游 PCBA 与组件供应链。',
   'Bac Ninh Electronics Manufacturing Cluster | FactoryAuditB2B',
   'Source verified electronics manufacturers in Bac Ninh, Vietnam. PCBA and component suppliers with factory audit support.',
   true, 60),

  ('印尼巴淡电子制造产业带','batam-electronics','Indonesia','ID','Riau Islands',NULL,'Batam','Electronics',
   ARRAY['electronics','pcba'],
   '巴淡（Batam）是印尼靠近新加坡的免税加工区，承接电子组装与精密制造，是印尼制造业前沿。',
   'Batam Electronics Manufacturing Cluster | FactoryAuditB2B',
   'Source verified electronics manufacturers in Batam, Indonesia. PCBA and assembly suppliers with factory audit support.',
   true, 70),

  ('印尼茉莉芬家具产业带','jepara-furniture','Indonesia','ID','Central Java',NULL,'Jepara','Furniture',
   ARRAY['furniture','wooden-furniture'],
   '茉莉芬（Jepara）是印尼著名的传统木制家具之乡，以手工与实木家具出口闻名。',
   'Jepara Furniture Manufacturing Cluster | FactoryAuditB2B',
   'Source verified furniture manufacturers in Jepara, Indonesia. Teak and wooden furniture suppliers with factory audit support.',
   true, 80)
) AS v(name, slug, country, country_code, region, province, city, industry, industry_tags, description, seo_title, seo_description, is_published, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.industrial_clusters WHERE slug = v.slug);
