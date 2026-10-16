export interface TestExecutorSchema {
  /** Vitest config file, relative to the project (default: Vitest's lookup, `vitest.config.ts`). */
  config?: string;
  /** Watch mode (`vitest` instead of `vitest run`). Default false. */
  watch?: boolean;
  /** Collect coverage (`--coverage`, output `coverage/`). */
  coverage?: boolean;
  /** Worker cap (`--maxWorkers`). */
  maxWorkers?: number | string;
  /** Succeed when no test file matches. Default true. */
  passWithNoTests?: boolean;
  /** Update snapshots (`-u`). */
  update?: boolean;
  /** Vitest projects to run (`--project`, e.g. `dom`, `server`). */
  project?: string[];
  /** Test file filters (positional). */
  testFiles?: string[];
  /** Test name pattern (`-t`). */
  testNamePattern?: string;
  /** Vitest reporter(s). */
  reporters?: string[];
  /** Extra environment variables. */
  env?: Record<string, string>;
}
