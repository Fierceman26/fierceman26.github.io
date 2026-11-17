/**
 * Shared numbers and drawing helpers for the waveguide notes.
 *
 * The cross-section shapes below are qualitative schematics: they keep the
 * strip's aspect ratio, which way the dominant E points, and which mode
 * spills farther into the oxide. They are not a replot of an FDE grid.
 *
 * Verified solver outputs used as labels (220 nm SOI, 500 nm strip,
 * 1550 nm, Si / SiO2 Palik):
 *   TE0  neff 2.445347, TE fraction 0.9835
 *   TM0  neff 1.771059, TE fraction 0.0444
 *   a third root at 1.492897, discarded as a radiation / PML artifact
 * n ≈ 3.5 and n ≈ 1.44 are the approximate Palik values used for intuition.
 */

import { siphCopy } from './copy';

export const LAMBDA_UM = 1.55;
export const N_CORE = 3.5;
export const N_CLAD = 1.44;

export const CORE_HALF_W_UM = 0.25;
export const CORE_HALF_H_UM = 0.11;

export const TE0 = {
  id: 'te' as const,
  name: 'TE0',
  neff: 2.445347,
  teFraction: 0.9835,
};

export const TM0 = {
  id: 'tm' as const,
  name: 'TM0',
  neff: 1.771059,
  teFraction: 0.0444,
};

export const MODE3_NEFF = 1.492897;

export const TRAVEL_LENGTH_UM = 3.2;

export type ModeId = 'te' | 'tm';

export interface WorldBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ViewRect extends WorldBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Palette {
  bg: string;
  ink: string;
  inkSoft: string;
  muted: string;
  faint: string;
  rule: string;
  accent: string;
  positive: string;
  negative: string;
  dark: boolean;
}

const SANS =
  `'Inter Variable', Inter, 'PingFang SC', 'Noto Sans SC', 'WenQuanYi Micro Hei', 'Droid Sans Fallback', 'Microsoft YaHei', sans-serif`;

export function k0PerUm(): number {
  return (2 * Math.PI) / LAMBDA_UM;
}

/** Asymptotic cladding decay rate in 1/µm, using n ≈ 1.44. Zero when unbound. */
export function claddingKappa(neff: number): number {
  const under = neff * neff - N_CLAD * N_CLAD;
  if (under <= 0) return 0;
  return k0PerUm() * Math.sqrt(under);
}

export function guidedWavelengthNm(neff: number): number {
  return (LAMBDA_UM * 1000) / neff;
}

export function phaseVelocityOverC(neff: number): number {
  return 1 / neff;
}

export function betaPerUm(neff: number): number {
  return neff * k0PerUm();
}

function lobe(v: number, half: number, fill: number): number {
  return Math.cos((Math.PI / 2) * ((v / half) * fill));
}

function edgeValue(x: number, y: number, fillX: number, fillY: number): number {
  const xb = Math.max(-CORE_HALF_W_UM, Math.min(CORE_HALF_W_UM, x));
  const yb = Math.max(-CORE_HALF_H_UM, Math.min(CORE_HALF_H_UM, y));
  return lobe(xb, CORE_HALF_W_UM, fillX) * lobe(yb, CORE_HALF_H_UM, fillY);
}

/**
 * Signed amplitude of the dominant component, before the time factor cos(ωt).
 * Positive everywhere in this schematic; the clock supplies the sign.
 * x along the width, y along the 220 nm thickness, both in µm.
 */
export function dominantField(mode: ModeId, x: number, y: number): number {
  const dx = Math.abs(x) - CORE_HALF_W_UM;
  const dy = Math.abs(y) - CORE_HALF_H_UM;
  const inside = dx <= 0 && dy <= 0;

  if (mode === 'te') {
    // Ex: tangential on the wide faces, normal on the sidewalls.
    const edge = edgeValue(x, y, 0.62, 0.48);
    if (inside) return edge;
    const side = dx > 0;
    const vert = dy > 0;
    let boost = 1;
    if (side && !vert) boost = 1.42;
    else if (side && vert) boost = 1.12;
    const ox = Math.max(0, dx);
    const oy = Math.max(0, dy);
    return edge * boost * Math.exp(-7.4 * ox - 11 * oy);
  }

  // Ey: normal on the wide faces, so |E| steps up in the oxide.
  const edge = edgeValue(x, y, 0.8, 0.3);
  const core = 0.4;
  if (inside) return edge * core;
  const side = dx > 0;
  const vert = dy > 0;
  let boost = 1;
  if (vert && !side) boost = 2.7;
  else if (vert && side) boost = 1.45;
  const ox = Math.max(0, dx);
  const oy = Math.max(0, dy);
  return edge * core * boost * Math.exp(-8.2 * ox - 2.5 * oy);
}

