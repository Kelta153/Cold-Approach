import type {
  BatchDto,
  CatalogueRowDto,
  DmQueueItemDto,
  EmailStatus,
  ReplyQueueItemDto,
  ReviewQueueItemDto,
  SendAuditDto,
  TargetingRowDto,
  TemplateDto,
} from '@outreach-engine/types';

/**
 * Fixtures shaped 1:1 onto future API responses. Field names/enum values are reconciled
 * against packages/db/prisma/schema.prisma (source of truth), NOT copied verbatim from the
 * original .dc.html prototype — the prototype's mock data was authored independently and
 * used different names/values in a few places (see comments below at each divergence).
 */

export interface LineFixture {
  id: string;
  name: string;
  /** UI-only accent for the line-switcher dot — not a persisted schema column. */
  color: string;
  senderName: string;
  /** UI-only tagline shown in the admin form — not a persisted schema column. */
  positioning: string;
  companyLegalName: string;
  postalAddress: string | null;
  sendingDomain: string;
  inboxes: { addr: string; warmupStatus: 'warm' | 'warming' }[];
  unsubscribeCopy: string;
  dailyCapPerLine: number;
  capPerInbox: number;
  minGapSeconds: number;
  warmupComplete: boolean;
  channelsEnabled: { email: boolean; instagram: boolean };
}

export const lines: LineFixture[] = [
  {
    id: 'ln_aurora',
    name: 'Aurora Skincare',
    color: '#3fce8a',
    senderName: 'Kay from Aurora',
    positioning: 'Clean-label skincare wholesale for independent retailers',
    companyLegalName: 'Aurora Skincare Ltd',
    postalAddress: '4 Paintworks, Bristol BS4 3EH',
    sendingDomain: 'auroraskin.co',
    inboxes: [
      { addr: 'kay@auroraskin.co', warmupStatus: 'warm' },
      { addr: 'hello@auroraskin.co', warmupStatus: 'warming' },
    ],
    unsubscribeCopy: 'Reply "unsubscribe" and we will never contact you again.',
    dailyCapPerLine: 80,
    capPerInbox: 40,
    minGapSeconds: 90,
    warmupComplete: true,
    channelsEnabled: { email: true, instagram: true },
  },
  {
    id: 'ln_forge',
    name: 'Forge Analytics',
    color: '#6ea8fe',
    senderName: 'Sam at Forge',
    positioning: 'Warehouse-native analytics for mid-market data teams',
    companyLegalName: 'Forge Analytics Ltd',
    // Left null deliberately — this is the fixture that demonstrates the footer/postal-address
    // compliance block (checkFooterPresent), not a bug.
    postalAddress: null,
    sendingDomain: 'tryforge.io',
    inboxes: [{ addr: 'sam@tryforge.io', warmupStatus: 'warm' }],
    unsubscribeCopy: 'One-click unsubscribe link in every message.',
    dailyCapPerLine: 50,
    capPerInbox: 50,
    minGapSeconds: 120,
    warmupComplete: false,
    channelsEnabled: { email: true, instagram: false },
  },
];

const emailStatus = (verified: boolean): EmailStatus => (verified ? 'valid' : 'unverified');

/** Sent-item audit records, keyed by queue item id — seeded here (rather than on the item
 * itself) so the same item shape works whether it's pending or already decided, exactly like
 * a real Send/Reply lookup would attach this only once a decision exists. Includes both
 * approvedVia variants so the "sent via Telegram" badge treatment is exercised without a
 * live bot. */
export const seededSendAudits: Record<string, SendAuditDto> = {
  msg_7a1x4d: { approvedVia: 'telegram', approvedByUserId: 'usr_admin_1', sentAt: '2026-07-14T09:12:00Z' },
  rep_8m1e: { approvedVia: 'telegram', approvedByUserId: 'usr_admin_1', sentAt: '2026-07-15T11:40:00Z' },
};

