import type { CSSProperties } from 'react';

export interface RowStyleOptions {
  selected: boolean;
  done: boolean;
  /** Accent color for the selected-row left inset stripe and border. Review/Replies use the
   * action blue; the Instagram DM queue swaps in the magenta accent so email vs IG states are
   * never confused. */
  accent?: string;
  selectedBg?: string;
}

export function listRowStyle({ selected, done, accent = '#3b6fe0', selectedBg = 'var(--oe-selected-bg)' }: RowStyleOptions): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    padding: '11px 12px',
    marginBottom: 3,
    borderRadius: 6,
    border: `1px solid ${selected ? 'var(--oe-border-selected)' : 'transparent'}`,
    background: selected ? selectedBg : 'transparent',
    cursor: 'pointer',
    color: 'var(--oe-text)',
    fontFamily: 'inherit',
    textAlign: 'left',
    opacity: done ? 0.45 : 1,
    boxShadow: selected ? `inset 2px 0 0 ${accent}` : undefined,
  };
}
