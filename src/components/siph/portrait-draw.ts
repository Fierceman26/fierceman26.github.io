/**
 * One to-scale cross-section of the 500 nm × 220 nm strip.
 * Shared by the TE/TM portrait and the magnified end-face on the travel widget.
 */

import {
  type ModeId,
  type Palette,
  type ViewRect,
  CORE_HALF_H_UM,
  CORE_HALF_W_UM,
  dominantField,
  drawArrow,
  fieldPeak,
  label,
  renderHeatmap,
  strokeCore,
  worldToScreen,
} from './modes';

const SPOTS: Array<[number, number]> = [];
for (const x of [-0.36, -0.16, 0, 0.16, 0.36]) {
  for (const y of [-0.3, -0.13, 0, 0.13, 0.3]) {
    SPOTS.push([x, y]);
  }
}

export interface PanelOptions {
  dims: boolean;
  title: boolean;
  arrowScale: number;
}

const heatCache = new Map<string, HTMLCanvasElement>();

export function clearPortraitCache(): void {
  heatCache.clear();
}

export function paintPortrait(
  ctx: CanvasRenderingContext2D,
  view: ViewRect,
  mode: ModeId,
  phase: number,
  pal: Palette,
  opts: PanelOptions,
): void {
  const key = `${mode}:${Math.round(view.w)}x${Math.round(view.h)}:${view.x0}:${view.y0}`;
  let off = heatCache.get(key);
  if (!off) {
    off = renderHeatmap(mode, view.w, view.h, view);
    heatCache.set(key, off);
  }
  ctx.drawImage(off, view.x, view.y, view.w, view.h);
  const core = strokeCore(ctx, view, pal);
  drawFieldArrows(ctx, view, mode, phase, pal, opts.arrowScale);
  if (opts.title) drawTitle(ctx, view, mode, pal);
  if (opts.dims && view.w >= 168 && view.h >= 140) drawDimensions(ctx, view, pal);
  else if (view.w >= 120) {
    label(ctx, mode === 'te' ? 'Ex' : 'Ey', core.x + core.w + 6, core.y + core.h / 2, pal, 12, 'left', 'middle');
  }
  if (opts.title && view.w >= 200) {
    label(ctx, '氧化硅', view.x + 8, view.y + view.h - 10, pal, 11, 'left', 'bottom');
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, view: ViewRect, mode: ModeId, pal: Palette): void {
  const title = mode === 'te' ? 'TE0 · 准横电' : 'TM0 · 准横磁';
  const sub = mode === 'te' ? '主导电场 Ex，沿宽度' : '主导电场 Ey，沿厚度';
  label(ctx, title, view.x + 8, view.y + 14, pal, 13, 'left', 'middle');
  if (view.w > 210) label(ctx, sub, view.x + 8, view.y + 32, pal, 11, 'left', 'middle');
}

function drawDimensions(ctx: CanvasRenderingContext2D, view: ViewRect, pal: Palette): void {
  const left = worldToScreen(view, -CORE_HALF_W_UM, -0.4);
  const right = worldToScreen(view, CORE_HALF_W_UM, -0.4);
  if (left.y < view.y + view.h - 18) {
    dimension(ctx, left.x, left.y, right.x, right.y, '500 nm', pal, 'below');
  }

  const top = worldToScreen(view, 0.36, CORE_HALF_H_UM);
  const bot = worldToScreen(view, 0.36, -CORE_HALF_H_UM);
  const roomRight = view.x + view.w - top.x;
  if (roomRight > 58) dimension(ctx, top.x, top.y, bot.x, bot.y, '220 nm', pal, 'right');
  else if (top.x - view.x > 58) dimension(ctx, top.x, top.y, bot.x, bot.y, '220 nm', pal, 'left');
}

function dimension(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  text: string,
  pal: Palette,
  side: 'below' | 'right' | 'left',
): void {
  ctx.save();
  ctx.strokeStyle = pal.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (const [x, y] of [
    [x0, y0],
    [x1, y1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x - nx * 3.5, y - ny * 3.5);
    ctx.lineTo(x + nx * 3.5, y + ny * 3.5);
    ctx.stroke();
  }
  ctx.restore();
  if (side === 'below') label(ctx, text, (x0 + x1) / 2, y0 + 12, pal, 11, 'center', 'top');
  else if (side === 'left') label(ctx, text, x0 - 8, (y0 + y1) / 2, pal, 11, 'right', 'middle');
  else label(ctx, text, x0 + 8, (y0 + y1) / 2, pal, 11, 'left', 'middle');
}

function drawFieldArrows(
  ctx: CanvasRenderingContext2D,
  view: ViewRect,
  mode: ModeId,
  phase: number,
  pal: Palette,
  arrowScale: number,
): void {
  const peak = fieldPeak(mode);
  const cos = Math.cos(phase);
  const maxLen = Math.max(14, Math.min(30, view.w * 0.07)) * arrowScale;
  for (const [xUm, yUm] of SPOTS) {
    const amp = dominantField(mode, xUm, yUm) / peak;
    if (amp < 0.16) continue;
    const signed = amp * cos;
    const len = signed * maxLen;
    if (Math.abs(len) < 4) continue;
    const p = worldToScreen(view, xUm, yUm);
    const color = signed >= 0 ? pal.positive : pal.negative;
    if (mode === 'te') drawArrow(ctx, p.x, p.y, len, 0, color, pal.bg, 1.6);
    else drawArrow(ctx, p.x, p.y, 0, -len, color, pal.bg, 1.6);
  }
}