export const reviewItems: (ReviewQueueItemDto & { line: string })[] = [
  {
    line: 'ln_aurora', id: 'msg_9f2k1c', leadId: 'lead_9f2k1c', businessLineId: 'ln_aurora',
    company: 'Willow & Sage Apothecary', contact: 'Mara Ellison', title: 'Owner',
    email: 'mara@willowsage.shop', emailStatus: emailStatus(true), domain: 'willowsage.shop',
    city: 'Bristol, UK', segment: 'Indie beauty retail · 2 locations', channel: 'email',
    facts: [
      { text: 'Stocks 14 independent skincare brands in the online catalogue.', source: 'willowsage.shop/brands · crawled 12 Jul' },
      { text: 'Opened a second location in Clifton in May 2026.', source: 'Bristol Post · 14 May 2026' },
      { text: 'Instagram bio: "clean beauty only — always cruelty free".', source: 'instagram.com/willowandsage' },
    ],
    subject: 'Clean-label margins for Willow & Sage',
    body: 'Hi Mara,\n\nCongrats on the Clifton opening — two shops in a year is no small thing.\n\nI noticed Willow & Sage carries 14 indie skincare lines and holds a strict clean-beauty bar. Aurora sits squarely in that lane: COSMOS-certified, UK-made, and we structure wholesale so independents keep a 58%+ margin.\n\nWorth a quick look at the line sheet? Happy to send samples to either shop.\n\nKay\nAurora Skincare',
    blockedReasons: [],
  },
  {
    line: 'ln_aurora', id: 'msg_9f2k7t', leadId: 'lead_9f2k7t', businessLineId: 'ln_aurora',
    company: 'Botanica Beauty Supply', contact: 'Priya Nair', title: 'Head Buyer',
    email: 'priya@botanicabeauty.co.uk', emailStatus: emailStatus(false), domain: 'botanicabeauty.co.uk',
    city: 'Manchester, UK', segment: 'Beauty wholesale · ~20 staff', channel: 'email',
    facts: [
      { text: 'Supplies 200+ salons across the North West.', source: 'botanicabeauty.co.uk/about' },
      { text: 'Recently added a "conscious beauty" category page.', source: 'sitemap diff · 8 Jul' },
    ],
    subject: 'A conscious-beauty line your salons will reorder',
    body: 'Hi Priya,\n\nSaw Botanica just added a conscious-beauty category — good timing, salon demand for certified clean lines keeps climbing.\n\nAurora is COSMOS-certified and built for repeat salon orders: retail-ready POS kits, 30-day terms, no minimum reorder.\n\nOpen to a 15-minute intro this week?\n\nKay\nAurora Skincare',
    blockedReasons: [],
  },
  {
    line: 'ln_aurora', id: 'msg_9f2m3a', leadId: 'lead_9f2m3a', businessLineId: 'ln_aurora',
    company: 'The Grooming Dept', contact: 'Callum Reid', title: 'Founder',
    email: 'callum@groomingdept.uk', emailStatus: emailStatus(true), domain: 'groomingdept.uk',
    city: 'Leeds, UK', segment: 'Men’s grooming retail', channel: 'email',
    facts: [
      { text: 'Runs 3 barbershop-adjacent retail counters in Leeds.', source: 'groomingdept.uk/stores' },
      { text: 'Blog post asking for "skincare brands men actually buy".', source: 'groomingdept.uk/blog · 2 Jul' },
    ],
    subject: 'Skincare men actually buy — for your counters',
    body: 'Hi Callum,\n\nYour post on skincare brands men actually buy hit a nerve — most clean lines skew feminine in packaging and price.\n\nAurora’s unisex core range was designed for exactly your counters: minimal packaging, sub-£25 retail, strong margins.\n\nCan I send the men’s-range line sheet?\n\nKay\nAurora Skincare',
    // Reconciled: prototype hardcoded a single "warm-up not complete" blockReason string.
    // Generalized to the plural blockedReasons[] the real chokepoint returns.
    blockedReasons: ['Sending inbox hello@auroraskin.co has not completed warm-up (6 of 14 days).'],
  },
  {
    line: 'ln_aurora', id: 'msg_9f2n8q', leadId: 'lead_9f2n8q', businessLineId: 'ln_aurora',
    company: 'Fern & Co', contact: 'Sofia Marsh', title: 'Store Manager',
    email: 'sofia@fernandco.com', emailStatus: emailStatus(true), domain: 'fernandco.com',
    city: 'Bath, UK', segment: 'Lifestyle boutique', channel: 'email',
    facts: [
      { text: 'Curated gift boutique; skincare shelf is 3 brands, all imported.', source: 'in-store photos · Google Maps' },
      { text: 'Featured in "Bath’s best independent shops 2026".', source: 'Bath Echo · Jan 2026' },
    ],
    subject: 'A UK-made skincare line for Fern & Co’s shelf',
    body: 'Hi Sofia,\n\nFern & Co’s skincare shelf is all imports right now — which means long lead times and customs noise.\n\nAurora is made in Somerset, 40 minutes from you. Two-day restock, UK-story packaging your gift customers respond to, and margins that beat all three lines you carry.\n\nShall I drop off samples next week?\n\nKay\nAurora Skincare',
    blockedReasons: [],
  },
  {
    line: 'ln_forge', id: 'msg_7a1x4d', leadId: 'lead_7a1x4d', businessLineId: 'ln_forge',
    company: 'Northbeam Logistics', contact: 'Dan Okafor', title: 'Head of Data',
    email: 'dan.okafor@northbeam.co', emailStatus: emailStatus(true), domain: 'northbeam.co',
    city: 'London, UK', segment: 'Logistics · 350 staff', channel: 'email',
    facts: [
      { text: 'Job posting for a 3rd analytics engineer (dbt, Snowflake).', source: 'LinkedIn Jobs · 10 Jul' },
      { text: 'Data team blog mentions "dashboard sprawl" as a 2026 pain.', source: 'northbeam.co/engineering' },
    ],
    subject: 'Dashboard sprawl at Northbeam',
    body: 'Hi Dan,\n\nYour engineering blog called out dashboard sprawl — and you’re hiring a third analytics engineer, so it’s clearly not slowing down.\n\nForge sits on top of Snowflake and replaces the dashboard layer with governed, versioned metrics. Teams your size typically cut BI tooling spend ~40%.\n\nWorth 20 minutes?\n\nSam\nForge Analytics',
    // Kept "ready" (no blockedReasons) even though ln_forge as a whole is missing a postal
    // address — this item demonstrates the *decided-via-Telegram* state instead (see
    // seededSendAudits). msg_9f3p2x below is the one demonstrating the footer block.
    blockedReasons: [],
  },
  {
    line: 'ln_forge', id: 'msg_7a1y9k', leadId: 'lead_7a1y9k', businessLineId: 'ln_forge',
    company: 'Casper Health', contact: 'Lena Vogel', title: 'VP Engineering',
    email: 'lena@casperhealth.io', emailStatus: emailStatus(false), domain: 'casperhealth.io',
    city: 'Berlin, DE', segment: 'Health tech · Series B', channel: 'email',
    facts: [
      { text: 'Raised a $28M Series B in April 2026.', source: 'TechCrunch · 3 Apr 2026' },
      { text: 'Stack includes BigQuery + Looker (careers page).', source: 'casperhealth.io/careers' },
    ],
    subject: 'Post-Series-B analytics without the Looker tax',
    body: 'Hi Lena,\n\nCongrats on the Series B. Scaling headcount usually means Looker seat costs scaling faster.\n\nForge runs on BigQuery directly — usage-based, no per-seat pricing, SOC 2. Casper-sized teams typically migrate a workspace in under two weeks.\n\nOpen to a short call?\n\nSam\nForge Analytics',
    blockedReasons: [],
  },
  {
    // New fixture (not in the original prototype) added per the postal-address/footer-check
    // requirement: proves the blocked banner is reason-driven, not hardcoded to warm-up copy.
    line: 'ln_forge', id: 'msg_9f3p2x', leadId: 'lead_9f3p2x', businessLineId: 'ln_forge',
    company: 'Saltwater Provisions', contact: 'Iris Halden', title: 'Operations Lead',
    email: 'iris@saltwaterprovisions.com', emailStatus: emailStatus(true), domain: 'saltwaterprovisions.com',
    city: 'Leith, UK', segment: 'Grocery distribution · 40 staff', channel: 'email',
    facts: [
      { text: 'Distributes to 60+ independent grocers across Scotland.', source: 'saltwaterprovisions.com/about' },
      { text: 'Ops team posted about a new WMS rollout this quarter.', source: 'LinkedIn · 9 Jul' },
    ],
    subject: 'Cutting dashboard sprawl during the WMS rollout',
    body: 'Hi Iris,\n\nMid-rollout is exactly when reporting sprawls hardest.\n\nForge sits on top of your warehouse data and replaces one-off dashboards with governed metrics — no re-platforming required.\n\nWorth a look once the rollout settles?\n\nSam\nForge Analytics',
    blockedReasons: ['Compliance footer (postal address / unsubscribe copy) is missing for this business line.'],
  },
];

