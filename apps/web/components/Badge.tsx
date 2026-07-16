import type { BadgeSpec } from '../lib/badges';

export function Badge({ spec }: { spec: BadgeSpec }) {
  return <span style={spec.style}>{spec.label}</span>;
}
