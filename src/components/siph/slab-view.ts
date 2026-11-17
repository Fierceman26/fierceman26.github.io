/**
 * Thick-slab rays collapsing to a 220 nm film.
 * The thick slab is deliberately exaggerated. At the thin end the core
 * and the λ0 bar share one scale.
 */

import {
  LAMBDA_UM,
  bindVisibility,
  claim,
  clearCanvas,
  fitCanvas,
  label,
  makeClock,
  paintPlayButton,
  readPalette,
  reducedMotion,
  smoothstep,
  watchTheme,
} from './modes';
import { siphCopy } from './copy';

const THIN_UM = 0.22;

export function mountSlab(root: HTMLElement): void {
  if (!claim(root)) return;
  const canvas = root.querySelector('canvas');
  const stage = root.querySelector('[data-stage]');
  const live = root.querySelector('[data-live]');
  const playBtn = root.querySelector('[data-play]');
  const slider = root.querySelector('[data-thick]');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  if (!(stage instanceof HTMLElement)) return;
  if (!(live instanceof HTMLElement)) return;
  if (!(playBtn instanceof HTMLButtonElement)) return;
  if (!(slider instanceof HTMLInputElement)) return;

  let s = reducedMotion() ? 1 : 0;
  let dotU = 0.18;
  let want = !reducedMotion();
  let lastW = -1;
  const clock = makeClock(1000);

  const story = (dt: number) => {
    if (s < 1) s = Math.min(1, s + dt / 8000);
    else {
      want = false;
      clock.pause();
      paintPlayButton(playBtn, false);
    }
    dotU = (dotU + dt / 2600) % 1;
    if (document.activeElement !== slider) slider.value = String(Math.round(s * 1000));
  };

  let lastNow = 0;
  clock.onFrame(() => {
    const now = performance.now();
    const dt = lastNow ? Math.min(48, now - lastNow) : 16;
    lastNow = now;
    story(dt);
    draw();
  });

  function sentence(): string {
    const slab = siphCopy().slab;
    if (s < 0.45) return slab.thick;
    if (s < 0.82) return slab.mid;
    return slab.thin;
  }

  function draw(): void {
    const w = stage.clientWidth;
    if (w < 8) return;
    const h = w < 560 ? 340 : 380;
    if (Math.abs(w - lastW) > 0.5) lastW = w;
    const ctx = fitCanvas(canvas, w, h);
    if (!ctx) return;
    const pal = readPalette();
    clearCanvas(ctx, w, h, pal.bg);

    const padL = 22;
    const padR = 16;
    const top = 36;
    const bottom = 86;
    const midY = top + (h - top - bottom) * 0.46;
    const span = w - padL - padR;
    const lambdaPx = Math.min(span * 0.5, 230);
    const pxPerUm = lambdaPx / LAMBDA_UM;
    const thinHalf = (THIN_UM / 2) * pxPerUm;
    const thickHalf = Math.min((h - top - bottom) * 0.36, lambdaPx * 0.78);
    const half = thickHalf + (thinHalf - thickHalf) * s;

    ctx.fillStyle = pal.dark ? '#14161b' : '#f3efe6';
    ctx.fillRect(padL, top, span, h - top - bottom + 8);

    const rayA = 1 - smoothstep(0.4, 0.74, s);
    const fieldA = smoothstep(0.48, 0.84, s);

    if (fieldA > 0.02) paintBand(ctx, padL, span, midY, half, fieldA, pal);

    ctx.fillStyle = pal.dark ? '#3a2c30' : '#f6efe8';
    ctx.fillRect(padL, midY - half, span, half * 2);
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(padL + 0.5, midY - half + 0.5, span - 1, half * 2 - 1);

    const slab = siphCopy().slab;
    if (half > 28 && s < 0.75) {
      label(ctx, slab.silicon, padL + span / 2, midY, pal, 13, 'center', 'middle');
    }
    label(ctx, slab.oxide, padL + 8, top + 12, pal, 12, 'left', 'middle');

    if (rayA > 0.03) {
      const path = rayPath(padL + 6, padL + span - 6, midY, half);
      ctx.save();
      ctx.globalAlpha = rayA;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      const dot = pointAlong(path, want || clock.playing ? dotU : 0.22);
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      if (rayA > 0.45 && half > 36 && path.length > 2) {
        const hit = path[1];
        ctx.strokeStyle = pal.muted;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hit.x, hit.y);
        ctx.lineTo(hit.x, hit.y - Math.min(36, half * 0.45));
        ctx.stroke();
        ctx.setLineDash([]);
        label(ctx, siphCopy().slab.normal, hit.x + 8, Math.min(midY - 8, hit.y + 16), pal, 11, 'left', 'top');
      }
      ctx.restore();
    }

    const barY = h - 48;
    ctx.fillStyle = pal.ink;
    ctx.fillRect(padL, barY, lambdaPx, 7);
    ctx.fillStyle = pal.accent;
    const mark = lambdaPx * (THIN_UM / LAMBDA_UM);
    ctx.fillRect(padL, barY - 5, Math.max(2, mark), 17);
    label(ctx, 'λ0 = 1550 nm', padL + lambdaPx / 2, barY + 18, pal, 12, 'center', 'top');
    label(ctx, '220 nm', padL + mark + 4, barY - 8, pal, 11, 'left', 'bottom');

    const scaleNote = s > 0.9 ? siphCopy().slab.scaleTrue : siphCopy().slab.scaleExaggerated;
    label(ctx, scaleNote, w - padR, top + 12, pal, 11, 'right', 'middle');

    if (live.textContent !== sentence()) live.textContent = sentence();
  }

  function paintBand(
    ctx: CanvasRenderingContext2D,
    x: number,
    span: number,
    midY: number,
    half: number,
    alpha: number,
    pal: ReturnType<typeof readPalette>,
  ): void {
    const reach = half * 2.6;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = midY - half - reach; y <= midY + half + reach; y += 2) {
      const ad = Math.abs(y - midY);
      let env: number;
      if (ad <= half) env = Math.cos(((Math.PI / 2) * ad) / half * 0.45);
      else env = Math.cos((Math.PI / 2) * 0.45) * Math.exp(-(ad - half) / (half * 1.15));
      const t = Math.pow(Math.max(0, env), 1.4);
      const g = Math.round(40 + 150 * t);
      const r = Math.round(30 + 190 * t);
      const b = Math.round(70 + 40 * (1 - t));
      ctx.fillStyle = `rgba(${r},${g},${b},${0.15 + 0.8 * t})`;
      void pal;
      ctx.fillRect(x, y, span, 2);
    }
    ctx.restore();
  }

  slider.addEventListener('input', () => {
    s = Number(slider.value) / 1000;
    if (s < 0.999) {
      /* keep the story resumable from here */
    }
    draw();
  });

  let scrubbing = false;
  slider.addEventListener('pointerdown', () => {
    scrubbing = true;
    clock.pause();
  });
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    if (want && s < 1) {
      lastNow = 0;
      clock.play();
      paintPlayButton(playBtn, true);
    }
  };
  slider.addEventListener('pointerup', endScrub);
  slider.addEventListener('pointercancel', endScrub);

  playBtn.addEventListener('click', () => {
    if (clock.playing) {
      want = false;
      clock.pause();
    } else {
      if (s >= 0.999) {
        s = 0;
        dotU = 0;
      }
      want = true;
      lastNow = 0;
      clock.play();
    }
    paintPlayButton(playBtn, clock.playing);
  });

  watchTheme(() => draw());
  const ro = new ResizeObserver(() => draw());
  ro.observe(stage);

  paintPlayButton(playBtn, false);
  slider.value = String(Math.round(s * 1000));
  draw();

  bindVisibility(
    root,
    () => {
      if (want && s < 1) {
        lastNow = 0;
        clock.play();
        paintPlayButton(playBtn, true);
      }
    },
    () => {
      clock.pause();
      if (want && s < 1) paintPlayButton(playBtn, false);
    },
    () => want && s < 1,
  );
}

