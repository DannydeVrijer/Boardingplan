import { describe, expect, it } from 'vitest';
import { KNSB_PARTNERS } from './knsb';
import { propose } from './proposal';
import { newProject } from './storage';
import { neighbours, shapeOf } from './track';
import { defaultValue } from './value';
import type { Partner } from './types';

const mk = (name: string, positions: number, extra: Partial<Partner> = {}): Partner => ({
  id: name,
  name,
  color: '#123456',
  positions,
  tier: 2,
  block: 1,
  preference: 'geen',
  fixed: [],
  ...extra,
});

function project(partners: Partner[]) {
  const p = newProject('test');
  p.partners = partners;
  return p;
}

describe('track', () => {
  it('heeft 86 unieke posities met geometrie', () => {
    for (let i = 1; i <= 86; i++) expect(shapeOf(i).boardPath.length).toBeGreaterThan(10);
  });
  it('waardeert de finish hoger dan een bocht', () => {
    expect(defaultValue(67, false)).toBeGreaterThan(defaultValue(12, false));
  });
});

describe('propose', () => {
  it('houdt KNSB-posities vast en vult de rest', () => {
    const knsb = KNSB_PARTNERS.map((p) => ({ ...p, id: p.name }));
    const extra = [mk('Essent', 4, { category: 'energie', block: 2 }), mk('Vattenfall', 4, { category: 'energie' }), mk('Jumbo', 6, { tier: 3 })];
    const res = propose(project([...knsb, ...extra]));
    for (const p of knsb) for (const pos of p.fixed) expect(res.assignment[pos]).toBe(p.id);
    for (const p of extra) {
      expect(Object.values(res.assignment).filter((x) => x === p.id).length).toBe(p.positions);
    }
    // concurrenten nooit naast elkaar
    for (const [pos, pid] of Object.entries(res.assignment)) {
      if (pid !== 'Essent') continue;
      for (const n of neighbours(Number(pos))) expect(res.assignment[n]).not.toBe('Vattenfall');
    }
    expect(res.shortfall).toEqual([]);
  });

  it('meldt tekort als er te weinig plek is', () => {
    const res = propose(project([mk('A', 60), mk('B', 40)]));
    const missing = res.shortfall.reduce((s, x) => s + x.missing, 0);
    expect(missing).toBe(14);
  });

  it('meldt conflicterende vaste posities', () => {
    const res = propose(project([mk('A', 1, { fixed: [10] }), mk('B', 1, { fixed: [10] })]));
    expect(res.conflicts.length).toBe(1);
  });
});
