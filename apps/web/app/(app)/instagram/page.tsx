'use client';

import { useState } from 'react';
import { useAppState } from '../../../lib/state/app-state';
import { useQueueKeyboard } from '../../../lib/hooks/use-queue-keyboard';
import { DmList } from '../../../components/queue/DmList';
import { DmDetail } from '../../../components/queue/DmDetail';
import { ShortcutBar } from '../../../components/ShortcutBar';

export default function InstagramPage() {
  const { dmItems, selection, select, decide, isDecided } = useAppState();
  const [mobileDetail, setMobileDetail] = useState(false);

  const pending = dmItems.filter((it) => !isDecided('dm', it.id));
  const selectedId = selection.dm;
  const selectedItem = dmItems.find((it) => it.id === selectedId);

  useQueueKeyboard({
    pendingIds: pending.map((it) => it.id),
    selectedId,
    onSelect: (id) => select('dm', id),
  });

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 oe:grid-cols-[340px_1fr]">
        <div className={`border-r border-border min-w-0 ${mobileDetail ? 'hidden' : 'flex'} oe:flex`}>
          <DmList
            items={dmItems}
            selectedId={selectedId}
            onSelect={(id) => {
              select('dm', id);
              setMobileDetail(true);
            }}
          />
        </div>

        <div className={`min-h-0 overflow-y-auto ${mobileDetail ? 'block' : 'hidden'} oe:block`}>
          {mobileDetail && (
            <div className="p-3 pb-0 oe:hidden">
              <button onClick={() => setMobileDetail(false)} className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] text-label">
                ← Back to queue
              </button>
            </div>
          )}
          {selectedItem && pending.length > 0 ? (
            <DmDetail
              item={selectedItem}
              onSent={() => decide('dm', selectedItem.id, 'sent')}
              onSkip={() => decide('dm', selectedItem.id, 'skipped')}
              onReject={() => decide('dm', selectedItem.id, 'rejected')}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-text-muted">DM queue clear.</div>
          )}
        </div>
      </div>
      <ShortcutBar queue="dm" />
    </>
  );
}
