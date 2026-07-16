import type { ReviewQueueItemDto } from '@outreach-engine/types';
import { emailStatusBadge } from '../../lib/badges';
import { Badge } from '../Badge';

export function ReviewContextPane({ item }: { item: ReviewQueueItemDto }) {
  return (
    <div className="p-[18px]">
      <div className="mb-0.5 flex items-start justify-between gap-2.5">
        <div className="text-[16px] font-semibold tracking-tight">{item.company}</div>
        <Badge spec={emailStatusBadge(item.emailStatus)} />
      </div>
      <div className="mb-3.5 font-mono text-[11.5px] text-link">{item.domain}</div>

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-md border border-border2 bg-surface p-2.5">
          <div className="mb-[3px] text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">Contact</div>
          <div className="text-[13px] font-medium">{item.contact}</div>
          <div className="text-[11.5px] text-text-secondary">{item.title}</div>
        </div>
        <div className="rounded-md border border-border2 bg-surface p-2.5">
          <div className="mb-[3px] text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">Location</div>
          <div className="text-[13px] font-medium">{item.city}</div>
          <div className="text-[11.5px] text-text-secondary">{item.segment}</div>
        </div>
      </div>

      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Facts used in this draft</div>
      <div className="flex flex-col gap-2">
        {item.facts.map((f, i) => (
          <div key={i} className="rounded-md border border-border2 bg-surface p-2.5">
            <div className="mb-[5px] text-[12.5px] text-body">{f.text}</div>
            <div className="font-mono text-[10px] text-text-muted">source · {f.source}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md border border-dashed border-border3 p-[11px_13px] text-[11.5px] text-text-secondary">
        These facts are shown so you can verify the personalization before sending. If a fact looks wrong,{' '}
        <b className="font-semibold text-body">Regenerate</b> or <b className="font-semibold text-body">Reject</b>.
      </div>
    </div>
  );
}
