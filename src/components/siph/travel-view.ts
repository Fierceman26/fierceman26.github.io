/**
 * A true-scale strip (so it is flat) plus the wave Re{E exp[j(ωt − βz)]}.
 * One clock drives both modes, so the higher-neff crest moves less per second.
 */

import {
  type ModeId,
  type Palette,
  type ViewRect,
  CORE_HALF_H_UM,
  CORE_HALF_W_UM,
  LAMBDA_UM,
  TE0,
  TM0,
  TRAVEL_LENGTH_UM,
  betaPerUm,
  bindVisibility,
  claim,
  clearCanvas,
  dominantField,
  fieldPeak,
  fitCanvas,
  guidedWavelengthNm,
  label,
  makeClock,
  paintPlayButton,
  phaseCss,
  phaseVelocityOverC,
  readPalette,
  reducedMotion,
  watchTheme,
} from './modes';
import { clearPortraitCache, paintPortrait } from './portrait-draw';
import { siphCopy } from './copy';

const L = TRAVEL_LENGTH_UM;
const WORLD = { x0: -0.55, x1: 0.55, y0: -0.5, y1: 0.5 };
const SHEAR_X = 0.62;
const SHEAR_Y = 0.48;

export function mountTravel(root: HTMLElement): void {
  if (!claim(root)) return;
  const canvas = root.querySelector('canvas');
  const stage = root.querySelector('[data-stage]');
  const live = root.querySelector('[data-live]');
  const playBtn = root.querySelector('[data-play]');
  const slider = root.querySelector('[data-phase]');
  const compareBtn = root.querySelector('[data-compare]');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  if (!(stage instanceof HTMLElement)) return;
  if (!(live instanceof HTMLElement)) return;
  if (!(playBtn instanceof HTMLButtonElement)) return;
  if (!(slider instanceof HTMLInputElement)) return;
  if (!(compareBtn instanceof HTMLButtonElement)) return;

  const modeButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  let mode: ModeId = 'te';
  let compare = true;
  let want = !reducedMotion();
  const clock = makeClock(4200);

  function render(phase: number): void {
    const w = stage.clientWidth;
    if (w < 8) return;
    const narrow = w < 680;
    const geom = measure(w, narrow);
    const ctx = fitCanvas(canvas, w, geom.h);
    if (!ctx) return;
    const pal = readPalette();
    clearCanvas(ctx, w, hSafe(geom.h), pal.bg);

    paintPortrait(ctx, geom.inset, mode, phase, pal, {
      dims: geom.inset.w >= 200,
      title: true,
      arrowScale: 0.9,
    });
    const mag = magnification(geom);
    label(
      ctx,
      siphCopy().travel.mag(mag.toFixed(0)),
      geom.inset.x + geom.inset.w - 8,
      geom.inset.y + geom.inset.h - 10,
      pal,
      11,
      'right',
      'bottom',
    );

    drawPrism(ctx, geom, mode, phase, pal);
    drawGraph(ctx, geom, mode, compare, phase, pal);
    const nose = geom.project(CORE_HALF_W_UM, 0, L);
  label(ctx, '+z', nose.x + 8, nose.y, pal, 12, 'left', 'middle');

    const text = liveText(mode, compare, mag);
    if (live.textContent !== text) live.textContent = text;
    const deg = Math.round(((phase * 180) / Math.PI) % 360);
    if (document.activeElement !== slider) slider.value = String(deg);
    compareBtn.setAttribute('aria-pressed', compare ? 'true' : 'false');
  }

  clock.onFrame(render);

  function syncModes(): void {
    for (const b of modeButtons) {
      b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
    }
  }

  for (const b of modeButtons) {
    b.addEventListener('click', () => {
      const next = b.dataset.mode;
      if (next === 'te' || next === 'tm') {
        mode = next;
        syncModes();
        render(clock.phase);
      }
    });
  }

  compareBtn.addEventListener('click', () => {
    compare = !compare;
    render(clock.phase);
  });

  slider.addEventListener('input', () => {
    clock.setPhase((Number(slider.value) * Math.PI) / 180);
  });
  slider.addEventListener('pointerdown', () => {
    clock.pause();
  });
  slider.addEventListener('pointerup', () => {
    if (want) {
      clock.play();
      paintPlayButton(playBtn, true);
    }
  });

  playBtn.addEventListener('click', () => {
    if (clock.playing) {
      want = false;
      clock.pause();
    } else {
      want = true;
      clock.play();
    }
    paintPlayButton(playBtn, clock.playing);
  });

  watchTheme(() => {
    clearPortraitCache();
    render(clock.phase);
  });
  const ro = new ResizeObserver(() => {
    clearPortraitCache();
    render(clock.phase);
  });
  ro.observe(stage);

  syncModes();
  paintPlayButton(playBtn, false);
  compareBtn.setAttribute('aria-pressed', 'true');
  render(0);

  bindVisibility(
    root,
    () => {
      if (want && !clock.playing) {
        clock.play();
        paintPlayButton(playBtn, true);
      }
    },
    () => {
      if (clock.playing) {
        clock.pause();
        paintPlayButton(playBtn, false);
      }
    },
    () => want,
  );
}

