import { useState } from 'react';
import { parseFixed } from '../model/importer';
import type { Partner, Preference } from '../model/types';
import { readLogo } from '../model/util';

interface Props {
  partner: Partner;
  assigned: number;
  value: number;
  metersPerPosition: number;
  onChange: (patch: Partial<Partner>) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onHighlight: (on: boolean) => void;
}

export function PartnerRow({ partner, assigned, value, metersPerPosition, onChange, onDelete, onDragStart, onHighlight }: Props) {
  const [open, setOpen] = useState(false);
  const [fixedText, setFixedText] = useState(partner.fixed.join(', '));
  const status = assigned === partner.positions ? 'ok' : assigned > partner.positions ? 'over' : 'under';

  return (
    <div className={`partner ${open ? 'open' : ''}`} onMouseEnter={() => onHighlight(true)} onMouseLeave={() => onHighlight(false)}>
      <div className="partner-head">
        <button className="chip" style={{ background: partner.color }} onPointerDown={onDragStart} title="Sleep naar een positie op de baan">
          ⠿
        </button>
        <button className="partner-name" onClick={() => setOpen(!open)}>
          <span>{partner.name}</span>
          <small>
            niveau {partner.tier}
            {partner.category ? ` · ${partner.category}` : ''} · Ø {assigned ? (value / assigned).toFixed(1) : '–'}
          </small>
        </button>
        <span className={`count ${status}`} title="Geplaatst / afgesproken">
          {assigned}/{partner.positions}
        </span>
      </div>
      {open && (
        <div className="partner-edit">
          <label>
            Naam
            <input value={partner.name} onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <div className="grid2">
            <label>
              Meters
              <input
                type="number"
                min={0}
                value={partner.meters ?? ''}
                onChange={(e) => {
                  const meters = e.target.value === '' ? undefined : Number(e.target.value);
                  onChange({ meters, positions: meters ? Math.ceil(meters / metersPerPosition) : partner.positions });
                }}
              />
            </label>
            <label>
              Posities
              <input type="number" min={0} max={86} value={partner.positions} onChange={(e) => onChange({ positions: Number(e.target.value) })} />
            </label>
            <label>
              Niveau
              <select value={partner.tier} onChange={(e) => onChange({ tier: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>1 · hoofd/seizoen</option>
                <option value={2}>2 · eventpartner</option>
                <option value={3}>3 · partner</option>
              </select>
            </label>
            <label>
              Kleur
              <input type="color" value={partner.color} onChange={(e) => onChange({ color: e.target.value })} />
            </label>
            <label>
              Voorkeur
              <select value={partner.preference} onChange={(e) => onChange({ preference: e.target.value as Preference })}>
                <option value="geen">geen</option>
                <option value="recht">rechte stuk</option>
                <option value="bocht">bocht</option>
                <option value="finish">rond de finish</option>
              </select>
            </label>
            <label>
              Blok
              <input type="number" min={1} max={6} value={partner.block} onChange={(e) => onChange({ block: Math.max(1, Number(e.target.value)) })} title="Aantal borden naast elkaar" />
            </label>
          </div>
          <label>
            Categorie (concurrenten niet naast elkaar)
            <input value={partner.category ?? ''} onChange={(e) => onChange({ category: e.target.value || undefined })} />
          </label>
          <label>
            Vaste posities
            <input
              value={fixedText}
              placeholder="bijv. 33, 34, 76-78"
              onChange={(e) => setFixedText(e.target.value)}
              onBlur={() => onChange({ fixed: parseFixed(fixedText) })}
            />
          </label>
          <div className="row">
            <label className="file">
              {partner.logo ? 'Logo vervangen' : 'Logo toevoegen'}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) onChange({ logo: await readLogo(f) });
                  e.target.value = '';
                }}
              />
            </label>
            {partner.logo && (
              <button className="link" onClick={() => onChange({ logo: undefined })}>
                Logo weg
              </button>
            )}
            <span className="spacer" />
            <button className="link danger" onClick={onDelete}>
              Verwijderen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
