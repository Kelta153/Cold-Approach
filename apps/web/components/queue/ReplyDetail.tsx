'use client';

import { useState } from 'react';
import type { ReplyQueueItemDto } from '@outreach-engine/types';
import { classificationBadge } from '../../lib/badges';
import { parseOps } from '../../lib/parse-ops';
import { Badge } from '../Badge';

export function ReplyDetail({
  item,
  draftBody,
  onDraftChange,
  onSend,
  onSkip,
  onEscalate,
  onHandled,
}: {
  item: ReplyQueueItemDto;
  draftBody: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onSkip: () => void;
  onEscalate: () => void;
  onHandled: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const segments = parseOps(draftBody);
  const opsCount = segments.filter((s) => s.chip).length;
  const hasOps = opsCount > 0;

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-3.5 px-6 py-[18px]">
      <div className="flex items-center gap-2.5">
        <div className="text-[16px] font-semibold">{item.contact}</div>
        <span className="font-mono text-[11px] text-text-muted">{item.company}</span>
        <Badge spec={classificationBadge(item.classification)} />
      </div>

      <div className="rounded-md border border-border2 p-[13px_16px]" style={{ background: 'var(--oe-surface2)' }}>
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-xs font-semibold text-text-secondary">You</span>
          <span className="font-mono text-[10px] text-text-muted">
            {item.sentAt} · via {item.inbox}
          </span>
        </div>
        <div className="whitespace-pre-wrap text-[12.5px] leading-[1.6] text-text-secondary">{item.original}</div>
      </div>

      <div className="rounded-md border p-[13px_16px]" style={{ borderColor: 'var(--oe-reply-inbound-border)', background: 'var(--oe-reply-inbound-bg)' }}>
        <div className="mb-1.5 flex items-baseline gap-2">
          <span className="text-xs font-semibold text-link2">{item.contact}</span>
          <span className="font-mono text-[10px] text-text-muted">{item.receivedAt}</span>
        </div>
        <div className="whitespace-pre-wrap text-[13.5px] leading-[1.6] text-text">{item.reply}</div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Drafted reply</div>
        <div className="flex-1" />
        {hasOps && (
          <span className="text-[11.5px] text-amber">
            {opsCount} operator placeholder{opsCount === 1 ? '' : 's'} to resolve
          </span>
        )}
        <button onClick={() => setEditing((v) => !v)} className="rounded-control border border-border3 px-2.5 py-1 text-[11.5px] text-label hover:text-text">
          {editing ? 'Preview' : 'Edit draft'}
        </button>
      </div>

      {editing ? (
        <textarea
          value={draftBody}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck={false}
          className="min-h-[180px] resize-y rounded-md border border-border2 bg-surface p-3.5 text-[13.5px] leading-[1.65] text-body"
        />
      ) : (
        <div className="whitespace-pre-wrap rounded-md border border-border2 bg-surface p-[14px_16px] text-[13.5px] leading-[1.8]">
          {segments.map((seg, i) =>
            seg.chip ? (
              <span
                key={i}
                className="whitespace-normal rounded-[4px] px-1.5 py-px font-mono text-[11.5px] font-medium text-amber"
                style={{ background: 'rgba(232,163,61,.14)', border: '1px solid rgba(232,163,61,.4)' }}
              >
                {seg.text}
              </span>
            ) : (
              <span key={i} className="text-body">
                {seg.text}
              </span>
            ),
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pb-5">
        <button
          onClick={onSend}
          disabled={hasOps}
          className="inline-flex items-center gap-1.5 rounded-control border border-action bg-action px-[18px] py-2 text-[13px] font-semibold text-white hover:bg-action-hover"
          style={hasOps ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          {hasOps ? 'Send (blocked)' : 'Send reply'}
        </button>
        <button onClick={onSkip} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-text hover:border-border-hover">
          Skip
        </button>
        <button onClick={onEscalate} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-amber hover:border-amber/40">
          Escalate
        </button>
        <button onClick={onHandled} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-label hover:text-text">
          Mark handled
        </button>
        <div className="flex-1" />
        {hasOps && <span className="text-[11.5px] text-text-muted">resolve operator placeholders before sending</span>}
      </div>
    </div>
  );
}
