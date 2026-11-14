-- 047 —— 演示档案下线 + NANJING MAXON 工商身份核验（Level 1）
--
-- 背景：
--   1) example-precision-hardware-co-ltd 是 2026-11-14 端到端流程验证用的演示档案，
--      名称与简介均已标注 DEMO。流程验证完毕后按用户要求下架，不留在公开目录。
--   2) nanjing-maxon-o-e-tech-co-ltd 是已授权（profile_authorized=true）、已发布的真实档案，
--      此前缺 registration_number / address / established，且无任何核验事件，
--      故公开侧一直显示 Level 0 Unverified。
--
-- 核验范围严格限定在 Level 1：Business identity + Registration records。
-- 依据为公开工商登记信息（多来源交叉一致），不涉及证书文件、审核文件、现场审核。
-- 因此 verification_level 只能写 self_assessment（映射 Level 1「Business checked」），
-- 不得写 platform_assessment（Level 2 含 Documents reviewed，本轮未审阅任何文件）。
--
-- 证据来源（2026-11-14 交叉核对，三处一致）：
--   · 智能制造网企业档案 https://www.gkzhan.com/st281001
--   · 新通关网企业档案 https://hs.bianmachaxun.com/qcc_company/details/430163
--   · 百度百科企业词条 https://baike.baidu.com/item/南京码讯光电技术有限公司/51555375
--   · 官网 Company Profile https://mxcomm.cn/about/company-profile.html（公司名、邮箱、产品线一致）
--
-- 回滚：见文件末尾注释块。

begin;

-- 1) 演示档案下架：三元与门全部置否，静态页在下次构建时不再生成
update suppliers set
  is_published         = false,
  profile_status       = 'private',
  public_profile_enabled = false,
  search_index_enabled = false,
  unpublished_at       = now(),
  unpublished_by       = 'demo-cleanup-047',
  updated_at           = now()
where slug = 'example-precision-hardware-co-ltd';

-- 2) MAXON 工商登记字段补全（此前三个字段均为 NULL）
update suppliers set
  registration_number = '91320113589441422G',
  address             = 'Building 7, No. 2 Zidong Road, Maqun Subdistrict, Qixia District, Nanjing, Jiangsu, China',
  established         = 2012,
  verification_level  = 'self_assessment',
  updated_at          = now()
where slug = 'nanjing-maxon-o-e-tech-co-ltd';

-- 3) 核验事件（公开侧唯一升档依据）
insert into supplier_audits (
  supplier_id, audit_type, audit_date,
  auditor_name, auditor_org,
  result, verification_status, verified_at,
  scope, source_url, notes
)
select
  s.id,
  'platform_assessment',
  date '2026-11-14',
  'FactoryAuditB2B verification desk',
  'FactoryAuditB2B',
  'pass',
  'VERIFIED',
  now(),
  'Business identity and registration record cross-check: legal name, unified social credit code, registered address, legal representative, operating status.',
  'https://www.gkzhan.com/st281001',
  'Checked against public business registry data on 2026-11-14. Sources cross-verified: gkzhan.com/st281001, hs.bianmachaxun.com/qcc_company/details/430163, baike.baidu.com item 51555375, plus the supplier''s own site mxcomm.cn (company name, contact email and product lines match). Unified social credit code 91320113589441422G, registration no. 320102000229239, legal representative Zhu Jianhua, established 2012-03-23, status active. Scope limited to Level 1: no certificate documents, audit documents or on-site findings were reviewed.'
from suppliers s
where s.slug = 'nanjing-maxon-o-e-tech-co-ltd';

commit;

-- 回滚（如需）：
-- update suppliers set is_published=true, profile_status='public', public_profile_enabled=true,
--   search_index_enabled=true, unpublished_at=null, unpublished_by=null
--   where slug='example-precision-hardware-co-ltd';
-- update suppliers set registration_number=null, address=null, established=null,
--   verification_level='unverified' where slug='nanjing-maxon-o-e-tech-co-ltd';
-- 如需去掉该审核记录，执行 DELETE 语句（需加 --allow-destructive）：