interface Pt {
  x: number;
  y: number;
}

function rayPath(left: number, right: number, midY: number, half: number): Pt[] {
  const inset = Math.max(5, Math.min(half * 0.16, 16));
  const yTop = midY - half + inset;
  const yBot = midY + half - inset;
  if (yBot - yTop < 8) {
    return [
      { x: left, y: midY },
      { x: right, y: midY },
    ];
  }
  const angle = 0.78;
  const pts: Pt[] = [{ x: left, y: midY }];
  let x = left;
  let y = midY;
  let dir = -1;
  for (let n = 0; n < 14 && x < right - 2; n++) {
    const yTarget = dir < 0 ? yTop : yBot;
    const step = Math.abs(yTarget - y) / Math.tan(angle);
    x = Math.min(right, x + step);
    y = y + dir * Math.tan(angle) * (x - pts[pts.length - 1].x);
    pts.push({ x, y: dir < 0 ? yTop : yBot });
    if (x >= right - 0.5) break;
    dir *= -1;
  }
  return pts;
}

function pointAlong(pts: Pt[], u: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(d);
    total += d;
  }
  let remain = (u % 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const d = seg[i - 1];
    if (remain <= d || i === pts.length - 1) {
      const t = d === 0 ? 0 : remain / d;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    remain -= d;
  }
  return pts[pts.length - 1];
}
