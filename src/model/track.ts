/**
 * Thialf-boarding: 86 posities in één doorlopende ring.
 *  1–23  bocht links   (onder → boven)
 * 24–43  recht boven   (links → rechts)
 * 44–66  bocht rechts  (boven → onder)
 * 67–86  recht onder   (rechts → links)
 * Positie 86 grenst weer aan 1. Buren in de ring zijn dus altijd ±1 (mod 86).
 */
export const POSITION_COUNT = 86;
export const POSITIONS = Array.from({ length: POSITION_COUNT }, (_, i) => i + 1);

export type Side = 'bocht-links' | 'recht-boven' | 'bocht-rechts' | 'recht-onder';

export function sideOf(pos: number): Side {
  if (pos <= 23) return 'bocht-links';
  if (pos <= 43) return 'recht-boven';
  if (pos <= 66) return 'bocht-rechts';
  return 'recht-onder';
}

export function isStraight(pos: number): boolean {
  const s = sideOf(pos);
  return s === 'recht-boven' || s === 'recht-onder';
}

export function next(pos: number): number {
  return pos === POSITION_COUNT ? 1 : pos + 1;
}
export function prev(pos: number): number {
  return pos === 1 ? POSITION_COUNT : pos - 1;
}
export function neighbours(pos: number): number[] {
  return [prev(pos), next(pos)];
}

/** Afstand in posities langs de ring. */
export function ringDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, POSITION_COUNT - d);
}

/* ---------- Geometrie voor de tekening (SVG-coördinaten) ---------- */

export const GEO = {
  width: 1600,
  cy: 470,
  xLeft: 400, // middelpunt bocht links / begin rechte stuk
  xRight: 1200, // middelpunt bocht rechts / eind rechte stuk
  segment: 40, // breedte van één positie op het rechte stuk
  numInner: 232,
  numOuter: 268,
  boardInner: 274,
  boardOuter: 352,
};

const CURVE_SEGMENTS = 23;
const DEG = Math.PI / 180;

export interface PositionShape {
  pos: number;
  /** Pad voor het bord (buitenring). */
  boardPath: string;
  /** Pad voor het nummervak (binnenring). */
  numberPath: string;
  /** Midden van het bord en draaiing van tekst op het bord. */
  boardCenter: { x: number; y: number; rotate: number };
  numberCenter: { x: number; y: number; rotate: number };
  /** Breedte en hoogte van het bord (voor logo's), in lokale tekstrichting. */
  boardLength: number; // radiale lengte (in leesrichting)
  boardThickness: number; // breedte langs de baan
}

function annularSector(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number): string {
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return [
    `M ${p(r1, a1)}`,
    `L ${p(r2, a1)}`,
    `A ${r2} ${r2} 0 0 1 ${p(r2, a2)}`,
    `L ${p(r1, a2)}`,
    `A ${r1} ${r1} 0 0 0 ${p(r1, a1)}`,
    'Z',
  ].join(' ');
}

function curveShape(pos: number, cx: number, startDeg: number, k: number): PositionShape {
  const { cy, numInner, numOuter, boardInner, boardOuter } = GEO;
  const step = 180 / CURVE_SEGMENTS;
  const a1 = (startDeg + (k - 1) * step) * DEG;
  const a2 = (startDeg + k * step) * DEG;
  const mid = (a1 + a2) / 2;
  const rb = (boardInner + boardOuter) / 2;
  const rn = (numInner + numOuter) / 2;
  // Tekst radiaal; aan de linkerkant 180° gedraaid zodat het niet op z'n kop staat.
  let rot = (mid / DEG) % 360;
  if (rot < 0) rot += 360;
  const radialRot = rot > 90 && rot < 270 ? rot - 180 : rot;
  return {
    pos,
    boardPath: annularSector(cx, cy, boardInner, boardOuter, a1, a2),
    numberPath: annularSector(cx, cy, numInner, numOuter, a1, a2),
    boardCenter: { x: cx + rb * Math.cos(mid), y: cy + rb * Math.sin(mid), rotate: radialRot },
    numberCenter: { x: cx + rn * Math.cos(mid), y: cy + rn * Math.sin(mid), rotate: radialRot },
    boardLength: boardOuter - boardInner,
    boardThickness: rb * (step * DEG),
  };
}

function straightShape(pos: number, x: number, top: boolean): PositionShape {
  const { cy, segment, numInner, numOuter, boardInner, boardOuter } = GEO;
  const yb1 = top ? cy - boardOuter : cy + boardInner;
  const yn1 = top ? cy - numOuter : cy + numInner;
  const bh = boardOuter - boardInner;
  const nh = numOuter - numInner;
  const rect = (x0: number, y0: number, w: number, h: number) => `M ${x0} ${y0} h ${w} v ${h} h ${-w} Z`;
  return {
    pos,
    boardPath: rect(x, yb1, segment, bh),
    numberPath: rect(x, yn1, segment, nh),
    boardCenter: { x: x + segment / 2, y: yb1 + bh / 2, rotate: -90 },
    numberCenter: { x: x + segment / 2, y: yn1 + nh / 2, rotate: top ? -90 : 90 },
    boardLength: bh,
    boardThickness: segment,
  };
}

export function shapeOf(pos: number): PositionShape {
  const { xLeft, xRight, segment } = GEO;
  if (pos <= 23) return curveShape(pos, xLeft, 90, pos); // onder (90°) → links → boven (270°)
  if (pos <= 43) return straightShape(pos, xLeft + (pos - 24) * segment, true);
  if (pos <= 66) return curveShape(pos, xRight, -90, pos - 43); // boven (-90°) → rechts → onder (90°)
  return straightShape(pos, xLeft + (86 - pos) * segment, false);
}

export const SHAPES: PositionShape[] = POSITIONS.map(shapeOf);
