const HINTS_BY_QUEUE: Record<string, { key: string; label: string }[]> = {
  review: [
    { key: 'J / K', label: 'navigate' },
    { key: '⏎', label: 'send' },
    { key: 'S', label: 'skip' },
    { key: 'X', label: 'reject' },
    { key: 'G', label: 'regenerate' },
  ],
  reply: [{ key: 'J / K', label: 'navigate' }],
  dm: [{ key: 'J / K', label: 'navigate' }],
};

export function ShortcutBar({ queue }: { queue: 'review' | 'reply' | 'dm' }) {
  const hints = HINTS_BY_QUEUE[queue];
  if (!hints) return null;

  return (
    <div className="hidden h-[34px] flex-none items-center gap-[18px] border-t border-border bg-surface2 px-[18px] text-[11px] text-text-muted oe:flex">
      {hints.map((h) => (
        <span key={h.key} className="inline-flex items-center gap-1.5">
          <span className="rounded-[3px] border border-border3 bg-raised2 px-1.5 py-px font-mono text-[10px] text-label">{h.key}</span>
          {h.label}
        </span>
      ))}
    </div>
  );
}
