-- 046_demo_supplier_journey_publish.sql
--
-- 用途：端到端验证「供应商注册 → 后台审核 → 发布 → 前台展示」整条链路。
--
-- 档案来源：2026-11-14 通过真实 HTTP 请求提交 /api/supplier-register 自动创建
--   （回执 LEAD-62ZUPM，draft id 84b9bccb-43c5-44a9-a6bb-cdded32345d5）。
--   本迁移只补「审核阶段人工该填、而注册表单没有的字段」+ 走发布闸门，不改写任何提交值。
--
-- 🔴 演示数据声明：company_description 与 report_summary 均写明 DEMO，避免被当作真实企业。
--    verification_level 依既有口径（lib/assessmentShared.ts）落 platform_assessment
--    —— 即「平台在线评估」，其定义为仅基于线上核验、不含现场审核；
--    绝不写 on_site_audit / third_party_audit，那两个等级意味着真的有人去过现场或第三方出过报告。

-- ── 1. 审核补全 + 发布 ──────────────────────────────────────────────────────
update suppliers set
  -- 注册接口不接收 province（表单无此字段），审核时人工补全；不补则完整度恒为 UNKNOWN。
  province = 'Zhejiang',
  -- FREE 层字段：注册买家可见，公开访客看不到。补上避免档案「有主体无介绍」。
  company_description =
    'Example Precision Hardware Co., Ltd. is a Ningbo-based manufacturer and exporter of precision CNC machined parts, stainless steel fasteners and aluminium housings. Founded in 2012, the company runs an 8,500 m2 plant with 180 staff and exports to Germany, the United States, Japan and Australia. '
    || 'This profile is a platform demonstration record used to validate the supplier onboarding and review workflow; it does not represent a real registered company.',
  profile_status = 'public',
  is_published = true,
  -- 平台在线评估（Level 1 语义：文件/线上核验，不含现场审核）。
  verification_level = 'platform_assessment',
  updated_at = now()
where slug = 'example-precision-hardware-co-ltd';

-- ── 2. 审核留痕（发起 → 审阅 → 发布 三步时间戳齐备）────────────────────────
insert into supplier_assessments (
  supplier_id,
  assessment_type,
  status,
  self_summary,
  report_number,
  report_summary,
  overall_grade,
  risk_level,
  submitted_at,
  reviewed_at,
  published_at
)
select
  s.id,
  'platform_assessment',
  'published',
  'Supplier submitted a complete profile through the public onboarding form and requested a platform review.',
  'PA-2026-1114-DEMO',
  E'■ DEMO RECORD — 本档案为平台流程演示数据，非真实企业，请勿作为采购依据。\n'
  || E'■ 提交路径：/join-supplier-network 公开表单真实 HTTP 提交（回执 LEAD-62ZUPM）。\n'
  || E'■ 字段完整性：公司名/英文名/公司类型/统一社会信用代码/官网/国家/城市/地址/员工数/厂房面积/成立年份/主营产品/产能/月产量/出口市场/出口起始年/联系人/邮箱/电话/WhatsApp/可见性/审核意愿 共 21 项齐备。\n'
  || E'■ 发布阻断项：city=Ningbo、industry_code=hardware、main_products=3 项、profile_authorized=true、country_code 非 unknown —— 五项全过。\n'
  || E'■ 未核验：营业执照原件、工厂实景照片、产能证明均未提交。本评估仅基于线上字段与表单自述，不含现场审核。\n'
  || E'■ 结论：演示评级 B / 风险档 low。发布目的为验证「注册 → 审核 → 前台展示」链路，不代表任何真实企业资质。',
  'B',
  'low',
  now() - interval '2 hours',
  now() - interval '30 minutes',
  now()
from suppliers s
where s.slug = 'example-precision-hardware-co-ltd'
  and not exists (
    select 1 from supplier_assessments a
    where a.supplier_id = s.id and a.assessment_type = 'platform_assessment'
  );
