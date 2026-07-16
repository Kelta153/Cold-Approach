'use client';

import { useState } from 'react';
import { useAppState } from '../../../lib/state/app-state';
import { useQueueKeyboard } from '../../../lib/hooks/use-queue-keyboard';
import { ReplyList } from '../../../components/queue/ReplyList';
import { ReplyDetail } from '../../../components/queue/ReplyDetail';
import { ShortcutBar } from '../../../components/ShortcutBar';

export default function RepliesPage() {
  const { replyItems, selection, select, decide, isDecided, drafts, setDraft } = useAppState();
  const [mobileDetail, setMobileDetail] = useState(false);

  const pending = replyItems.filter((it) => !isDecided('reply', it.id));
  const selectedId = selection.reply;
  const selectedItem = replyItems.find((it) => it.id === selectedId);

  useQueueKeyboard({
    pendingIds: pending.map((it) => it.id),
    selectedId,
    onSelect: (id) => select('reply', id),
  });

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 oe:grid-cols-[340px_1fr]">
        <div className={`border-r border-border min-w-0 ${mobileDetail ? 'hidden' : 'flex'} oe:flex`}>
          <ReplyList
            items={replyItems}
            selectedId={selectedId}
            onSelect={(id) => {
              select('reply', id);
              setMobileDetail(true);
            }}
          />
        </div>

        <div className={`min-h-0 flex-col overflow-y-auto ${mobileDetail ? 'flex' : 'hidden'} oe:flex`}>
          {mobileDetail && (
            <div className="p-3 pb-0 oe:hidden">
              <button onClick={() => setMobileDetail(false)} className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] text-label">
                ← Back to queue
              </button>
            </div>
          )}
          {selectedItem && pending.length > 0 ? (
            <ReplyDetail
              item={selectedItem}
              draftBody={drafts[selectedItem.id]?.body ?? selectedItem.draft}
              onDraftChange={(v) => setDraft(selectedItem.id, { body: v })}
              onSend={() => decide('reply', selectedItem.id, 'sent', 'webapp')}
              onSkip={() => decide('reply', selectedItem.id, 'skipped')}
              onEscalate={() => decide('reply', selectedItem.id, 'escalated')}
              onHandled={() => decide('reply', selectedItem.id, 'handled')}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-text-muted">All replies handled.</div>
          )}
        </div>
      </div>
      <ShortcutBar queue="reply" />
    </>
  );
}
