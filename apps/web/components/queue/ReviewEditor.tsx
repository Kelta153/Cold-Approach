'use client';

import type { ReviewQueueItemDto } from '@outreach-engine/types';
import { complianceBadge, doneBadge, type DoneStatus } from '../../lib/badges';
import type { Decision, DraftEdit } from '../../lib/state/app-state';
import { Badge } from '../Badge';

const keyChip = 'font-mono text-[10px] rounded-[3px] border border-border3 bg-bg px-1.5 py-0 text-text-secondary';

export function ReviewEditor({
  item,
  draft,
  decision,
  onSubjectChange,
  onBodyChange,
  onSend,
  onSkip,
  onReject,
  onRegen,
}: {
  item: ReviewQueueItemDto;
  draft: DraftEdit | undefined;
  decision: Decision | undefined;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSend: () => void;
  onSkip: () => void;
  onReject: () => void;
  onRegen: () => void;
}) {
  const blocked = item.blockedReasons.length > 0;
  const subject = draft?.subject ?? item.subject;
  const body = draft?.body ?? item.body;
  const edited = !!draft;
  const badgeSpec = decision ? doneBadge(decision.status as DoneStatus, decision.approvedVia, decision.simulated) : complianceBadge(item.blockedReasons);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-3.5">
        <span className="font-mono text-[11px] text-text-muted">{item.id}</span>
        <Badge spec={badgeSpec} />
        <div className="flex-1" />
        <span className="text-[11.5px] text-text-muted">{edited ? 'edited — will send your version' : 'autosaves as you type'}</span>
      </div>

      {blocked && (
        <div
          className="mx-5 mt-3 flex items-start gap-2.5 rounded-md p-[11px_14px]"
          style={{ background: 'rgba(232,163,61,.08)', border: '1px solid rgba(232,163,61,.35)' }}
        >
          <span className="text-[13px] leading-[1.4] text-amber">◆</span>
          <div className="text-[12.5px] text-amber-soft">
            <b className="font-semibold text-amber">Blocked — sending is not allowed.</b>
            <ul className="mt-1 list-disc pl-4">
              {item.blockedReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
            <div className="mt-1">This is expected: sending is gated until every compliance check passes. You can still edit, skip or reject.</div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col px-5 pt-3.5">
        <div className="flex items-center gap-2.5 rounded-t-md border border-border2 bg-surface px-3.5 py-[9px]">
          <span className="w-[52px] text-[11.5px] font-medium text-text-muted">To</span>
          <span className="text-[13px] text-body">{item.email}</span>
        </div>
        <div className="flex items-center gap-2.5 border border-t-0 border-border2 bg-surface px-3.5 py-1.5">
          <span className="w-[52px] text-[11.5px] font-medium text-text-muted">Subject</span>
          <input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-[13.5px] font-semibold text-text"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          spellCheck={false}
          className="min-h-[240px] flex-1 resize-none rounded-b-md border border-border2 bg-surface p-3.5 text-[13.5px] leading-[1.65] text-body oe:min-h-0"
        />
      </div>

      <div className="flex items-center gap-2 px-5 py-4">
        <button
          onClick={onSend}
          disabled={blocked}
          className="inline-flex items-center gap-1.5 rounded-control border border-action bg-action px-[18px] py-2 text-[13px] font-semibold text-white hover:bg-action-hover"
          style={blocked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          Send<span className="rounded-[3px] bg-white/15 px-1.5 font-mono text-[10px]">⏎</span>
        </button>
        <button onClick={onSkip} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-text hover:border-border-hover">
          Skip<span className={keyChip}>S</span>
        </button>
        <button onClick={onReject} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-red hover:border-red/40">
          Reject · suppress<span className={keyChip}>X</span>
        </button>
        <div className="flex-1" />
        <button onClick={onRegen} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-transparent px-3.5 py-2 text-[13px] text-label hover:border-border-hover hover:text-text">
          Regenerate<span className={keyChip}>G</span>
        </button>
      </div>
    </div>
  );
}
