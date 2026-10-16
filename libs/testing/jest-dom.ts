// `@testing-library/jest-dom` matchers on Vitest's `expect` (import once, e.g. from a setup file).
// Registered by hand rather than via `@testing-library/jest-dom/vitest`: that entry's typings augment
// `Assertion<T>`, which no longer matches Vitest 5's `Assertion<R, T>`; `Matchers<R, T>` is the
// supported extension point.
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);

declare module "vitest" {
  interface Matchers<R, T> extends TestingLibraryMatchers<any, R> {}
}