interface Geom {
  h: number;
  inset: ViewRect;
  originX: number;
  originY: number;
  umToPx: number;
  graphTop: number;
  graphH: number;
  zToX: (z: number) => number;
  project: (x: number, y: number, z: number) => { x: number; y: number };
}

function hSafe(h: number): number {
  return h;
}

function measure(w: number, narrow: boolean): Geom {
  const aspect = (WORLD.x1 - WORLD.x0) / (WORLD.y1 - WORLD.y0);
  if (narrow) {
    const insetH = clamp(w / aspect, 230, 320);
    const prismH = 132;
    const graphH = 236;
    const h = 8 + insetH + 6 + prismH + 4 + graphH + 8;
    const inset = fitInset(8, 8, w - 16, insetH);
    const prismTop = 8 + insetH + 6;
    const rightX = 16;
    const rightW = w - 32;
    const umToPx = (rightW - 8) / (L + SHEAR_X * 0.55);
    const originX = rightX + 0.28 * umToPx * SHEAR_X;
    const originY = prismTop + prismH * 0.58;
    return {
      h,
      inset,
      originX,
      originY,
      umToPx,
      graphTop: prismTop + prismH + 4,
      graphH,
      zToX: (z) => originX + z * umToPx,
      project: (x, y, z) => ({
        x: originX + z * umToPx + x * umToPx * SHEAR_X,
        y: originY - y * umToPx + x * umToPx * SHEAR_Y,
      }),
    };
  }

  const h = 520;
  const insetW = Math.round(w * 0.36);
  const inset = fitInset(8, 10, insetW - 8, h - 20);
  const rightX = insetW + 18;
  const rightW = w - rightX - 14;
  const graphH = 248;
  const prismTop = 12;
  const prismH = h - graphH - 28;
  const umToPx = (rightW - 12) / (L + SHEAR_X * 0.55);
  const originX = rightX + 0.3 * umToPx * SHEAR_X;
  const originY = prismTop + prismH * 0.62;
  return {
    h,
    inset,
    originX,
    originY,
    umToPx,
    graphTop: h - graphH - 12,
    graphH,
    zToX: (z) => originX + z * umToPx,
    project: (x, y, z) => ({
      x: originX + z * umToPx + x * umToPx * SHEAR_X,
      y: originY - y * umToPx + x * umToPx * SHEAR_Y,
    }),
  };
}

function fitInset(x: number, y: number, pw: number, ph: number): ViewRect {
  const aspect = (WORLD.x1 - WORLD.x0) / (WORLD.y1 - WORLD.y0);
  let dw = pw;
  let dh = dw / aspect;
  if (dh > ph) {
    dh = ph;
    dw = dh * aspect;
  }
  return {
    x: x + (pw - dw) / 2,
    y: y + (ph - dh) / 2,
    w: dw,
    h: dh,
    ...WORLD,
  };
}

function magnification(geom: Geom): number {
  const insetPerUm = geom.inset.w / (geom.inset.x1 - geom.inset.x0);
  if (geom.umToPx < 1) return 1;
  return insetPerUm / geom.umToPx;
}

