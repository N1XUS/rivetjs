// Sequential subtests inside one Vitest test (node:test's `await t.test(name, fn)`): each step runs
// in order against the shared state the test built; a failing step is recorded and the next ones
// still run; the test fails at the end with every failed step.
export interface Steps {
  /** Run one named step; resolves even when it fails (like `await t.test`). */
  test(name: string, fn: () => unknown): Promise<void>;
  /** `skip`: a truthy value (or reason string) skips the step, like node:test's option. */
  test(name: string, options: { skip?: boolean | string }, fn: () => unknown): Promise<void>;
}

export function steps(body: (t: Steps) => Promise<unknown> | unknown): () => Promise<void> {
  return async () => {
    const failures: Error[] = [];
    const t: Steps = {
      async test(name: string, ...rest: [() => unknown] | [{ skip?: boolean | string }, () => unknown]) {
        const [options, fn] = rest.length === 1 ? [{}, rest[0]] : rest;
        if (options.skip) return;
        try {
          await fn();
        } catch (error) {
          const wrapped = new Error(`step "${name}" failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
          if (error instanceof Error && error.stack) wrapped.stack = `${wrapped.message}\n${error.stack.split("\n").slice(1).join("\n")}`;
          failures.push(wrapped);
        }
      },
    };
    await body(t);
    if (failures.length === 1) throw failures[0];
    if (failures.length) throw new AggregateError(failures, failures.map((f) => f.message).join("\n"));
  };
}
