import type { DmQueueItemDto, ReplyQueueItemDto, ReviewQueueItemDto } from '@outreach-engine/types';
import { apiFetch } from '../api-client';

// Every function here is async and takes the same shape it always did as a mock — now backed by
// real fetch calls to apps/api, scoped to the given business line.

export async function getReviewQueue(lineId: string): Promise<ReviewQueueItemDto[]> {
  return apiFetch<ReviewQueueItemDto[]>('/queue/review', { businessLineId: lineId });
}

export async function getReplyQueue(lineId: string): Promise<ReplyQueueItemDto[]> {
  return apiFetch<ReplyQueueItemDto[]>('/queue/replies', { businessLineId: lineId });
}

export async function getDmQueue(lineId: string): Promise<DmQueueItemDto[]> {
  return apiFetch<DmQueueItemDto[]>('/queue/dm', { businessLineId: lineId });
}
