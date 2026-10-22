import { forwardRef } from 'react';
import { GEO, SHAPES } from '../model/track';
import type { Partner, Project } from '../model/types';
import { textOn } from '../model/util';

export type ViewMode = 'partners' | 'waarde';

interface Props {
  project: Project;
  values: Record<number, number>;
  mode: ViewMode;
  selected: number | null;
  hover: number | null;
  dragSource: number | null;
  highlightPartner?: string | null;
  showLegend?: boolean;
}

const FONT = 'Arial, Helvetica, sans-serif';
const { width: W, cy, xLeft, xRight } = GEO;

function stadium(r: number): string {
  return `M ${xLeft} ${cy - r} H ${xRight} A ${r} ${r} 0 0 1 ${xRight} ${cy + r} H ${xLeft} A ${r} ${r} 0 0 1 ${xLeft} ${cy - r} Z`;
}

function valueColor(v: number): string {
  // licht (laag) → diep blauw (hoog)
  const t = (v - 1) / 9;
  const l = 92 - t * 58;
  return `hsl(222 ${45 + t * 25}% ${l}%)`;
}

const LEGEND_TOP = 880;
const LEGEND_ROW = 34;
const LEGEND_COLS = 4;

export function svgHeight(partnerCount: number, showLegend: boolean): number {
  if (!showLegend || partnerCount === 0) return 900;
  return LEGEND_TOP + Math.ceil(partnerCount / LEGEND_COLS) * LEGEND_ROW + 30;
}

const LINE_LABELS: Array<{ x: number; top: boolean; text: string }> = [
  { x: xLeft, top: true, text: 'START 5000m' },
  { x: (xLeft + xRight) / 2, top: true, text: 'START 1000m' },
  { x: xRight, top: true, text: 'START 1500m' },
  { x: xLeft, top: false, text: 'START 500m' },
  { x: (xLeft + xRight) / 2, top: false, text: 'FINISH 1000m' },
  { x: xRight, top: false, text: 'START 10000m · FINISH' },
];

