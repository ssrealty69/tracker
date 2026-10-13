import { PrismaClient, Disposition, Budget, Requirement, VisitStatus, CallOutcome } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SS Realty database...');

  // Upsert admin user
  const hashedPassword = await hash('Admin@123', 12);
  await prisma.adminUser.upsert({
    where: { email: 'ssrealtyteams@gmail.com' },
    update: {},
    create: {
      email: 'ssrealtyteams@gmail.com',
      password: hashedPassword,
    },
  });
  console.log('✅ Admin user seeded');

  // Seed agents
  const agents = [
    { name: 'Nihal', email: 'nihal@ssrealty.org' },
    { name: 'Ayaan', email: 'ayaan@ssrealty.org' },
    { name: 'Nikhil', email: 'nikhil@ssrealty.org' },
    { name: 'Bhavishya', email: 'bhavishya@ssrealty.org' },
    { name: 'Gulshan', email: 'gulshan@ssrealty.org' },
    { name: 'Vikas', email: 'vikas@ssrealty.org' },
  ];

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { email: agent.email },
      update: { name: agent.name, isActive: true },
      create: { ...agent, isActive: true },
    });
  }
  console.log('✅ 6 agents seeded');

  const existingLeads = await prisma.lead.count();
  if (existingLeads > 0) {
    console.log(`ℹ️ Database already has ${existingLeads} leads. Skipping lead seeding to protect real data.`);
  } else {
    // Database is empty, populate from crmStore.json
    try {
      const fs = require('fs');
      const path = require('path');
      const crmStorePath = path.join(__dirname, '../src/lib/crmStore.json');
      if (fs.existsSync(crmStorePath)) {
        const allAgents = await prisma.agent.findMany();
        const agentMap = Object.fromEntries(allAgents.map((a) => [a.name.toLowerCase().trim(), a.id]));

        const data = JSON.parse(fs.readFileSync(crmStorePath, 'utf-8'));
        if (data && Array.isArray(data.leads)) {
          for (const l of data.leads) {
            const agentId = l.assignedAgent?.name ? agentMap[l.assignedAgent.name.toLowerCase().trim()] : null;
            const leadData = {
              phone: l.phone,
              name: l.name,
              totalInteractions: l.totalInteractions || 1,
              callOutcome: l.callOutcome || CallOutcome.CONNECTED,
              notConnectedReason: l.notConnectedReason ?? null,
              disposition: l.disposition ?? null,
              requirement: l.requirement ? (Requirement as any)[l.requirement] || null : null,
              budget: l.budget ? (Budget as any)[l.budget] || null : null,
              visitDate: l.visitDate ? new Date(l.visitDate) : null,
              visitStatus: l.visitStatus || VisitStatus.NONE,
              latestRemark: l.latestRemark ?? null,
              assignedAgentId: agentId || (allAgents[0]?.id || null),
            };

            await prisma.lead.upsert({
              where: { phone: l.phone },
              update: leadData,
              create: leadData,
            });
          }
          console.log(`✅ Loaded ${data.leads.length} real leads from crmStore.json into fresh database`);
        }
      }
    } catch (err) {
      console.warn('Notice importing crmStore.json:', (err as any).message);
    }
  }

  console.log('🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
