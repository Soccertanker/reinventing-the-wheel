const SVG = 'http://www.w3.org/2000/svg';

/** A wheel drawn as a closed path: `wobble` 0 = perfect circle, 1 = potato. `sides` >= 3 draws a polygon. */
export function wheelPath(wobble: number, seed: number, sides = 0): string {
  const pts: string[] = [];
  const n = sides >= 3 ? sides : 72;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = 40 * (1 + wobble * 0.35 * Math.sin(a * 3 + seed) * Math.cos(a * 2 + seed * 1.7));
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function wheelSvg(): { el: SVGSVGElement; draw: (wobble: number, seed: number, sides?: number) => void } {
  const el = document.createElementNS(SVG, 'svg');
  el.setAttribute('viewBox', '0 0 100 100');
  el.setAttribute('class', 'wheel-art');
  const path = document.createElementNS(SVG, 'path');
  const hub = document.createElementNS(SVG, 'circle');
  hub.setAttribute('cx', '50');
  hub.setAttribute('cy', '50');
  hub.setAttribute('r', '6');
  el.append(path, hub);
  let last = '';
  return {
    el,
    draw(wobble, seed, sides = 0) {
      const d = wheelPath(wobble, seed, sides);
      if (d !== last) path.setAttribute('d', (last = d));
    },
  };
}

/** Simple line chart of up to 51 values (index 0..50 maps to the full width). */
export function sparkline(): { el: SVGSVGElement; draw: (values: number[], max: number) => void } {
  const el = document.createElementNS(SVG, 'svg');
  el.setAttribute('viewBox', '0 0 100 40');
  el.setAttribute('preserveAspectRatio', 'none');
  el.setAttribute('class', 'spark');
  const line = document.createElementNS(SVG, 'polyline');
  el.append(line);
  let last = '';
  return {
    el,
    draw(values, max) {
      const pts = values.map((v, i) => `${((i / 50) * 100).toFixed(1)},${(40 - (v / max) * 38).toFixed(1)}`).join(' ');
      if (pts !== last) line.setAttribute('points', (last = pts));
    },
  };
}
