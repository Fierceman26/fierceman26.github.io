/**
 * neff between n_oxide and n_Si, and how fast the cladding tail decays.
 * The continuous slider is the formula 1/√(neff² − n²), not extra modes.
 */

import {
  MODE3_NEFF,
  N_CLAD,
  N_CORE,
  TE0,
  TM0,
  bindVisibility,
  claim,
  claddingKappa,
  clearCanvas,
  fitCanvas,
  label,
  paintPlayButton,
  readPalette,
  reducedMotion,
  watchTheme,
} from './modes';
import { siphCopy } from './copy';

const N0 = 1.3;
const N1 = 3.7;
const SPEED = 0.11;

interface Mark {
  n: number;
  label: string;
  side: 'up' | 'down';
  snap: boolean;
}

function marks(): Mark[] {
  const n = siphCopy().neff;
  return [
    { n: N_CLAD, label: n.oxide, side: 'down', snap: false },
    { n: MODE3_NEFF, label: n.discarded, side: 'up', snap: true },
    { n: TM0.neff, label: 'TM0', side: 'down', snap: true },
    { n: TE0.neff, label: 'TE0', side: 'up', snap: true },
    { n: N_CORE, label: n.silicon, side: 'down', snap: false },
  ];
}

export function mountNeff(root: HTMLElement): void {
  if (!claim(root)) return;
  const canvas = root.querySelector('canvas');
  const stage = root.querySelector('[data-stage]');
  const live = root.querySelector('[data-live]');
  const playBtn = root.querySelector('[data-play]');
  const slider = root.querySelector('[data-neff]');
  const track = root.querySelector('[data-track]');
  const windowEl = root.querySelector('[data-window]');
  const head = root.querySelector('[data-head]');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  if (!(stage instanceof HTMLElement)) return;
  if (!(live instanceof HTMLElement)) return;
  if (!(playBtn instanceof HTMLButtonElement)) return;
  if (!(slider instanceof HTMLInputElement)) return;
  if (!(track instanceof HTMLElement)) return;
  if (!(windowEl instanceof HTMLElement)) return;
  if (!(head instanceof HTMLElement)) return;

  const snaps = [...root.querySelectorAll<HTMLButtonElement>('[data-snap]')];

  windowEl.style.left = `${pct(N_CLAD)}%`;
  windowEl.style.width = `${pct(N_CORE) - pct(N_CLAD)}%`;

  for (const mark of marks()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'neff-mark';
    btn.style.left = `${pct(mark.n)}%`;
    btn.dataset.side = mark.side;
    btn.dataset.kind = mark.snap ? 'mode' : 'wall';
    btn.dataset.snap = mark.snap ? '1' : '0';
    btn.dataset.n = String(mark.n);
    const align = pct(mark.n) < 16 ? 'left' : pct(mark.n) > 84 ? 'right' : 'center';
    btn.dataset.align = align;
    if (!mark.snap) btn.tabIndex = -1;
    btn.setAttribute('aria-label', mark.label);
    btn.title = mark.label;
    if (mark.snap) {
      btn.addEventListener('click', () => {
        setNeff(mark.n, true);
      });
    }
    track.appendChild(btn);
  }

  let neff = reducedMotion() ? TE0.neff : 2.9;
  let want = !reducedMotion();
  let raf = 0;
  let last = 0;
  let playing = false;

  function setNeff(next: number, fromUser: boolean): void {
    neff = Math.max(1.42, Math.min(3.2, next));
    if (fromUser && document.activeElement !== slider) {
      /* slider tracks the value either way */
    }
    slider.value = String(neff);
    head.style.left = `${pct(neff)}%`;
    for (const b of snaps) {
      const v = Number(b.dataset.snap);
      b.setAttribute('aria-pressed', Math.abs(v - neff) < 0.003 ? 'true' : 'false');
    }
    for (const mark of track.querySelectorAll<HTMLButtonElement>('.neff-mark')) {
      const v = Number(mark.dataset.n);
      const on = mark.dataset.snap === '1' && Math.abs(v - neff) < 0.003;
      mark.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const text = describe(neff);
    if (live.textContent !== text) live.textContent = text;
    draw();
  }

  function frame(now: number): void {
    if (!playing) return;
    if (!last) last = now;
    const dt = Math.min(48, now - last);
    last = now;
    neff -= SPEED * (dt / 1000);
    if (neff <= 1.42) {
      neff = 1.42;
      playing = false;
      want = false;
      paintPlayButton(playBtn, false);
      setNeff(neff, false);
      return;
    }
    setNeff(neff, false);
    raf = requestAnimationFrame(frame);
  }

  function play(): void {
    if (playing) return;
    if (neff <= 1.43) neff = 2.9;
    playing = true;
    last = 0;
    paintPlayButton(playBtn, true);
    raf = requestAnimationFrame(frame);
  }

  function pause(): void {
    playing = false;
    cancelAnimationFrame(raf);
    paintPlayButton(playBtn, false);
  }

  function draw(): void {
    const w = stage.clientWidth;
    if (w < 8) return;
    const h = 168;
    const ctx = fitCanvas(canvas, w, h);
    if (!ctx) return;
    const pal = readPalette();
    clearCanvas(ctx, w, h, pal.bg);

    const coreH = 46;
    const coreW = coreH * (500 / 220);
    const cx = w / 2;
    const cy = h / 2 + 6;
    const radiating = neff <= N_CLAD + 1e-4;
    const maxTail = h / 2 - coreH / 2 - 22;
    let tailPx = maxTail;
    if (!radiating) {
      const kappa = claddingKappa(neff);
      const lenUm = kappa > 1e-4 ? 1 / kappa : 8;
      tailPx = Math.min(maxTail, lenUm * 250);
    }

    const tailW = coreW * 1.15;
    if (radiating) {
      paintRipple(ctx, cx, cy, coreH, tailW, maxTail, pal.negative);
    } else {
      paintTail(ctx, cx, cy, coreH, tailW, tailPx, pal);
    }

    ctx.fillStyle = pal.dark ? '#3a2c30' : '#f7f1ea';
    ctx.fillRect(cx - coreW / 2, cy - coreH / 2, coreW, coreH);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(cx - coreW / 2 + 0.5, cy - coreH / 2 + 0.5, coreW, coreH);
    const neffCopy = siphCopy().neff;
    label(ctx, neffCopy.core, cx, cy, pal, 12, 'center', 'middle');

    const caption = radiating ? neffCopy.radiating : neffCopy.tail;
    label(ctx, caption, cx, 16, pal, 12, 'center', 'middle');
    label(ctx, `neff = ${formatN(neff)}`, w - 12, h - 14, pal, 12, 'right', 'middle');
  }

  slider.addEventListener('input', () => {
    pause();
    want = false;
    setNeff(Number(slider.value), true);
  });

  for (const b of snaps) {
    b.addEventListener('click', () => {
      pause();
      want = false;
      setNeff(Number(b.dataset.snap), true);
    });
  }

  playBtn.addEventListener('click', () => {
    if (playing) {
      want = false;
      pause();
    } else {
      want = true;
      play();
    }
  });

  watchTheme(() => draw());
  const ro = new ResizeObserver(() => draw());
  ro.observe(stage);

  paintPlayButton(playBtn, false);
  setNeff(neff, false);

  bindVisibility(
    root,
    () => {
      if (want) play();
    },
    () => {
      if (playing) {
        playing = false;
        cancelAnimationFrame(raf);
        paintPlayButton(playBtn, false);
      }
    },
    () => want,
  );
}

function pct(n: number): number {
  return ((n - N0) / (N1 - N0)) * 100;
}

function formatN(n: number): string {
  const known: Array<[number, string]> = [
    [TE0.neff, TE0.neff.toFixed(6)],
    [TM0.neff, TM0.neff.toFixed(6)],
    [MODE3_NEFF, MODE3_NEFF.toFixed(6)],
  ];
  for (const [v, text] of known) {
    if (Math.abs(n - v) < 0.0008) return text;
  }
  return n.toFixed(3);
}

function describe(n: number): string {
  const copy = siphCopy().neff;
  if (n <= N_CLAD + 0.0008) return copy.atClad;
  if (Math.abs(n - MODE3_NEFF) < 0.003) return copy.atThird;
  if (Math.abs(n - TM0.neff) < 0.003) return copy.atTm;
  if (Math.abs(n - TE0.neff) < 0.003) return copy.atTe;
  return copy.between(n.toFixed(3));
}

function paintTail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  coreH: number,
  tailW: number,
  tailPx: number,
  pal: ReturnType<typeof readPalette>,
): void {
  const x = cx - tailW / 2;
  const steps = Math.max(8, Math.round(tailPx));
  for (const dir of [-1, 1]) {
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      const fade = Math.exp(-3.2 * u);
      ctx.fillStyle = fadeColor(fade, pal);
      const y = dir < 0 ? cy - coreH / 2 - (i + 1) * (tailPx / steps) : cy + coreH / 2 + i * (tailPx / steps);
      ctx.fillRect(x, y, tailW, tailPx / steps + 0.5);
    }
  }
}

function paintRipple(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  coreH: number,
  tailW: number,
  reach: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    const y0 = dir < 0 ? cy - coreH / 2 : cy + coreH / 2;
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      const y = y0 + dir * u * reach;
      const x = cx + Math.sin(u * Math.PI * 5) * (tailW * 0.28);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function fadeColor(fade: number, pal: ReturnType<typeof readPalette>): string {
  const t = Math.max(0, Math.min(1, fade));
  const r = Math.round(30 + 200 * t);
  const g = Math.round(80 + 110 * t);
  const b = Math.round(90 + 20 * (1 - t));
  const a = 0.08 + 0.75 * t;
  void pal;
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
