import { rowsToPartners } from './importer';
import { KNSB_PARTNERS } from './knsb';
import { propose } from './proposal';
import { newProject } from './storage';
import type { Project } from './types';
import { uid } from './util';

/** Voorbeeld-event dat bij het eerste gebruik wordt geopend, zodat meteen zichtbaar is wat de app doet. */
export function demoProject(): Project {
  const p = newProject('Voorbeeld-event (fictieve afspraken)');
  const knsb = KNSB_PARTNERS.map((k) => ({ ...k, id: uid() }));
  const { partners } = rowsToPartners(
    [
      { Partner: 'Essent', Posities: 6, Niveau: 2, Kleur: '#e5007d', Categorie: 'energie', Blok: 2, Voorkeur: 'recht' },
      { Partner: 'Odido', Meters: 24, Niveau: 2, Kleur: '#1e1e1e', Categorie: 'telecom', Voorkeur: 'finish' },
      { Partner: 'Holland America Line', Posities: 6, Niveau: 2, Kleur: '#1d2d5c', Categorie: 'reizen', Blok: 2, Voorkeur: 'recht' },
      { Partner: 'Jumbo', Posities: 4, Niveau: 3, Kleur: '#ffd200', Categorie: 'supermarkt' },
      { Partner: 'Gamma', Posities: 5, Niveau: 3, Kleur: '#003c7d', Categorie: 'bouwmarkt' },
      { Partner: 'Stihl', Posities: 4, Niveau: 3, Kleur: '#f37a1f', Voorkeur: 'bocht' },
      { Partner: 'EuroParcs', Posities: 4, Niveau: 3, Kleur: '#f39200', Categorie: 'reizen', Blok: 2 },
      { Partner: 'Chocomel', Posities: 5, Niveau: 3, Kleur: '#f9b000' },
    ],
    p.metersPerPosition,
  );
  p.partners = [...knsb, ...partners];
  for (const k of knsb) for (const pos of k.fixed) p.locked.push(pos);
  p.assignment = propose(p).assignment;
  return p;
}
