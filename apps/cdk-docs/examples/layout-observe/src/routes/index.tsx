import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { createBreakpointObserver, type BreakpointState } from "@rivetjs/cdk/layout";

export const head = { title: "BreakpointObserver.observe()" };

// #region demo
export default function Observe() {
  const emissions = signal<string[]>([]);
  clientEffect(() => {
    // Angular BreakpointObserver: the current state on subscribe, then one emission per batch of changes.
    const observer = createBreakpointObserver();
    const subscription = observer.observe(["(max-width: 400px)", "(min-width: 401px)"]).subscribe((state: BreakpointState) => {
      emissions.update((list) => [
        ...list,
        Object.entries(state.breakpoints)
          .map(([q, on]) => `${q}=${on}`)
          .join(" "),
      ]);
    });
    return () => {
      subscription.unsubscribe();
      observer.destroy();
    };
  });
  return (
    <section class="m-4 grid gap-2 text-sm">
      <p id="count">Emissions: {emissions().length}</p>
      <ol id="emissions" class="list-decimal ps-6 font-mono text-xs">
        {emissions().map((line) => (
          <li>{line}</li>
        ))}
      </ol>
      <p class="text-slate-500">Resize the window across 400px to see a new emission.</p>
    </section>
  );
}
// #endregion