export const replyItems: (ReplyQueueItemDto & { line: string })[] = [
  {
    line: 'ln_aurora', id: 'rep_3k1a', leadId: 'lead_9f2k1c', businessLineId: 'ln_aurora',
    contact: 'Mara Ellison', company: 'Willow & Sage', classification: 'interested',
    inbox: 'kay@auroraskin.co', receivedAt: '2026-07-16T07:30:00Z', sentAt: '2026-07-13T09:00:00Z',
    original: 'Hi Mara,\n\nCongrats on the Clifton opening — two shops in a year is no small thing…',
    reply: 'This actually sounds interesting. What are your wholesale minimums, and do you do sale-or-return for a first order?\n\nMara',
    draft: 'Hi Mara,\n\nGreat to hear from you. Our starter bundle is [OPERATOR: confirm current starter MOQ] with free carriage, and yes — first orders are sale-or-return for 60 days.\n\nI’ll attach the line sheet [OPERATOR: attach 2026 line sheet PDF] so you can see the full range and margins.\n\nWould samples to the Clifton shop help?\n\nKay',
  },
  {
    line: 'ln_aurora', id: 'rep_3k2b', leadId: 'lead_9f2k7t', businessLineId: 'ln_aurora',
    contact: 'Priya Nair', company: 'Botanica Beauty', classification: 'question',
    inbox: 'kay@auroraskin.co', receivedAt: '2026-07-16T04:30:00Z', sentAt: '2026-07-14T09:00:00Z',
    original: 'Hi Priya,\n\nSaw Botanica just added a conscious-beauty category…',
    reply: 'Before anything else — are your products vegan certified, or just cruelty-free? Our salons ask for both.',
    draft: 'Hi Priya,\n\nBoth: the full range is Vegan Society registered and Leaping Bunny certified. Certificates are on every product page, and I can send the audit pack for your salon partners.\n\nShall I include it with the intro deck?\n\nKay',
  },
  {
    // Reconciled: prototype used cls:'not_now'; schema's ReplyClassification enum has
    // 'not_interested' (no 'not_now'). Value fixed, display label stays "not now".
    line: 'ln_aurora', id: 'rep_3k4c', leadId: 'lead_verdant', businessLineId: 'ln_aurora',
    contact: 'James Whitfield', company: 'Verdant Living', classification: 'not_interested',
    inbox: 'hello@auroraskin.co', receivedAt: '2026-07-15T09:30:00Z', sentAt: '2026-07-10T09:00:00Z',
    original: 'Hi James,\n\nVerdant’s refill station is exactly where skincare is heading…',
    reply: 'Not the right time — we’re mid-refit until September. Try me then.',
    draft: 'Hi James,\n\nUnderstood — refits eat every spare hour. I’ll come back to you in the first week of September.\n\nGood luck with the build.\n\nKay',
  },
  {
    line: 'ln_aurora', id: 'rep_3k5d', leadId: 'lead_beautyroom', businessLineId: 'ln_aurora',
    contact: 'info@thebeautyroom.uk', company: 'The Beauty Room', classification: 'opt_out',
    inbox: 'kay@auroraskin.co', receivedAt: '2026-07-15T09:30:00Z', sentAt: '2026-07-12T09:00:00Z',
    original: 'Hi,\n\nThe Beauty Room’s curation caught my eye…',
    reply: 'Please remove us from your list.',
    draft: 'Hi,\n\nDone — you’ve been removed and won’t hear from us again. Apologies for the interruption.\n\nKay',
  },
  {
    line: 'ln_forge', id: 'rep_8m1e', leadId: 'lead_7a1x4d', businessLineId: 'ln_forge',
    contact: 'Dan Okafor', company: 'Northbeam', classification: 'interested',
    inbox: 'sam@tryforge.io', receivedAt: '2026-07-16T08:20:00Z', sentAt: '2026-07-15T09:00:00Z',
    original: 'Hi Dan,\n\nYour engineering blog called out dashboard sprawl…',
    reply: 'Ha — fair hit. We’re actually reviewing the BI layer this quarter. Send over pricing and a sandbox if you have one.',
    draft: 'Hi Dan,\n\nPerfect timing then. Sandbox link: [OPERATOR: generate sandbox invite for northbeam.co] — it’s preloaded with a logistics demo dataset.\n\nPricing is usage-based; for a team your size it lands around [OPERATOR: confirm current mid-market band]. Happy to walk through it live.\n\nSam',
  },
];

