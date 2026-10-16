// Rivet-authored (not a port): the shared FLIP core (extracted from `@rivetjs/cdk/masonry` in motion plan T11; used by
// masonry relayouts and `@rivetjs/motion/layout`). Elements that changed box start at the old one and travel to the new:
// - First: `captureBoxes` (one rect read per element, start-edge x relative to a container) or boxes the caller knows;
// - Last: the new boxes (callers with a pure geometry pass them, nothing read after the writes);
// - Invert + Play: per frame `transform: translate(…)` for moved elements, `width` / `height` px for resized ones; at
//   the end the overrides go away (or the item's `final` styles land) and the CSS layout stays.
// The default driver is the house motion (`../motion` Motion1D: embla's scroll body, the feel of carousels / sheets /
// sliders); a `FlipDriver` swaps it (a spring, WAAPI). Elements outside `viewport` before and after jump. A new
// `playFlip` on the same container during a running one stops it first (callers start from `animatingBoxes`); a
// container unmounted mid-animation stops on its next frame. Browser-only closures, never serialized.
import { Motion1D } from "../motion/Motion1D.ts";

/** A box: start-edge `x` (left in LTR, right in RTL), `y`, size; relative to a container. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlipItem {
  el: HTMLElement;
  from: Box;
  to: Box;
  /** The element's own `transform` the offset composes with (default: its inline `transform` at the start). */
  base?: string;
  /** Final inline styles (`transform` / `width` / `height`) at the end instead of the ones it had at the start. */
  final?: () => Readonly<Record<string, string>> | undefined;
}

/** A moved item as a driver sees it: the inverted offset (`dx` / `dy`, screen px), its `base` transform, `resize`. */
export interface FlipMove extends FlipItem {
  dx: number;
  dy: number;
  base: string;
  resize: boolean;
}

/** One running FLIP: `render(t)` writes every item at progress `t` (0 → 1, may overshoot); `done()` when settled. */
export interface FlipRun {
  items: readonly FlipMove[];
  render(t: number): void;
  done(): void;
}

/** Drives a FLIP's progress; returns `stop` (no write: the core commits the final boxes). */
export interface FlipDriver {
  play(run: FlipRun): () => void;
}

export interface FlipOptions {
  /** Visible band of the container (container y coordinates): items outside it before and after jump. */
  viewport?: readonly [number, number];
  /** Boxes are start-edge in RTL (x from the right). */
  rtl?: boolean;
  /** Default: `motion1dDriver()`. */
  driver?: FlipDriver;
}

interface Running {
  stop: () => void;
  els: HTMLElement[];
}
const running = new WeakMap<HTMLElement, Running>();

/** Whether FLIP animations run here: `motion !== false` and no `prefers-reduced-motion: reduce` (false on the server). */
export function flipAllowed(motion: unknown): boolean {
  if (motion === false || typeof window === "undefined") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const boxOf = (el: Element, g: DOMRect, rtl: boolean | undefined): Box => {
  const r = el.getBoundingClientRect();
  return { x: rtl ? g.right - r.right : r.left - g.left, y: r.top - g.top, width: r.width, height: r.height };
};

/** Read phase: the current (visual) boxes of `els` relative to `relativeTo`. */
export function captureBoxes(els: Iterable<HTMLElement>, relativeTo: HTMLElement, rtl?: boolean): Map<HTMLElement, Box> {
  const g = relativeTo.getBoundingClientRect();
  const boxes = new Map<HTMLElement, Box>();
  for (const el of els) boxes.set(el, boxOf(el, g, rtl));
  return boxes;
}

/** Visual boxes of the elements whose FLIP on `container` is still running (empty otherwise). */
export function animatingBoxes(container: HTMLElement, rtl?: boolean): Map<HTMLElement, Box> {
  const run = running.get(container);
  return run
    ? captureBoxes(
        run.els.filter((el) => el.isConnected),
        container,
        rtl,
      )
    : new Map();
}

/** Stops the FLIP running on `container` (its items take their final boxes). */
export function stopFlip(container: HTMLElement): void {
  running.get(container)?.stop();
}

/** House motion driver (Motion1D; `duration` in embla units, default 25; `friction` default 0.68). */
export function motion1dDriver(options?: { duration?: number; friction?: number }): FlipDriver {
  return {
    play(run) {
      const motion = Motion1D({
        value: 0,
        duration: options?.duration ?? 25,
        friction: options?.friction ?? 0.68,
        render: (v) => run.render(Math.min(1, v / 1000)),
        onSettle: () => run.done(),
      });
      motion.to(1000);
      return () => motion.stop();
    },
  };
}

/**
 * Write phase: animate `items` on `container` from `from` to `to`. Unchanged items (< 0.5 px) and items outside
 * `viewport` before and after are skipped. Returns `stop` (final boxes at once).
 */
export function playFlip(container: HTMLElement, items: Iterable<FlipItem>, options?: FlipOptions): () => void {
  running.get(container)?.stop();
  const viewport = options?.viewport;
  const visible = (r: Box) => !viewport || (r.y + r.height > viewport[0] && r.y < viewport[1]);
  const moves: (FlipMove & { width: string; height: string })[] = [];
  for (const item of items) {
    const { el, from, to } = item;
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    const resize = Math.abs(from.width - to.width) > 0.5 || Math.abs(from.height - to.height) > 0.5;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && !resize) continue;
    if (!visible(from) && !visible(to)) continue;
    const s = el.style;
    moves.push({ ...item, dx: options?.rtl ? -dx : dx, dy, resize, width: s.width, height: s.height, base: item.base ?? s.transform });
  }
  if (!moves.length) return () => {};
  let halt = (): void => {};
  const render = (t: number) => {
    // Unmounted mid-animation (no effect needed, so server-placed grids still boot nothing): stop, write nothing.
    if (!container.isConnected) {
      halt();
      if (running.get(container) === entry) running.delete(container);
      return;
    }
    for (const m of moves) {
      const s = m.el.style;
      const fin = t >= 1 && m.final ? m.final() : undefined;
      if (fin) {
        s.transform = fin.transform ?? "";
        s.width = fin.width ?? "";
        s.height = fin.height ?? "";
        continue;
      }
      // Elements placed by their own `transform`: the offset composes with it.
      s.transform = t >= 1 ? m.base : `translate(${m.dx * (1 - t)}px, ${m.dy * (1 - t)}px)${m.base ? " " + m.base : ""}`;
      if (m.resize) {
        if (t >= 1) {
          s.width = m.width;
          s.height = m.height;
        } else {
          s.width = `${m.from.width + (m.to.width - m.from.width) * t}px`;
          s.height = `${m.from.height + (m.to.height - m.from.height) * t}px`;
        }
      }
    }
  };
  const stop = () => {
    halt();
    render(1);
    if (running.get(container) === entry) running.delete(container);
  };
  const entry: Running = { stop, els: moves.map((m) => m.el) };
  render(0);
  running.set(container, entry);
  halt = (options?.driver ?? motion1dDriver()).play({ items: moves, render, done: stop });
  return stop;
}
