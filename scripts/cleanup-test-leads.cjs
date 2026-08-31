// 一次性清理脚本：删除测试产生的 @example.com 线索（保留真实线索）
// 运行：node scripts/cleanup-test-leads.cjs
const { PrismaClient } = require("../generated/prisma-client");

const p = new PrismaClient();

async function main() {
  const testLeads = await p.lead.findMany({
    where: { email: { contains: "@example.com" } },
    select: { id: true, email: true },
  });
  console.log(`test leads found: ${testLeads.length}`);
  if (testLeads.length > 0) {
    const ids = testLeads.map((l) => l.id);
    // 先删关联 assessment（外键），再删 lead
    const delAssessments = await p.assessment.deleteMany({ where: { leadId: { in: ids } } });
    const del = await p.lead.deleteMany({ where: { id: { in: ids } } });
    console.log(`deleted assessments: ${delAssessments.count}, leads: ${del.count}`);
  }
  const remain = await p.lead.count();
  console.log(`remaining leads: ${remain}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
