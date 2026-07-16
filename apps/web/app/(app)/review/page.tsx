'use client';

import { useCallback, useState } from 'react';
import { useAppState } from '../../../lib/state/app-state';
import { useQueueKeyboard } from '../../../lib/hooks/use-queue-keyboard';
import { ReviewList } from '../../../components/queue/ReviewList';
import { ReviewContextPane } from '../../../components/queue/ReviewContextPane';
import { ReviewEditor } from '../../../components/queue/ReviewEditor';
import { ShortcutBar } from '../../../components/ShortcutBar';

function regenerateBody(body: string): string {
  const withGreeting = body.replace('Hi ', 'Hello ');
  const paragraphs = withGreeting.split('\n\n');
  if (paragraphs.length > 1) paragraphs[1] += ' (Regenerated variant — tightened hook.)';
  return paragraphs.join('\n\n');
}

export default function ReviewPage() {
  const { reviewItems, isLoadingLine, selection, select, decide, isDecided, drafts, setDraft, showToast } = useAppState();
  const [mobileDetail, setMobileDetail] = useState(false);

  const pending = reviewItems.filter((it) => !isDecided('review', it.id));
  const selectedId = selection.review;
  const selectedItem = reviewItems.find((it) => it.id === selectedId);

  const onSelect = useCallback(
    (id: string) => {
      select('review', id);
      setMobileDetail(true);
    },
    [select],
  );

  const onRegen = useCallback(() => {
    if (!selectedItem) return;
    const currentBody = drafts[selectedItem.id]?.body ?? selectedItem.body;
    setDraft(selectedItem.id, { subject: drafts[selectedItem.id]?.subject ?? selectedItem.subject, body: regenerateBody(currentBody) });
    showToast('Draft regenerated');
  }, [selectedItem, drafts, setDraft, showToast]);

  useQueueKeyboard({
    pendingIds: pending.map((it) => it.id),
    selectedId,
    onSelect: (id) => select('review', id),
    onKey: (key) => {
      if (!selectedItem) return;
      if (key === 'enter') {
        if (selectedItem.blockedReasons.length === 0) decide('review', selectedItem.id, 'sent', 'webapp');
        else showToast('Blocked — sending is not allowed');
      } else if (key === 's') decide('review', selectedItem.id, 'skipped');
      else if (key === 'x') decide('review', selectedItem.id, 'rejected');
      else if (key === 'g') onRegen();
    },
  });

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-1 oe:grid-cols-[300px_340px_1fr]">
        <div className={`border-r border-border min-w-0 ${mobileDetail ? 'hidden' : 'flex'} oe:flex`}>
          <ReviewList items={reviewItems} selectedId={selectedId} onSelect={onSelect} loading={isLoadingLine} />
        </div>

        <div className={`min-h-0 overflow-y-auto border-r border-border ${mobileDetail ? 'block' : 'hidden'} oe:block`}>
          {mobileDetail && (
            <div className="p-3 pb-0 oe:hidden">
              <button onClick={() => setMobileDetail(false)} className="rounded-control border border-border3 bg-raised2 px-3 py-1.5 text-[12.5px] text-label">
                ← Back to queue
              </button>
            </div>
          )}
          {selectedItem && pending.length > 0 && <ReviewContextPane item={selectedItem} />}
        </div>

        <div className={`min-h-0 flex-col ${mobileDetail ? 'flex' : 'hidden'} oe:flex`}>
          {selectedItem && pending.length > 0 ? (
            <ReviewEditor
              item={selectedItem}
              draft={drafts[selectedItem.id]}
              decision={isDecided('review', selectedItem.id)}
              onSubjectChange={(v) => setDraft(selectedItem.id, { subject: v, body: drafts[selectedItem.id]?.body ?? selectedItem.body })}
              onBodyChange={(v) => setDraft(selectedItem.id, { subject: drafts[selectedItem.id]?.subject ?? selectedItem.subject, body: v })}
              onSend={() => decide('review', selectedItem.id, 'sent', 'webapp')}
              onSkip={() => decide('review', selectedItem.id, 'skipped')}
              onReject={() => decide('review', selectedItem.id, 'rejected')}
              onRegen={onRegen}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-text-muted">Nothing selected — the queue is clear.</div>
          )}
        </div>
      </div>
      <ShortcutBar queue="review" />
    </>
  );
}
