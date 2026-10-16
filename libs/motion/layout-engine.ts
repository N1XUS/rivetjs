// `@rivetjs/motion/layout` browser parts (`.ts`: DOM globals): `layoutDriver` (a WAAPI `FlipDriver` over `motion/mini`
// `animate`: compositor `transform`, px `width` / `height`), `animateLayout` (Motion's vanilla signature on the shared
// FLIP core `@rivetjs/cdk/flip`) and the shared-element (`layoutId`) hook of the Motion elements.
import { animate } from "motion/mini";
import { batch, _activating, _settle } from "@rivetjs/reactivity";
import { captureBoxes, playFlip, stopFlip, type Box, type FlipDriver, type FlipItem } from "@rivetjs/cdk/flip";
import { reducedActive, type AnimateResult } from "./engine.ts";
import { layoutHook } from "./layout-hook.ts";
import type { ReducedPolicy } from "./css.ts";
import type { Transition } from "./values.ts";

/** Default layout transition (Motion's layout default feel: a short ease-out). */
const DEFAULT: Transition = { duration: 0.3, ease: [0.33, 1, 0.68, 1] };

interface Controls {
  stop(): void;
  then(resolve: () => void, reject?: (e: unknown) => void): unknown;
}

/** A WAAPI FLIP driver: each moved element animates its inverted `transform` (+ size) back on `motion/mini`. */
export function layoutDriver(transition?: Transition): FlipDriver {
  const { delayChildren: _d, staggerChildren: _s, ...options } = { ...DEFAULT, ...transition };
  return {
    play(run) {
      const started: Controls[] = [];
      for (const m of run.items) {
        const frames: Record<string, string[]> = {
          transform: [`translate(${m.dx}px, ${m.dy}px)${m.base ? " " + m.base : ""}`, m.base || "none"],
        };
        if (m.resize) {
          frames.width = [m.from.width + "px", m.to.width + "px"];
          frames.height = [m.from.height + "px", m.to.height + "px"];
        }
        started.push(animate(m.el, frames as never, options as never) as unknown as Controls);
      }
      let live = true;
      void Promise.all(started.map((c) => new Promise<void>((resolve) => void c.then(resolve, () => resolve())))).then(() => live && run.done());
      return () => {
        live = false;
        for (const c of started) c.stop();
      };
    },
  };
}

/** An element, a `ref()` of any element type (an accessor), or none (the document body). */
type Scope = Element | (() => Element | null | undefined) | null | undefined;
const typeOf = (el: Element) => el.getAttribute("data-layout") ?? "true";
/** Limit a move to `type`: `"position"` keeps the size, `"size"` keeps the position. */
const limit = (type: string, from: Box, to: Box): Box =>
  type === "position" ? { ...from, width: to.width, height: to.height } : type === "size" ? { ...from, x: to.x, y: to.y } : from;

/** Whether the FLIP core plays `m` (it skips moves under half a pixel). */
const moves = (m: FlipItem): boolean =>
  Math.abs(m.from.x - m.to.x) >= 0.5 ||
  Math.abs(m.from.y - m.to.y) >= 0.5 ||
  Math.abs(m.from.width - m.to.width) > 0.5 ||
  Math.abs(m.from.height - m.to.height) > 0.5;
// Bindings a resumed page activated and still loads chunks for (dom-resume `_activating`): `loading` settles once the
// last one ran or failed; null when none is pending.
let pendingCount = 0,
  loaded = (): void => {},
  loading: Promise<void> | null = null;
_activating.start = () => {
  if (!pendingCount++) loading = new Promise<void>((resolve) => (loaded = resolve));
  return () => {
    if (!--pendingCount) {
      loading = null;
      loaded();
    }
  };
};
/** The longest an update waits for pending activations before it measures anyway. */
const LOAD_CAP = 2000;
// A call's pending measure per scope root (waiting for a resumed page's re-creation): a later call on the root cancels it.
const waiting = new WeakMap<Element, () => void>();

/**
 * Motion's `animateLayout(scope?, update, transition?)`: the `[data-layout]` elements in `scope` (default the
 * document body; Motion elements with `layout`) animate from their boxes before `update` to the ones after it.
 * `update` runs in a reactivity batch; the new boxes are read once after it flushed (a microtask). Reduced motion
 * per element (its `reducedMotion` or MotionConfig's; default `"user"` = `prefersReducedMotion`) applies the update
 * to it without animation. On a resumed page, an update whose region re-creation waits for chunks (the first
 * interaction: nothing moved yet) is measured again once that re-creation ran (at most 2 s); an element it rendered again
 * takes the box of the server element with its `id`.
 */
