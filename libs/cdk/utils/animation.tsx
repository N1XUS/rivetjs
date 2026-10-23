// Ported from packages/react-aria/src/utils/animation.ts (useEnterAnimation, useExitAnimation), Apache-2.0, © Adobe.
// Rivet:
// - Names: `useEnterAnimation` → `createEnterAnimation`, `useExitAnimation` → `createExitAnimation` (no `use*` exports).
// - `.tsx` (no JSX): `.ts` modules are not server-rewritten, and this one calls `clientEffect`.
// - React state → signals; both hooks return an accessor (`isEntering()` / `isExiting()`) that bindings
//   read (`data-entering={dataBool(isEntering())}`); `ref` is a `ref()` (or any element accessor),
//   `isReady` / `isOpen` a value or an accessor.
// - `useLayoutEffect` → `clientEffect` (runs in the microtask after the element mounted, before paint).
// - `useEffectEvent(onStart)` → the callback is read untracked when the animation starts; pass a wrapper
//   (`(el) => props.onEnter?.(el)`) to always call the latest one.
// - `flushSync(onEnd)` → a plain signal write (bindings update synchronously).
// - `useExitAnimation`'s render-phase `setExitState` → a computed holding the state machine.
// Deviation: an overlay rendered open by the server is not entering — React Aria never server-renders overlays,
// Rivet does, and its HTML is the settled open state. Created in the browser (incl. the first open after resume
// of an overlay the server rendered closed) → entering.
// Deviation: with no running animation and the element not yet carrying its `data-entering` / `data-exiting`
// attribute (a resumed page commits that binding after the effect), the end waits a microtask for the CSS
// animation the attribute starts; with the attribute present it ends at once (RA).
import { computed, signal, untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { chain } from "../interactions/merge-props.tsx";
import { setStyle } from "./dom.ts";

/** An element accessor: a `ref()` from `@rivetjs/runtime/dom`, or a function returning the element. */
export type AnimationRef = () => HTMLElement | null | undefined;
type MaybeAccessor<T> = T | (() => T);
const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

/** Whether this element is being created in the browser (not server-rendered). */
const createdInBrowser = (): boolean => typeof document !== "undefined";

/**
 * Entry animation state of `ref` (react-aria `useEnterAnimation`): true from creation until the element's
 * running CSS animations / transitions and the promise `onEnter` returns have finished. While `isReady`
 * is false the element is hidden with non-layout styles and the animation waits (popovers before placement).
 */
export function createEnterAnimation(
  ref: AnimationRef,
  isReady: MaybeAccessor<boolean> = true,
  onEnter?: (element: HTMLElement) => void | Promise<void>,
): () => boolean {
  const isEntering = signal(createdInBrowser());
  const isAnimationReady = () => isEntering() && read(isReady);

  // Hide the element while it prepares for entry, using only non-layout-thrashing attributes.
  // This prevents accidental flashes of content in scenarios where no hidden styling is applied
  // while the enter animation is not yet ready (e.g. popovers prior to placement calculation).
  clientEffect(() => {
    const element = ref();
    if (!read(isReady) && element) {
      return chain(
        setStyle(element, "opacity", "0"),
        setStyle(element, "clip", "rect(0 0 0 0)"),
        setStyle(element, "clip-path", "inset(50%)"),
        setStyle(element, "mask-image", "linear-gradient(#0000, #0000)"),
      );
    }
  });

  // There are two cases for entry animations:
  // 1. CSS @keyframes. The `animation` property is set during the isEntering state, and it is removed after the animation finishes.
  // 2. CSS transitions. The initial styles are applied during the isEntering state, and removed immediately, causing the transition to occur.
  //
  // In the second case, cancel any transitions that were triggered prior to the isEntering = false state (when the transition is supposed to start).
  // This can happen when isReady starts as false (e.g. popovers prior to placement calculation).
  clientEffect(() => {
    const element = ref();
    if (isAnimationReady() && element && "getAnimations" in element) {
      for (const animation of element.getAnimations()) {
        if (typeof CSSTransition !== "undefined" && animation instanceof CSSTransition) animation.cancel();
      }
    }
  });

  // Object literal value, not an inline argument: the effect captures it, so it must be resumable (R2).
  const done = { end: () => isEntering.set(false) };
  useAnimation(ref, isAnimationReady, onEnter, done.end, "data-entering");
  return isAnimationReady;
}

/**
 * Exit animation state of `ref` (react-aria `useExitAnimation`): true from the moment `isOpen` turns false
 * until the element's running animations and the promise `onExit` returns have finished — keep the element
 * mounted while it is true. Reopening interrupts the exit.
 */
export function createExitAnimation(ref: AnimationRef, isOpen: MaybeAccessor<boolean>, onExit?: (element: HTMLElement) => void | Promise<void>): () => boolean {
  const exit = createExitAnimationState(isOpen);
  watchExitAnimation(ref, exit, onExit);
  return exit.isExiting;
}

/** The state half of {@link createExitAnimation}: `isExiting` + `end` (no client effect). */
export interface ExitAnimationState {
  /** True while exiting (keep the element mounted). */
  readonly isExiting: () => boolean;
  /** Ends the running exit (closes the state machine). */
  readonly end: () => void;
}

/**
 * Rivet: {@link createExitAnimation} without its client effect — create the state where the open / exiting
 * condition is read, call {@link watchExitAnimation} where the element exists (inside the branch that stays
 * mounted while exiting). A closed overlay then records no client effect, so a resumed page with closed
 * tooltips does not boot the runtime at load.
 */
export function createExitAnimationState(isOpen: MaybeAccessor<boolean>): ExitAnimationState {
  let exitState: "closed" | "open" | "exiting" = untrack(() => read(isOpen)) ? "open" : "closed";
  // Each finished exit bumps `ended`; the state machine below closes on it.
  const ended = signal(0);
  let seen = 0;
  const isExiting = computed(() => {
    const open = read(isOpen);
    const end = ended();
    if (end !== seen) {
      seen = end;
      // Set the state to closed, which will cause the element to be unmounted.
      if (exitState === "exiting") exitState = "closed";
    }
    switch (exitState) {
      case "open":
        // If isOpen becomes false, set the state to exiting.
        if (!open) exitState = "exiting";
        break;
      case "closed":
      case "exiting":
        // If we are exiting and isOpen becomes true, the animation was interrupted.
        // Reset the state to open.
        if (open) exitState = "open";
        break;
    }
    return exitState === "exiting";
  });
  return { isExiting, end: () => ended.update((n) => n + 1) };
}

/** The effect half of {@link createExitAnimation}: waits for the exit animations of `ref`, then `exit.end()`. */
export function watchExitAnimation(ref: AnimationRef, exit: ExitAnimationState, onExit?: (element: HTMLElement) => void | Promise<void>): void {
  useAnimation(ref, exit.isExiting, onExit, exit.end, "data-exiting");
}

function useAnimation(
  ref: AnimationRef,
  isActive: () => boolean,
  onStart: ((element: HTMLElement) => void | Promise<void>) | undefined,
  onEnd: () => void,
  /** The state attribute the element's binding writes (`data-entering` / `data-exiting`). */
  attribute: string,
): void {
  let wasActive: boolean | null = null;
  clientEffect(() => {
    const active = isActive();
    const element = ref();
    if (active && element && wasActive !== active) {
      wasActive = active;
      const start = (): void => {
        if (!("getAnimations" in element)) {
          // JSDOM
          onEnd();
          return;
        }

        const startPromise = onStart?.(element);

        const animations = running(element);
        if (animations.length === 0 && !startPromise && element.hasAttribute(attribute)) {
          onEnd();
          return;
        }
        if (animations.length === 0 && !startPromise) {
          // Deviation: on a resumed page the element's state binding (`data-entering` / `data-exiting`) can
          // commit after this effect, so the CSS animation it starts is not running yet: look again after
          // the pending bindings (a microtask; RA's layout effect always runs after the commit) before ending.
          queueMicrotask(() => {
            const wait = (): void => {
              const later = element.isConnected ? running(element) : [];
              if (later.length === 0) onEnd();
              // Cancelled (moved into the portal host): wait for the restarted ones.
              else Promise.all(later.map((a) => a.finished)).then(onEnd, wait);
            };
            wait();
          });
          return;
        }

        // Deviation: RA swallows a rejected `finished` (cancelled animation) and never ends. A Rivet overlay is
        // moved into its portal host right after mount, which restarts its CSS animation (the first one is
        // cancelled): then wait for the animations running at that point, while the element is in the document.
        // (`finished` is read at once: a cancelled animation's next `finished` is a new pending promise.)
        // Deviation: a rejected start promise (a user `onEnter` / `onExit`) ends the animation and reports the error
        // (RA ends nothing: with held exit fills below, the overlay would stay mounted, invisible, its underlay and
        // focus containment active).
        let ended = false;
        const end = (): void => {
          if (!ended) {
            ended = true;
            onEnd();
          }
        };
        Promise.resolve(startPromise).catch((error: unknown) => {
          end();
          (globalThis.reportError ?? console.error)(error);
        });
        // Deviation (Rivet `onEnter` / `onExit` promise, e.g. a nested `@rivetjs/motion` exit in cdk Modal): when the
        // promise outlives the element's own CSS animations, they hold their end state instead of snapping the element
        // back to its open styles until the unmount (a backdrop flashed opaque while a longer Motion exit ran).
        const hold = (list: Animation[]): void => {
          if (startPromise) for (const a of list) if ("animationName" in a) a.effect?.updateTiming({ fill: "forwards" });
        };
        hold(animations);
        const settle = (finished: unknown[]): void => {
          Promise.all(finished).then(end, () => {
            if (!ended && element.isConnected) {
              const later = running(element);
              hold(later);
              settle([startPromise, ...later.map((a) => a.finished)]);
            }
          });
        };
        if (!startPromise) settle(animations.map((a) => a.finished));
        else
          // A CSS animation the state binding starts after this effect (a resumed page re-creating the region on its
          // first interaction, e.g. dismissing a server-open modal) is held and awaited too: collect a microtask later.
          queueMicrotask(() => {
            const all = element.isConnected ? running(element) : [];
            for (const a of animations) if (!all.includes(a)) all.push(a);
            hold(all);
            settle([startPromise, ...all.map((a) => a.finished)]);
          });
      };
      // Deviation: an overlay's portal host is moved into its mount by the Portal's own client effect, queued after
      // this one (the overlay's state is created before its `<Overlay>`). Moving re-inserts the element: a CSS
      // transition keyed on `data-entering` (drawer / sheet backdrops) needs its entering style computed in the final
      // position, else ending here leaves no before-change style and the element snaps to its open state. So the enter
      // starts a microtask later, after the mount's queued effects (RA's layout effect runs after the commit, with the
      // portal content already in place). Exit animations start in place (nothing moves; nested `@rivetjs/motion`
      // exits are collected by the overlay's presence scope after the close's bindings ran, cdk Modal).
      if (attribute === "data-entering") queueMicrotask(() => untrack(start));
      else untrack(start);
      return;
    }

    wasActive = active;
  });
}

/** The element's running document-timeline animations (RA's filter). */
function running(element: HTMLElement): Animation[] {
  return element
    .getAnimations()
    .filter((a) => (typeof DocumentTimeline === "undefined" || a.timeline instanceof DocumentTimeline) && a.playState === "running");
}
