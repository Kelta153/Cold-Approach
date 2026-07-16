import { prisma } from './index';

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stinksafe.co.uk' },
    update: {},
    create: { email: 'admin@stinksafe.co.uk', role: 'admin' },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@stinksafe.co.uk' },
    update: {},
    create: { email: 'operator@stinksafe.co.uk', role: 'operator' },
  });

  // postalAddress: null and warmupComplete: false are correct pending real values, not bugs —
  // the compliance chokepoint blocks sends for this line until both are set for real.
  const stinkSafe = await prisma.businessLine.upsert({
    where: { id: 'seed-stink-safe' },
    update: {},
    create: {
      id: 'seed-stink-safe',
      name: 'Stink Safe',
      senderName: 'Stink Safe Team',
      companyLegalName: 'Stink Safe Ltd',
      postalAddress: null,
      sendingDomain: 'stinksafe.co.uk',
      sendingInboxes: [],
      privacyPolicyUrl: null,
      channelsEnabled: { email: true, instagram: false },
      sendLimits: { perInboxPerDay: 40, igPerDay: 0, rampSchedule: [] },
      warmupComplete: false,
    },
  });

  console.log('Seeded:', { admin: admin.email, operator: operator.email, businessLine: stinkSafe.name });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
