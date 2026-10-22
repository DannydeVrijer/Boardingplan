import { useEffect, useMemo, useRef, useState } from 'react';
import { PartnerRow } from './components/PartnerRow';
import { TrackView, type ViewMode } from './components/TrackView';
import { exportPdf, exportPng } from './model/exporter';
import { TEMPLATE_CSV, readPartnerFile } from './model/importer';
import { KNSB_PARTNERS, KNSB_SEASON } from './model/knsb';
import { propose } from './model/proposal';
import { loadProjects, newProject, saveProjects } from './model/storage';
import { POSITIONS, sideOf } from './model/track';
import type { Partner, Project } from './model/types';
import { downloadBlob, textOn, uid } from './model/util';
import { defaultValue, valueMap } from './model/value';

type Drag =
  | { kind: 'partner'; partnerId: string; x: number; y: number; started: boolean; sx: number; sy: number }
  | { kind: 'position'; pos: number; x: number; y: number; started: boolean; sx: number; sy: number };

const SIDE_LABEL: Record<string, string> = {
  'bocht-links': 'bocht links',
  'recht-boven': 'rechte stuk boven',
  'bocht-rechts': 'bocht rechts',
  'recht-onder': 'rechte stuk onder (finish)',
};

function posFromPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-pos]');
  return el ? Number(el.getAttribute('data-pos')) : null;
}

