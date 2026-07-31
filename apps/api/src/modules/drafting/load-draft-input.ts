import { prisma } from '@outreach-engine/db';
import type { DraftGroundingInput } from './drafting.service';

/** Shared by the real drafting pipeline (`DraftingProcessor`) and manual Regenerate
 * (`QueueService.regenerateDraft`) — both need the exact same lead/business/product/businessLine
 * + active-template assembly; extracted here so the two call sites can't quietly drift apart. */
export async function loadDraftGroundingInput(leadId: string): Promise<DraftGroundingInput> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true, product: true, businessLine: true },
  });

  const template = await prisma.template.findFirst({
    where: { businessLineId: lead.businessLineId, type: 'email_outbound', active: true },
    orderBy: { createdAt: 'desc' },
  });

  return {
    business: {
      name: lead.business.name,
      category: lead.business.category,
      address: lead.business.address,
      website: lead.business.website,
    },
    product: {
      name: lead.product.name,
      description: lead.product.description,
      keyFeatures: lead.product.keyFeatures,
      link: lead.product.link,
    },
    businessLine: {
      senderName: lead.businessLine.senderName,
      companyLegalName: lead.businessLine.companyLegalName,
      postalAddress: lead.businessLine.postalAddress,
    },
    templateHint: template?.bodySkeleton ?? null,
  };
}
