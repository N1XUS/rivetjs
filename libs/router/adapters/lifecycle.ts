// Lifecycle hooks shared by the node and uWS adapters (`serve({ ready, onClose })`, backend plan T4): the readiness
// endpoint's cached `ready` answer and the `onClose` hook bounded by the close budget (`grace`). Loaded with the
// adapters; nothing runs unless the options are set.

/** Readiness state: see `readinessOf`. */
export interface Readiness {
  known(): boolean | undefined;
  check(): Promise<boolean>;
}

/**
 * `ready` hook state for the readiness endpoint: `known()` = the cached answer when under 1 s old, `check()` = ask the
 * hook (one call in flight at a time) and cache its answer; a throw or rejection is "not ready", reported to `onError`.
 */
export function readinessOf(ready: () => boolean | Promise<boolean>, onError: (error: unknown) => void): Readiness {
  let answer = false,
    at = -Infinity,
    running: Promise<boolean> | null = null;
  const settle = (ok: boolean) => {
    answer = ok;
    at = performance.now();
    running = null;
    return ok;
  };
  return {
    known: () => (performance.now() - at < 1_000 ? answer : undefined),
    check: () =>
      (running ??= (async () => {
        try {
          // Called a microtask later: a synchronous throw must settle after `running` holds this call.
          return settle((await Promise.resolve().then(ready)) === true);
        } catch (error) {
          try {
            onError(error);
          } catch (failure) {
            console.error(failure);
          }
          return settle(false);
        }
      })()),
  };
}

/**
 * `onClose` hook inside the close budget: resolves when `hook` does before `deadline` (a `performance.now()` time),
 * rejects with its error, or with a timeout error past the deadline.
 */
export function closeHook(hook: () => Promise<void>, deadline: number, grace: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new Error(`onClose did not finish within grace (${grace} ms)`)), Math.max(0, deadline - performance.now()));
    timer.unref();
  });
  return Promise.race([Promise.resolve().then(hook), late]).finally(() => clearTimeout(timer));
}
