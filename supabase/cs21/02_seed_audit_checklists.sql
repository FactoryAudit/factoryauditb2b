-- =============================================================================
-- CS-21 / 02_seed_audit_checklists.sql —— 灌入两份清单 72 项检查点
--
-- 执行通道：node scripts/db-apply-sql.mjs supabase/cs21/02_seed_audit_checklists.sql
-- 前置：CS-18 已建 audit_templates/sections/questions（全 0 行）；本文件幂等可重跑。
-- 性质：业务数据 INSERT（service_role 经 Management API 执行，BYPASSRLS）。
--
-- 结构：模板 2 行 → 分组 17 行 → 检查项 35 + 37 = 72 行。
--   SOCIAL_COMPLIANCE：A–I 共 9 组 / 37 项（SMETA 7.0 / amfori BSCI 方法）
--   QUALITY：          A–H 共 8 组 / 35 项（ISO 19011:2026 / ISO 9001 概念）
-- 评分选项：social ['C','PC','NC','CR']；quality ['C','PC','NC','NA']。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. 模板（2 行）
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_templates (code, name, name_zh, description, is_active) VALUES
  ('SOCIAL_COMPLIANCE', 'Supplier Social Compliance Audit Checklist', '供应商社会责任审核清单',
   'Buyer Risk & Worker Rights Edition。SMETA 7.0 / amfori BSCI 方法；9 组 37 项检查点（A–I）。', true),
  ('QUALITY', 'Supplier Quality Audit Checklist', '供应商质量审核清单',
   'Buyer Decision Edition。ISO 19011:2026 / ISO 9001 概念；8 组 35 项检查点（A–H）。', true)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. 分组（17 行）
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_sections (template_id, section_code, title, title_zh, sort_order) VALUES
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'A','Accurate Assessment & Management Systems','审核真实性与管理体系',1),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'B','Child Labour & Young Workers','童工与未成年工',2),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'C','Forced Labour & Recruitment','强迫劳动与招聘',3),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'D','Working Hours & Wages','工时与工资',4),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'E','Freedom of Association, Discrimination & Harassment','结社、歧视与骚扰',5),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'F','Health & Safety','健康与安全',6),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'G','Dormitory, Canteen & Welfare','宿舍、食堂与福利',7),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'H','Environment & Business Ethics','环境与商业道德',8),
  ((SELECT id FROM public.audit_templates WHERE code='SOCIAL_COMPLIANCE'),'I','Grievance, Privacy & Corrective Action','申诉、隐私与整改',9),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'A','Company & QMS','企业与质量体系',1),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'B','Customer & Product Requirements','客户与产品要求',2),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'C','Supplier & Incoming Material Control','供应商与来料控制',3),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'D','Production Process Control','生产过程控制',4),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'E','Inspection, Testing & Calibration','检验、测试与计量',5),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'F','Traceability, Packaging & Shipment','追溯、包装与出货',6),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'G','Nonconformance & CAPA','不合格与纠正预防',7),
  ((SELECT id FROM public.audit_templates WHERE code='QUALITY'),'H','Capacity, Maintenance & Business Continuity','产能、维护与连续经营',8)
