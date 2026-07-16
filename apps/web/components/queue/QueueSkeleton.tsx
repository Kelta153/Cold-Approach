export function QueueSkeleton() {
  return (
    <div className="p-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="oe-shimmer mb-1 rounded-md p-3" style={{ background: 'var(--oe-raised)' }}>
          <div className="mb-2 h-[11px] w-3/5 rounded-[3px]" style={{ background: 'var(--oe-border-2)' }} />
          <div className="h-[9px] w-4/5 rounded-[3px]" style={{ background: 'var(--oe-border)' }} />
        </div>
      ))}
    </div>
  );
}