export const TrackView = forwardRef<SVGSVGElement, Props>(function TrackView(
  { project, values, mode, selected, hover, dragSource, highlightPartner = null, showLegend = true },
  ref,
) {
  const partnerById = new Map<string, Partner>(project.partners.map((p) => [p.id, p]));
  const locked = new Set(project.locked);
  const counts = new Map<string, number>();
  for (const pid of Object.values(project.assignment)) counts.set(pid, (counts.get(pid) ?? 0) + 1);
  const legendPartners = project.partners.filter((p) => (counts.get(p.id) ?? 0) > 0);
  const H = svgHeight(legendPartners.length, showLegend && mode === 'partners');

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      className="track"
      style={{ fontFamily: FONT }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#cde8f8" />
      <text x={40} y={58} fontFamily={FONT} fontWeight={800} fontSize={34} fill="#22408f" fontStyle="italic">
        {project.name.toUpperCase()}
      </text>
      <text x={40} y={84} fontFamily={FONT} fontSize={15} fill="#22408f" opacity={0.8}>
        {mode === 'waarde' ? 'Mediawaarde per positie (1 = laag, 10 = hoog)' : 'Boardingplan Thialf'}
      </text>

      {/* ijsbaan */}
      <path d={stadium(GEO.numInner - 4)} fill="#ffffff" stroke="#1c2a5a" strokeWidth={2.5} />
      <path d={stadium(GEO.numInner - 36)} fill="none" stroke="#1c2a5a" strokeWidth={2.5} />
      <path d={stadium(GEO.numInner - 54)} fill="#cde8f8" />
      <path d={stadium(GEO.numInner - 72)} fill="#2f4a99" />

      {[xLeft, (xLeft + xRight) / 2, xRight].map((x) => (
        <line key={x} x1={x} x2={x} y1={cy - 400} y2={cy + 400} stroke="#e23b3b" strokeWidth={2} strokeDasharray="10 8" />
      ))}
      {LINE_LABELS.map((l) => (
        <text
          key={l.text}
          x={l.x + 4}
          y={l.top ? cy - GEO.numInner + 18 : cy + GEO.numInner - 10}
          fontFamily={FONT}
          fontSize={10}
          fill="#1c2a5a"
        >
          {l.text}
        </text>
      ))}

      {SHAPES.map((s) => {
        const pid = project.assignment[s.pos];
        const partner = pid ? partnerById.get(pid) : undefined;
        const v = values[s.pos];
        const fill = mode === 'waarde' ? valueColor(v) : partner ? partner.color : '#ffffff';
        const isSel = selected === s.pos;
        const isHover = hover === s.pos && dragSource !== s.pos;
        const label = mode === 'waarde' ? String(v) : partner ? partner.name : '';
        const fg = mode === 'waarde' ? (v >= 6 ? '#fff' : '#1c2a5a') : textOn(fill);
        const maxChars = Math.floor(s.boardLength / 7);
        const shortLabel = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
        return (
          <g key={s.pos} data-pos={s.pos} className="pos" opacity={dragSource === s.pos || (highlightPartner && pid !== highlightPartner) ? 0.35 : 1}>
            <path d={s.numberPath} fill="#1aa0e0" stroke="#cde8f8" strokeWidth={1.5} />
            <text
              x={s.numberCenter.x}
              y={s.numberCenter.y}
              transform={`rotate(${s.numberCenter.rotate} ${s.numberCenter.x} ${s.numberCenter.y})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={FONT}
              fontSize={17}
              fill="#ffffff"
              pointerEvents="none"
            >
              {s.pos}
            </text>
            <path
              d={s.boardPath}
              fill={fill}
              stroke={isSel || isHover ? '#ff4d00' : '#1c2a5a'}
              strokeWidth={isSel || isHover ? 4 : 1}
            />
            {mode === 'partners' && partner?.logo ? (
              <image
                href={partner.logo}
                x={s.boardCenter.x - (s.boardLength - 10) / 2}
                y={s.boardCenter.y - (s.boardThickness - 8) / 2}
                width={s.boardLength - 10}
                height={s.boardThickness - 8}
                preserveAspectRatio="xMidYMid meet"
                transform={`rotate(${s.boardCenter.rotate} ${s.boardCenter.x} ${s.boardCenter.y})`}
                pointerEvents="none"
              />
            ) : (
              <text
                x={s.boardCenter.x}
                y={s.boardCenter.y}
                transform={`rotate(${s.boardCenter.rotate} ${s.boardCenter.x} ${s.boardCenter.y})`}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={FONT}
                fontWeight={700}
                fontSize={mode === 'waarde' ? 16 : 11}
                fill={fg}
                pointerEvents="none"
              >
                {shortLabel}
              </text>
            )}
            {locked.has(s.pos) && mode === 'partners' && (
              <circle
                cx={s.numberCenter.x + (s.boardCenter.x - s.numberCenter.x) * 0.55}
                cy={s.numberCenter.y + (s.boardCenter.y - s.numberCenter.y) * 0.55}
                r={3.5}
                fill="#1c2a5a"
                className="lock-dot"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {showLegend && mode === 'partners' &&
        legendPartners.map((p, i) => {
          const col = i % LEGEND_COLS;
          const row = Math.floor(i / LEGEND_COLS);
          const x = 60 + col * 380;
          const y = LEGEND_TOP + row * LEGEND_ROW;
          return (
            <g key={p.id}>
              <rect x={x} y={y} width={36} height={22} fill={p.color} stroke="#1c2a5a" strokeWidth={1.5} />
              <text x={x + 48} y={y + 16} fontFamily={FONT} fontWeight={700} fontStyle="italic" fontSize={17} fill={textOn(p.color) === '#ffffff' ? p.color : '#1c2a5a'}>
                {p.name.toUpperCase()}
                <tspan fontWeight={400} fontStyle="normal" fontSize={13} fill="#1c2a5a" opacity={0.7} dx={8}>
                  {counts.get(p.id)}×
                </tspan>
              </text>
            </g>
          );
        })}
    </svg>
  );
});
