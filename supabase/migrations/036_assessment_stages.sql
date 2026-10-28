-- 036_assessment_stages.sql
-- 问卷分层：把「一次 72 题全必答」改成「基础档案（必答）→ 专项模块（按需）」
--
-- 背景（用户 2026-10-28 拍板）：
--   现有 SOCIAL_COMPLIANCE(37) + QUALITY(35) = 72 项检查点，全部 mandatory=true，
--   供应商一进自评页就被要求填 72 题 ⇒ 完成率极低。
--   改为两层：
--     stage='basic'  —— SUPPLIER_PROFILE，14 题事实型，填完即可提交审核发布档案
--     stage='module' —— QUALITY / SOCIAL_COMPLIANCE / ENVIRONMENT，供应商按需逐个填
--
-- 🔴 红线：
--   1. 不改动现有 72 题的任何一行（题目/编码/必答标记全部保留）。
--   2. 基础题是**事实型**（text/number/single_select），不是评分型；
--      评分型（C/PC/NC/CR）只属于专项模块，两者不可混。
--   3. 新增 ENVIRONMENT 模块为**空壳清单**，不代表已有核验能力；
--      供应商自评 ≠ 平台核验，页面标签必须区分。
--
-- 幂等可重跑。

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. audit_templates 增加 stage 列
-- -----------------------------------------------------------------------------
ALTER TABLE public.audit_templates
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'module';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_templates_stage_check'
  ) THEN
    ALTER TABLE public.audit_templates
      ADD CONSTRAINT audit_templates_stage_check CHECK (stage IN ('basic', 'module'));
  END IF;
END $$;

COMMENT ON COLUMN public.audit_templates.stage IS
  'basic=基础档案问卷（供应商必答，填完可提交发布）；module=专项模块（质量/社会责任/环保，按需填写）。';

-- 存量两个模板显式归为专项模块（DEFAULT 已回填，此处仅确保语义明确）
UPDATE public.audit_templates SET stage = 'module'
 WHERE code IN ('SOCIAL_COMPLIANCE', 'QUALITY');

-- -----------------------------------------------------------------------------
-- 2. 新增两个模板
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_templates (code, name, name_zh, description, is_active, stage) VALUES
  ('SUPPLIER_PROFILE', 'Supplier Profile Questionnaire', '供应商基础档案问卷',
   '14 项事实型问题：企业身份、生产实体、业务能力。填完即可提交档案审核发布，不涉及任何符合性评分。',
   true, 'basic'),
  ('ENVIRONMENT', 'Supplier Environmental Checklist', '供应商环保审核清单',
   'Buyer Due Diligence Edition。ISO 14001 概念 / 中国排污许可与危废管理要求；2 组 10 项检查点（A–B）。',
   true, 'module')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. 分组
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_sections (template_id, section_code, title, title_zh, sort_order) VALUES
  ((SELECT id FROM public.audit_templates WHERE code='SUPPLIER_PROFILE'),'A','Company Identity','企业身份',1),
  ((SELECT id FROM public.audit_templates WHERE code='SUPPLIER_PROFILE'),'B','Production Facility','生产实体',2),
  ((SELECT id FROM public.audit_templates WHERE code='SUPPLIER_PROFILE'),'C','Business Capability','业务能力',3),
  ((SELECT id FROM public.audit_templates WHERE code='ENVIRONMENT'),'A','Environmental Management & Compliance','环境管理与合规',1),
  ((SELECT id FROM public.audit_templates WHERE code='ENVIRONMENT'),'B','Pollution Control & Chemical Substances','污染防治与化学物质',2)
ON CONFLICT (template_id, section_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. 基础档案题（14 项）—— SP01..SP14，事实型，不打分
--    mandatory：核心 12 项必答；官网 / 设备数量为选填。
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_questions
  (section_id, question_code, title, title_zh, requirement, requirement_zh,
   response_type, options, severity_if_failed, mandatory, sort_order)
VALUES
  -- ===== A 企业身份 =====
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='A'),
   'SP01','Legal company name (Chinese)','企业法定名称（中文）',
   'Exactly as printed on the business licence','与营业执照完全一致',
   'text',NULL,NULL,true,1),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='A'),
   'SP02','Legal company name (English)','企业英文名称',
   'Your registered or commonly used English name','注册英文名或对外常用英文名',
   'text',NULL,NULL,true,2),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='A'),
   'SP03','Unified social credit code','统一社会信用代码',
   '18 characters, from the business licence','18 位，取自营业执照',
   'text',NULL,NULL,true,3),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='A'),
   'SP04','Business type','企业类型',
   'Whether you manufacture, trade, or both','自产、贸易还是两者兼有',
   'single_select','["factory","trading","both","other"]'::jsonb,NULL,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='A'),
   'SP05','Year established','成立年份',
   'Four-digit year','四位年份',
   'number',NULL,NULL,true,5),

  -- ===== B 生产实体 =====
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='B'),
   'SP06','Factory site address','工厂实际地址',
   'Province, city, district and street of the site where production happens — not the registered office if different',
   '省/市/区+详细地址；生产地，若与注册地不同请填生产地',
   'text',NULL,NULL,true,1),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='B'),
   'SP07','Site ownership','厂房权属',
   'Owned, leased, or largely outsourced','自有、租赁或以委外为主',
   'single_select','["owned","leased","mixed","outsourced"]'::jsonb,NULL,true,2),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='B'),
   'SP08','Total employees','员工总人数',
   'Headcount on site, including production and office','厂区在册人数，含生产与办公',
   'number',NULL,NULL,true,3),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='B'),
   'SP09','Built-up floor area (m²)','厂房建筑面积（平方米）',
   'Total production and warehouse floor area','生产与仓储建筑面积合计',
   'number',NULL,NULL,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='B'),
   'SP10','Main production lines','主要生产线数量',
   'Count of principal production lines or cells','主要产线/生产单元数量',
   'number',NULL,NULL,false,5),

  -- ===== C 业务能力 =====
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='C'),
   'SP11','Main product categories','主营产品类别',
   'List 3–6 categories in English, comma separated','英文填写 3–6 个类别，逗号分隔',
   'text',NULL,NULL,true,1),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='C'),
   'SP12','Main export markets','主要出口市场',
   'Regions or countries you actually ship to','实际出货到的国家或地区',
   'text',NULL,NULL,true,2),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='C'),
   'SP13','Management system certificates held','持有的管理体系证书',
   'Only certificates currently valid in your company name','仅填以本公司名义、当前有效的证书',
   'single_select','["iso9001","iso14001","bsci","smeta","sa8000","other","none"]'::jsonb,NULL,true,3),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SUPPLIER_PROFILE' AND s.section_code='C'),
   'SP14','Company website','公司官网',
   'Full URL including https://; leave blank if none','完整网址含 https://；没有可留空',
   'text',NULL,NULL,false,4);

