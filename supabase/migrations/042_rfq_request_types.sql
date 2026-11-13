-- =============================================================================
-- Migration 042 —— 询价表单「需求类型」分流 + 供应商报价通道
--
-- 背景（2026-11-13，真实询盘 RFQ-2MSL3N 暴露的缺陷）：
--   /rfq 只表达「买货」：字段是 Product / Quantity / Target country。
--   科威特 Molden Technical Solutions 要的是 HVAC 风水平衡与系统验证**服务**，
--   表单没有「验厂 / 验货 / 找供应商 / 其他」这个维度，他只能把服务说明
--   塞进 Product 栏、把「一个项目」塞进 Quantity 栏，结果：
--     · 后台看不出这是一条服务需求；
--     · 前台把它当「买家要买 HVAC 产品」挂出去，引供应商去回复；
--     · 撮合逻辑按 product 关键词匹，永远匹不上。
--   这是表单设计缺失，不是买家填错。
--
-- 做法（沿用既有约定，不新造第二套库）：
--   1. rfqs 增加三列：
--      · request_type   —— product | sourcing | audit | inspection | other
--                          默认 product，历史 5 条一行不用改
--      · phone          —— 中东/非洲/南亚买家的唯一兜底联系方式
--      · service_detail —— 按类型而异的明细（工厂名/所在地/审核类型/
--                          期望日期/目的港/验货标准），jsonb 兜住，
--                          不为每种服务新增一堆稀疏列
--   2. leads_kind_check 增加 supplier_quote：
--      /suppliers 的「Respond to Request」此前链到 /rfq（买家表单），
--      供应商点进去看到的是一张空白采购单 —— 死链。修法是给供应商
--      一条真正的报价通道，落 leads 而非新建表（leads 已有
--      supplier_name / phone / payload，后台 /admin/leads 可直接运营）。
--
-- 语义红线：
--   · request_type 只描述**买家要什么**，不代表已受理、已报价、已成交。
--   · service_detail 只存买家自己填的内容，绝不推断补值。
--   · supplier_quote 只代表「收到一份供应商报价」，不等于已选为供应商、
--     不等于已核验、更不等于已成交。
-- =============================================================================

BEGIN;

-- ---- 1. rfqs：需求类型 / 电话 / 服务明细 ----
ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'product';

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS service_detail jsonb;

ALTER TABLE public.rfqs DROP CONSTRAINT IF EXISTS rfqs_request_type_check;

ALTER TABLE public.rfqs
  ADD CONSTRAINT rfqs_request_type_check CHECK (
    request_type = ANY (ARRAY[
      'product'::text,
      'sourcing'::text,
      'audit'::text,
      'inspection'::text,
      'other'::text
    ])
  );

-- 后台按类型筛选 / 业务看板按类型统计都走这列
CREATE INDEX IF NOT EXISTS rfqs_request_type ON public.rfqs(request_type);

COMMENT ON COLUMN public.rfqs.request_type IS
  '买家要什么：product=采购产品 sourcing=找供应商 audit=验厂/核实 inspection=验货/质检 other=其他。只描述诉求，不代表已受理。';
COMMENT ON COLUMN public.rfqs.service_detail IS
  '按 request_type 而异的明细（factoryName/factoryLocation/auditType/preferredDate/destinationPort/inspectionStandard）。只存买家填写内容，缺省 NULL。';

-- ---- 2. leads：供应商报价 ----
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_kind_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_kind_check CHECK (
    kind = ANY (ARRAY[
      'buyer_lead'::text,
      'supplier_application'::text,
      'supplier_claim'::text,
      'supplier_verification'::text,
      'auditor_application'::text,
      'supplier_quote'::text
    ])
  );

COMMIT;
