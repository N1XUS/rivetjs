// Rivet's `act` for the ported react-aria testers (React: `React.act`). Rivet applies updates
// synchronously inside event handlers, so a sync callback needs no wrapping; an async one is awaited,
// then queued work settles through `flush()` from `@rivetjs/runtime/testing`: every microtask chain
// (`clientEffect`, Async commits however many awaits deep) plus task turns. It never waits on a faked
// clock, so it also works under fake timers. A sync callback's trusted mouse clicks (DOM flush deferred one
// task, `_dispatch`) are settled before `act` returns.
import { _settle } from "@rivetjs/reactivity";
import { flush } from "@rivetjs/runtime/testing";

export function act<T>(fn: () => T): T {
  const result = fn();
  if (result && typeof (result as { then?: unknown }).then === "function")
    return (async () => {
      const value = await result;
      await flush();
      return value;
    })() as T;
  _settle();
  return result;
}
