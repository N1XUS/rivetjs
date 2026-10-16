// Jest globals for suites ported from react-spectrum, on Vitest: the same `expect` (Jest-compatible,
// asymmetric matchers, `toEqual` ignoring undefined properties), `it.each` tables, and `jest` = `vi`
// (`fn`, `spyOn`, `restoreAllMocks`, fake timers: `useFakeTimers`, `advanceTimersByTime`, `runAllTimers`).
// Hoisted module mocking is the exception: Vitest hoists only literal `vi.mock(…)` / `vi.unmock(…)`
// calls, so `jest.mock` / `jest.unmock` would run after the imports and silently mock nothing — they
// throw and name the `vi.*` call to write instead (`jest.doMock` / `jest.doUnmock` are not hoisted in
// Jest either and map to `vi.doMock` / `vi.doUnmock`).
// DOM matchers (`toHaveAttribute`, `toBeInTheDocument`, …) come from `@rivetjs/testing/jest-dom`.
import { vi } from "vitest";

export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from "vitest";
export type { Mock, MockInstance } from "vitest";

const unhoisted =
  (name: string) =>
  (path: unknown): never => {
    throw new Error(
      `jest.${name}(${JSON.stringify(path)}) is not hoisted on Vitest and would affect nothing: write vi.${name}(${JSON.stringify(path)}, …) at the top level of the test file (Vitest hoists literal vi.${name} calls above the imports).`,
    );
  };

export const jest: typeof vi = Object.assign(Object.create(vi) as typeof vi, {
  mock: unhoisted("mock"),
  unmock: unhoisted("unmock"),
});