export const dmItems: (DmQueueItemDto & { line: string })[] = [
  {
    line: 'ln_aurora', id: 'dm_5r1a', leadId: 'lead_glowhaus', businessLineId: 'ln_aurora',
    handle: '@glowhaus.bristol', name: 'Glow Haus', followers: '12.4k', posts: '642',
    bio: 'Bristol’s clean beauty studio ✨ facials · skin consults · retail corner. Booking link below.',
    draft: 'Hey! Your retail corner keeps popping up on my feed — love the curation. I run Aurora, a COSMOS-certified skincare line made in Somerset. We stock studios like yours with 58%+ margin and tiny minimums. Want me to send the line sheet?',
  },
  {
    line: 'ln_aurora', id: 'dm_5r2b', leadId: 'lead_facialbar', businessLineId: 'ln_aurora',
    handle: '@thefacialbar', name: 'The Facial Bar', followers: '8.9k', posts: '417',
    bio: 'Results-driven facials, Cardiff. Est. 2021. Retail shelf: ask us what we use!',
    draft: 'Hi! "Ask us what we use" — that’s exactly the retail energy we build for. Aurora is a UK clean-label line studios retail after using in treatments. Sample kit for your team? No strings.',
  },
  {
    line: 'ln_aurora', id: 'dm_5r3c', leadId: 'lead_fernbeauty', businessLineId: 'ln_aurora',
    handle: '@fernbeauty.bath', name: 'Fern Beauty', followers: '21.1k', posts: '1,204',
    bio: 'Independent beauty boutique in Bath 🌿 est.2018. Shipping UK-wide.',
    draft: 'Hey Fern team! Fellow West Country business here — Aurora Skincare, made in Somerset. Your shelf and our range feel like a natural fit. Can I send over the wholesale deck?',
  },
  {
    line: 'ln_forge', id: 'dm_5r4d', leadId: 'lead_dataengdan', businessLineId: 'ln_forge',
    handle: '@dataeng.dan', name: 'Dan O.', followers: '4.2k', posts: '188',
    bio: 'Head of Data @northbeam. dbt stan. Occasional conference talks.',
    draft: 'Hey Dan — caught your dashboard-sprawl thread. Forge replaces the BI layer with governed metrics on Snowflake. DM-ing here since my email might be in your promotions tab — worth 20 mins?',
  },
];

