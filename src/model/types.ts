export type Preference = 'geen' | 'recht' | 'bocht' | 'finish';

export interface Partner {
  id: string;
  name: string;
  color: string;
  /** Logo als data-URL (verkleind), optioneel. */
  logo?: string;
  /** Afgesproken meters boarding (informatief; bepaalt het aantal posities als `positions` leeg is). */
  meters?: number;
  /** Aantal posities dat deze partner moet krijgen. */
  positions: number;
  /** 1 = hoofdsponsor/seizoenspartner, 2 = eventpartner, 3 = partner/leverancier. Bepaalt de kiesvolgorde. */
  tier: 1 | 2 | 3;
  /** Branche; partners met dezelfde categorie komen niet naast elkaar (concurrentie). */
  category?: string;
  /** Aantal borden dat steeds aaneengesloten geplaatst wordt (1 = los, 2 = in paren). */
  block: number;
  preference: Preference;
  /** Contractueel vaste posities. Deze worden nooit door het voorstel verplaatst. */
  fixed: number[];
}

export interface Project {
  id: string;
  name: string;
  metersPerPosition: number;
  partners: Partner[];
  /** positie (1-86) -> partner-id */
  assignment: Record<number, string>;
  /** Handmatig vastgezette posities (blijven staan bij een nieuw voorstel). */
  locked: number[];
  /** Handmatig aangepaste mediawaarde per positie (1-10). */
  valueOverrides: Record<number, number>;
  /** KNSB-boardingplanposities als premium meewegen. */
  knsbPremium: boolean;
  updatedAt: number;
}
