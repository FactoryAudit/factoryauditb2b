-- 043 —— 发布 5 家「已授权但停在草稿」的供应商档案（纯数据更新，无 DDL）
--
-- 背景（2026-11-14 核实）：
--   这 5 家都是通过站内入驻表单主动提交的申请，表单里 authorizeCompanyProfile = "yes"、
--   contactVisibility = "public"，注册接口据此写入了 suppliers 草稿
--   （profile_authorized = true / consent_version = '1.0' / public_profile_enabled = true）。
--   但 is_published 停在 false、profile_status 停在 'draft'、city 是 'unknown'、industry_code 为空
--   ⇒ lib/trustProfile.ts:isProfilePublic 的三元与门永远 false，档案永远不对外可见。
--
--   发布闸门（lib/supplierCompleteness.ts）的阻断项是：
--     profile_authorized / city / industry_code / main_products / country_code
--   这 5 家的 city 与 industry_code 缺失，其余三项已满足。本迁移补齐这两项 +
--   官网可核对的省市/地址/简介，然后置 is_published = true、profile_status = 'public'。
--
-- 数据来源（逐条核过，不是推断）：
--   · Seek Ribbon   —— 官网 About「manufacturing facilities in Xiamen (factory)」+ Contact 页地址
--   · 温州元恩      —— 官网「Based in Longgang, Wenzhou」+ 申请表单 employees=130 / established=2017
--   · JGN           —— 申请表单明文声明：公司地址在大连，工厂地址/归属/人数/年份/产能均未提供
--   · 南京 MAXON    —— 公司名与官网均指向 Nanjing；官网未给街道地址，故 address 留空
--   · 厦门翔龙      —— 公司名与官网 english_name 均为 Xiamen Green Land Food；官网未给街道地址
--
-- 刻意不做的事：
--   · 不改 verification_level（保持 unverified）—— 发布 ≠ 核验，页面会照实显示「未核验」；
--   · 不写 certifications（text[] 是自述层，证书未经审阅不得入库）；
--   · 不写 risk_score / completeness_percent（无核验即无评分）；
--   · 不把公司地址写成工厂地址（JGN 明确要求过这一点）。
--
-- 幂等：每条 WHERE 都带 is_published = false，重复执行影响 0 行。

-- 1) Seek Ribbon —— 缎带/蝴蝶结制造
UPDATE public.suppliers SET
  city = 'Xiamen',
  province = 'Fujian',
  industry_code = 'textiles',
  address = '205# Fengling RD, Jimei, Xiamen, China',
  established = 2010,
  export_since = 2011,
  export_markets = ARRAY['USA'],
  company_description = 'Ribbon manufacturer operating since 2010, producing grosgrain, satin, organza, velvet and custom-printed ribbons for packaging, retail and event use. The company states ISO 9001 certification and OEKO-TEX compliant dyes; certificates have not yet been reviewed by the platform.',
  profile_status = 'public',
  is_published = true
WHERE slug = 'seek-ribbon' AND is_published = false;

-- 2) 温州元恩 —— 保温/冷链包装制造
UPDATE public.suppliers SET
  city = 'Wenzhou',
  province = 'Zhejiang',
  industry_code = 'packaging',
  address = 'Longgang, Wenzhou, Zhejiang, China',
  established = 2017,
  employees = '130',
  company_description = 'Manufacturer of custom insulated and cold-chain packaging: foil insulated bags, cooler totes, box liners, pallet covers and ice packs. The company reports three production locations in Zhejiang, Shandong and Hunan totalling 28,800 m2. Capacity and headcount are company-stated and not yet verified.',
  profile_status = 'public',
  is_published = true
WHERE slug = 'wenzhou-yuanen-crafts-co-ltd' AND is_published = false;

-- 3) JGN —— 工业耐磨件（贸易供应商，地址是公司地址）
UPDATE public.suppliers SET
  city = 'Dalian',
  province = 'Liaoning',
  industry_code = 'machinery',
  address = 'Maike Building 168, Kunming Street, Dalian, Liaoning, China 116011',
  company_description = 'Supplier of industrial replacement wear parts and drawing-based custom metal components for wood grinding, crushing, mulching, road milling and pellet mills. The address shown is a company office in Dalian, not a factory address; factory location, ownership, workforce, founding year and certificates have not been provided.',
  profile_status = 'public',
  is_published = true
WHERE slug = 'jgn' AND is_published = false;

-- 4) 南京 MAXON —— 工业无线通信设备制造
UPDATE public.suppliers SET
  city = 'Nanjing',
  province = 'Jiangsu',
  industry_code = 'electronics',
  main_products = ARRAY[
    'Industrial WiFi modules',
    'Industrial wireless access points and bridges',
    'Embedded wireless boards',
    'Explosion-proof wireless APs, routers and DTUs',
    'Industrial Ethernet switches and serial device servers'
  ],
  company_description = 'Manufacturer of industrial wireless networking hardware: WiFi modules, access points, wireless bridges, embedded boards, explosion-proof wireless equipment and industrial Ethernet switches. Product specifications are company-published; no certificate has been reviewed by the platform yet.',
  profile_status = 'public',
  is_published = true
WHERE slug = 'nanjing-maxon-o-e-tech-co-ltd' AND is_published = false;

-- 5) 厦门翔龙食品 —— 冷冻果蔬出口（同时把临时 slug 换成正式 slug）
UPDATE public.suppliers SET
  slug = 'xiamen-green-land-food-co-ltd',
  city = 'Xiamen',
  province = 'Fujian',
  industry_code = 'food-beverage',
  company_description = 'Frozen food exporter based in Xiamen, supplying IQF frozen vegetables, fruit and mushrooms to importers, distributors and private-label customers. The company states it works with partner production sites; factory ownership, site-specific capacity and certificate scope have not yet been verified by the platform.',
  profile_status = 'public',
  is_published = true
WHERE slug = 'supplier-2' AND is_published = false;

-- 6) 授权时间回填：用申请提交时间，不用 now()（now() 会伪造出一个当天才授权的假事实）
UPDATE public.suppliers s
   SET authorized_at = l.created_at
  FROM public.leads l
 WHERE s.authorized_at IS NULL
   AND l.kind = 'supplier_application'
   AND l.email = s.contact_email
   AND s.slug IN (
     'seek-ribbon',
     'wenzhou-yuanen-crafts-co-ltd',
     'jgn',
     'nanjing-maxon-o-e-tech-co-ltd',
     'xiamen-green-land-food-co-ltd'
   );

-- 7) 把 lead 与档案关联起来（后台能看到「这条申请对应哪份档案」）
UPDATE public.leads l
   SET linked_supplier_id = s.id
  FROM public.suppliers s
 WHERE l.linked_supplier_id IS NULL
   AND l.kind = 'supplier_application'
   AND l.email = s.contact_email
   AND s.slug IN (
     'seek-ribbon',
     'wenzhou-yuanen-crafts-co-ltd',
     'jgn',
     'nanjing-maxon-o-e-tech-co-ltd',
     'xiamen-green-land-food-co-ltd'
   );

-- 让 PostgREST 立刻看到新数据（不改结构，仅为刷新 schema cache）
NOTIFY pgrst, 'reload schema';
