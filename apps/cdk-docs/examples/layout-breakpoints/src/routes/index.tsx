import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { Breakpoints, breakpointObserver, breakpointState } from "@rivetjs/cdk/layout";

export const head = { title: "breakpointState()" };

// #region demo
export default function Layout() {
  const queries = ["(min-width: 1px)", Breakpoints.XLarge];
  // Server and first paint: built from `initial` (mobile-first: nothing matches).
  const { state } = breakpointState(queries, { initial: false });
  // In the browser: the real state now, then every change. The effect captures only the signal and
  // the queries (`connect()` itself is a run-time function a resumed page cannot capture).
  clientEffect(() => {
    const subscription = breakpointObserver()
      .observe(queries)
      .subscribe((next) => state.set(next));
    return () => subscription.unsubscribe();
  });

  const checked = signal("");
  return (
    <section class="m-4 grid max-w-lg gap-2 text-sm">
      <p id="matches">Any query matches: {String(state().matches)}</p>
      <ul id="queries" class="font-mono text-xs">
        {Object.entries(state().breakpoints).map(([query, on]) => (
          <li data-on={on ? "" : undefined} class="text-slate-400 data-[on]:text-teal-800">
            {query}: {String(on)}
          </li>
        ))}
      </ul>
      <button
        id="check"
        type="button"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={() =>
          checked.set(
            `isMatched(Handset): ${breakpointObserver().isMatched(Breakpoints.Handset)}; isMatched("(max-width: 1px)"): ${breakpointObserver().isMatched("(max-width: 1px)")}`,
          )
        }
      >
        isMatched() now
      </button>
      <p id="checked">{checked()}</p>
    </section>
  );
}
// #endregion
