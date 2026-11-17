import {
  type ModeId,
  type ViewRect,
  bindVisibility,
  claim,
  clearCanvas,
  fitCanvas,
  makeClock,
  paintPlayButton,
  readPalette,
  reducedMotion,
  watchTheme,
} from './modes';
import { clearPortraitCache, paintPortrait } from './portrait-draw';
import { siphCopy } from './copy';

const WORLD = { x0: -0.52, x1: 0.52, y0: -0.48, y1: 0.48 };

type Choice = ModeId | 'both';

export function mountPortrait(root: HTMLElement): void {
  if (!claim(root)) return;
  const canvas = root.querySelector('canvas');
  const stage = root.querySelector('[data-stage]');
  const live = root.querySelector('[data-live]');
  const playBtn = root.querySelector('[data-play]');
  const slider = root.querySelector('[data-phase]');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  if (!(stage instanceof HTMLElement)) return;
  if (!(live instanceof HTMLElement)) return;
  if (!(playBtn instanceof HTMLButtonElement)) return;
  if (!(slider instanceof HTMLInputElement)) return;

  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  let choice: Choice = 'te';
  let want = !reducedMotion();
  const clock = makeClock(3600);

  const copy = siphCopy().portrait;

  function render(phase: number): void {
    const w = stage.clientWidth;
    if (w < 8) return;
    const narrow = w < 620;
    const both = choice === 'both';
    const aspect = (WORLD.x1 - WORLD.x0) / (WORLD.y1 - WORLD.y0);
    let h: number;
    if (!both) h = clamp(w / aspect, 280, 460);
    else if (narrow) h = clamp(w / aspect, 260, 420) * 2 + 22;
    else h = clamp(w / 2 / aspect, 260, 400);

    const ctx = fitCanvas(canvas, w, h);
    if (!ctx) return;
    const pal = readPalette();
    clearCanvas(ctx, w, h, pal.bg);

    const panels = layoutPanels(w, h, choice, narrow);
    for (const panel of panels) {
      paintPortrait(ctx, panel.view, panel.mode, phase, pal, {
        dims: !both || !narrow,
        title: true,
        arrowScale: both ? 0.92 : 1,
      });
    }

    const text = choice === 'te'
      ? copy.te
      : choice === 'tm'
        ? copy.tm
        : (narrow ? copy.bothNarrow : copy.bothWide);
    if (live.textContent !== text) live.textContent = text;
    const deg = Math.round(((phase * 180) / Math.PI) % 360);
    if (document.activeElement !== slider) slider.value = String(deg);
  }

  clock.onFrame(render);

  function syncButtons(): void {
    for (const b of buttons) {
      b.setAttribute('aria-pressed', b.dataset.mode === choice ? 'true' : 'false');
    }
  }

  for (const b of buttons) {
    b.addEventListener('click', () => {
      const next = b.dataset.mode;
      if (next === 'te' || next === 'tm' || next === 'both') {
        choice = next;
        clearPortraitCache();
        syncButtons();
        render(clock.phase);
      }
    });
  }

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

  syncButtons();
  paintPlayButton(playBtn, false);
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

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function layoutPanels(
  w: number,
  h: number,
  choice: Choice,
  narrow: boolean,
): Array<{ mode: ModeId; view: ViewRect }> {
  const aspect = (WORLD.x1 - WORLD.x0) / (WORLD.y1 - WORLD.y0);
  const make = (mode: ModeId, x: number, y: number, pw: number, ph: number): { mode: ModeId; view: ViewRect } => {
    let dw = pw;
    let dh = dw / aspect;
    if (dh > ph) {
      dh = ph;
      dw = dh * aspect;
    }
    return {
      mode,
      view: {
        x: x + (pw - dw) / 2,
        y: y + (ph - dh) / 2,
        w: dw,
        h: dh,
        ...WORLD,
      },
    };
  };

  if (choice !== 'both') return [make(choice, 0, 0, w, h)];
  if (narrow) {
    const gap = 18;
    const ph = (h - gap) / 2;
    return [make('te', 0, 0, w, ph), make('tm', 0, ph + gap, w, ph)];
  }
  const gap = 12;
  const pw = (w - gap) / 2;
  return [make('te', 0, 0, pw, h), make('tm', pw + gap, 0, pw, h)];
}
