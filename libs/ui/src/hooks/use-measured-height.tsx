// `useMeasuredHeight(target)`: accessor of an element's content-box height in px, kept current by a `ResizeObserver`.
// `target` = an element, a Rivet `ref()` / accessor returning one (or null while unattached). `0` on the server, before
// the element exists and where `ResizeObserver` is missing. Client effect: re-runs when an accessor target changes.
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export type MeasuredTarget = Element | null | undefined | (() => Element | null | undefined);

export function useMeasuredHeight(target: MeasuredTarget): () => number {
  const height = signal(0);
  clientEffect(() => {
    const el = typeof target === "function" ? target() : target;
    if (!el) return;
    height.set(el.getBoundingClientRect().height);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) height.set(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  });
  return height;
}
