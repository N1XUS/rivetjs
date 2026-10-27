// Rivet-authored. Imported only after a touch/pen/no-hover tap grants permission. Sensor readings stay in this module.
const MAX = 25;
type Reading = { beta: number; gamma: number };
type Writer = (element: HTMLElement, x: number, y: number, opacity: number) => void;

/** Screen-relative deltas from the first reading; 25 degrees reaches either edge. */
export function holoOrientationPoint(reading: Reading, baseline: Reading, angle: number): [number, number] {
  const x = reading.gamma - baseline.gamma;
  // beta wraps at +/-180, including when a nearly upright device crosses that seam.
  const y = ((reading.beta - baseline.beta + 540) % 360) - 180;
  const rotation = ((angle % 360) + 360) % 360;
  const [dx, dy] = rotation === 90 ? [y, -x] : rotation === 270 ? [-y, x] : rotation === 180 ? [-x, -y] : [x, y];
  return [50 + Math.max(-1, Math.min(1, dx / MAX)) * 50, 50 + Math.max(-1, Math.min(1, dy / MAX)) * 50];
}

interface Card {
  element: HTMLElement;
  write: Writer;
  enabled: () => boolean;
  visible: boolean;
  running: boolean;
  baseline?: Reading;
  angle: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lastX: number;
  lastY: number;
  timer?: ReturnType<typeof setTimeout>;
}

const cards = new Set<Card>();
let observer: IntersectionObserver | undefined;
let motion: MediaQueryList;
let listening = false;
let frame = 0;

function pause(card: Card) {
  clearTimeout(card.timer);
  card.timer = undefined;
  card.running = false;
  if (card.baseline) {
    card.element.removeAttribute("data-active");
    card.write(card.element, 50, 50, 0);
    card.baseline = undefined;
  }
}

function remove(card: Card) {
  pause(card);
  observer?.unobserve(card.element);
  cards.delete(card);
  sync();
  if (!cards.size) {
    observer?.disconnect();
    observer = undefined;
    document.removeEventListener("visibilitychange", sync);
    motion.removeEventListener("change", sync);
  }
}

function sync() {
  let needed = false;
  for (const card of cards) {
    const running = card.visible && !document.hidden && !motion.matches && card.enabled();
    if (running && !card.running) {
      card.running = true;
      // No usable readings (including unsupported sensors): keep touch dragging, with no automatic retry.
      card.timer = setTimeout(() => remove(card), 1000);
    } else if (!running && card.running) pause(card);
    needed ||= running;
  }
  if (needed !== listening) {
    listening = needed;
    if (needed) window.addEventListener("deviceorientation", orient);
    else window.removeEventListener("deviceorientation", orient);
  }
  if (!needed && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

function paint() {
  frame = 0;
  let moving = false;
  for (const card of cards) {
    if (!card.running || !card.baseline) continue;
    // Low-pass once per frame, then quantize to 0.1 percentage points to suppress sensor shimmer.
    card.x += (card.targetX - card.x) * 0.2;
    card.y += (card.targetY - card.y) * 0.2;
    if (Math.abs(card.targetX - card.x) < 0.05) card.x = card.targetX;
    if (Math.abs(card.targetY - card.y) < 0.05) card.y = card.targetY;
    const x = Math.round(card.x * 10) / 10;
    const y = Math.round(card.y * 10) / 10;
    if (x !== card.lastX || y !== card.lastY) {
      card.lastX = x;
      card.lastY = y;
      card.element.setAttribute("data-active", "true");
      card.write(card.element, x, y, 1);
    }
    moving ||= card.x !== card.targetX || card.y !== card.targetY;
  }
  if (moving) frame = requestAnimationFrame(paint);
}

function orient(event: DeviceOrientationEvent) {
  if (event.beta == null || event.gamma == null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  sync();
  const reading = { beta: event.beta, gamma: event.gamma };
  const angle = window.screen.orientation?.angle ?? 0;
  for (const card of cards) {
    if (!card.running) continue;
    if (!card.baseline || card.angle !== angle) {
      card.baseline = reading;
      card.angle = angle;
      card.x = card.y = 50;
      card.lastX = card.lastY = NaN;
      clearTimeout(card.timer);
      card.timer = undefined;
    }
    [card.targetX, card.targetY] = holoOrientationPoint(reading, card.baseline, angle);
  }
  if (listening && !frame) frame = requestAnimationFrame(paint);
}

export function trackHoloOrientation(element: HTMLElement, write: Writer, enabled: () => boolean) {
  const card: Card = {
    element,
    write,
    enabled,
    visible: false,
    running: false,
    angle: 0,
    x: 50,
    y: 50,
    targetX: 50,
    targetY: 50,
    lastX: NaN,
    lastY: NaN,
  };
  if (!cards.size) {
    motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        for (const item of cards) if (item.element === entry.target) item.visible = entry.isIntersecting;
      }
      sync();
    });
  }
  cards.add(card);
  observer!.observe(element);
  return {
    active: () => card.running && !!card.baseline,
    dispose: () => {
      if (cards.has(card)) remove(card);
    },
  };
}
