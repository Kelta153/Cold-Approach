'use client';

import { useEffect } from 'react';

interface UseQueueKeyboardOptions {
  pendingIds: string[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Extra single-key handlers beyond J/K/arrow navigation (Review-only: enter/s/x/g). */
  onKey?: (key: string) => void;
}

/** J/K or arrow keys navigate the pending list; suppressed while typing in an input/textarea,
 * exactly like the prototype's onKey handler. */
export function useQueueKeyboard({ pendingIds, selectedId, onSelect, onKey }: UseQueueKeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (pendingIds.length === 0) return;

      const idx = Math.max(0, pendingIds.findIndex((id) => id === selectedId));
      const key = e.key.toLowerCase();

      if (key === 'j' || key === 'arrowdown') {
        e.preventDefault();
        onSelect(pendingIds[Math.min(idx + 1, pendingIds.length - 1)]);
      } else if (key === 'k' || key === 'arrowup') {
        e.preventDefault();
        onSelect(pendingIds[Math.max(idx - 1, 0)]);
      } else {
        onKey?.(key);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pendingIds, selectedId, onSelect, onKey]);
}