export const templates: TemplateDto[] = [
  {
    id: 'tpl_01h2x', businessLineId: 'ln_aurora', type: 'email_outbound', version: 3,
    subjectSkeleton: 'Clean-label margins for {{company}}',
    bodySkeleton: 'Hi {{first_name}},\n\n{{personalized_hook}}\n\nAurora is COSMOS-certified, UK-made, and structured so independents keep a 58%+ margin.\n\nWorth a quick look at the line sheet?\n\n{{sender_name}}',
  },
  {
    id: 'tpl_01h3y', businessLineId: 'ln_aurora', type: 'email_outbound', version: 2,
    subjectSkeleton: 'Re: Clean-label margins for {{company}}',
    bodySkeleton: 'Hi {{first_name}},\n\nQuick nudge — since I wrote, {{recent_stockist}} started carrying the range and reordered within 3 weeks.\n\nStill happy to send samples to {{city}}.\n\n{{sender_name}}',
  },
  {
    id: 'tpl_01h4z', businessLineId: 'ln_aurora', type: 'instagram_dm', version: 2,
    subjectSkeleton: null,
    bodySkeleton: 'Hey! {{personalized_hook}} I run Aurora, a COSMOS-certified line made in Somerset — we stock boutiques like yours with tiny minimums. Want the line sheet?',
  },
];

