// Test helpers for the react-stately data hook suites (`useListData`, `useTreeData`, `useAsyncList`):
// `renderHook` / `act` over the Rivet factories. `result.current` is a fresh snapshot with the
// reactive members read (`items()`, `selectedKeys()`, …) — what a React re-render would hand back —
// and the methods as is.
const REACTIVE = new Set(["items", "selectedKeys", "filterText", "isLoading", "loadingState", "error", "sortDescriptor"]);

function snapshot<R extends object>(value: R): any {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const member = (value as Record<string, unknown>)[key];
    out[key] = REACTIVE.has(key) && typeof member === "function" ? (member as () => unknown)() : member;
  }
  return out;
}

/** Calls the factory once; `result.current` reads its state now. */
export function renderHook<R extends object>(create: () => R): { result: { readonly current: any } } {
  const value = create();
  return {
    result: {
      get current() {
        return snapshot(value);
      },
    },
  };
}

/** Runs `fn`, awaits it, then lets pending promise reactions (resolved loads) settle — like React's async act. */
export function act(fn: () => unknown): any {
  const result = fn();
  if (result && typeof (result as Promise<unknown>).then === "function")
    return (async () => {
      await result;
      for (let i = 0; i < 20; i++) await Promise.resolve();
    })();
  return undefined;
}
