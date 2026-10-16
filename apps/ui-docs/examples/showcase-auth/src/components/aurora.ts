// Rivet-authored showcase piece: the aurora canvas engine (plain DOM code, browser only; called from a clientEffect).

/**
 * One blob = an elliptical radial gradient. Position, size and strength follow two slow sines each
 * (periods 15–40 s), offset so every curve starts at 0: the first frame equals the blob's rest pose.
 * `x` / `y` = centre, `rx` / `ry` = radius as a fraction of the panel, `fade` = blob joins after load, at that peak strength.
 */
type Blob = {
  color: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  stops: [number, number][];
  move: [ax: number, px: number, ay: number, py: number, phase: number];
  fade?: number;
};

// Blobs 0 and 1 are the panel's CSS gradient (`.aurora` in styles.css), drawn the same way at rest.
const CSS_STOPS: [number, number][] = [
  [0, 1],
  [0.6, 0],
];
const SOFT_STOPS: [number, number][] = [
  [0, 0.9],
  [0.3, 0.55],
  [0.65, 0.16],
  [1, 0],
];
const BLOBS: Blob[] = [
  { color: 1, x: 0.1, y: 0.1, rx: 1.2, ry: 0.9, stops: CSS_STOPS, move: [0.14, 31, 0.1, 23, 0.4] },
  { color: 2, x: 0.9, y: 0.9, rx: 0.9, ry: 0.8, stops: CSS_STOPS, move: [0.12, 27, 0.14, 37, 2.1] },
  { color: 3, x: 0.78, y: 0.28, rx: 0.6, ry: 0.5, stops: SOFT_STOPS, move: [0.2, 19, 0.16, 29, 4.2], fade: 0.75 },
  { color: 4, x: 0.28, y: 0.78, rx: 0.55, ry: 0.42, stops: SOFT_STOPS, move: [0.22, 23, 0.12, 17, 1.3], fade: 0.55 },
  { color: 5, x: 0.48, y: 0.42, rx: 0.42, ry: 0.4, stops: SOFT_STOPS, move: [0.24, 37, 0.2, 33, 5.6], fade: 0.4 },
  { color: 1, x: 0.18, y: 0.55, rx: 0.4, ry: 0.36, stops: SOFT_STOPS, move: [0.16, 29, 0.22, 21, 3.3], fade: 0.6 },
];
const TAU = Math.PI * 2;
/** Internal resolution per CSS pixel: the blobs are soft, so half the (capped) device ratio is enough. */
const SCALE = 0.5;
const MAX_DPR = 1.5;
/** Seconds the extra blobs take to join, from the CSS gradient's two to all six. */
const FADE_IN = 6;

/** Draws the panel and keeps it moving while it is on screen; returns the cleanup. */
export function startAurora(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return () => {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const dark = matchMedia("(prefers-color-scheme: dark)");
  // Palette from the CSS custom properties (light / dark in styles.css), resolved to rgb once per theme.
  let base = "#000";
  let rgb: string[] = [];
  const readPalette = () => {
    const style = getComputedStyle(canvas);
    const probe = new OffscreenCanvas(1, 1).getContext("2d", { willReadFrequently: true })!;
    const resolve = (name: string) => {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = style.getPropertyValue(name).trim() || "#000";
      probe.fillRect(0, 0, 1, 1);
      const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
      return `${r},${g},${b}`;
    };
    base = `rgb(${resolve("--aurora-base")})`;
    rgb = [0, 1, 2, 3, 4, 5].map((i) => resolve(`--aurora-${i}`));
  };

  let width = 0;
  let height = 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let onScreen = false;
  let shown = false;

  const draw = (t: number, joined: number) => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // `screen` lightens where blobs meet without blowing out to white the way `lighter` does.
    ctx.globalCompositeOperation = "screen";
    // Back to front: the CSS paints its first gradient on top, so the canvas draws it last.
    for (let i = BLOBS.length - 1; i >= 0; i--) {
      const blob = BLOBS[i];
      const strength = blob.fade ? blob.fade * joined : 1;
      if (strength <= 0) continue;
      const [ax, px, ay, py, phase] = blob.move;
      const x = blob.x + ax * (Math.sin((TAU * t) / px + phase) - Math.sin(phase));
      const y = blob.y + ay * (Math.sin((TAU * t) / py + phase * 1.7) - Math.sin(phase * 1.7));
      const breathe = 1 + 0.08 * (Math.sin((TAU * t) / (px + py) + phase) - Math.sin(phase));
      const color = rgb[blob.color];
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [at, alpha] of blob.stops) gradient.addColorStop(at, `rgba(${color},${alpha * strength})`);
      // Unit circle scaled into the ellipse; only its bounding box is filled.
      const end = blob.stops[blob.stops.length - 1][0];
      ctx.setTransform(blob.rx * breathe * w, 0, 0, blob.ry * breathe * h, x * w, y * h);
      ctx.fillStyle = gradient;
      ctx.fillRect(-end, -end, end * 2, end * 2);
    }
    if (!shown) {
      shown = true;
      // The canvas fades in over the identical CSS gradient: no flash when it takes over.
      canvas.style.opacity = "1";
    }
  };

  const ease = (t: number) => {
    const k = Math.min(1, t / FADE_IN);
    return k * k * (3 - 2 * k);
  };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // At most ~60 draws a second on faster displays; the motion is slow, more frames add nothing.
    if (now - last < 15) return;
    time += Math.min(now - last, 100) / 1000;
    last = now;
    draw(time, ease(time));
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const update = () => {
    if (!width || !height) return stop();
    if (reduce.matches) {
      // One still frame, every blob in.
      stop();
      return draw(time, 1);
    }
    if (!onScreen || document.hidden) return stop();
    if (!raf) {
      last = performance.now();
      draw(time, ease(time));
      raf = requestAnimationFrame(frame);
    }
  };
  const redraw = () => {
    readPalette();
    if (!raf && width && height) draw(time, reduce.matches ? 1 : ease(time));
  };

  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    const ratio = Math.min(devicePixelRatio || 1, MAX_DPR) * SCALE;
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    if (width && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
      // Resizing clears the bitmap: paint it again even while paused.
      if (raf) draw(time, ease(time));
      else if (shown || reduce.matches) draw(time, reduce.matches ? 1 : ease(time));
    }
    update();
  });
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    update();
  });
  const theme = new MutationObserver(redraw);

  readPalette();
  resize.observe(canvas);
  visibility.observe(canvas);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
  document.addEventListener("visibilitychange", update);
  reduce.addEventListener("change", update);
  dark.addEventListener("change", redraw);

  return () => {
    stop();
    resize.disconnect();
    visibility.disconnect();
    theme.disconnect();
    document.removeEventListener("visibilitychange", update);
    reduce.removeEventListener("change", update);
    dark.removeEventListener("change", redraw);
  };
}
