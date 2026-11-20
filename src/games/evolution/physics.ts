/**
 * Rolling physics for a rigid convex polygon on an incline (pure, deterministic).
 *
 * The shape rolls forward by pivoting over its front corner. During a pivot, energy is
 * conserved (gravity along the slope speeds it up or slows it down). When the next corner hits
 * the ground, angular momentum about that new corner is conserved, which loses energy: sharp
 * corners lose a lot (a square loses ~94%), near-circles lose almost nothing.
 *   omega' = omega * (I_c + d_old . d_new) / (I_c + |d_new|^2)    (unit mass)
 * A shape stops when it can't get its centre of mass over the next corner.
 */

export type Vec = [number, number];

export interface Body {
  /** convex hull, counter-clockwise, centred on the centre of mass */
  hull: Vec[];
  /** moment of inertia about the centre of mass, per unit mass */
  inertia: number;
}

export interface SimParams {
  /** slope in degrees (downhill = forward) */
  slopeDeg: number;
  gravity: number;
  /** initial nudge, rad/s */
  push: number;
  maxSeconds: number;
  finish: number;
}

export interface Sample {
  t: number;
  /** pivot position along the ground */
  x: number;
  /** body rotation */
  angle: number;
  /** hull index of the pivot corner */
  pivot: number;
}

export interface SimResult {
  distance: number;
  time: number;
  finished: boolean;
  samples: Sample[];
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
const len = (a: Vec) => Math.hypot(a[0], a[1]);
const rot = (v: Vec, a: number): Vec => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const cross = (o: Vec, a: Vec, b: Vec) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Andrew's monotone chain; returns CCW hull without collinear points. */
export function convexHull(points: Vec[]): Vec[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: Vec[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2] as Vec, lower[lower.length - 1] as Vec, pt) <= 1e-12) lower.pop();
    lower.push(pt);
  }
  const upper: Vec[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i] as Vec;
    while (upper.length >= 2 && cross(upper[upper.length - 2] as Vec, upper[upper.length - 1] as Vec, pt) <= 1e-12) upper.pop();
    upper.push(pt);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Radial genome (radii at equal angles) -> rigid body. */
export function bodyFromGenome(radii: number[]): Body {
  const n = radii.length;
  const pts = radii.map((r, i): Vec => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);
  const hull = convexHull(pts);
  // Area, centroid and inertia of a uniform polygon (shoelace formulas).
  let a = 0, cx = 0, cy = 0, io = 0;
  for (let i = 0; i < hull.length; i++) {
    const [x0, y0] = hull[i] as Vec;
    const [x1, y1] = hull[(i + 1) % hull.length] as Vec;
    const k = x0 * y1 - x1 * y0;
    a += k / 2;
    cx += ((x0 + x1) * k) / 6;
    cy += ((y0 + y1) * k) / 6;
    io += (k * (x0 * x0 + x0 * x1 + x1 * x1 + y0 * y0 + y0 * y1 + y1 * y1)) / 12;
  }
  cx /= a;
  cy /= a;
  const inertia = io / a - (cx * cx + cy * cy);
  return { hull: hull.map(([x, y]): Vec => [x - cx, y - cy]), inertia };
}

/** 1 = perfect circle; lower = lumpier. Smallest/largest distance from centre to the outline. */
export function roundness(body: Body): number {
  const r = body.hull.map(len);
  // Edge midpoints catch flat sides that corner radii alone would miss.
  const mids = body.hull.map((p, i) => len([(p[0] + (body.hull[(i + 1) % body.hull.length] as Vec)[0]) / 2, (p[1] + (body.hull[(i + 1) % body.hull.length] as Vec)[1]) / 2]));
  return Math.min(...r, ...mids) / Math.max(...r);
}

export function simulate(body: Body, p: SimParams, record = false): SimResult {
  const { hull, inertia } = body;
  const n = hull.length;
  const alpha = (p.slopeDeg * Math.PI) / 180;
  const g = p.gravity;
  // Potential energy of the centre of mass at offset c from the pivot (x along slope, y up from ground).
  const U = (c: Vec) => g * (Math.cos(alpha) * c[1] - Math.sin(alpha) * c[0]);

  // Start resting on edge 0 -> 1, rolling forward over corner 1.
  const e0 = sub(hull[1] as Vec, hull[0] as Vec);
  let angle = -Math.atan2(e0[1], e0[0]);
  let pivot = 1;
  let x = len(e0);
  let t = 0;
  let omega = p.push;
  const samples: Sample[] = [];
  const centre = () => rot([-(hull[pivot] as Vec)[0], -(hull[pivot] as Vec)[1]], angle);
  const ip = () => inertia + dot(centre(), centre());
  let energy = 0.5 * ip() * omega * omega;

  if (record) samples.push({ t, x, angle, pivot });
  for (let guard = 0; guard < 5000 && t < p.maxSeconds && x < p.finish; guard++) {
    const next = (pivot + 1) % n;
    const edge = rot(sub(hull[next] as Vec, hull[pivot] as Vec), angle);
    const beta = Math.atan2(edge[1], edge[0]); // how far to rotate (clockwise) until `next` touches down
    const steps = Math.max(4, Math.ceil(beta / 0.04));
    const d = beta / steps;
    let stopped = false;
    for (let i = 0; i < steps; i++) {
      const before = centre();
      angle -= d;
      const after = centre();
      const e2 = energy - (U(after) - U(before));
      if (e2 <= 0) {
        angle += d; // can't get over the corner: it rocks back and stops here
        stopped = true;
        break;
      }
      const w2 = Math.sqrt((2 * e2) / ip());
      t += d / ((omega + w2) / 2);
      omega = w2;
      energy = e2;
      if (record) samples.push({ t, x, angle, pivot });
      if (t >= p.maxSeconds) break;
    }
    if (stopped || t >= p.maxSeconds) break;
    // Impact on the next corner.
    const dOld = centre();
    const edgeLen = len(edge);
    pivot = next;
    x += edgeLen;
    const dNew = centre();
    omega *= (inertia + dot(dOld, dNew)) / (inertia + dot(dNew, dNew));
    if (omega <= 1e-6) break;
    energy = 0.5 * ip() * omega * omega;
    if (record) samples.push({ t, x, angle, pivot });
  }
  return { distance: Math.min(x, p.finish), time: t, finished: x >= p.finish, samples };
}

/** Where the hull corners are at a sample (for drawing): x along the slope, y up from it. */
export function posedHull(body: Body, s: Sample): Vec[] {
  const pv = body.hull[s.pivot] as Vec;
  return body.hull.map((v) => {
    const r = rot(sub(v, pv), s.angle);
    return [s.x + r[0], r[1]];
  });
}
