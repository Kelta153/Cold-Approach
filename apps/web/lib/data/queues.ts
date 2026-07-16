import type { DmQueueItemDto, ReplyQueueItemDto, ReviewQueueItemDto } from '@outreach-engine/types';
import { dmItems, replyItems, reviewItems, seededSendAudits } from '../mock-data';

// Every function here is async and takes the same shape a real `fetch('/api/...')` call
// would — swap the body for a fetch later without touching any component.

const REPLY_ORDER: Record<string, number> = { interested: 0, question: 1, not_interested: 2, opt_out: 3 };

export async function getReviewQueue(lineId: string): Promise<ReviewQueueItemDto[]> {
  return reviewItems
    .filter((item) => item.line === lineId)
    .map(({ line, ...item }) => ({ ...item, send: seededSendAudits[item.id] }));
}

export async function getReplyQueue(lineId: string): Promise<ReplyQueueItemDto[]> {
  return replyItems
    .filter((item) => item.line === lineId)
    .slice()
    .sort((a, b) => (REPLY_ORDER[a.classification] ?? 9) - (REPLY_ORDER[b.classification] ?? 9))
    .map(({ line, ...item }) => ({ ...item, send: seededSendAudits[item.id] }));
}

export async function getDmQueue(lineId: string): Promise<DmQueueItemDto[]> {
  return dmItems.filter((item) => item.line === lineId).map(({ line, ...item }) => item);
}