function drawPrism(
  ctx: CanvasRenderingContext2D,
  geom: Geom,
  mode: ModeId,
  phase: number,
  pal: Palette,
): void {
  const { project } = geom;
  const neff = mode === 'te' ? TE0.neff : TM0.neff;
  const beta = betaPerUm(neff);
  const n = 72;
  const peak = fieldPeak(mode);
  const endSign = Math.cos(phase);

  for (let i = 0; i < n; i++) {
    const z0 = (L * i) / n;
    const z1 = (L * (i + 1)) / n;
    const c = Math.cos(phase - beta * ((z0 + z1) / 2));
    fillPoly(ctx, [
      project(-CORE_HALF_W_UM, CORE_HALF_H_UM, z0),
      project(CORE_HALF_W_UM, CORE_HALF_H_UM, z0),
      project(CORE_HALF_W_UM, CORE_HALF_H_UM, z1),
      project(-CORE_HALF_W_UM, CORE_HALF_H_UM, z1),
    ], phaseCss(c, pal, 0));
    fillPoly(ctx, [
      project(CORE_HALF_W_UM, CORE_HALF_H_UM, z0),
      project(CORE_HALF_W_UM, -CORE_HALF_H_UM, z0),
      project(CORE_HALF_W_UM, -CORE_HALF_H_UM, z1),
      project(CORE_HALF_W_UM, CORE_HALF_H_UM, z1),
    ], phaseCss(c, pal, 0.18));
  }

  const bands = 8;
  for (let i = 0; i < bands; i++) {
    const y1 = CORE_HALF_H_UM - (2 * CORE_HALF_H_UM * i) / bands;
    const y0 = CORE_HALF_H_UM - (2 * CORE_HALF_H_UM * (i + 1)) / bands;
    const ym = (y0 + y1) / 2;
    const amp = dominantField(mode, 0, ym) / peak;
    fillPoly(ctx, [
      project(-CORE_HALF_W_UM, y1, 0),
      project(CORE_HALF_W_UM, y1, 0),
      project(CORE_HALF_W_UM, y0, 0),
      project(-CORE_HALF_W_UM, y0, 0),
    ], phaseCss(endSign * Math.max(0.25, amp), pal, 0.05));
  }

  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.1;
  strokeLoop(ctx, [
    project(-CORE_HALF_W_UM, CORE_HALF_H_UM, 0),
    project(CORE_HALF_W_UM, CORE_HALF_H_UM, 0),
    project(CORE_HALF_W_UM, CORE_HALF_H_UM, L),
    project(-CORE_HALF_W_UM, CORE_HALF_H_UM, L),
  ]);
  strokeLoop(ctx, [
    project(CORE_HALF_W_UM, CORE_HALF_H_UM, 0),
    project(CORE_HALF_W_UM, -CORE_HALF_H_UM, 0),
    project(CORE_HALF_W_UM, -CORE_HALF_H_UM, L),
    project(CORE_HALF_W_UM, CORE_HALF_H_UM, L),
  ]);
  strokeLoop(ctx, [
    project(-CORE_HALF_W_UM, CORE_HALF_H_UM, 0),
    project(CORE_HALF_W_UM, CORE_HALF_H_UM, 0),
    project(CORE_HALF_W_UM, -CORE_HALF_H_UM, 0),
    project(-CORE_HALF_W_UM, -CORE_HALF_H_UM, 0),
  ]);
  ctx.restore();

  const crest = crestZ(phase, beta);
  if (crest !== null) {
    const p = project(0, CORE_HALF_H_UM, crest);
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 11);
    ctx.lineTo(p.x - 4, p.y - 4);
    ctx.lineTo(p.x + 4, p.y - 4);
    ctx.closePath();
    ctx.fill();
  }

  label(ctx, siphCopy().travel.strip, geom.originX, geom.originY - geom.umToPx * 0.42 - 14, pal, 12, 'left', 'bottom');
}

