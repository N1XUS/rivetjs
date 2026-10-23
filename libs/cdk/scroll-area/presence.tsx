// Ported from @radix-ui/react-presence 1.1.11 (src/presence.tsx, src/use-state-machine.tsx), MIT, © 2022 WorkOS
// (https://github.com/radix-ui/primitives packages/react/presence; read from the published tarball's source map).
// Radix `Presence`: keeps a part mounted while its exit animation runs. State machine `mounted` / `unmountSuspended` /
// `unmounted`; `present` turning false unmounts at once unless the node's computed `animation-name` changed (an exit
// animation started: `unmountSuspended` until `animationend` / `animationcancel` of the current animation, which also
// sets `animation-fill-mode: forwards` for a frame so the last keyframe does not flash); no node → `ANIMATION_END`.
// Rivet:
// - `createPresence({ present, node })` returns the state signal; the part renders `<Show when={() => isPresent(state())}>`.
//   `node` is the part's element ref (Radix clones the child with its own ref); `present` is an object-literal accessor
//   (resumable: an argument arrow would not serialize).
// - React's ref callback (reads the computed style when the node attaches) + `[node]` layout effect = one `clientEffect`
//   over `node()`; the `[present]` layout effect = a `clientEffect` over `present()` whose body runs in a microtask, after
//   the bindings of the same change (`data-state`) have updated the DOM — React runs layout effects after the commit;
//   the `[state]` passive effect waits for the node (React: the child mounts before passive effects run).
// - Server / before the effects run: the state is `mounted` when `present` is true at creation, else `unmounted`.
// - `useStableComposedRefs` / `getElementRef` (React 19 ref plumbing) not needed.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { cssEscape } from "../utils/dom.ts";

export type PresenceState = "mounted" | "unmountSuspended" | "unmounted";
type PresenceEvent = "MOUNT" | "UNMOUNT" | "ANIMATION_OUT" | "ANIMATION_END";

const MACHINE: Record<PresenceState, Partial<Record<PresenceEvent, PresenceState>>> = {
  mounted: { UNMOUNT: "unmounted", ANIMATION_OUT: "unmountSuspended" },
  unmountSuspended: { MOUNT: "mounted", ANIMATION_END: "unmounted" },
  unmounted: { MOUNT: "mounted" },
};

/** Radix `useStateMachine` reducer step: the next state, or the same state for an event it does not handle. */
function send(state: Signal<PresenceState>, event: PresenceEvent): void {
  const next = MACHINE[untrack(state)][event];
  if (next) state.set(next);
}

export interface PresenceOptions {
  /** Whether the part should be present (an accessor). */
  present: () => boolean;
  /** The part's element (a `ref()` signal). */
  node: () => HTMLElement | undefined;
}

/** Radix `usePresence(present).isPresent`. */
export const isPresent = (state: PresenceState): boolean => state === "mounted" || state === "unmountSuspended";

function getAnimationName(styles: CSSStyleDeclaration | null): string {
  return styles?.animationName || "none";
}

/** Radix `usePresence`: the presence state of a part (render it while `isPresent(state())`). */
export function createPresence(options: PresenceOptions): Signal<PresenceState> {
  const initial = untrack(options.present);
  const state = signal<PresenceState>(initial ? "mounted" : "unmounted");
  // Radix refs: stylesRef, prevPresentRef, prevAnimationNameRef, mountAnimationNameRef (plain data: resumes as one object).
  const memo = { prevPresent: initial, prevAnimationName: "none", mountAnimationName: undefined as string | undefined };

  // `[state]` passive effect: the animation name at mount (captured when the node attached) becomes the previous one.
  clientEffect(() => {
    const current = state();
    const node = options.node();
    untrack(() => {
      if (current === "mounted") {
        if (!node) return;
        memo.prevAnimationName = memo.mountAnimationName ?? getAnimationName(getComputedStyle(node));
        memo.mountAnimationName = undefined;
      } else memo.prevAnimationName = "none";
    });
  });

  // `[present]` layout effect.
  clientEffect(() => {
    const present = options.present();
    queueMicrotask(() => {
      const wasPresent = memo.prevPresent;
      if (wasPresent === present) return;
      const node = untrack(options.node);
      const styles = node ? getComputedStyle(node) : null;
      const prevAnimationName = memo.prevAnimationName;
      const currentAnimationName = getAnimationName(styles);
      if (present) {
        memo.mountAnimationName = node ? currentAnimationName : undefined;
        send(state, "MOUNT");
      } else if (currentAnimationName === "none" || styles?.display === "none") {
        // No exit animation or the element is hidden: animations won't run, unmount at once.
        send(state, "UNMOUNT");
      } else {
        // An exit animation started when the animation name changed (there is no `animationrun` event and
        // `animationstart` fires after `animation-delay`).
        const isAnimating = prevAnimationName !== currentAnimationName;
        send(state, wasPresent && isAnimating ? "ANIMATION_OUT" : "UNMOUNT");
      }
      memo.prevPresent = present;
    });
  });

  // Ref callback + `[node]` layout effect: animation listeners on the node.
  clientEffect(() => {
    const node = options.node();
    if (!node) {
      // The node was removed prematurely.
      untrack(() => send(state, "ANIMATION_END"));
      return;
    }
    const styles = getComputedStyle(node);
    memo.mountAnimationName = getAnimationName(styles);
    let timeoutId = 0;
    const ownerWindow = node.ownerDocument.defaultView ?? window;
    // Triggering ANIMATION_OUT during an enter animation fires `animationcancel` for the enter animation after
    // `unmountSuspended`: only the current animation ends the exit.
    const handleAnimationEnd = (event: AnimationEvent) => {
      const currentAnimationName = getAnimationName(styles);
      const isCurrentAnimation = currentAnimationName.includes(cssEscape(event.animationName));
      if (event.target === node && isCurrentAnimation) {
        send(state, "ANIMATION_END");
        if (!memo.prevPresent) {
          // Keep the last keyframe until the node is gone (no flash), then restore the fill mode.
          const currentFillMode = node.style.animationFillMode;
          node.style.animationFillMode = "forwards";
          timeoutId = ownerWindow.setTimeout(() => {
            if (node.style.animationFillMode === "forwards") node.style.animationFillMode = currentFillMode;
          });
        }
      }
    };
    const handleAnimationStart = (event: AnimationEvent) => {
      if (event.target === node) memo.prevAnimationName = getAnimationName(styles);
    };
    node.addEventListener("animationstart", handleAnimationStart);
    node.addEventListener("animationcancel", handleAnimationEnd);
    node.addEventListener("animationend", handleAnimationEnd);
    return () => {
      ownerWindow.clearTimeout(timeoutId);
      node.removeEventListener("animationstart", handleAnimationStart);
      node.removeEventListener("animationcancel", handleAnimationEnd);
      node.removeEventListener("animationend", handleAnimationEnd);
    };
  });

  return state;
}
