-- 050: 补齐 6 家供应商简介（来源：企业官网 meta/About，2026-11-14 抓取）
--
-- 背景：36 家已发布档案有官网但无 company_description。抓了 36 个站点：
--   29 家 HTTP 200，18 家有可用 meta，最终只有这 6 条同时满足：
--   英文、80–320 字、无电话/邮箱/价格、无员工数/厂房面积/产能/注册资本
--   （后四项属免费层锁区数据，写进公开简介等于绕开门控）、非纯产品清单、非夸大措辞。
--   其余 30 家：WAF 拦截 5、无有效文本 13、产品清单 6、含锁区数据 4、中文 2。
--
-- 口径：
--   1. 原文来自企业自己的官网 ⇒ 公开页标注 Self-reported（sp.selfReported），不冒充平台结论。
--   2. 只做删除式修剪（去掉 CTA / 产品枚举尾巴），不改写、不补事实。
--   3. 只填空值，已有简介的一律不动（幂等）。
--   4. 与各自 main_products 逐条比对过，产品线一致才收录。
--
-- 回滚：update suppliers set company_description = null where slug in (...);

begin;

update suppliers set company_description =
  'Established in 2015, Weihai ITOY Toys Co., LTD is a professional manufacturer and exporter that is concerned with the design, development and production of plush products.'
where slug = 'itoychina' and (company_description is null or company_description = '');

update suppliers set company_description =
  'MINDONG KAIFA ELECTRICAL MACHINERY CO.,LTD Professional production of various kinds of household water pump, motors, generators and power generating sets.'
where slug = 'kaifa-motor' and (company_description is null or company_description = '');

update suppliers set company_description =
  'Xiuxinyang manufactures custom loungewear and pajamas for global brands, offering OEM/ODM production, private label, sampling, QC, and bulk supply.'
where slug = 'qingdao-xiuxinyang-international-trade-co-ltd'
  and (company_description is null or company_description = '');

update suppliers set company_description =
  'We are a professional manufacturer of gearbox, gear motor, and industrial control system, as well as a provider of intelligent automation solutions, integrating R&D, production, sales, and service.'
where slug = 'wanshsin' and (company_description is null or company_description = '');

update suppliers set company_description =
  'Discover premium sunglasses, optical frames, and eyewear accessories from Jings Eyewear. 20+ years of OEM/ODM experience.'
where slug = 'xiamen-jings-eyewear' and (company_description is null or company_description = '');

update suppliers set company_description =
  'Polishing machine factory in Xiamen since 1992. We build vibratory, barrel, disc and magnetic finishing systems, take OEM/ODM work, and test your parts first.'
where slug = 'xiamen-jintaijin-polish-tech-co-ltd'
  and (company_description is null or company_description = '');

commit;
