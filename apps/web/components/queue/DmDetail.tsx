'use client';

import type { DmQueueItemDto } from '@outreach-engine/types';
import { useAppState } from '../../lib/state/app-state';

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function DmDetail({
  item,
  onSent,
  onSkip,
  onReject,
}: {
  item: DmQueueItemDto;
  onSent: () => void;
  onSkip: () => void;
  onReject: () => void;
}) {
  const { showToast } = useAppState();

  const onOpen = () => showToast(`Would deep-link to instagram.com/${item.handle.slice(1)}`);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.draft);
    } catch {
      // clipboard access can fail (permissions, insecure context) — the toast still fires
    }
    showToast('Message copied');
  };

  return (
    <div className="max-w-[680px] p-[22px_26px]">
      <div className="mb-[18px] flex items-center gap-3.5">
        <div
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[16px] font-semibold text-ig2"
          style={{ background: 'var(--oe-dm-avatar-bg)', border: '1px solid rgba(229,122,184,.35)' }}
        >
          {initials(item.name)}
        </div>
        <div className="flex-1">
          <div className="text-[16px] font-semibold text-ig2">{item.handle}</div>
          <div className="text-[12.5px] text-text-secondary">
            {item.name} · <span className="font-mono">{item.followers} followers</span> · {item.posts} posts
          </div>
        </div>
      </div>

      <div className="mb-[18px] rounded-md border border-border2 bg-surface p-3.5">
        <div className="mb-[5px] text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">Bio</div>
        <div className="text-[13px] leading-[1.55] text-body">{item.bio}</div>
      </div>

      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Draft DM</div>
      <div
        className="max-w-[480px] whitespace-pre-wrap rounded-[12px_12px_12px_3px] p-[14px_16px] text-[13.5px] leading-[1.65] text-body"
        style={{ background: 'var(--oe-dm-bubble-bg)', border: '1px solid var(--oe-dm-bubble-border)' }}
      >
        {item.draft}
      </div>
      <div className="mt-2 font-mono text-[10.5px] text-text-muted">{item.draft.length} chars · paste into Instagram</div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-control border border-ig bg-ig px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#d15f9e]">
          Open in Instagram ↗
        </button>
        <button onClick={onCopy} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-text hover:border-border-hover">
          Copy message
        </button>
        <button onClick={onSent} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-green hover:border-green/40">
          Mark as sent
        </button>
        <button onClick={onSkip} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-label hover:text-text">
          Skip
        </button>
        <button onClick={onReject} className="inline-flex items-center gap-1.5 rounded-control border border-border3 bg-raised2 px-3.5 py-2 text-[13px] text-red hover:border-red/40">
          Reject
        </button>
      </div>
    </div>
  );
}