-- -----------------------------------------------------------------------------
-- 5. 环保模块（10 项）—— EV01..EV10，评分型（与现有两模块同档 C/PC/NC/CR）
--    ⚠️ 这是「自评清单」，不是平台核验结论；不得据此显示 Verified。
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_questions
  (section_id, question_code, title, title_zh, requirement, requirement_zh,
   response_type, options, severity_if_failed, mandatory, sort_order)
VALUES
  -- ===== A 环境管理与合规 =====
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='A'),
   'EV01','An environmental management system is in place and running','已建立并运行环境管理体系',
   'ISO 14001 certificate or equivalent internal system with owner and review cycle','ISO14001 证书或等效内部体系（含责任人与评审周期）',
   'single_select','["C","PC","NC","CR"]'::jsonb,'major',true,1),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='A'),
   'EV02','Environmental impact approval and pollutant discharge permit are valid','环评批复与排污许可证有效',
   'Approval document + permit number, checked against the site and product scope','批复文件+许可证编号，核对企业与产线范围',
   'single_select','["C","PC","NC","CR"]'::jsonb,'critical',true,2),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='A'),
   'EV03','No environmental administrative penalty in the last three years','近三年无环保行政处罚',
   'Public enforcement records + company declaration','公开处罚记录+企业声明',
   'single_select','["C","PC","NC","CR"]'::jsonb,'major',true,3),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='A'),
   'EV04','Environmental emergency plan exists and has been drilled','有环境应急预案并已演练',
   'Plan document + drill record with date','预案文件+带日期的演练记录',
   'single_select','["C","PC","NC","CR"]'::jsonb,'minor',true,4),

  -- ===== B 污染防治与化学物质 =====
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='B'),
   'EV05','Wastewater treatment facilities operate and are monitored','废水处理设施正常运行并有监测记录',
   'Treatment facility + monitoring/entrustment testing reports','处理设施+自行监测或委托检测报告',
   'single_select','["C","PC","NC","CR"]'::jsonb,'major',true,1),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='B'),
   'EV06','Air emissions are captured and treated','废气有收集与处理设施',
   'Collection hoods, treatment units, maintenance records','集气罩、处理设施、维护记录',
   'single_select','["C","PC","NC","CR"]'::jsonb,'major',true,2),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='B'),
   'EV07','Hazardous waste is segregated, stored properly and transferred to a licensed party','危废分类贮存并交有资质单位处置',
   'Storage area + manifest/transfer records with licence number','贮存场所+转移联单及处置方资质',
   'single_select','["C","PC","NC","CR"]'::jsonb,'critical',true,3),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='B'),
   'EV08','Chemicals have MSDS and are stored by compatibility','化学品有 MSDS 且按相容性分区存放',
   'MSDS set + storage layout + secondary containment','MSDS 清单+存放分区+防泄漏措施',
   'single_select','["C","PC","NC","CR"]'::jsonb,'major',true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='B'),
   'EV09','Restricted substances are controlled against buyer requirements','限用物质按买方要求受控',
   'Declarations/test reports for RoHS, REACH or buyer RSL as applicable','RoHS/REACH 或买方 RSL 声明与检测报告',
   'single_select','["C","PC","NC","CR"]'::jsonb,'major',true,5),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='ENVIRONMENT' AND s.section_code='B'),
   'EV10','Energy and water consumption are metered and reviewed','能耗与水耗有计量并定期复核',
   'Meters + monthly/annual consumption records','计量表+月度或年度消耗记录',
   'single_select','["C","PC","NC","CR"]'::jsonb,'minor',true,6);

COMMIT;

NOTIFY pgrst, 'reload schema';