export const templateNames: Record<string, string> = {
  tpl_01h2x: 'Cold intro — retailer v3',
  tpl_01h3y: 'Follow-up 1 — social proof',
  tpl_01h4z: 'IG DM — boutique v2',
};

export const tokens = ['{{first_name}}', '{{company}}', '{{city}}', '{{personalized_hook}}', '{{recent_stockist}}', '{{sender_name}}', '{{unsubscribe}}'];

export const catalogue: CatalogueRowDto[] = [
  { sku: 'AUR-CLN-01', name: 'Gentle Cleansing Balm 90ml', priceLabel: '£7.40 / unit', moq: 12, active: true },
  { sku: 'AUR-SRM-02', name: 'Barrier Repair Serum 30ml', priceLabel: '£11.20 / unit', moq: 12, active: true },
  { sku: 'AUR-MST-03', name: 'Daily Moisture Cream 50ml', priceLabel: '£8.90 / unit', moq: 12, active: true },
  { sku: 'AUR-KIT-ST', name: 'Retail Starter Bundle (36 units + POS)', priceLabel: '£298.00 / kit', moq: 1, active: true },
  { sku: 'AUR-SPF-04', name: 'Mineral SPF30 40ml', priceLabel: '£9.60 / unit', moq: 12, active: false },
];

export const targeting: TargetingRowDto[] = [
  { name: 'UK indie beauty retailers', description: '1–5 locations, clean-beauty positioning', geography: 'UK', channel: 'email + instagram_dm', prospectsFound: 1842, active: true },
  { name: 'Facial studios w/ retail corner', description: 'IG-first, 5k–50k followers', geography: 'UK', channel: 'instagram_dm', prospectsFound: 634, active: true },
  { name: 'Salon wholesale distributors', description: 'Regional distributors, 10+ staff', geography: 'UK + IE', channel: 'email', prospectsFound: 207, active: false },
];

export const batches: BatchDto[] = [
  { id: 'bat_01j8m2', date: '14 Jul 2026', profile: 'UK indie beauty retailers', channel: 'email', funnelLabel: '412 → 236 → 198 → 180', apiSpendLabel: '$14.20', status: 'complete' },
  { id: 'bat_01j7k9', date: '11 Jul 2026', profile: 'Facial studios w/ retail corner', channel: 'instagram', funnelLabel: '180 → 122 → 96 → —', apiSpendLabel: '$8.75', status: 'drafting' },
  { id: 'bat_01j6h4', date: '8 Jul 2026', profile: 'UK indie beauty retailers', channel: 'email', funnelLabel: '395 → 241 → 210 → 202', apiSpendLabel: '$13.60', status: 'complete' },
  { id: 'bat_01j5f1', date: '4 Jul 2026', profile: 'Salon wholesale distributors', channel: 'email', funnelLabel: '88 → 41 → — → —', apiSpendLabel: '$3.10', status: 'failed' },
];

export const batchStats = [
  { label: 'Batches run', value: '24', sub: 'last 90 days' },
  { label: 'Messages sent', value: '3,912', sub: 'across both channels' },
  { label: 'Reply rate', value: '7.4%', sub: '↑ 1.1pt vs prior period' },
  { label: 'API spend', value: '$212.40', sub: '$0.054 / message avg' },
];
