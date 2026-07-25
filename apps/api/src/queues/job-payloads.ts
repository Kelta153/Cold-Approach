export interface DiscoveryJobPayload {
  batchId: string;
  businessLineId: string;
  profileId: string;
  productId: string;
  geography: string;
  sizeRequested: number;
}

export interface EnrichmentJobPayload {
  batchId: string;
  leadId: string;
  businessLineId: string;
}

export interface DraftingJobPayload {
  batchId: string;
  leadId: string;
  businessLineId: string;
}