const peakCache: Partial<Record<ModeId, number>> = {};

export function fieldPeak(mode: ModeId): number {
  const cached = peakCache[mode];
  if (cached) return cached;
  let peak = 1e-6;
  for (let iy = 0; iy <= 90; iy++) {
    const y = -0.6 + (1.2 * iy) / 90;
    for (let ix = 0; ix <= 90; ix++) {
      const x = -0.7 + (1.4 * ix) / 90;
      peak = Math.max(peak, dominantField(mode, x, y));
    }
  }
  peakCache[mode] = peak;
  return peak;
}

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function claim(el: HTMLElement): boolean {
  if (el.dataset.ready === '1') return false;
  el.dataset.ready = '1';
  return true;
}

let paletteCache: Palette | null = null;

export function invalidatePalette(): void {
  paletteCache = null;
}

function isDark(): boolean {
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readPalette(): Palette {
  if (paletteCache) return paletteCache;
  const cs = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const dark = isDark();
  paletteCache = {
    bg: pick('--bg', '#fafaf6'),
    ink: pick('--ink', '#15161a'),
    inkSoft: pick('--ink-soft', '#2c2d32'),
    muted: pick('--muted', '#6c6e75'),
    faint: pick('--faint', '#a8a69e'),
    rule: pick('--rule', '#d9d4c8'),
    accent: pick('--accent', '#7a1631'),
    positive: pick('--accent', '#7a1631'),
    negative: dark ? '#9ec3dd' : '#1e3f66',
    dark,
  };
  return paletteCache;
}

export function watchTheme(cb: () => void): () => void {
  const obs = new MutationObserver(() => {
    invalidatePalette();
    cb();
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onMq = () => {
    invalidatePalette();
    cb();
  };
  mq.addEventListener('change', onMq);
  return () => {
    obs.disconnect();
    mq.removeEventListener('change', onMq);
  };
}

export interface Clock {
  readonly phase: number;
  readonly playing: boolean;
  onFrame: (fn: (phase: number) => void) => void;
  setPhase: (phase: number) => void;
  play: () => void;
  pause: () => void;
}

/** phase advances by 2π every periodMs. Crests of cos(ωt − βz) then move toward +z. */
export function makeClock(periodMs: number): Clock {
  let phase = 0;
  let playing = false;
  let raf = 0;
  let last = 0;
  let handler = (_phase: number) => {};

  const tick = (now: number) => {
    if (!playing) return;
    if (!last) last = now;
    const dt = Math.min(48, now - last);
    last = now;
    phase = (phase + (dt / periodMs) * Math.PI * 2) % (Math.PI * 2);
    handler(phase);
    raf = requestAnimationFrame(tick);
  };

  return {
    get phase() {
      return phase;
    },
    get playing() {
      return playing;
    },
    onFrame(fn) {
      handler = fn;
    },
    setPhase(next) {
      phase = ((next % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      last = 0;
      handler(phase);
    },
    play() {
      if (playing) return;
      playing = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    },
    pause() {
      playing = false;
      cancelAnimationFrame(raf);
    },
  };
}

export function fitCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

export function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 500): void {
  ctx.font = `${weight} ${size}px ${SANS}`;
}

export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  pal: Palette,
  size = 12,
  align: CanvasTextAlign = 'left',
  baseline: CanvasTextBaseline = 'middle',
): void {
  ctx.save();
  setFont(ctx, size, 600);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = pal.bg;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = pal.ink;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function worldToScreen(view: ViewRect, xUm: number, yUm: number): { x: number; y: number } {
  return {
    x: view.x + ((xUm - view.x0) / (view.x1 - view.x0)) * view.w,
    y: view.y + ((view.y1 - yUm) / (view.y1 - view.y0)) * view.h,
  };
}

const HEAT_STOPS: Array<[number, number, number, number, number]> = [
  [0, 22, 28, 56, 0],
  [0.12, 30, 52, 96, 80],
  [0.3, 28, 104, 114, 170],
  [0.5, 64, 156, 112, 205],
  [0.7, 196, 176, 72, 230],
  [0.86, 236, 208, 120, 242],
  [1, 255, 250, 236, 250],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function heatRgba(t: number): [number, number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < HEAT_STOPS.length - 2 && x > HEAT_STOPS[i + 1][0]) i += 1;
  const a = HEAT_STOPS[i];
  const b = HEAT_STOPS[i + 1];
  const u = (x - a[0]) / (b[0] - a[0] || 1);
  return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u), lerp(a[4], b[4], u)];
}

export function heatCss(t: number): string {
  const [r, g, b, a] = heatRgba(t);
  return `rgba(${r | 0},${g | 0},${b | 0},${(a / 255).toFixed(3)})`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(lerp(pa[0], pb[0], u));
  const g = Math.round(lerp(pa[1], pb[1], u));
  const bl = Math.round(lerp(pa[2], pb[2], u));
  return `rgb(${r},${g},${bl})`;
}

/** v in [-1, 1]. shade > 0 darkens, used for the front face of the strip. */
export function phaseCss(v: number, pal: Palette, shade = 0): string {
  const t = Math.max(-1, Math.min(1, v));
  const paper = pal.dark ? '#22242b' : '#e7e1d4';
  const end = t >= 0 ? pal.accent : pal.negative;
  const base = mixHex(paper, end, Math.pow(Math.abs(t), 0.8));
  if (shade <= 0) return base;
  return mixHex(base, pal.dark ? '#07080a' : '#2a241c', shade);
}

export function renderHeatmap(mode: ModeId, cssW: number, cssH: number, world: WorldBox): HTMLCanvasElement {
  const step = 2;
  const cols = Math.max(2, Math.round(cssW / step));
  const rows = Math.max(2, Math.round(cssH / step));
  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  const ctx = off.getContext('2d');
  if (!ctx) return off;
  const img = ctx.createImageData(cols, rows);
  const data = img.data;
  const peak = fieldPeak(mode);
  const inv = 1 / (peak * peak);
  const xSpan = world.x1 - world.x0;
  const ySpan = world.y1 - world.y0;
  for (let j = 0; j < rows; j++) {
    const yUm = world.y1 - ((j + 0.5) / rows) * ySpan;
    for (let i = 0; i < cols; i++) {
      const xUm = world.x0 + ((i + 0.5) / cols) * xSpan;
      const amp = dominantField(mode, xUm, yUm);
      const t = Math.pow(amp * amp * inv, 0.62);
      const [r, g, b, a] = heatRgba(t);
      const p = (j * cols + i) * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return off;
}

export function strokeCore(ctx: CanvasRenderingContext2D, view: ViewRect, pal: Palette): { x: number; y: number; w: number; h: number } {
  const a = worldToScreen(view, -CORE_HALF_W_UM, CORE_HALF_H_UM);
  const b = worldToScreen(view, CORE_HALF_W_UM, -CORE_HALF_H_UM);
  const x = a.x;
  const y = a.y;
  const w = b.x - a.x;
  const h = b.y - a.y;
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = pal.bg;
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.25;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.restore();
  return { x, y, w, h };
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
  halo: string,
  width = 1.7,
): void {
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ang = Math.atan2(dy, dx);
  const head = Math.min(8, Math.max(5, len * 0.34));
  const paint = (stroke: string, line: number, shorten: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = line;
    ctx.lineCap = 'round';
    const tip = len / 2 - shorten;
    const tail = -len / 2;
    ctx.beginPath();
    ctx.moveTo(tail, 0);
    ctx.lineTo(tip - head + 1, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tip, 0);
    ctx.lineTo(tip - head, head * 0.38);
    ctx.lineTo(tip - head, -head * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  paint(halo, width + 2.2, 0);
  paint(color, width, 0);
}

export function bindVisibility(el: HTMLElement, start: () => void, stop: () => void, allow: () => boolean): void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && allow()) start();
        else stop();
      }
    },
    { threshold: 0.25 },
  );
  io.observe(el);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (allow()) start();
  });
}

export function paintPlayButton(button: HTMLButtonElement, playing: boolean): void {
  const c = siphCopy();
  button.textContent = playing ? c.pause : c.play;
  button.setAttribute('aria-pressed', playing ? 'true' : 'false');
  button.setAttribute('aria-label', playing ? c.pauseAria : c.playAria);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}
