'use client';

import type { ReviewQueueItemDto } from '@outreach-engine/types';
import { complianceBadge, doneBadge } from '../../lib/badges';
import { useAppState } from '../../lib/state/app-state';
import { listRowStyle } from '../../lib/list-row-style';
import { Badge } from '../Badge';
import { QueueSkeleton } from './QueueSkeleton';

export function ReviewList({
  items,
  selectedId,
  onSelect,
  loading,
}: {
  items: ReviewQueueItemDto[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const { isDecided, resetQueues } = useAppState();
  const pending = items.filter((it) => !isDecided('review', it.id));

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-surface2">
      <div className="flex items-baseline gap-2 border-b border-border px-4 pb-2.5 pt-3.5">
        <div className="text-[14px] font-semibold">Review queue</div>
        <div className="font-mono text-[11px] text-text-secondary">{pending.length} pending</div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {loading && <QueueSkeleton />}

        {!loading && pending.length > 0 &&
          items.map((it) => {
            const decision = isDecided('review', it.id);
            const badgeSpec = decision ? doneBadge(decision.status, decision.approvedVia, decision.simulated) : complianceBadge(it.blockedReasons);
            return (
              <button key={it.id} onClick={() => onSelect(it.id)} style={listRowStyle({ selected: it.id === selectedId, done: !!decision })}>
                <div className="mb-[3px] flex items-center gap-1.5">
                  <span className="flex-1 truncate text-left text-[13px] font-semibold">{it.company}</span>
                  <Badge spec={badgeSpec} />
                </div>
                <div className="w-full truncate text-left text-xs text-text-secondary">{it.subject}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-text-muted">{it.contact}</span>
                </div>
              </button>
            );
          })}

        {!loading && pending.length === 0 && (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3.5 flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] text-[15px]" style={{ borderColor: 'var(--oe-green)', color: 'var(--oe-green)' }}>
              ✓
            </div>
            <div className="mb-1 text-[13.5px] font-semibold">Queue clear</div>
            <div className="mb-4 text-xs text-text-secondary">Every drafted message for this line has been reviewed.</div>
            <button onClick={resetQueues} className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-xs text-label hover:text-text">
              Show reviewed items again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