ON CONFLICT (template_id, section_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. 检查项（72 行）
--    response_type = 'single_select'；options = 评分档；mandatory = true。
--    requirement / requirement_zh = 客观证据（指导供应商填什么）。
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_questions
  (section_id, question_code, title, title_zh, requirement, requirement_zh, response_type, options, mandatory, sort_order)
VALUES
  -- ===== SOCIAL_COMPLIANCE =====
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='A'),'A01','Full site, workforce and production scope disclosed','工厂、员工及生产范围真实披露','Business licence, org chart, worker headcount, site tour','营业执照、组织架构、人数、现场','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='A'),'A02','No coaching, retaliation or interference with audit','不得引导、报复或干扰审核','Interviews + observation','访谈+观察','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='A'),'A03','Policies and responsibilities are implemented, monitored and improved','政策职责落实、监控并持续改进','Policies, KPI, review records','政策、KPI、评审','single_select','["C","PC","NC","CR"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='A'),'A04','Subcontractors, labour agencies and dormitories are disclosed','外发、劳务机构及宿舍真实披露','Contracts + list + sample trace','合同+名录+追溯','single_select','["C","PC","NC","CR"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='B'),'B01','No child labour; legal age verification is robust','无童工，年龄验证有效','Personnel files + sampling','人事档案抽样','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='B'),'B02','Young workers are protected from prohibited work/hours','未成年工不从事禁限工作且工时受控','Roster + shifts','花名册+排班','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='B'),'B03','Remediation procedure exists if a child is identified','发现童工时有补救程序','Procedure + evidence','程序+证据','single_select','["C","PC","NC","CR"]'::jsonb,true,3),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='C'),'C01','No forced, bonded or trafficked labour','无强迫、债役或人口贩运','Worker interviews + contracts','访谈+合同','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='C'),'C02','No retention of identity documents and no illegal deposits','不扣押身份证件，不收取非法押金','Worker interviews','访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='C'),'C03','Recruitment fees are not borne by workers','招聘费用不由员工承担','Agency contracts + worker interviews','劳务合同+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='C'),'C04','Workers can terminate employment according to law','员工依法可离职','Contracts + policy','合同+制度','single_select','["C","PC","NC","CR"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='D'),'D01','Time records are complete, authentic and reconcile to payroll','工时记录完整、真实并与工资一致','Timecards + payroll + production cross-check','打卡+工资+生产交叉核对','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='D'),'D02','Normal and overtime hours comply with applicable law/buyer limits','正常及加班工时符合适用法律/买方要求','12-month sample','12个月抽样','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='D'),'D03','Workers receive legally required minimum wage and overtime premiums','工资及加班费达到法定要求','Payroll sample','工资抽样','single_select','["C","PC","NC","CR"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='D'),'D04','Deductions are lawful, transparent and authorized','扣款合法、透明、有授权','Payroll sample','工资抽样','single_select','["C","PC","NC","CR"]'::jsonb,true,4),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='D'),'D05','Benefits/social insurance/legal leave are provided as required','法定福利、社保、休假符合要求','Records + interviews','记录+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,5),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='E'),'E01','Workers can raise concerns without retaliation','员工可无报复地表达意见','Grievance records + interviews','申诉记录+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='E'),'E02','No discrimination in hiring, pay, promotion or termination','招聘、薪酬、晋升、离职无歧视','HR records + interviews','人事记录+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='E'),'E03','No harassment, violence or abusive discipline','无骚扰、暴力或侮辱性惩戒','Interviews + records','访谈+记录','single_select','["C","PC","NC","CR"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='E'),'E04','Worker representatives/committees operate where legally applicable','依法适用时员工代表/委员会有效','Minutes + interviews','会议纪要+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='F'),'F01','Emergency exits, fire protection and evacuation routes are effective','消防、疏散及出口有效','Site tour + test records','现场+测试记录','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='F'),'F02','Machine guarding and lockout controls are effective','机器防护及能源隔离有效','Site observation','现场观察','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='F'),'F03','Chemical storage, SDS and worker training are controlled','化学品、SDS及培训受控','Chemical area + SDS','化学品区+SDS','single_select','["C","PC","NC","CR"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='F'),'F04','PPE is suitable, available and used','PPE适用、充足并正确使用','Site tour','现场','single_select','["C","PC","NC","CR"]'::jsonb,true,4),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='F'),'F05','Occupational health risks are identified and controlled','职业健康风险识别与控制','Risk assessment + testing','风险评估+检测','single_select','["C","PC","NC","CR"]'::jsonb,true,5),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='F'),'F06','First aid, incident reporting and corrective action are effective','急救、事故报告及整改有效','Logs + interviews','台账+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,6),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='G'),'G01','Dormitory conditions are safe and not overcrowded','宿舍安全且不过度拥挤','Site tour','现场','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='G'),'G02','Drinking water, sanitation and hygiene are adequate','饮水、卫生及清洁符合要求','Site tour + test reports','现场+检测','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='G'),'G03','Canteen food safety and hygiene are controlled where provided','食堂食品安全及卫生受控','Licences + inspection','许可+检查','single_select','["C","PC","NC","CR"]'::jsonb,true,3),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='H'),'H01','Required environmental permits and legal controls are current','环保许可及法定控制有效','Permits + records','许可+记录','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='H'),'H02','Waste, hazardous waste and emissions are controlled','废弃物、危废及排放受控','Manifests + site','联单+现场','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='H'),'H03','Bribery, falsification and conflicts of interest are prohibited and controlled','反贿赂、反造假及利益冲突机制有效','Policy + interviews','政策+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='H'),'H04','Records can be verified and are not falsified','记录可核验且不得造假','Triangulation','交叉验证','single_select','["C","PC","NC","CR"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='I'),'I01','Confidential grievance channels are accessible','保密申诉渠道可使用','Hotline/box + interviews','热线/意见箱+访谈','single_select','["C","PC","NC","CR"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='I'),'I02','Complaints are investigated and closed without retaliation','申诉得到调查及闭环且无报复','Case files','案件记录','single_select','["C","PC","NC","CR"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='I'),'I03','Worker personal data and sensitive records are appropriately protected','员工个人及敏感资料得到适当保护','Access controls + policy','权限+政策','single_select','["C","PC","NC","CR"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='SOCIAL_COMPLIANCE' AND s.section_code='I'),'I04','CAPA addresses root cause and effectiveness','整改覆盖根因及有效性验证','CAPA sample','整改抽样','single_select','["C","PC","NC","CR"]'::jsonb,true,4),

  -- ===== QUALITY =====
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='A'),'A01','QMS scope matches audited site and products','质量体系范围覆盖本工厂及产品','Certificate + scope + site verification','证书+范围+现场核实','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='A'),'A02','Quality policy, objectives and KPI are defined and reviewed','质量方针、目标及KPI已建立并评审','Management review','管理评审','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='A'),'A03','Document and record control is effective','文件与记录控制有效','Revision control sample','版本抽查','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='A'),'A04','Internal audits identify and close real issues','内审能发现并关闭真实问题','Last 12 months records','最近12个月记录','single_select','["C","PC","NC","NA"]'::jsonb,true,4),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='A'),'A05','Competence and training controls are implemented','能力与培训控制有效','Training matrix + interviews','培训矩阵+访谈','single_select','["C","PC","NC","NA"]'::jsonb,true,5),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='B'),'B01','Customer specifications/drawings are current and accessible','客户规格书图纸受控且现行','Sample order','抽查订单','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='B'),'B02','Critical-to-quality characteristics are identified','关键质量特性已识别','CTQ list','控制计划','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='B'),'B03','Contract/order review confirms capacity and quality requirements','订单评审覆盖产能及质量要求','Order review sample','订单抽查','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='B'),'B04','Changes require customer approval when applicable','变更按要求取得客户批准','Change records','变更记录','single_select','["C","PC","NC","NA"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='C'),'C01','Critical suppliers are approved and periodically evaluated','关键供应商经批准并定期评价','AVL + scorecards','合格供应商名录','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='C'),'C02','Incoming inspection criteria are defined and followed','来料检验标准明确且执行','IQC records','IQC记录','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='C'),'C03','Material identification and segregation prevent mix-up','物料标识与隔离防止混料','Warehouse trace','仓库追溯','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='C'),'C04','Nonconforming incoming materials are controlled','不合格来料受控','NCR / MRB records','不合格记录','single_select','["C","PC","NC","NA"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='D'),'D01','Work instructions match actual process','作业指导书与实际工艺一致','Line verification','产线核查','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='D'),'D02','Process parameters are defined, monitored and recorded','工艺参数明确、监控并记录','Logs + live witness','参数记录+见证','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='D'),'D03','First article / first-off controls are effective','首件控制有效','FAI records','首件记录','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='D'),'D04','Poka-yoke and critical controls are implemented','防错及关键控制有效','On-site evidence','现场证据','single_select','["C","PC","NC","NA"]'::jsonb,true,4),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='D'),'D05','Line clearance prevents product mix-up','换线清场防止混料','Observation','现场观察','single_select','["C","PC","NC","NA"]'::jsonb,true,5),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='D'),'D06','Subcontracted/outsourced processes are controlled','外协工序受控','Approved list + audit','名录+审核','single_select','["C","PC","NC","NA"]'::jsonb,true,6),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='E'),'E01','Inspection plans define sampling and acceptance criteria','检验计划明确抽样及接收标准','AQL/spec records','标准记录','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='E'),'E02','Measurement equipment is calibrated and traceable','测量设备校准且可追溯','Calibration labels/certs','校准证书','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='E'),'E03','Testing methods and lab competence are adequate','测试方法及实验室能力适当','Method validation','能力证据','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='E'),'E04','Final inspection release prevents shipment of nonconforming goods','出货放行防止不合格品出货','Release sample','放行记录','single_select','["C","PC","NC","NA"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='F'),'F01','Lot/batch/serial traceability works from finished goods to materials','成品可追溯至物料批次','Trace one sample','抽查追溯','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='F'),'F02','FIFO/FEFO controls are used where applicable','适用时执行先进先出/先到期先出','Warehouse observation','仓储观察','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='F'),'F03','Packaging and labeling match buyer requirements','包装标识符合买方要求','Shipment sample','出货抽查','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='F'),'F04','Shipment documents match physical goods','出货资料与实物一致','Packing list + label','装箱单+标签','single_select','["C","PC","NC","NA"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='G'),'G01','NCRs are contained and dispositioned promptly','不合格得到及时遏制及处置','NCR/MRB sample','抽查','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='G'),'G02','Root-cause analysis addresses systemic causes','根因分析针对系统性原因','5Why/Fishbone/8D','5Why/鱼骨/8D','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='G'),'G03','Effectiveness checks verify corrective action','整改有效性已验证','Follow-up evidence','效果证据','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='G'),'G04','Customer complaints are trended and acted on','客诉趋势分析并采取措施','Complaint KPI','客诉KPI','single_select','["C","PC","NC","NA"]'::jsonb,true,4),

  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='H'),'H01','Declared capacity is supported by equipment and manpower','声称产能与设备人力匹配','Capacity calculation','产能核算','single_select','["C","PC","NC","NA"]'::jsonb,true,1),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='H'),'H02','Preventive maintenance is planned and effective','预防性维护有效','PM records','PM记录','single_select','["C","PC","NC","NA"]'::jsonb,true,2),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='H'),'H03','Critical spare parts and utilities have continuity controls','关键备件及公用工程有连续性措施','BCP/stock','连续性计划','single_select','["C","PC","NC","NA"]'::jsonb,true,3),
  ((SELECT s.id FROM public.audit_sections s JOIN public.audit_templates t ON t.id=s.template_id WHERE t.code='QUALITY' AND s.section_code='H'),'H04','Production load and lead-time risks are transparent','产能负荷及交期风险透明','Planning records','排产','single_select','["C","PC","NC","NA"]'::jsonb,true,4)
ON CONFLICT (section_id, question_code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
