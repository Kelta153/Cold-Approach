'use client';

import { useAppState } from '../lib/state/app-state';

export function Toast() {
  const { toast } = useAppState();
  if (!toast) return null;

  return (
    <div
      className="oe-toast fixed bottom-[52px] left-1/2 z-[100] rounded-control border px-4 py-[9px] text-[12.5px]"
      style={{
        background: '#1b1e28',
        borderColor: '#2a2e3a',
        color: 'var(--oe-text)',
        boxShadow: '0 8px 24px rgba(0,0,0,.5)',
      }}
    >
      {toast}
    </div>
  );
}
