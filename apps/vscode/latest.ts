// Last-wins guard for async refreshes (no `vscode` import: unit-tested on its own).

/**
 * `begin()` starts a run and returns its `current()` check: true until a later `begin()`. An async answer that
 * arrives after a newer run started is stale and must not be applied.
 */
export function lastWins(): { begin(): () => boolean } {
  let generation = 0;
  return {
    begin() {
      const run = ++generation;
      return () => run === generation;
    },
  };
}
