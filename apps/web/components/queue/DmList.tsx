'use client';

import type { DmQueueItemDto } from '@outreach-engine/types';
import { doneBadge } from '../../lib/badges';
import { useAppState } from '../../lib/state/app-state';
import { listRowStyle } from '../../lib/list-row-style';
import { Badge } from '../Badge';

export function DmList({
  items,
  selectedId,
  onSelect,
}: {
  items: DmQueueItemDto[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const { isDecided, resetQueues } = useAppState();
  const pending = items.filter((it) => !isDecided('dm', it.id));

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-surface2">
      <div className="border-b border-border px-4 pb-2.5 pt-3.5">
        <div className="flex items-baseline gap-2">
          <div className="text-[14px] font-semibold">Instagram DMs</div>
          <div className="font-mono text-[11px] text-text-secondary">{pending.length} to send</div>
        </div>
        <div
          className="mt-[7px] inline-flex items-center gap-1.5 rounded-[4px] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-wide text-ig2"
          style={{ background: 'rgba(229,122,184,.1)', border: '1px solid rgba(229,122,184,.3)' }}
        >
          ◈ manual send channel
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {items.map((it) => {
          const decision = isDecided('dm', it.id);
          return (
            <button
              key={it.id}
              onClick={() => onSelect(it.id)}
              style={listRowStyle({ selected: it.id === selectedId, done: !!decision, accent: '#c2508f', selectedBg: 'var(--oe-selected-bg-ig)' })}
            >
              <div className="mb-[3px] flex items-center gap-1.5">
                <span className="flex-1 text-left text-[13px] font-semibold text-ig2">{it.handle}</span>
                <span className="font-mono text-[10.5px] text-text-secondary">{it.followers}</span>
              </div>
              <div className="w-full truncate text-left text-xs text-text-secondary">
                {it.name} · {it.bio.slice(0, 48)}…
              </div>
              {decision && (
                <div className="mt-1">
                  <Badge spec={doneBadge(decision.status, decision.approvedVia)} />
                </div>
              )}
            </button>
          );
        })}

        {pending.length === 0 && (
          <div className="p-12 text-center text-[12.5px] text-text-secondary">
            DM queue clear.
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
