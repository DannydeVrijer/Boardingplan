import { jsPDF } from 'jspdf';
import { downloadBlob } from './util';

function svgToCanvas(svg: SVGSVGElement, scale: number): Promise<HTMLCanvasElement> {
  const vb = svg.viewBox.baseVal;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(vb.width));
  clone.setAttribute('height', String(vb.height));
  // selectie-/sleepmarkeringen niet meenemen in de export
  clone.querySelectorAll('.lock-dot').forEach((n) => n.remove());
  clone.querySelectorAll('path[stroke="#ff4d00"]').forEach((n) => {
    n.setAttribute('stroke', '#1c2a5a');
    n.setAttribute('stroke-width', '1');
  });
  clone.querySelectorAll('g[opacity]').forEach((n) => n.setAttribute('opacity', '1'));
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(vb.width * scale);
      c.height = Math.round(vb.height * scale);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Tekening kon niet worden omgezet'));
    };
    img.src = url;
  });
}

const safe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'boardingplan';

export async function exportPng(svg: SVGSVGElement, name: string) {
  const canvas = await svgToCanvas(svg, 2);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/png'));
  downloadBlob(blob, `${safe(name)}.png`);
}

export async function exportPdf(svg: SVGSVGElement, name: string) {
  const canvas = await svgToCanvas(svg, 2.5);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const ratio = Math.min((pw - 16) / canvas.width, (ph - 16) / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, (ph - h) / 2, w, h);
  pdf.save(`${safe(name)}.pdf`);
}
