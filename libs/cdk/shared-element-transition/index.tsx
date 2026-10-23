// Ported from react-spectrum packages/react-aria-components/src/SharedElementTransition.tsx, Apache-2.0, © Adobe.
// `SharedElementTransition` is a scope of named snapshots; a `SharedElement` that stops being visible (or
// unmounts) stores its rect and the computed values of its `transition-property` properties there, and the
// next instance of the same name that becomes visible starts from them (translate = rect delta, other
// properties = previous computed values), so CSS transitions animate it from the old place to the new one.
// Rivet:
// - React's layout effect (cleanup snapshots, setup consumes, microtask decides exiting) → one effect per
//   element on `isVisible` plus a per-scope microtask that runs snapshots, then consumers, then the
//   "was my snapshot consumed?" checks. Bindings update synchronously, so that order holds whichever
//   element's effect ran first; React gets it from running every cleanup before every setup.
// - Resumed pages: nothing runs before the first change of `isVisible`.
// - Render props are accessors (`isEntering()`, `isExiting()`), read inside bindings (Rivet convention);
//   `class` / `style` / `children` may be functions of them. No `render` prop (RAC DOMRenderProps).
// - Server: no effect; the element renders without `data-entering` / `data-exiting`.
import { effect, onCleanup, signal, untrack, useContext } from "@rivetjs/reactivity";
import { Show, ref } from "@rivetjs/runtime/dom";
import type { Content, Slot } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";

import { SharedElementContext, type SharedElementScope } from "./transition.tsx";

export { SharedElementContext, SharedElementTransition, type SharedElementScope, type SharedElementTransitionProps, type Snapshot } from "./transition.tsx";

export interface SharedElementRenderProps {
  /**
   * Whether the element is currently entering.
   *
   * @selector [data-entering]
   */
  isEntering: () => boolean;
  /**
   * Whether the element is currently exiting.
   *
   * @selector [data-exiting]
   */
  isExiting: () => boolean;
}

type StyleObject = Record<string, string | number | undefined>;

export interface SharedElementPropsBase extends GlobalDOMAttributes<HTMLDivElement> {
  id?: string;
  /** Class name, or a function of the render props (called inside a binding). */
  class?: string | ((values: SharedElementRenderProps) => string | undefined);
  /** Inline style, or a function of the render props (called inside a binding). */
  style?: StyleObject | ((values: SharedElementRenderProps) => StyleObject | undefined);
  /** Content; a function gets the render props. */
  children?: Content | Slot<[SharedElementRenderProps]>;
}

export interface SharedElementProps extends SharedElementPropsBase {
  name: string;
  /** @default true — a boolean or an accessor (a signal) for a changing value. */
  isVisible?: boolean | (() => boolean);
}

type State = "visible" | "hidden" | "entering" | "exiting";

// Per-scope work of one flush, run in one microtask: snapshots, then consumers, then exit checks.
const queues = new WeakMap<SharedElementScope, (() => void)[][]>();
function schedule(scope: SharedElementScope, phase: 0 | 1 | 2, task: () => void) {
  let queue = queues.get(scope);
  if (!queue) {
    queues.set(scope, (queue = [[], [], []]));
    queueMicrotask(() => {
      queues.delete(scope);
      for (const tasks of queue!) for (const run of tasks) run();
    });
  }
  queue[phase]!.push(task);
}

const styleOf = (element: HTMLElement) => element.style as unknown as Record<string, string>;

/** On hide / unmount: the rect and computed values of the transitioning properties (RAC effect cleanup). */
function takeSnapshot(scope: SharedElementScope, name: string, element: HTMLElement | undefined) {
  if (element && element.isConnected && !element.hasAttribute("data-exiting")) {
    const style = getComputedStyle(element);
    if (style.transitionProperty !== "none") {
      const transitionProperty = style.transitionProperty.split(/\s*,\s*/);
      scope[name] = {
        rect: element.getBoundingClientRect(),
        style: transitionProperty.map((p) => [p, (style as unknown as Record<string, string>)[p]!]),
      };
    }
  }
}

/**
 * An element that animates between its old and new position when moving between parents.
 */