function crestZ(phase: number, beta: number): number | null {
  let z = phase / beta;
  const period = (2 * Math.PI) / beta;
  while (z > L) z -= period;
  while (z < 0) z += period;
  if (z < 0 || z > L) return null;
  return z;
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  geom: Geom,
  mode: ModeId,
  compare: boolean,
  phase: number,
  pal: Palette,
): void {
  const top = geom.graphTop;
  const mid = top + geom.graphH * 0.34;
  const amp = Math.min(36, geom.graphH * 0.15);
  const primary = mode === 'te' ? TE0 : TM0;
  const secondary = mode === 'te' ? TM0 : TE0;
  const primaryColor = mode === 'te' ? pal.positive : pal.negative;
  const secondaryColor = mode === 'te' ? pal.negative : pal.positive;

  ctx.save();
  ctx.strokeStyle = pal.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(geom.zToX(0), mid);
  ctx.lineTo(geom.zToX(L), mid);
  ctx.stroke();
  ctx.restore();

  for (let z = 0; z <= L + 1e-6; z += 1) {
    const x = geom.zToX(Math.min(z, L));
    ctx.strokeStyle = pal.faint;
    ctx.beginPath();
    ctx.moveTo(x, mid - 3);
    ctx.lineTo(x, mid + 3);
    ctx.stroke();
    const align: CanvasTextAlign = z === 0 ? 'left' : z >= 3 ? 'right' : 'center';
    label(ctx, z === 0 ? '0' : `${z} µm`, x, mid - amp - 6, pal, 10, align, 'bottom');
  }

  if (compare) {
    strokeWave(ctx, geom, mid, amp, phase, secondary.neff, secondaryColor, true);
  }
  fillWave(ctx, geom, mid, amp, phase, primary.neff, primaryColor);
  strokeWave(ctx, geom, mid, amp, phase, primary.neff, primaryColor, false);

  const y0 = mid + amp + 28;
  bracket(ctx, geom, y0, primary.neff, primaryColor, `${primary.name}  λg ${Math.round(guidedWavelengthNm(primary.neff))} nm`, pal);
  if (compare) {
    bracket(
      ctx,
      geom,
      y0 + 20,
      secondary.neff,
      secondaryColor,
      `${secondary.name}  λg ${Math.round(guidedWavelengthNm(secondary.neff))} nm`,
      pal,
    );
  }
  bracket(ctx, geom, y0 + (compare ? 40 : 20), 1, pal.muted, 'λ0  1550 nm', pal);

  label(
    ctx,
    siphCopy().travel.axis,
    geom.zToX(0),
    top + 12,
    pal,
    11,
    'left',
    'middle',
  );
}

function strokeWave(
  ctx: CanvasRenderingContext2D,
  geom: Geom,
  mid: number,
  amp: number,
  phase: number,
  neff: number,
  color: string,
  dashed: boolean,
): void {
  const beta = betaPerUm(neff);
  ctx.save();
  ctx.beginPath();
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    const z = (L * i) / steps;
    const y = mid - Math.cos(phase - beta * z) * amp;
    const x = geom.zToX(z);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = dashed ? 1.25 : 2;
  ctx.setLineDash(dashed ? [4, 4] : []);
  ctx.stroke();
  ctx.restore();
}

function fillWave(
  ctx: CanvasRenderingContext2D,
  geom: Geom,
  mid: number,
  amp: number,
  phase: number,
  neff: number,
  color: string,
): void {
  const beta = betaPerUm(neff);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(geom.zToX(0), mid);
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    const z = (L * i) / steps;
    ctx.lineTo(geom.zToX(z), mid - Math.cos(phase - beta * z) * amp);
  }
  ctx.lineTo(geom.zToX(L), mid);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.fill();
  ctx.restore();
}

function bracket(
  ctx: CanvasRenderingContext2D,
  geom: Geom,
  y: number,
  neff: number,
  color: string,
  text: string,
  pal: Palette,
): void {
  const z1 = Math.min(L - 0.02, LAMBDA_UM / neff);
  const x0 = geom.zToX(0);
  const x1 = geom.zToX(z1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.moveTo(x0, y - 3);
  ctx.lineTo(x0, y + 3);
  ctx.moveTo(x1, y - 3);
  ctx.lineTo(x1, y + 3);
  ctx.stroke();
  ctx.restore();
  label(ctx, text, x1 + 6, y, pal, 11, 'left', 'middle');
}

function strokeLoop(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();
}

function liveText(mode: ModeId, compare: boolean, mag: number): string {
  const a = mode === 'te' ? TE0 : TM0;
  const b = mode === 'te' ? TM0 : TE0;
  const lg = Math.round(guidedWavelengthNm(a.neff));
  const vp = phaseVelocityOverC(a.neff).toFixed(3);
  const travel = siphCopy().travel;
  const head = travel.head(a.name, a.neff.toFixed(4), lg, vp, mag.toFixed(0));
  if (!compare) return head;
  const lg2 = Math.round(guidedWavelengthNm(b.neff));
  const vp2 = phaseVelocityOverC(b.neff).toFixed(3);
  return `${head} ${travel.compareTail(b.name, lg2, vp2)}`;
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