export function animateLayout(scope: Scope, update: () => void, transition?: Transition): Promise<AnimateResult> {
  const root = ((typeof scope === "function" ? scope() : scope) ?? document.body) as HTMLElement;
  waiting.get(root)?.();
  const els = [...root.querySelectorAll<HTMLElement>("[data-layout]")];
  if (root.hasAttribute("data-layout")) els.push(root);
  // Each element's policy (its own `reducedMotion` / MotionConfig's, `data-layout-reduced`; default "user"): a reduced
  // element jumps to its new box.
  const moving = els.filter((el) => !reducedActive((el.getAttribute("data-layout-reduced") ?? "user") as ReducedPolicy));
  const before = captureBoxes(moving, root);
  batch(update);
  return new Promise((resolve) =>
    queueMicrotask(() => {
      // The update's effects (a deferred first-click flush included) land before the read.
      _settle();
      let done!: () => void;
      const finished = new Promise<void>((r) => (done = r));
      let stop = (): void => {};
      const measure = (): FlipItem[] => {
        const now = moving.filter((el) => el.isConnected);
        // Re-created by a resumed region (rows that read signals render again): the server element's box by `id`.
        if (now.length < moving.length) {
          const ids = new Map(moving.filter((el) => el.id && !el.isConnected).map((el) => [el.id, el]));
          if (ids.size)
            for (const el of root.querySelectorAll<HTMLElement>("[data-layout][id]")) {
              const old = ids.get(el.id);
              if (old && !before.has(el)) (before.set(el, before.get(old)!), now.push(el));
            }
        }
        const items: FlipItem[] = [];
        for (const [el, to] of captureBoxes(now, root)) items.push({ el, from: limit(typeOf(el), before.get(el)!, to), to });
        return items;
      };
      const play = (items: FlipItem[]): void => {
        waiting.delete(root);
        const driver = layoutDriver(transition);
        stop = playFlip(root, items, {
          driver: {
            play: (run) => driver.play({ ...run, done: () => (run.done(), done()) }),
          },
        });
        // Nothing moved (the core plays nothing, so no driver run ends): settled at once.
        if (!root.isConnected || !items.some(moves)) done();
      };
      // Measured a microtask later (state a re-created region's content applies in a microtask, e.g. a Motion element
      // created while its presence leaves setting `data-exiting`, lands first). When nothing moved or was replaced yet
      // and a resumed page still loads chunks for activated bindings (the first interaction re-creating the region),
      // measured again once they ran (at most `LOAD_CAP`). A later call on the root cancels a waiting one.
      let live = true;
      const cancel = (): void => {
        live = false;
        if (waiting.get(root) === cancel) waiting.delete(root);
        done();
      };
      waiting.set(root, cancel);
      stop = cancel;
      void Promise.resolve().then(() => {
        if (!live) return;
        stopFlip(root);
        const items = measure();
        const wait = loading;
        if (wait === null || items.some(moves) || moving.some((el) => !el.isConnected)) return play(items);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const later = (): void => {
          clearTimeout(timer);
          if (!live || waiting.get(root) !== cancel) return;
          stopFlip(root);
          play(measure());
        };
        timer = setTimeout(later, LOAD_CAP);
        void wait.then(later);
      });
      resolve({
        finished,
        stop: () => {
          stop();
          done();
        },
      });
    }),
  );
}

const viewport = (r: DOMRect): Box => ({ x: r.left, y: r.top, width: r.width, height: r.height });

// Boxes of shared elements removed this frame (sibling branches: the old one may go before its replacement exists).
const gone = new Map<string, DOMRect>();
/** Shared elements: the last connected element with the id (the one a new element replaces), its box now. */
layoutHook.from = (id) => {
  const list = document.querySelectorAll(`[data-layout-id="${CSS.escape(id)}"]`);
  const el = list[list.length - 1];
  return el ? el.getBoundingClientRect() : gone.get(id);
};
layoutHook.gone = (id, el) => {
  if (!el?.isConnected) return;
  if (!gone.size) requestAnimationFrame(() => gone.clear());
  gone.set(id, el.getBoundingClientRect());
};
/** After mount: FLIP from the replaced element's box (viewport coordinates) to this element's. */
layoutHook.play = (el, from, type, transition, reduced) => {
  if (!el.isConnected || reducedActive(reduced)) return;
  const to = viewport(el.getBoundingClientRect());
  playFlip(el as HTMLElement, [{ el: el as HTMLElement, from: limit(type, viewport(from), to), to }], { driver: layoutDriver(transition) });
};

/** Keeps this module (and its hook registration) in bundles that use `LayoutGroup`. */
export const layoutReady = (): boolean => layoutHook.play !== undefined;
