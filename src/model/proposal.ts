import { LINES, valueMap } from './value';
import { POSITIONS, isStraight, neighbours, next, ringDistance, sideOf, type Side } from './track';
import type { Partner, Project } from './types';

export interface ProposalResult {
  assignment: Record<number, string>;
  /** Partners die niet alle posities kregen (te weinig vrije posities). */
  shortfall: Array<{ partner: string; missing: number }>;
  /** Vaste posities die door twee partners werden geclaimd. */
  conflicts: Array<{ pos: number; kept: string; skipped: string }>;
}

const FINISH = LINES[0];

/**
 * Maakt een voorstel:
 * 1. Handmatig vastgezette posities en contractuele vaste posities blijven staan.
 * 2. De overige posities worden in rondes verdeeld. Per ronde kiest elke partner één
 *    bord (of blok borden); niveau 1 kiest eerst, daarna niveau 2 en 3. Binnen een niveau
 *    kiest de partner die relatief het minst heeft eerst.
 * 3. Een keuze weegt mediawaarde, voorkeur (recht/bocht/finish), spreiding over de baan,
 *    en houdt concurrenten (zelfde categorie) uit elkaar.
 */
export function propose(project: Project): ProposalResult {
  const values = valueMap(project);
  const assignment: Record<number, string> = {};
  const conflicts: ProposalResult['conflicts'] = [];
  const byId = new Map(project.partners.map((p) => [p.id, p]));

  for (const pos of project.locked) {
    const pid = project.assignment[pos];
    if (pid && byId.has(pid)) assignment[pos] = pid;
  }
  for (const p of project.partners) {
    for (const pos of p.fixed) {
      if (pos < 1 || pos > 86) continue;
      const current = assignment[pos];
      if (current && current !== p.id) {
        conflicts.push({ pos, kept: byId.get(current)?.name ?? '?', skipped: p.name });
        continue;
      }
      assignment[pos] = p.id;
    }
  }

  const count = new Map<string, number>();
  for (const pid of Object.values(assignment)) count.set(pid, (count.get(pid) ?? 0) + 1);
  const need = new Map<string, number>();
  for (const p of project.partners) need.set(p.id, Math.max(0, p.positions - (count.get(p.id) ?? 0)));

  const isFree = (pos: number) => assignment[pos] === undefined;

  const scoreSet = (partner: Partner, set: number[]): number => {
    const inSet = new Set(set);
    let s = 0;
    const own = POSITIONS.filter((q) => assignment[q] === partner.id);
    const sideCount = new Map<Side, number>();
    for (const q of own) sideCount.set(sideOf(q), (sideCount.get(sideOf(q)) ?? 0) + 1);

    for (const pos of set) {
      s += values[pos];
      if (partner.preference === 'recht' && isStraight(pos)) s += 2;
      if (partner.preference === 'bocht' && !isStraight(pos)) s += 2;
      if (partner.preference === 'finish') {
        const d = Math.min(ringDistance(pos, FINISH.a), ringDistance(pos, FINISH.b));
        if (d <= 4) s += 3;
      }
      for (const n of neighbours(pos)) {
        if (inSet.has(n)) continue;
        const other = assignment[n];
        if (!other) continue;
        if (other === partner.id) s -= 4; // geen onbedoelde clusters
        const op = byId.get(other);
        if (op && op.id !== partner.id && partner.category && op.category &&
            op.category.toLowerCase() === partner.category.toLowerCase()) s -= 8; // concurrent ernaast
      }
      // spreiding: niet te dicht bij eigen borden en verdelen over de vier zijden
      const nearest = own.reduce((m, q) => Math.min(m, ringDistance(pos, q)), 99);
      if (nearest < 4) s -= 4 - nearest;
      s -= 1.5 * (sideCount.get(sideOf(pos)) ?? 0);
    }
    return s;
  };

  const candidates = (size: number): number[][] => {
    const out: number[][] = [];
    for (const start of POSITIONS) {
      const set = [start];
      let ok = isFree(start);
      let cur = start;
      for (let i = 1; ok && i < size; i++) {
        cur = next(cur);
        if (!isFree(cur) || sideOf(cur) !== sideOf(start)) ok = false;
        set.push(cur);
      }
      if (ok) out.push(set);
    }
    return out;
  };

  const tierOrder = (a: Partner, b: Partner) =>
    a.tier - b.tier ||
    (count.get(a.id) ?? 0) / Math.max(1, a.positions) - (count.get(b.id) ?? 0) / Math.max(1, b.positions) ||
    a.name.localeCompare(b.name);

  let guard = 0;
  while (guard++ < 1000) {
    const waiting = project.partners.filter((p) => (need.get(p.id) ?? 0) > 0).sort(tierOrder);
    if (waiting.length === 0) break;
    let placedThisRound = false;
    for (const partner of waiting) {
      const remaining = need.get(partner.id) ?? 0;
      if (remaining <= 0) continue;
      let size = Math.max(1, Math.min(partner.block || 1, remaining));
      let options = candidates(size);
      if (options.length === 0 && size > 1) {
        size = 1;
        options = candidates(1);
      }
      if (options.length === 0) continue;
      let best = options[0];
      let bestScore = -Infinity;
      for (const set of options) {
        const sc = scoreSet(partner, set);
        if (sc > bestScore) {
          bestScore = sc;
          best = set;
        }
      }
      for (const pos of best) assignment[pos] = partner.id;
      need.set(partner.id, remaining - best.length);
      count.set(partner.id, (count.get(partner.id) ?? 0) + best.length);
      placedThisRound = true;
    }
    if (!placedThisRound) break;
  }

  const shortfall = project.partners
    .filter((p) => (need.get(p.id) ?? 0) > 0)
    .map((p) => ({ partner: p.name, missing: need.get(p.id)! }));

  return { assignment, shortfall, conflicts };
}
