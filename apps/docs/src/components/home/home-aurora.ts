// The auth showcase's drifting-gradient idea, using docs-kit's bounded animation clock.
import { createGlowLoop, blobAt } from "@rivetjs/docs-kit/components/hero-glow.ts";

/** Owns a decorative canvas, including visibility, pause and live reduced-motion changes. */
export function mountHomeAurora(root: HTMLElement): () => void {
  const canvas = root.querySelector("canvas")!;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const policy = { reduced: media.matches, fps: 24 };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  let visible = false;
  const colors = ["1,238,249", "38,44,250", "91,0,248", "248,39,245"];
  const points = [
    { x: 0.23, y: 0.35 },
    { x: 0.5, y: 0.42 },
    { x: 0.76, y: 0.3 },
    { x: 0.58, y: 0.66 },
  ];
  const draw = (time: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    points.forEach((point, index) => {
      const p = blobAt(index, time, point);
      const x = p.x * canvas.width,
        y = p.y * canvas.height;
      const radius = p.r * canvas.width * 0.8;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${colors[index]},${index === 1 ? 0.2 : 0.12})`);
      gradient.addColorStop(1, `rgba(${colors[index]},0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
  };
  const loop = createGlowLoop(
    draw,
    {
      request(callback) {
        timer = setTimeout(() => {
          timer = undefined;
          frame = requestAnimationFrame(callback);
        }, 35);
        return 1;
      },
      cancel() {
        if (timer !== undefined) clearTimeout(timer);
        cancelAnimationFrame(frame);
        timer = undefined;
      },
    },
    policy,
  );
  const sync = () => {
    policy.reduced = media.matches;
    const paused = root.hasAttribute("data-paused") || document.hidden || !visible;
    loop.setHidden(paused || policy.reduced);
    canvas.dataset.state = policy.reduced ? "still" : paused ? "paused" : "running";
    if (policy.reduced) draw(0);
  };
  const resize = new ResizeObserver(() => {
    const ratio = Math.min(devicePixelRatio || 1, 1.5) * 0.5;
    canvas.width = Math.max(1, Math.min(1000, Math.round(root.clientWidth * ratio)));
    canvas.height = Math.max(1, Math.min(750, Math.round(root.clientHeight * ratio)));
    draw(0);
    sync();
  });
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  const pause = new MutationObserver(sync);
  resize.observe(root);
  seen.observe(root);
  pause.observe(root, { attributes: true, attributeFilter: ["data-paused"] });
  document.addEventListener("visibilitychange", sync);
  media.addEventListener("change", sync);
  draw(0);
  sync();
  return () => {
    loop.dispose();
    resize.disconnect();
    seen.disconnect();
    pause.disconnect();
    document.removeEventListener("visibilitychange", sync);
    media.removeEventListener("change", sync);
  };
}
