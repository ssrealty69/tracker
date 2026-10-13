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

  // Seed sample leads for demonstration
  const allAgents = await prisma.agent.findMany();
  const agentMap = Object.fromEntries(allAgents.map((a) => [a.name, a.id]));

  const sampleLeads = [
    {
      phone: '9812345670',
      name: 'Rahul Sharma',
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.BHK_2,
      budget: Budget.L25_35,
      visitDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
      visitStatus: VisitStatus.SCHEDULED,
      assignedAgentId: agentMap['Nihal'],
      latestRemark: 'Very interested in 2BHK near metro',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345671',
      name: 'Priya Verma',
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.BHK_3,
      budget: Budget.L50_75,
      visitDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
      visitStatus: VisitStatus.SCHEDULED,
      assignedAgentId: agentMap['Ayaan'],
      latestRemark: 'Looking for 3BHK, prefers ground floor',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345672',
      name: 'Amit Kumar',
      disposition: Disposition.INTERESTED_FOLLOW_UP,
      requirement: Requirement.BHK_2,
      budget: Budget.UNDER_25L,
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      assignedAgentId: agentMap['Nikhil'],
      latestRemark: 'Will call back after discussing with wife',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345673',
      name: 'Sunita Patel',
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.PLOT,
      budget: Budget.L75_PLUS,
      visitDate: new Date(), // today
      visitStatus: VisitStatus.VISIT_DONE,
      assignedAgentId: agentMap['Bhavishya'],
      latestRemark: 'Visit completed, very interested in corner plot',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345674',
      name: 'Vikram Singh',
      disposition: Disposition.BUDGET_MISMATCH,
      requirement: Requirement.BHK_1,
      budget: Budget.UNDER_25L,
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      assignedAgentId: agentMap['Gulshan'],
      latestRemark: 'Budget too low for available inventory',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345675',
      name: 'Meera Joshi',
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.INDEPENDENT_FLOOR,
      budget: Budget.L35_50,
      visitDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // day after tomorrow
      visitStatus: VisitStatus.SCHEDULED,
      assignedAgentId: agentMap['Vikas'],
      latestRemark: 'Interested in independent floor with parking',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345676',
      name: 'Deepak Gupta',
      disposition: Disposition.NOT_CONNECTED,
      requirement: null,
      budget: null,
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      assignedAgentId: agentMap['Nihal'],
      latestRemark: 'Not picking up calls',
      callOutcome: CallOutcome.NOT_CONNECTED,
    },
    {
      phone: '9812345677',
      name: 'Kavya Nair',
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.BHK_2,
      budget: Budget.L25_35,
      visitDate: new Date(), // today
      visitStatus: VisitStatus.SCHEDULED,
      assignedAgentId: agentMap['Ayaan'],
      latestRemark: 'Confirmed for today\'s visit at 3pm',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345678',
      name: 'Rajesh Malhotra',
      disposition: Disposition.JUNK_BROKER,
      requirement: null,
      budget: null,
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      assignedAgentId: agentMap['Nikhil'],
      latestRemark: 'Identified as broker',
      callOutcome: CallOutcome.CONNECTED,
    },
    {
      phone: '9812345679',
      name: 'Ananya Reddy',
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.BHK_3,
      budget: Budget.L50_75,
      visitDate: new Date(), // today
      visitStatus: VisitStatus.SCHEDULED,
      assignedAgentId: agentMap['Bhavishya'],
      latestRemark: 'Looking for 3BHK with garden facing',
      callOutcome: CallOutcome.CONNECTED,
    },
  ];

  for (const lead of sampleLeads) {
    await prisma.lead.upsert({
      where: { phone: lead.phone },
      update: lead,
      create: lead,
    });
  }
  console.log('✅ Sample leads seeded');
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
