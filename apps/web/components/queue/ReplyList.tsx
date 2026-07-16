'use client';

import type { ReplyQueueItemDto } from '@outreach-engine/types';
import { classificationBadge, doneBadge } from '../../lib/badges';
import { useAppState } from '../../lib/state/app-state';
import { listRowStyle } from '../../lib/list-row-style';
import { Badge } from '../Badge';

export function ReplyList({
  items,
  selectedId,
  onSelect,
}: {
  items: ReplyQueueItemDto[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const { isDecided, resetQueues } = useAppState();
  const pending = items.filter((it) => !isDecided('reply', it.id));

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-surface2">
      <div className="flex items-baseline gap-2 border-b border-border px-4 pb-2.5 pt-3.5">
        <div className="text-[14px] font-semibold">Replies</div>
        <div className="font-mono text-[11px] text-text-secondary">{pending.length} open</div>
        <div className="flex-1" />
        <div className="text-[11px] text-text-muted">interested first</div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {items.map((it) => {
          const decision = isDecided('reply', it.id);
          const badgeSpec = decision ? doneBadge(decision.status, decision.approvedVia) : classificationBadge(it.classification);
          return (
            <button key={it.id} onClick={() => onSelect(it.id)} style={listRowStyle({ selected: it.id === selectedId, done: !!decision })}>
              <div className="mb-[3px] flex items-center gap-1.5">
                <span className="flex-1 text-left text-[13px] font-semibold">{it.contact}</span>
                <Badge spec={badgeSpec} />
              </div>
              <div className="w-full truncate text-left text-xs text-text-secondary">{it.reply.replace(/\n/g, ' ')}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-muted">{it.company}</span>
              </div>
            </button>
          );
        })}

        {pending.length === 0 && (
          <div className="p-12 text-center text-[12.5px] text-text-secondary">
            All replies handled.
            <div className="mt-3">
              <button onClick={resetQueues} className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-xs text-label">
                Restore demo items
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
