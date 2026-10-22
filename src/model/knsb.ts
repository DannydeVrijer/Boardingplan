import type { Partner } from './types';

/**
 * Boardingplan KNSB 2026-2027 (seizoensposities). Overgenomen uit de plattegrond
 * "BOARDINGPLAN KNSB 2026-2027". Deze posities zijn contractueel vast en gelden
 * daarom ook als de best renderende posities van de baan.
 */
export const KNSB_SEASON = '2026-2027';

export const KNSB_PARTNERS: Array<Omit<Partner, 'id'>> = [
  {
    name: 'HSNL',
    color: '#6f6f71',
    positions: 6,
    tier: 1,
    block: 1,
    preference: 'geen',
    fixed: [33, 34, 35, 76, 77, 78],
  },
  {
    name: 'Staatsloterij',
    color: '#e8641b',
    positions: 8,
    tier: 1,
    block: 1,
    preference: 'geen',
    fixed: [5, 6, 24, 31, 49, 50, 68, 73],
  },
  {
    name: 'Daikin',
    color: '#3a55a4',
    positions: 5,
    tier: 1,
    block: 1,
    preference: 'geen',
    fixed: [36, 58, 59, 67, 79],
  },
  {
    name: 'OK',
    color: '#178c3a',
    positions: 7,
    tier: 1,
    block: 1,
    preference: 'geen',
    fixed: [7, 23, 32, 47, 48, 74, 75],
  },
  {
    name: "De'Longhi",
    color: '#9a4794',
    positions: 5,
    tier: 1,
    block: 1,
    preference: 'geen',
    fixed: [4, 15, 16, 22, 62],
  },
];

export const KNSB_POSITIONS: Set<number> = new Set(KNSB_PARTNERS.flatMap((p) => p.fixed));
