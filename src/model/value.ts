import { KNSB_POSITIONS } from './knsb';
import { POSITIONS, isStraight } from './track';
import type { Project } from './types';

/**
 * Standaard mediawaarde per positie (1–10). Dit is een vuistregel, geen meting:
 * - rechte stukken renderen beter dan bochten;
 * - posities rond de finish en de startlijnen komen het vaakst in beeld;
 * - KNSB-boardingplanposities krijgen een premium (optioneel).
 * Per positie is de waarde in de app te overschrijven zodra er echte data is.
 */

/** Een lijn ligt tussen twee posities; `a` en `b` zijn de posities direct ernaast. */
interface Line {
  label: string;
  a: number;
  b: number;
  bonus: number[]; // bonus op afstand 0, 1, 2, ... van de lijn
}

export const LINES: Line[] = [
  { label: 'Finish (+ start 10.000 m)', a: 67, b: 66, bonus: [4, 3, 2, 1] },
  { label: 'Finish 1000 m', a: 77, b: 76, bonus: [3, 2, 1] },
  { label: 'Start 1000 m', a: 34, b: 33, bonus: [2, 1] },
  { label: 'Start 500 m', a: 86, b: 1, bonus: [2, 1] },
  { label: 'Start 1500 m', a: 43, b: 44, bonus: [2, 1] },
  { label: 'Start 5000 m', a: 24, b: 23, bonus: [2, 1] },
];

function distanceToLine(pos: number, line: Line): number {
  const ring = (x: number, y: number) => {
    const d = Math.abs(x - y);
    return Math.min(d, 86 - d);
  };
  return Math.min(ring(pos, line.a), ring(pos, line.b));
}

export function defaultValue(pos: number, knsbPremium: boolean): number {
  let v = isStraight(pos) ? 6 : 3;
  let best = 0;
  for (const line of LINES) {
    const d = distanceToLine(pos, line);
    const bonus = line.bonus[d] ?? 0;
    if (bonus > best) best = bonus;
  }
  v += best;
  if (knsbPremium && KNSB_POSITIONS.has(pos)) v += 2;
  return Math.max(1, Math.min(10, v));
}

export function valueOf(pos: number, project: Pick<Project, 'valueOverrides' | 'knsbPremium'>): number {
  return project.valueOverrides[pos] ?? defaultValue(pos, project.knsbPremium);
}

export function valueMap(project: Pick<Project, 'valueOverrides' | 'knsbPremium'>): Record<number, number> {
  const m: Record<number, number> = {};
  for (const p of POSITIONS) m[p] = valueOf(p, project);
  return m;
}
