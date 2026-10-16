// Browser half of HeroGlow.tsx (a .ts module: not server-rewritten). Soft brand blobs that drift and
// breathe on a tiny canvas (1/8 of the box, scaled up by the browser's image smoothing), 24 fps,
// paused off screen and in hidden tabs, one static frame under prefers-reduced-motion. Colours,
// alphas, centres and the canvas composite come from CSS custom properties on the glow element, so
// themes / layouts tune them in CSS (apps/docs/src/home.css):
//   --glow-colors: "#262cfa 0.16, #5b00f8 0.10, #01eef9 0.07"   (6-digit hex + alpha per blob)
//   --glow-points: "0.62 0.46, 0.80 0.30, 0.44 0.70"            (blob centres, fractions of the box)
//   --glow-composite: source-over | lighter

/** Frame scheduling (injectable for tests). */
export interface GlowClock {
  request: (fn: (time: number) => void) => number;
  cancel: (id: number) => void;
}

/**
 * The animation loop without the DOM: draws at most `fps` frames per second while running; `reduced`
 * draws one static frame and never schedules. `setVisible(false)` (off screen) or `setHidden(true)`
 * (tab hidden) cancels the pending frame; becoming visible again resumes without a time jump.
 */
export function createGlowLoop(draw: (seconds: number) => void, clock: GlowClock, options: { reduced: boolean; fps?: number }) {
  const step = 1000 / (options.fps ?? 30);
  let frame = 0;
  let visible = true;
  let hidden = false;
  let disposed = false;
  let last = -Infinity;
  /** Animation time (ms) excluding paused stretches. */
  let elapsed = 0;
  let resumedAt: number | undefined;
  const running = () => !options.reduced && visible && !hidden && !disposed;
  const tick = (time: number) => {
    frame = 0;
    if (!running()) return;
    if (resumedAt === undefined) resumedAt = time - elapsed;
    if (time - last >= step - 1) {
      last = time;
      elapsed = time - resumedAt;
      draw(elapsed / 1000);
    }
    frame = clock.request(tick);
  };
  const update = () => {
    if (running()) {
      if (!frame) frame = clock.request(tick);
    } else if (frame) {
      clock.cancel(frame);
      frame = 0;
      resumedAt = undefined;
    }
  };
  return {
    start() {
      if (options.reduced) draw(0);
      update();
    },
    setVisible(value: boolean) {
      visible = value;
      update();
    },
    setHidden(value: boolean) {
      hidden = value;
      update();
    },
    dispose() {
      disposed = true;
      update();
    },
    /** For tests: a frame is scheduled. */
    get scheduled() {
      return frame !== 0;
    },
  };
}

interface Blob {
  /** `r, g, b` of the colour: stops fade to the same colour at alpha 0 (no grey fringe). */
  rgb: string;
  alpha: number;
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

/** Blob geometry at time `t` (s): slow Lissajous drift, breathing radius, gentle squash = morph. ~30 s feel. */
export function blobAt(i: number, t: number, base: { x: number; y: number }) {
  const p = i * 1.7 + 0.4;
  return {
    x: base.x + 0.07 * Math.sin((TAU * t) / (29 + i * 4) + p),
    y: base.y + 0.06 * Math.sin((TAU * t) / (23 + i * 3) + p * 1.3),
    r: 0.44 * (1 + 0.12 * Math.sin((TAU * t) / (19 + i * 5) + p * 0.7)),
    squash: 1 + 0.18 * Math.sin((TAU * t) / (31 + i * 2) + p * 2.1),
    turn: 0.35 * Math.sin((TAU * t) / (37 + i * 6) + p),
  };
}

function readBlobs(el: Element): { blobs: Blob[]; composite: GlobalCompositeOperation } {
  const style = getComputedStyle(el);
  const unquote = (v: string) => v.trim().replace(/^["']|["']$/g, "");
  const colors = unquote(style.getPropertyValue("--glow-colors")).split(",");
  const points = unquote(style.getPropertyValue("--glow-points")).split(",");
  const blobs = colors.flatMap((entry, i) => {
    const [color, alpha] = entry.trim().split(/\s+/);
    const [x, y] = (points[i] ?? "0.5 0.5").trim().split(/\s+/).map(Number);
    const hex = /^#([0-9a-f]{6})$/i.exec(color ?? "")?.[1];
    if (!hex) return [];
    const rgb = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(", ");
    return [{ rgb, alpha: Number(alpha ?? 0.1), x: x ?? 0.5, y: y ?? 0.5 }];
  });
  const composite = (unquote(style.getPropertyValue("--glow-composite")) || "source-over") as GlobalCompositeOperation;
  return { blobs, composite };
}

/** Starts the glow on `root` (holding a `canvas`); returns the cleanup. */
export function mountGlow(root: HTMLElement): () => void {
  const canvas = root.querySelector("canvas");
  const ctx = canvas?.getContext("2d", { alpha: true });
  if (!canvas || !ctx) return () => {};
  const scale = 1 / 8;
  let { blobs, composite } = readBlobs(root);
  let w = 1;
  let h = 1;
  const size = () => {
    w = Math.max(8, Math.round(root.clientWidth * scale));
    h = Math.max(8, Math.round(root.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  let shown = false;
  const draw = (t: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = composite;
    const side = Math.min(w, h);
    blobs.forEach((blob, i) => {
      const b = blobAt(i, t, blob);
      const r = b.r * side;
      ctx.setTransform(b.squash, 0, 0, 1 / b.squash, b.x * w, b.y * h);
      ctx.rotate(b.turn);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      ctx.globalAlpha = blob.alpha;
      g.addColorStop(0, `rgba(${blob.rgb}, 1)`);
      g.addColorStop(1, `rgba(${blob.rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    });
    ctx.globalAlpha = 1;
    if (!shown) {
      shown = true;
      root.setAttribute("data-live", "");
    }
  };
  size();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Wake once per frame budget (timer, then rAF to paint in step with the display), not on every vsync.
  const fps = 24;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let raf = 0;
  const clock: GlowClock = {
    request(fn) {
      timer = setTimeout(
        () => {
          timer = undefined;
          raf = requestAnimationFrame(fn);
        },
        1000 / fps - 6,
      );
      return 1;
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      cancelAnimationFrame(raf);
      timer = undefined;
    },
  };
  const loop = createGlowLoop(draw, clock, { reduced, fps });
  const resize = new ResizeObserver(() => {
    size();
    if (reduced) draw(0);
  });
  resize.observe(root);
  const seen = new IntersectionObserver((entries) => loop.setVisible(entries.some((e) => e.isIntersecting)));
  seen.observe(root);
  const onVisibility = () => loop.setHidden(document.visibilityState === "hidden");
  document.addEventListener("visibilitychange", onVisibility);
  onVisibility();
  const theme = new MutationObserver(() => {
    ({ blobs, composite } = readBlobs(root));
    if (reduced) draw(0);
  });
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  loop.start();
  return () => {
    loop.dispose();
    resize.disconnect();
    seen.disconnect();
    theme.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
