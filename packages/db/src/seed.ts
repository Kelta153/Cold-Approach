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

  // --- Businesses discovered for the review/reply/DM queues ---
  const willowFarm = await prisma.business.upsert({
    where: { id: 'seed-biz-willow-farm' },
    update: {},
    create: {
      id: 'seed-biz-willow-farm',
      businessLineId: stinkSafe.id,
      name: 'Willow Farm Grocers',
      category: 'Independent grocer',
      address: '12 Mill Lane, York YO1 7PQ',
      website: 'willowfarmgrocers.co.uk',
      rating: 4.7,
      reviewCount: 212,
      source: 'google_places',
    },
  });

  const bulkAndBarrel = await prisma.business.upsert({
    where: { id: 'seed-biz-bulk-and-barrel' },
    update: {},
    create: {
      id: 'seed-biz-bulk-and-barrel',
      businessLineId: stinkSafe.id,
      name: 'Bulk & Barrel',
      category: 'Zero-waste refill store',
      address: '4 Canal Street, Manchester M1 3HE',
      website: 'bulkandbarrel.shop',
      rating: 4.9,
      reviewCount: 98,
      source: 'google_places',
    },
  });

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

  // --- Leads + Drafts (Review queue) ---
  const leadWillow = await prisma.lead.upsert({
    where: { id: 'seed-lead-willow-farm' },
    update: {},
    create: {
      id: 'seed-lead-willow-farm',
      businessLineId: stinkSafe.id,
      businessId: willowFarm.id,
      productId: product.id,
      email: 'orders@willowfarmgrocers.co.uk',
      emailStatus: 'valid',
      contactFirstName: 'Priya',
      contactMethod: 'email',
      channel: 'email',
      status: 'drafted',
    },
  });

  await prisma.draft.upsert({
    where: { id: 'seed-draft-willow-farm' },
    update: {},
    create: {
      id: 'seed-draft-willow-farm',
      leadId: leadWillow.id,
      subject: 'Odour-proof storage for Willow Farm Grocers',
      body:
        'Hi Priya,\n\nYour bulk-bins section is exactly where a musty stockroom becomes a real problem.\n\nStink Safe bags are fully odour-proof and food-safe — several grocers your size use them for coffee, spices, and dried goods storage.\n\nWorth a sample pack?\n\nStink Safe Team',
      groundingFacts: [
        { text: 'Runs a bulk-bins zero-waste aisle alongside standard grocery.', source: 'willowfarmgrocers.co.uk/about' },
        { text: 'Rated 4.7 stars across 212 Google reviews.', source: 'Google Places · crawled 15 Jul' },
      ],
      openPlaceholders: [],
      model: 'claude-haiku-4-5',
    },
  });

  const leadBulk = await prisma.lead.upsert({
    where: { id: 'seed-lead-bulk-and-barrel' },
    update: {},
    create: {
      id: 'seed-lead-bulk-and-barrel',
      businessLineId: stinkSafe.id,
      businessId: bulkAndBarrel.id,
      productId: product.id,
      email: 'hello@bulkandbarrel.shop',
      emailStatus: 'unverified',
      contactFirstName: 'Sam',
      contactMethod: 'email',
      channel: 'email',
      status: 'drafted',
    },
  });

  await prisma.draft.upsert({
    where: { id: 'seed-draft-bulk-and-barrel' },
    update: {},
    create: {
      id: 'seed-draft-bulk-and-barrel',
      leadId: leadBulk.id,
      subject: 'Odour-proof storage for Bulk & Barrel',
      body:
        'Hi Sam,\n\nA refill store lives or dies on how fresh the bulk bins smell — Stink Safe bags keep strong stock (coffee, spices, dried chilli) fully sealed between refills.\n\nHappy to send a free sample pack for the shop floor.\n\nStink Safe Team',
      groundingFacts: [
        { text: 'Zero-waste refill store with an open bulk-bin floor plan.', source: 'bulkandbarrel.shop' },
        { text: 'Rated 4.9 stars across 98 Google reviews.', source: 'Google Places · crawled 15 Jul' },
      ],
      openPlaceholders: [],
      model: 'claude-haiku-4-5',
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

  // --- A reply + reply draft (Reply queue) — from a lead who already received an earlier send ---
  const leadPastCustomer = await prisma.lead.upsert({
    where: { id: 'seed-lead-past-customer' },
    update: {},
    create: {
      id: 'seed-lead-past-customer',
      businessLineId: stinkSafe.id,
      businessId: willowFarm.id,
      productId: product.id,
      email: 'priya@willowfarmgrocers.co.uk',
      emailStatus: 'valid',
      contactFirstName: 'Priya',
      contactMethod: 'email',
      channel: 'email',
      status: 'replied',
    },
  });

  const reply = await prisma.reply.upsert({
    where: { id: 'seed-reply-willow-farm' },
    update: {},
    create: {
      id: 'seed-reply-willow-farm',
      leadId: leadPastCustomer.id,
      fromEmail: 'priya@willowfarmgrocers.co.uk',
      body: 'This looks great — what are your bulk order minimums, and do you offer a first-order discount?',
      classification: 'interested',
      classificationConfidence: 0.92,
    },
  });

  await prisma.replyDraft.upsert({
    where: { id: 'seed-replydraft-willow-farm' },
    update: {},
    create: {
      id: 'seed-replydraft-willow-farm',
      replyId: reply.id,
      body:
        'Hi Priya,\n\nGreat to hear from you! Our minimum order is [OPERATOR: confirm current MOQ], and first orders get [OPERATOR: confirm current first-order discount] off.\n\nWant me to send the full price list?\n\nStink Safe Team',
      groundingFacts: [],
      openPlaceholders: ['[OPERATOR: confirm current MOQ]', '[OPERATOR: confirm current first-order discount]'],
      model: 'claude-haiku-4-5',
    },
  });

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
    leads: [leadWillow.id, leadBulk.id, leadRoast.id, leadPastCustomer.id],
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
