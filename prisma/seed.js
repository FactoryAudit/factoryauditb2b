// FactoryAuditB2B — Seed (STEP 2: taxonomy data)
// 可在 prisma generate 之后运行：npm run db:seed 或 node prisma/seed.js
// 幂等：bulkCreate 对唯一冲突(P2002)自动忽略，可重复执行。

const { PrismaClient } = require('../generated/prisma-client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// 对唯一冲突安全的批量插入
async function bulkCreate(model, data) {
  if (!data || data.length === 0) return;
  try {
    await model.createMany({ data });
  } catch (e) {
    if (e && e.code === 'P2002') {
      // 部分已存在则逐条 upsert
      for (const row of data) {
        try { await model.create({ data: row }); } catch (_) { /* ignore */ }
      }
    } else {
      throw e;
    }
  }
}

// ---------- 1. 国家 ----------
const COUNTRIES = [
  { code: 'china', name: 'China', cn: '中国' },
  { code: 'vietnam', name: 'Vietnam', cn: '越南' },
  { code: 'india', name: 'India', cn: '印度' },
  { code: 'bangladesh', name: 'Bangladesh', cn: '孟加拉' },
  { code: 'turkey', name: 'Turkey', cn: '土耳其' },
  { code: 'indonesia', name: 'Indonesia', cn: '印度尼西亚' },
  { code: 'pakistan', name: 'Pakistan', cn: '巴基斯坦' },
  { code: 'mexico', name: 'Mexico', cn: '墨西哥' },
  { code: 'thailand', name: 'Thailand', cn: '泰国' },
];

// ---------- 2. 行业 ----------
const INDUSTRIES = [
  { code: 'electronics', name: 'Electronics / 电子' },
  { code: 'textiles', name: 'Textiles / 纺织' },
  { code: 'toys', name: 'Toys / 玩具' },
  { code: 'footwear', name: 'Footwear / 鞋类' },
  { code: 'machinery', name: 'Machinery / 机械' },
  { code: 'plastics', name: 'Plastics / 塑料' },
  { code: 'home-appliances', name: 'Home Appliances / 家电' },
  { code: 'food-beverage', name: 'Food & Beverage / 食品饮料' },
  { code: 'automotive', name: 'Automotive / 汽车' },
  { code: 'furniture', name: 'Furniture / 家具' },
  { code: 'packaging', name: 'Packaging / 包装' },
  { code: 'cosmetics', name: 'Cosmetics / 化妆品' },
];

// ---------- 3. 审核/认证项目（同时写入 audit_types 与 standards 两张表） ----------
const PROGRAMS = [
  { code: 'SMETA', nameEn: 'SMETA', nameZh: 'SMETA 社会责任审核', serviceType: 'AUDIT', isAudit: true, isCertification: true, owner: 'Sedex', note: 'SMETA 不是证书，而是由 Sedex 认可审核机构执行的社会责任审核方法，仅出具审核报告、不发证。', category: 'SOCIAL_AUDIT' },
  { code: 'BSCI', nameEn: 'BSCI', nameZh: 'BSCI 商业社会责任倡议', serviceType: 'AUDIT', isAudit: true, isCertification: true, owner: 'amfori', category: 'SOCIAL_AUDIT' },
  { code: 'SA8000', nameEn: 'SA8000', nameZh: 'SA8000', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'SAI', category: 'SOCIAL_AUDIT' },
  { code: 'WRAP', nameEn: 'WRAP', nameZh: 'WRAP 环球服装生产社会责任', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'WRAP', category: 'SOCIAL_AUDIT' },
  { code: 'ICTI', nameEn: 'ICTI Ethical Toy Program', nameZh: 'ICTI 玩具业责任规范', serviceType: 'AUDIT', isAudit: true, isCertification: true, owner: 'ICTI', category: 'SOCIAL_AUDIT' },
  { code: 'ISO9001', nameEn: 'ISO 9001', nameZh: 'ISO 9001 质量管理体系', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'ISO', category: 'QUALITY_AUDIT' },
  { code: 'ISO13485', nameEn: 'ISO 13485', nameZh: 'ISO 13485 医疗器械质量管理', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'ISO', category: 'QUALITY_AUDIT' },
  { code: 'IATF16949', nameEn: 'IATF 16949', nameZh: 'IATF 16949 汽车行业质量管理', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'IATF', category: 'QUALITY_AUDIT' },
  { code: 'GMP', nameEn: 'GMP', nameZh: 'GMP 良好生产规范', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'FDA/WHO', category: 'QUALITY_AUDIT' },
  { code: 'ISO14001', nameEn: 'ISO 14001', nameZh: 'ISO 14001 环境管理体系', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'ISO', category: 'ENVIRONMENTAL' },
  { code: 'ISO45001', nameEn: 'ISO 45001', nameZh: 'ISO 45001 职业健康安全', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'ISO', category: 'SAFETY' },
  { code: 'BRC', nameEn: 'BRCGS', nameZh: 'BRC 全球食品安全标准', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'BRCGS', category: 'FOOD_SAFETY' },
  { code: 'HACCP', nameEn: 'HACCP', nameZh: 'HACCP 危害分析与关键控制点', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'Codex', category: 'FOOD_SAFETY' },
  { code: 'FSSC22000', nameEn: 'FSSC 22000', nameZh: 'FSSC 22000 食品安全体系认证', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'FSSC', category: 'FOOD_SAFETY' },
  { code: 'CE', nameEn: 'CE Marking', nameZh: 'CE 认证', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'EU', category: 'PRODUCT_CERT' },
  { code: 'UL', nameEn: 'UL Certification', nameZh: 'UL 认证', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'UL', category: 'PRODUCT_CERT' },
  { code: 'CCC', nameEn: 'CCC', nameZh: 'CCC 中国强制性产品认证', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'CNCA', category: 'PRODUCT_CERT' },
  { code: 'ISO37001', nameEn: 'ISO 37001', nameZh: 'ISO 37001 反贿赂管理体系', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'ISO', category: 'ANTI_BRIBERY' },
  { code: 'ISO27001', nameEn: 'ISO 27001', nameZh: 'ISO 27001 信息安全管理', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'ISO', category: 'INFO_SECURITY' },
  { code: 'RBA', nameEn: 'RBA Code of Conduct', nameZh: 'RBA 责任商业联盟行为准则', serviceType: 'AUDIT', isAudit: true, isCertification: true, owner: 'RBA', category: 'INDUSTRY_SPECIFIC' },
  { code: 'CTPAT', nameEn: 'C-TPAT', nameZh: 'C-TPAT 海关商贸反恐', serviceType: 'VERIFICATION', isInspection: true, owner: 'U.S. CBP', category: 'SUPPLY_CHAIN' },
  { code: 'ISO28000', nameEn: 'ISO 28000', nameZh: 'ISO 28000 供应链安全管理', serviceType: 'CERTIFICATION_SUPPORT', isCertification: true, owner: 'ISO', category: 'SUPPLY_CHAIN' },
];

// ---------- 4. 纯服务节点（无对应认证/审核项目） ----------
const SERVICE_NODES = {
  PSI: { labelEn: 'Pre-Shipment Inspection', labelZh: '出货前检验' },
  DUPRO: { labelEn: 'During Production Inspection', labelZh: '生产中检验' },
  CL: { labelEn: 'Container Loading Supervision', labelZh: '装柜监装' },
  CONSULT_SOCIAL: { labelEn: 'Social Audit Consulting', labelZh: '社会责任验厂辅导' },
  CONSULT_QUALITY: { labelEn: 'Quality System Consulting', labelZh: '质量体系辅导' },
  TRAIN_AUDITOR: { labelEn: 'Auditor Training', labelZh: '审核员培训' },
  TRAIN_EHS: { labelEn: 'EHS Training', labelZh: '环安卫培训' },
  TEST_CHEM: { labelEn: 'Chemical Testing', labelZh: '化学检测' },
  TEST_PHYS: { labelEn: 'Physical & Mechanical Testing', labelZh: '物理机械测试' },
  DOC_REVIEW_LABOR: { labelEn: 'Labor Compliance Document Review', labelZh: '劳工合规文件审查' },
  DOC_REVIEW_PERMIT: { labelEn: 'License & Permit Review', labelZh: '证照许可审查' },
};

// ---------- 5. 15 个一级类目（§81） ----------
const TOP_CATEGORIES = [
  { code: 'SOCIAL_AUDIT', labelEn: 'Social Audit / 社会责任验厂', labelZh: '社会责任验厂', children: ['SMETA', 'BSCI', 'SA8000', 'WRAP', 'ICTI', 'RBA'] },
  { code: 'QUALITY_AUDIT', labelEn: 'Quality Audit / 质量体系审核', labelZh: '质量体系审核', children: ['ISO9001', 'ISO13485', 'IATF16949', 'GMP'] },
  { code: 'ENVIRONMENTAL', labelEn: 'Environmental / 环境管理', labelZh: '环境管理', children: ['ISO14001'] },
  { code: 'SAFETY', labelEn: 'Health & Safety / 职业健康安全', labelZh: '职业健康安全', children: ['ISO45001'] },
  { code: 'FOOD_SAFETY', labelEn: 'Food Safety / 食品安全', labelZh: '食品安全', children: ['BRC', 'HACCP', 'FSSC22000'] },
  { code: 'PRODUCT_CERT', labelEn: 'Product Certification / 产品认证', labelZh: '产品认证', children: ['CE', 'UL', 'CCC'] },
  { code: 'ANTI_BRIBERY', labelEn: 'Anti-Bribery & Compliance / 反贿赂合规', labelZh: '反贿赂合规', children: ['ISO37001'] },
  { code: 'INFO_SECURITY', labelEn: 'Information Security / 信息安全', labelZh: '信息安全', children: ['ISO27001'] },
  { code: 'SUPPLY_CHAIN', labelEn: 'Supply Chain Security / 供应链安全', labelZh: '供应链安全', children: ['CTPAT', 'ISO28000'] },
  { code: 'INDUSTRY_SPECIFIC', labelEn: 'Industry-Specific / 行业专项', labelZh: '行业专项', children: ['RBA'] },
  { code: 'INSPECTION', labelEn: 'Inspection / 验货出货检验', labelZh: '验货出货检验', children: ['PSI', 'DUPRO', 'CL'] },
  { code: 'CONSULTING', labelEn: 'Consulting / 咨询辅导', labelZh: '咨询辅导', children: ['CONSULT_SOCIAL', 'CONSULT_QUALITY'] },
  { code: 'TRAINING', labelEn: 'Training / 培训', labelZh: '培训', children: ['TRAIN_AUDITOR', 'TRAIN_EHS'] },
  { code: 'TESTING', labelEn: 'Testing / 第三方检测', labelZh: '第三方检测', children: ['TEST_CHEM', 'TEST_PHYS'] },
  { code: 'DOCUMENT_REVIEW', labelEn: 'Document & Compliance Review / 文件合规审查', labelZh: '文件合规审查', children: ['DOC_REVIEW_LABOR', 'DOC_REVIEW_PERMIT'] },
];

function buildTaxonomyNodes() {
  const nodes = [];
  TOP_CATEGORIES.forEach((cat, i) => {
    nodes.push({
      code: cat.code, parentCode: null, category: cat.code, level: 0,
      labelEn: cat.labelEn, labelZh: cat.labelZh, isLeaf: false, sortOrder: i,
    });
    cat.children.forEach((childCode, j) => {
      const p = PROGRAMS.find((x) => x.code === childCode);
      const s = SERVICE_NODES[childCode];
      const labelEn = p ? p.nameEn : s.labelEn;
      const labelZh = p ? p.nameZh : s.labelZh;
      nodes.push({
        code: 'NODE_' + childCode, parentCode: cat.code, category: cat.code, level: 1,
        labelEn, labelZh, isLeaf: true, sortOrder: j,
      });
    });
  });
  return nodes;
}

// ---------- 主流程 ----------
async function main() {
  console.log('Seeding countries...');
  await bulkCreate(prisma.country, COUNTRIES);

  console.log('Seeding industries...');
  await bulkCreate(prisma.industry, INDUSTRIES);

  console.log('Seeding audit_types...');
  await bulkCreate(prisma.auditType, PROGRAMS.map((p) => ({
    code: p.code, nameEn: p.nameEn, nameZh: p.nameZh, serviceType: p.serviceType,
    isAudit: p.isAudit, isAssessment: false, isCertification: p.isCertification,
    isInspection: p.serviceType === 'INSPECTION', owner: p.owner, description: p.note,
    taxonomyCode: p.category, riskWeight: 1,
  })));

  console.log('Seeding standards...');
  const certPrograms = PROGRAMS.filter((p) => p.isCertification);
  await bulkCreate(prisma.standard, certPrograms.map((p) => ({
    code: p.code, nameEn: p.nameEn, nameZh: p.nameZh, owner: p.owner,
    serviceType: p.serviceType, isCertification: true, isAudit: p.isAudit,
    isAssessment: false, isInspection: p.serviceType === 'INSPECTION',
    note: p.note, category: p.category, riskWeight: 1,
  })));

  console.log('Seeding taxonomy_nodes...');
  await bulkCreate(prisma.taxonomyNode, buildTaxonomyNodes());

  console.log('Seeding taxonomy_relations...');
  const relations = [
    { sourceCode: 'SOCIAL_AUDIT', targetCode: 'NODE_SMETA', relation: 'RELATED_AUDIT' },
    { sourceCode: 'NODE_SMETA', targetCode: 'NODE_BSCI', relation: 'ALTERNATIVE' },
    { sourceCode: 'NODE_BSCI', targetCode: 'NODE_ISO9001', relation: 'REQUIRES_STANDARD' },
    { sourceCode: 'NODE_CE', targetCode: 'NODE_ISO9001', relation: 'PREREQUISITE' },
    { sourceCode: 'NODE_UL', targetCode: 'NODE_ISO9001', relation: 'PREREQUISITE' },
    { sourceCode: 'NODE_ISO14001', targetCode: 'NODE_ISO45001', relation: 'SUBSUMES' },
    { sourceCode: 'NODE_RBA', targetCode: 'NODE_SMETA', relation: 'RELATED_AUDIT' },
  ];
  for (const r of relations) {
    await prisma.taxonomyRelation.upsert({
      where: { sourceCode_targetCode_relation: { sourceCode: r.sourceCode, targetCode: r.targetCode, relation: r.relation } },
      update: {},
      create: { ...r, weight: 1 },
    });
  }

  console.log('Seeding risk_weight_rules...');
  const weights = [{ dimension: 'overall', weight: 1, description: '综合权重基准' }];
  TOP_CATEGORIES.forEach((c) => weights.push({ dimension: c.code, weight: 1, description: c.labelZh + ' 维度权重' }));
  for (const w of weights) {
    await prisma.riskWeightRule.upsert({ where: { dimension: w.dimension }, update: { weight: w.weight }, create: w });
  }

  console.log('Seeding users (RBAC)...');
  const pwHash = await bcrypt.hash('FactoryAudit2026!', 10);
  const users = [
    { email: 'admin@factoryauditb2b.com', name: 'Admin', role: 'ADMIN', passwordHash: pwHash },
    { email: 'buyer@factoryauditb2b.com', name: 'Buyer Demo', role: 'BUYER', passwordHash: pwHash },
    { email: 'supplier@factoryauditb2b.com', name: 'Supplier Demo', role: 'SUPPLIER', passwordHash: pwHash },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: u });
  }

  console.log('Seeding suppliers + capabilities + evidence + risk events...');
  const suppliers = [
    {
      slug: 'shenzhen-precision-electronics', legalName: 'Shenzhen Precision Electronics Ltd.',
      countryCode: 'china', city: 'Shenzhen', industryCode: 'electronics',
      businessType: 'Manufacturer', established: 2009, employees: '501-1000',
      mainProducts: 'PCBA, Consumer Electronics', exportMarkets: 'EU,US,JP',
      verificationStatus: 'FACTORY_VERIFIED', riskScore: 22, riskLevel: 'LOW',
      certifications: 'ISO9001,SMETA', auditStatus: 'Verified',
      caps: [
        { refType: 'AUDIT_TYPE', refCode: 'SMETA', verified: true, source: 'THIRD_PARTY' },
        { refType: 'AUDIT_TYPE', refCode: 'BSCI', verified: false, source: 'SELF' },
        { refType: 'STANDARD', refCode: 'ISO9001', verified: true, source: 'THIRD_PARTY' },
      ],
      evidence: [
        { type: '营业执照', status: 'VERIFIED', source: 'gov.cn', date: '2024-03-01' },
        { type: 'SMETA 审核报告', status: 'VERIFIED', source: 'sedex.com', date: '2025-01-15' },
      ],
      risks: [{ taxonomyCode: 'ENVIRONMENTAL', eventType: 'FINE', severity: 2, description: '2023 年环保轻微违规罚款', source: '公开记录', occurredAt: new Date('2023-06-10') }],
    },
    {
      slug: 'guangzhou-textile', legalName: 'Guangzhou Textile Manufacturing Co.',
      countryCode: 'china', city: 'Guangzhou', industryCode: 'textiles',
      businessType: 'Manufacturer', established: 2012, employees: '201-500',
      mainProducts: 'Apparel, Knitwear', exportMarkets: 'EU,US',
      verificationStatus: 'DOCUMENT_VERIFIED', riskScore: 41, riskLevel: 'MEDIUM',
      certifications: 'BSCI,WRAP', auditStatus: 'In Progress',
      caps: [
        { refType: 'AUDIT_TYPE', refCode: 'BSCI', verified: true, source: 'THIRD_PARTY' },
        { refType: 'AUDIT_TYPE', refCode: 'WRAP', verified: false, source: 'SELF' },
      ],
      evidence: [{ type: 'BSCI 审核报告', status: 'VERIFIED', source: 'amfori.org', date: '2024-11-20' }],
      risks: [],
    },
    {
      slug: 'ho-chi-minh-garment', legalName: 'Ho Chi Minh Garment JSC',
      countryCode: 'vietnam', city: 'Ho Chi Minh', industryCode: 'textiles',
      businessType: 'Manufacturer', established: 2015, employees: '1000+',
      mainProducts: 'Garments, Uniforms', exportMarkets: 'US,EU',
      verificationStatus: 'IDENTITY_VERIFIED', riskScore: 35, riskLevel: 'MEDIUM',
      certifications: 'SMETA', auditStatus: 'Pending',
      caps: [{ refType: 'AUDIT_TYPE', refCode: 'SMETA', verified: false, source: 'SELF' }],
      evidence: [],
      risks: [],
    },
  ];

  for (const s of suppliers) {
    const created = await prisma.supplier.upsert({
      where: { slug: s.slug },
      update: {
        legalName: s.legalName, countryCode: s.countryCode, city: s.city, industryCode: s.industryCode,
        businessType: s.businessType, established: s.established, employees: s.employees,
        mainProducts: s.mainProducts, exportMarkets: s.exportMarkets, verificationStatus: s.verificationStatus,
        riskScore: s.riskScore, riskLevel: s.riskLevel, certifications: s.certifications, auditStatus: s.auditStatus,
      },
      create: {
        slug: s.slug, legalName: s.legalName, countryCode: s.countryCode, city: s.city, industryCode: s.industryCode,
        businessType: s.businessType, established: s.established, employees: s.employees,
        mainProducts: s.mainProducts, exportMarkets: s.exportMarkets, verificationStatus: s.verificationStatus,
        riskScore: s.riskScore, riskLevel: s.riskLevel, certifications: s.certifications, auditStatus: s.auditStatus,
      },
    });
    await prisma.supplierCapability.deleteMany({ where: { supplierId: created.id } });
    await bulkCreate(prisma.supplierCapability, s.caps.map((c) => ({ supplierId: created.id, ...c })));
    await prisma.supplierEvidence.deleteMany({ where: { supplierId: created.id } });
    await bulkCreate(prisma.supplierEvidence, s.evidence.map((e) => ({ supplierId: created.id, ...e })));
    await prisma.riskEvent.deleteMany({ where: { supplierId: created.id } });
    await bulkCreate(prisma.riskEvent, s.risks.map((r) => ({ supplierId: created.id, ...r })));
  }

  console.log('Seeding auditor...');
  const auditor = await prisma.auditor.upsert({
    where: { name: 'Li Wei' },
    update: { company: 'VerifyB2 Audit Partners', countryCode: 'china', city: 'Shanghai', languages: 'zh,en', hourlyRate: 80, rating: 4.8, completedJobs: 132 },
    create: { name: 'Li Wei', company: 'VerifyB2 Audit Partners', countryCode: 'china', city: 'Shanghai', languages: 'zh,en', hourlyRate: 80, rating: 4.8, completedJobs: 132 },
  });
  await prisma.auditorCapability.deleteMany({ where: { auditorId: auditor.id } });
  await bulkCreate(prisma.auditorCapability, [
    { auditorId: auditor.id, refType: 'AUDIT_TYPE', refCode: 'SMETA', level: 'LEAD', verified: true },
    { auditorId: auditor.id, refType: 'AUDIT_TYPE', refCode: 'BSCI', level: 'LEAD', verified: true },
    { auditorId: auditor.id, refType: 'STANDARD', refCode: 'ISO9001', level: 'SENIOR', verified: true },
  ]);

  console.log('Seeding sample RFQ + AuditRequest...');
  await prisma.rfq.upsert({
    where: { id: 'seed-rfq-1' },
    update: {},
    create: {
      id: 'seed-rfq-1', name: 'Procurement Team', email: 'sourcing@example.com',
      productCategory: 'Consumer Electronics', country: 'china', quantity: '5000 pcs',
      targetPrice: 'USD 12.5/unit', message: 'Need a socially compliant PCBA supplier.',
      auditTypeCodes: 'SMETA,BSCI', standardCodes: 'ISO9001', taxonomyCodes: 'SOCIAL_AUDIT,QUALITY_AUDIT',
      status: 'OPEN',
    },
  });
  await prisma.auditRequest.upsert({
    where: { id: 'seed-audit-1' },
    update: {},
    create: {
      id: 'seed-audit-1', supplierName: 'Shenzhen Precision Electronics Ltd.', country: 'china',
      industry: 'electronics', auditTypeCode: 'SMETA', standardCodes: 'ISO9001',
      taxonomyCode: 'SOCIAL_AUDIT', message: 'Annual SMETA re-audit.', status: 'PENDING',
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
