import { lines } from '../mock-data';
import type { LineFixture } from '../mock-data';

export type { LineFixture };

export async function getLines(): Promise<LineFixture[]> {
  return lines;
}

export async function getLine(lineId: string): Promise<LineFixture | undefined> {
  return lines.find((l) => l.id === lineId);
}
