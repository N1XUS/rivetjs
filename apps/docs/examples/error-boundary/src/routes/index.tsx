import { signal } from "@rivetjs/reactivity";
import { ErrorBoundary } from "@rivetjs/runtime/dom";

export const head = { title: "Error boundary" };

// #region demo
export default function Shop() {
  // Bad data from the start: the first render of the label throws.
  const stock = signal(-1);
  const visits = signal(0);
  const label = (n: number) => {
    if (n < 0) throw new Error("Stock cannot go below zero");
    return `${n} in stock`;
  };
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ErrorBoundary
        fallback={(error, reset) => (
          <div class="rounded border border-red-300 bg-red-50 p-3">
            <p id="problem">{error instanceof Error ? error.message : "Something went wrong"}</p>
            <button
              id="retry"
              type="button"
              class="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1"
              onClick={() => {
                stock.set(2);
                reset();
              }}
            >
              Try again
            </button>
          </div>
        )}
      >
        <div class="flex items-center gap-3">
          <span id="stock">{label(stock())}</span>
          <button id="sell" type="button" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={() => stock.update((n) => n - 1)}>
            Sell one
          </button>
        </div>
      </ErrorBoundary>
      {/* Outside the boundary: not affected by the failure. */}
      <button id="visits" type="button" class="justify-self-start rounded-md border border-slate-300 px-3 py-1" onClick={() => visits.update((n) => n + 1)}>
        Page still works: {visits()}
      </button>
    </div>
  );
}
// #endregion