export function SharedElement(props: SharedElementProps) {
  const scope = useContext(SharedElementContext);
  if (!scope) {
    throw new Error("<SharedElement> must be rendered inside a <SharedElementTransition>");
  }
  const { name, isVisible = true, children, class: className, style } = props;
  const dom = globalDOMProps(props);
  const idProp = props.id;
  const visible = typeof isVisible === "function" ? isVisible : () => isVisible;
  const client = typeof requestAnimationFrame === "function";
  const state = signal<State>(untrack(visible) ? "visible" : "hidden");
  const element = ref<HTMLDivElement>();
  const values: SharedElementRenderProps = {
    isEntering: () => client && state() === "entering",
    isExiting: () => client && state() === "exiting",
  };

  if (client) {
    let previous: boolean | undefined;
    let frame: number | null = null;
    // Runs of the effect: a task queued by an earlier run (React: its captured element) does nothing.
    let run = 0;
    effect(() => {
      const isShown = visible();
      untrack(() => {
        const current = ++run;
        const before = previous;
        previous = isShown;
        if (frame != null) (cancelAnimationFrame(frame), (frame = null));
        const rendered = state() !== "hidden";
        if (isShown && !rendered) state.set("visible");
        // The previous run's cleanup: snapshot the element it rendered (none while hidden).
        if (before !== undefined && rendered) schedule(scope, 0, () => takeSnapshot(scope, name, element()));
        if (isShown)
          schedule(scope, 1, () => {
            if (current !== run) return;
            const el = element();
            const prevSnapshot = scope[name];
            if (el && prevSnapshot) {
              // Element is transitioning from a previous instance.
              state.set("visible");
              const animations = el.getAnimations();
              const elStyle = styleOf(el);
              // Set properties to animate from.
              const restore = prevSnapshot.style.map(([property, prevValue]) => {
                const value = elStyle[property]!;
                if (property === "translate") {
                  const prevRect = prevSnapshot.rect;
                  const currentItem = el.getBoundingClientRect();
                  const deltaX = prevRect.left - currentItem.left;
                  const deltaY = prevRect.top - currentItem.top;
                  el.style.translate = `${deltaX}px ${deltaY}px`;
                } else {
                  elStyle[property] = prevValue;
                }
                return [property, value] as const;
              });
              // Cancel any new animations triggered by these properties.
              for (const a of el.getAnimations()) {
                if (!animations.includes(a)) a.cancel();
              }
              // Remove overrides after one frame to animate to the current values.
              frame = requestAnimationFrame(() => {
                frame = null;
                for (const [property, value] of restore) elStyle[property] = value;
              });
              delete scope[name];
            } else if (el && !prevSnapshot) {
              // No previous instance exists, apply the entering state.
              state.set("entering");
              frame = requestAnimationFrame(() => {
                frame = null;
                state.set("visible");
              });
            }
          });
        else
          schedule(scope, 2, () => {
            if (current !== run) return;
            const el = element();
            if (!el) return;
            // After every consumer ran: a snapshot still there was not taken by a new instance, so exit.
            if (scope[name]) {
              delete scope[name];
              state.set("exiting");
              Promise.all(el.getAnimations().map((a) => a.finished))
                .then(() => !visible() && state() === "exiting" && state.set("hidden"))
                .catch(() => {});
            } else {
              // Snapshot was consumed by another instance, unmount.
              state.set("hidden");
            }
          });
      });
    });
    // Unmount: store a snapshot for the instance that replaces this one.
    onCleanup(() => {
      if (frame != null) cancelAnimationFrame(frame);
      takeSnapshot(scope, name, untrack(element));
    });
  }

  // Keyed by an object per instance: a re-created (resumed) region builds its own element instead of
  // adopting the server one, whose bindings belong to the server render.
  const instance = {};
  return (
    <Show when={() => (visible() || (client && state() !== "hidden")) && instance} keyed>
      {() => (
        <div
          {...dom}
          id={idProp}
          ref={element}
          class={typeof className === "function" ? className(values) : className}
          style={typeof style === "function" ? style(values) : style}
          data-entering={values.isEntering() ? "true" : undefined}
          data-exiting={values.isExiting() ? "true" : undefined}
        >
          {renderSlot(children, values)}
        </div>
      )}
    </Show>
  );
}
