import { prisma } from './index';

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stinksafe.co.uk' },
    update: {},
    create: { email: 'admin@stinksafe.co.uk', role: 'admin', name: 'Stink Safe Admin', emailVerified: true },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@stinksafe.co.uk' },
    update: {},
    create: { email: 'operator@stinksafe.co.uk', role: 'operator', name: 'Stink Safe Operator', emailVerified: true },
  });

  // postalAddress: null and warmupComplete: false are correct pending real values, not bugs —
  // the compliance chokepoint blocks sends for this line until both are set for real. Seeded
  // leads below are deliberately drafted against a still-gated line so the review queue shows
  // the real blocked-reason banner, not a mocked one.
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
      sendingInboxes: [{ email: 'hello@stinksafe.co.uk', dailyCap: 40, active: true }],
      privacyPolicyUrl: null,
      channelsEnabled: { email: true, instagram: true },
      sendLimits: { perInboxPerDay: 40, igPerDay: 20, rampSchedule: [] },
      warmupComplete: false,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: 'seed-mylar-bags' },
    update: {},
    create: {
      id: 'seed-mylar-bags',
      businessLineId: stinkSafe.id,
      name: 'Odour-Proof Mylar Storage Bags',
      description: 'Resealable, odour-proof mylar bags for food service and retail storage.',
      keyFeatures: ['Fully odour-proof seal', 'Food-safe material', 'Resealable zip closure'],
      targetBusinessTypes: ['Independent grocers', 'Cafés', 'Specialty food retailers'],
      link: 'https://stinksafe.co.uk/shop/mylar-storage-bags',
    },
  });

  await prisma.productVariant.upsert({
    where: { id: 'seed-mylar-bags-100pk' },
    update: {},
    create: {
      id: 'seed-mylar-bags-100pk',
      productId: product.id,
      variantName: '100-pack, medium (20x30cm)',
      price: 24.5,
      moq: 5,
      attributes: { size: '20x30cm', pack: 100 },
    },
  });

  await prisma.template.upsert({
    where: { id: 'seed-tpl-cold-intro' },
    update: {},
    create: {
      id: 'seed-tpl-cold-intro',
      businessLineId: stinkSafe.id,
      type: 'email_outbound',
      subjectSkeleton: 'Odour-proof storage for {{company}}',
      bodySkeleton:
        'Hi {{first_name}},\n\n{{personalized_hook}}\n\nStink Safe bags keep strong-smelling stock fully sealed — no more musty stockrooms.\n\nWorth a sample pack?\n\n{{sender_name}}',
    },
  });

  await prisma.targetingProfile.upsert({
    where: { id: 'seed-targeting-uk-grocers' },
    update: {},
    create: {
      id: 'seed-targeting-uk-grocers',
      businessLineId: stinkSafe.id,
      name: 'UK independent grocers',
      googlePlaceTypes: ['grocery_or_supermarket', 'convenience_store'],
      keywords: ['zero waste', 'bulk foods', 'independent grocer'],
      exclusions: ['Tesco', 'Sainsbury', 'Asda', 'Morrisons'],
    },
  });

  // --- Business discovered for the DM queue ---
  const roastAndGrind = await prisma.business.upsert({
    where: { id: 'seed-biz-roast-and-grind' },
    update: {},
    create: {
      id: 'seed-biz-roast-and-grind',
      businessLineId: stinkSafe.id,
      name: 'Roast & Grind Coffee Co',
      category: 'Independent coffee roaster',
      instagramHandle: '@roastandgrind.leeds',
      instagramFollowers: 6400,
      instagramBio: 'Small-batch coffee roasted in Leeds. Wholesale enquiries welcome.',
      instagramWebsite: 'roastandgrind.co.uk',
      source: 'instagram',
    },
  });

  // --- DM lead + draft (Instagram queue) ---
  const leadRoast = await prisma.lead.upsert({
    where: { id: 'seed-lead-roast-and-grind' },
    update: {},
    create: {
      id: 'seed-lead-roast-and-grind',
      businessLineId: stinkSafe.id,
      businessId: roastAndGrind.id,
      productId: product.id,
      contactMethod: 'website_form',
      channel: 'instagram_dm',
      status: 'drafted',
    },
  });

  await prisma.dmDraft.upsert({
    where: { id: 'seed-dm-roast-and-grind' },
    update: {},
    create: {
      id: 'seed-dm-roast-and-grind',
      leadId: leadRoast.id,
      body:
        'Hey! Freshly roasted beans deserve packaging that keeps that smell locked in until the customer opens the bag. Stink Safe makes odour-proof mylar bags — want a sample pack for your wholesale line?',
      groundingFacts: [{ text: 'Small-batch roaster, wholesale enquiries open.', source: 'instagram.com/roastandgrind.leeds' }],
      openPlaceholders: [],
      model: 'claude-haiku-4-5',
    },
  });

  // Reply queue is intentionally unseeded — no inbound-email ingestion pipeline exists yet (see
  // docs/project.md), so an empty Reply queue against a real environment is correct, not a bug.

  await prisma.batch.upsert({
    where: { id: 'seed-batch-uk-grocers-1' },
    update: {},
    create: {
      id: 'seed-batch-uk-grocers-1',
      businessLineId: stinkSafe.id,
      profileId: 'seed-targeting-uk-grocers',
      productId: product.id,
      geography: 'UK',
      channel: 'email',
      sizeRequested: 50,
      stats: { discovered: 50, enriched: 34, drafted: 3, sent: 0, apiSpend: '$4.10' },
      runBy: admin.id,
    },
  });

  console.log('Seeded:', {
    users: [admin.email, operator.email],
    businessLine: stinkSafe.name,
    leads: [leadRoast.id],
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