export default function App() {
  const initial = useMemo(loadProjects, []);
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [currentId, setCurrentId] = useState(initial.currentId);
  const [history, setHistory] = useState<Project[]>([]);
  const [mode, setMode] = useState<ViewMode>('partners');
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const project = projects.find((p) => p.id === currentId) ?? projects[0];
  const values = useMemo(() => valueMap(project), [project]);

  useEffect(() => {
    setSaveFailed(!saveProjects(projects, currentId));
  }, [projects, currentId]);

  /** Wijzig het huidige project, met undo-geschiedenis. */
  const update = (fn: (p: Project) => Project) => {
    setHistory((h) => [...h.slice(-49), project]);
    setProjects((all) => all.map((p) => (p.id === currentId ? { ...fn(p), updatedAt: Date.now() } : p)));
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setProjects((all) => all.map((p) => (p.id === last.id ? last : p)));
    setHistory((h) => h.slice(0, -1));
  };

  const assign = (pos: number, partnerId: string | null) =>
    update((p) => {
      const assignment = { ...p.assignment };
      if (partnerId) assignment[pos] = partnerId;
      else delete assignment[pos];
      return { ...p, assignment };
    });

  const swap = (a: number, b: number) =>
    update((p) => {
      const assignment = { ...p.assignment };
      const pa = assignment[a];
      const pb = assignment[b];
      if (pb) assignment[a] = pb;
      else delete assignment[a];
      if (pa) assignment[b] = pa;
      else delete assignment[b];
      // een slot verhuist mee met het bord
      const locked = new Set(p.locked);
      const la = locked.has(a);
      const lb = locked.has(b);
      locked.delete(a);
      locked.delete(b);
      if (la) locked.add(b);
      if (lb) locked.add(a);
      return { ...p, assignment, locked: [...locked] };
    });

  const toggleLock = (pos: number) =>
    update((p) => ({ ...p, locked: p.locked.includes(pos) ? p.locked.filter((x) => x !== pos) : [...p.locked, pos] }));

  const patchPartner = (id: string, patch: Partial<Partner>) =>
    update((p) => ({ ...p, partners: p.partners.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const deletePartner = (id: string) => {
    const partner = project.partners.find((x) => x.id === id);
    if (!partner || !confirm(`${partner.name} verwijderen? Alle borden van deze partner worden leeggemaakt.`)) return;
    update((p) => {
      const assignment = Object.fromEntries(Object.entries(p.assignment).filter(([, v]) => v !== id));
      return { ...p, partners: p.partners.filter((x) => x.id !== id), assignment };
    });
  };

  const addPartner = () =>
    update((p) => ({
      ...p,
      partners: [
        ...p.partners,
        { id: uid(), name: `Partner ${p.partners.length + 1}`, color: '#00a0e2', positions: 2, tier: 2, block: 1, preference: 'geen', fixed: [] },
      ],
    }));

  const loadKnsb = () =>
    update((p) => {
      const partners = [...p.partners];
      const assignment = { ...p.assignment };
      const locked = new Set(p.locked);
      for (const k of KNSB_PARTNERS) {
        let existing = partners.find((x) => x.name.toLowerCase() === k.name.toLowerCase());
        if (!existing) {
          existing = { ...k, id: uid() };
          partners.push(existing);
        }
        for (const pos of k.fixed) {
          assignment[pos] = existing.id;
          locked.add(pos);
        }
      }
      return { ...p, partners, assignment, locked: [...locked] };
    });

  const runProposal = () => {
    const unlockedFilled = POSITIONS.filter((pos) => project.assignment[pos] && !project.locked.includes(pos)).length;
    if (unlockedFilled > 0 && !confirm(`Nieuw voorstel maken? ${unlockedFilled} niet-vastgezette borden worden opnieuw verdeeld.`)) return;
    const res = propose(project);
    update((p) => ({ ...p, assignment: res.assignment }));
    const msgs: string[] = [];
    const used = Object.keys(res.assignment).length;
    msgs.push(`Voorstel gemaakt: ${used} van 86 posities gevuld.`);
    for (const s of res.shortfall) msgs.push(`${s.partner}: ${s.missing} positie(s) te weinig, de baan is vol.`);
    for (const c of res.conflicts) msgs.push(`Positie ${c.pos} is vast voor ${c.kept} én ${c.skipped}; ${c.kept} blijft staan.`);
    setMessages(msgs);
  };

  const clearUnlocked = () => {
    if (!confirm('Alle niet-vastgezette borden leegmaken?')) return;
    update((p) => ({ ...p, assignment: Object.fromEntries(Object.entries(p.assignment).filter(([pos]) => p.locked.includes(Number(pos)))) }));
  };

  const importFile = async (file: File) => {
    try {
      const { partners, warnings } = await readPartnerFile(file, project.metersPerPosition);
      if (!partners.length) {
        setMessages(['Geen partners gevonden. Controleer of de eerste rij kolomnamen bevat (zie sjabloon).']);
        return;
      }
      update((p) => {
        const merged = [...p.partners];
        for (const np of partners) {
          const i = merged.findIndex((x) => x.name.toLowerCase() === np.name.toLowerCase());
          if (i >= 0) merged[i] = { ...np, id: merged[i].id, logo: merged[i].logo };
          else merged.push(np);
        }
        return { ...p, partners: merged };
      });
      const total = partners.reduce((s, x) => s + x.positions, 0);
      setMessages([`${partners.length} partners ingelezen (${total} posities).`, ...warnings]);
    } catch (e) {
      setMessages([`Bestand kon niet worden gelezen: ${(e as Error).message}`]);
    }
  };

  const copyPositionList = async () => {
    const byId = new Map(project.partners.map((p) => [p.id, p.name]));
    const lines = POSITIONS.map((pos) => `${pos}: ${byId.get(project.assignment[pos]) ?? '— leeg —'}`);
    const text = `${project.name}\n\n${lines.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setMessages(['Positielijst gekopieerd naar het klembord.']);
    } catch {
      downloadBlob(new Blob([text], { type: 'text/plain' }), `${project.name}-posities.txt`);
    }
  };

  const doExport = async (kind: 'png' | 'pdf') => {
    if (!svgRef.current) return;
    const prevSel = selected;
    setSelected(null);
    setHighlight(null);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      if (kind === 'png') await exportPng(svgRef.current, project.name);
      else await exportPdf(svgRef.current, project.name);
    } catch (e) {
      setMessages([`Export mislukt: ${(e as Error).message}`]);
    }
    setSelected(prevSel);
  };

  /* ---------- slepen ---------- */
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const dropRef = useRef<(d: Drag, target: number | null) => void>(() => {});
  dropRef.current = (d, target) => {
    if (!d.started) {
      if (d.kind === 'position') setSelected(d.pos);
      return;
    }
    if (!target) return;
    if (d.kind === 'partner') {
      if (project.locked.includes(target)) {
        setMessages([`Positie ${target} is vastgezet. Maak hem eerst los.`]);
        return;
      }
      assign(target, d.partnerId);
    } else if (d.pos !== target) {
      if (project.locked.includes(target)) {
        setMessages([`Positie ${target} is vastgezet. Maak hem eerst los.`]);
        return;
      }
      swap(d.pos, target);
    }
    setSelected(target);
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const started = d.started || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4;
      setDrag({ ...d, x: e.clientX, y: e.clientY, started });
      setHover(posFromPoint(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d) dropRef.current(d, posFromPoint(e.clientX, e.clientY));
      setDrag(null);
      setHover(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !project.locked.includes(selected)) {
        assign(selected, null);
      } else if (e.key.toLowerCase() === 'l' && selected) {
        toggleLock(selected);
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  /* ---------- afgeleide cijfers ---------- */
  const assignedCount = new Map<string, number>();
  const valueSum = new Map<string, number>();
  for (const [pos, pid] of Object.entries(project.assignment)) {
    assignedCount.set(pid, (assignedCount.get(pid) ?? 0) + 1);
    valueSum.set(pid, (valueSum.get(pid) ?? 0) + values[Number(pos)]);
  }
  const demand = project.partners.reduce((s, p) => s + p.positions, 0);
  const filled = Object.keys(project.assignment).length;
  const sortedPartners = [...project.partners].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  const selPartner = selected ? project.partners.find((p) => p.id === project.assignment[selected]) : undefined;
  const dragPartner = drag?.kind === 'partner' ? project.partners.find((p) => p.id === drag.partnerId) : drag?.kind === 'position' ? project.partners.find((p) => p.id === project.assignment[drag.pos]) : undefined;

  return (
    <div className={`app ${drag?.started ? 'dragging' : ''}`}>
      <header className="toolbar">
        <div className="brand">
          Boardingplan <span>Thialf</span>
        </div>
        <select value={currentId} onChange={(e) => { setCurrentId(e.target.value); setHistory([]); setSelected(null); }}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={() => { const n = prompt('Naam van het event', 'Nieuw event'); if (!n) return; const p = newProject(n); setProjects((a) => [...a, p]); setCurrentId(p.id); setHistory([]); }}>
          + Event
        </button>
        <button onClick={() => { const n = prompt('Nieuwe naam', project.name); if (n) update((p) => ({ ...p, name: n })); }}>Hernoem</button>
        <button onClick={() => {
          const copy = { ...structuredClone(project), id: uid(), name: `${project.name} (kopie)` };
          setProjects((a) => [...a, copy]); setCurrentId(copy.id); setHistory([]);
        }}>Dupliceer</button>
        <span className="sep" />
        <div className="seg">
          <button className={mode === 'partners' ? 'on' : ''} onClick={() => setMode('partners')}>Partners</button>
          <button className={mode === 'waarde' ? 'on' : ''} onClick={() => setMode('waarde')}>Mediawaarde</button>
        </div>
        <span className="sep" />
        <button className="primary" onClick={runProposal} disabled={!project.partners.length}>Maak voorstel</button>
        <button onClick={undo} disabled={!history.length} title="Ctrl/Cmd+Z">Ongedaan maken</button>
        <button onClick={clearUnlocked}>Leegmaken</button>
        <span className="grow" />
        <button onClick={() => doExport('png')}>PNG</button>
        <button className="primary" onClick={() => doExport('pdf')}>PDF</button>
      </header>

      <main className="layout">
        <section
          className="canvas"
          onPointerDown={(e) => {
            const el = (e.target as Element).closest('[data-pos]');
            const pos = el ? Number(el.getAttribute('data-pos')) : null;
            if (!pos) {
              if ((e.target as Element).closest('svg')) setSelected(null);
              return;
            }
            if (mode === 'waarde' || !project.assignment[pos] || project.locked.includes(pos)) {
              setSelected(pos);
              return;
            }
            e.preventDefault();
            setDrag({ kind: 'position', pos, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, started: false });
          }}
        >
          <TrackView
            ref={svgRef}
            project={project}
            values={values}
            mode={mode}
            selected={selected}
            hover={drag?.started ? hover : null}
            dragSource={drag?.started && drag.kind === 'position' ? drag.pos : null}
            highlightPartner={drag ? null : highlight}
          />
          <p className="hint">
            Sleep een partner (⠿) naar een bord, of sleep borden om te ruilen. Klik op een bord voor details. <kbd>Del</kbd> leegt, <kbd>L</kbd> zet vast.
          </p>
        </section>

        <aside className="side">
          {saveFailed && <div className="msg warn">Opslaan in de browser lukt niet (waarschijnlijk te grote logo's). Exporteer het project als bestand.</div>}
          {messages.length > 0 && (
            <div className="msg">
              {messages.map((m, i) => <div key={i}>{m}</div>)}
              <button className="link" onClick={() => setMessages([])}>Sluiten</button>
            </div>
          )}

          {selected && (
            <div className="card">
              <div className="card-title">
                Positie {selected} <small>{SIDE_LABEL[sideOf(selected)]}</small>
                <button className="link" onClick={() => setSelected(null)}>×</button>
              </div>
              <label>
                Partner
                <select value={project.assignment[selected] ?? ''} disabled={project.locked.includes(selected)} onChange={(e) => assign(selected, e.target.value || null)}>
                  <option value="">— leeg —</option>
                  {sortedPartners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <div className="row">
                <label className="check">
                  <input type="checkbox" checked={project.locked.includes(selected)} onChange={() => toggleLock(selected)} /> Vastgezet
                </label>
                <span className="spacer" />
                <label className="inline">
                  Waarde
                  <input
                    type="number" min={1} max={10} value={values[selected]}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(10, Number(e.target.value)));
                      update((p) => ({ ...p, valueOverrides: { ...p.valueOverrides, [selected]: v } }));
                    }}
                  />
                </label>
                {project.valueOverrides[selected] !== undefined && (
                  <button className="link" title={`Standaard: ${defaultValue(selected, project.knsbPremium)}`} onClick={() => update((p) => { const o = { ...p.valueOverrides }; delete o[selected]; return { ...p, valueOverrides: o }; })}>
                    standaard
                  </button>
                )}
              </div>
              {selPartner && <div className="muted">Klik ⠿ bij een partner en sleep om dit bord te vervangen.</div>}
            </div>
          )}

          <div className="card">
            <div className="card-title">
              Partners <small>{filled}/86 gevuld · {demand} afgesproken</small>
            </div>
            {demand > 86 && <div className="msg warn">Er zijn {demand - 86} posities meer afgesproken dan er op de baan passen.</div>}
            <div className="row wrap">
              <button onClick={() => fileRef.current?.click()}>Excel/CSV importeren</button>
              <button className="link" onClick={() => downloadBlob(new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv' }), 'partnerafspraken-sjabloon.csv')}>sjabloon</button>
              <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
            </div>
            <div className="row wrap">
              <button onClick={loadKnsb}>KNSB-plan {KNSB_SEASON} laden</button>
              <button onClick={addPartner}>+ Partner</button>
            </div>
            <div className="partners">
              {sortedPartners.length === 0 && <div className="muted">Nog geen partners. Laad het KNSB-plan en importeer de partnerafspraken van dit event.</div>}
              {sortedPartners.map((p) => (
                <PartnerRow
                  key={p.id}
                  partner={p}
                  assigned={assignedCount.get(p.id) ?? 0}
                  value={valueSum.get(p.id) ?? 0}
                  metersPerPosition={project.metersPerPosition}
                  onChange={(patch) => patchPartner(p.id, patch)}
                  onDelete={() => deletePartner(p.id)}
                  onHighlight={(on) => setHighlight(on ? p.id : null)}
                  onDragStart={(e) => {
                    e.preventDefault();
                    setDrag({ kind: 'partner', partnerId: p.id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, started: false });
                  }}
                />
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Instellingen</div>
            <label className="inline">
              Meter per positie
              <input type="number" min={1} step={0.5} value={project.metersPerPosition} onChange={(e) => update((p) => ({ ...p, metersPerPosition: Math.max(0.5, Number(e.target.value)) }))} />
            </label>
            <label className="check">
              <input type="checkbox" checked={project.knsbPremium} onChange={() => update((p) => ({ ...p, knsbPremium: !p.knsbPremium }))} /> KNSB-posities als premium meewegen
            </label>
            <div className="row wrap">
              <button onClick={copyPositionList}>Positielijst kopiëren</button>
              <button onClick={() => downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${project.name}.boardingplan.json`)}>Project opslaan als bestand</button>
              <button onClick={() => jsonRef.current?.click()}>Project openen</button>
              <input ref={jsonRef} type="file" hidden accept=".json" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (!f) return;
                try {
                  const p = JSON.parse(await f.text()) as Project;
                  if (!p.partners || !p.assignment) throw new Error('geen boardingplan-bestand');
                  const imported = { ...p, id: uid() };
                  setProjects((a) => [...a, imported]); setCurrentId(imported.id); setHistory([]);
                } catch (err) { setMessages([`Openen mislukt: ${(err as Error).message}`]); }
              }} />
              {projects.length > 1 && (
                <button className="link danger" onClick={() => {
                  if (!confirm(`Event "${project.name}" verwijderen?`)) return;
                  const rest = projects.filter((p) => p.id !== project.id);
                  setProjects(rest); setCurrentId(rest[0].id); setHistory([]);
                }}>Event verwijderen</button>
              )}
            </div>
          </div>
        </aside>
      </main>

      {drag?.started && dragPartner && (
        <div className="ghost" style={{ left: drag.x + 12, top: drag.y + 12, background: dragPartner.color, color: textOn(dragPartner.color) }}>
          {dragPartner.name}
          {hover ? ` → ${hover}` : ''}
        </div>
      )}
    </div>
  );
}
