import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

// Module scope: the analytics code becomes its own chunk, loaded only when the effect runs.
const loadAnalytics = () => import("../analytics.ts");

// #region demo
/** Sends a page view when the browser is idle, and again after each client navigation. */
export function PageViews({ url }: { url: () => URL }) {
  // Only for this demo: show what was sent. A real component can render nothing.
  const sent = signal<string[]>([]);
  clientEffect(
    async () => {
      // Read the URL before any `await`: that makes the effect run again when it changes.
      const path = url().pathname;
      const { pageView } = await loadAnalytics();
      sent.set(pageView(path));
    },
    { when: "idle" },
  );
  return (
    <p id="views" class="mt-6 text-sm text-slate-600">
      Page views sent: {sent().length} {sent().length ? "(" + sent().join(", ") + ")" : ""}
    </p>
  );
}
// #endregion
