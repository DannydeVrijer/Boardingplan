import * as XLSX from 'xlsx';
import type { Partner, Preference } from './types';
import { uid } from './util';

/**
 * Leest partnerafspraken uit .xlsx/.xls/.csv. Eerste rij = kolomnamen.
 * Herkende kolommen (hoofdletters/spaties maken niet uit):
 *   Partner | Naam            (verplicht)
 *   Meters                    afgesproken meters
 *   Posities | Aantal         aantal posities (gaat voor op meters)
 *   Niveau | Tier             1, 2 of 3 (ook: hoofdsponsor / eventpartner / partner)
 *   Kleur                     #rrggbb
 *   Categorie | Branche       concurrenten niet naast elkaar
 *   Blok                      1 = losse borden, 2 = in paren, ...
 *   Voorkeur                  recht / bocht / finish
 *   Vast | Vaste posities     bijv. "33, 34, 76"
 */

export const TEMPLATE_CSV = [
  'Partner;Meters;Posities;Niveau;Kleur;Categorie;Blok;Voorkeur;Vast',
  'Essent;;4;2;#e5007d;energie;2;recht;',
  'Odido;40;;2;#1e1e1e;telecom;1;finish;',
  'Jumbo;;3;3;#ffd200;supermarkt;1;;',
  'Holland America Line;;4;2;#1d2d5c;reizen;2;recht;',
  'Stihl;;3;3;#f37a1f;;1;bocht;',
].join('\n');

type Row = Record<string, unknown>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES: Record<string, string[]> = {
  name: ['partner', 'naam', 'name', 'sponsor', 'bedrijf'],
  meters: ['meters', 'meter', 'm'],
  positions: ['posities', 'positie', 'aantal', 'aantalposities', 'borden', 'aantalborden', 'positions'],
  tier: ['niveau', 'tier', 'type', 'soort'],
  color: ['kleur', 'color', 'colour', 'hex'],
  category: ['categorie', 'branche', 'category', 'sector'],
  block: ['blok', 'block', 'blokgrootte', 'aaneengesloten'],
  preference: ['voorkeur', 'preference', 'plek'],
  fixed: ['vast', 'vasteposities', 'fixed', 'vasteplek', 'vasteplekken'],
};

const PALETTE = ['#e5007d', '#1d2d5c', '#ffd200', '#f37a1f', '#00a0e2', '#5bb031', '#7d3c98', '#c0392b', '#16a085', '#34495e', '#d35400', '#8e44ad'];

function pick(row: Row, key: keyof typeof ALIASES): string {
  for (const [k, v] of Object.entries(row)) {
    if (ALIASES[key].includes(norm(k)) && v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseTier(v: string): 1 | 2 | 3 {
  const s = v.toLowerCase();
  if (s.startsWith('1') || s.includes('hoofd') || s.includes('seizoen')) return 1;
  if (s.startsWith('3') || s.includes('lever') || s === 'partner') return 3;
  if (s.startsWith('2') || s.includes('event')) return 2;
  return 2;
}

function parsePreference(v: string): Preference {
  const s = v.toLowerCase();
  if (s.includes('finish')) return 'finish';
  if (s.includes('bocht')) return 'bocht';
  if (s.includes('recht')) return 'recht';
  return 'geen';
}

export function parseFixed(v: string): number[] {
  const out: number[] = [];
  for (const part of v.split(/[,;\s]+/)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      for (let i = Number(range[1]); i <= Number(range[2]); i++) out.push(i);
    } else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return [...new Set(out.filter((n) => n >= 1 && n <= 86))];
}

export function rowsToPartners(rows: Row[], metersPerPosition: number): { partners: Partner[]; warnings: string[] } {
  const partners: Partner[] = [];
  const warnings: string[] = [];
  rows.forEach((row, i) => {
    const name = pick(row, 'name');
    if (!name) return;
    const meters = Number(pick(row, 'meters').replace(',', '.')) || undefined;
    const posRaw = Number(pick(row, 'positions')) || 0;
    const fixed = parseFixed(pick(row, 'fixed'));
    let positions = posRaw || (meters ? Math.ceil(meters / metersPerPosition) : 0);
    if (!positions) positions = fixed.length;
    if (!positions) warnings.push(`Rij ${i + 2} (${name}): geen meters of posities, op 0 gezet.`);
    const color = pick(row, 'color');
    partners.push({
      id: uid(),
      name,
      meters,
      positions,
      tier: parseTier(pick(row, 'tier')),
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : PALETTE[partners.length % PALETTE.length],
      category: pick(row, 'category') || undefined,
      block: Math.max(1, Number(pick(row, 'block')) || 1),
      preference: parsePreference(pick(row, 'preference')),
      fixed,
    });
  });
  return { partners, warnings };
}

export async function readPartnerFile(file: File, metersPerPosition: number) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
  return rowsToPartners(rows, metersPerPosition);
}
