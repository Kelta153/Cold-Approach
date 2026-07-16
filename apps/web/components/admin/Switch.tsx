export function Switch({ on, color, onToggle }: { on: boolean; color: string; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="inline-block cursor-pointer border-none bg-transparent p-0">
      <span
        className="relative inline-block h-[19px] w-[34px] rounded-full transition-colors"
        style={{ background: on ? color : 'var(--oe-border-3)' }}
      >
        <span
          className="absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-[left]"
          style={{ left: on ? 17 : 2 }}
        />
      </span>
    </button>
  );
}
