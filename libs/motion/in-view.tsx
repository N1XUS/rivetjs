// @rivetjs/motion/in-view (spec D14): `createInView(ref, { once, margin, amount, root })` → accessor, on Motion's
// `inView` (IntersectionObserver). `false` on the server and until the element is first observed in view; attached in
// a `clientEffect` (`when: "visible"`: a resumed page attaches when the component's DOM nears the viewport).
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { inView } from "motion";

export interface InViewOptions {
  /** Stay `true` after the first entry (the observer stops). */
  once?: boolean;
  /** `rootMargin` (`"0px 0px -100px 0px"`). */
  margin?: string;
  /** Visible fraction that counts: `"some"` (default), `"all"` or 0–1. */
  amount?: "some" | "all" | number;
  /** Scroll container (default: the viewport). */
  root?: Element | (() => Element | null | undefined);
}

/** Whether `target` is in view. */
export function createInView(target: () => Element | null | undefined, options: InViewOptions = {}): () => boolean {
  const value = signal(false);
  clientEffect(
    () => {
      const el = target();
      if (!el) return;
      const root = typeof options.root === "function" ? options.root() : options.root;
      return inView(
        el,
        () => {
          value.set(true);
          return options.once ? undefined : () => value.set(false);
        },
        { root: root ?? undefined, margin: options.margin as never, amount: options.amount },
      );
    },
    { when: "visible" },
  );
  return () => value();
}
