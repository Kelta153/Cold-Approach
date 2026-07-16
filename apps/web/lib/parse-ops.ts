export interface OpsSegment {
  text: string;
  chip: boolean;
}

const OPERATOR_PLACEHOLDER_RE = /\[OPERATOR:[^\]]*\]/g;

/** Splits a drafted reply body into plain-text/chip segments on `[OPERATOR: ...]`
 * placeholders, so they can be rendered as amber chips the operator must resolve. */
export function parseOps(text: string): OpsSegment[] {
  const parts: OpsSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  OPERATOR_PLACEHOLDER_RE.lastIndex = 0;
  while ((match = OPERATOR_PLACEHOLDER_RE.exec(text))) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), chip: false });
    parts.push({ text: match[0], chip: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), chip: false });

  return parts;
}
