// Ported from embla-carousel (packages/embla-carousel/src/__tests__/mocks/matchMedia.mock.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Jest globals from `@rivetjs/testing/jest`, module specifiers; defined on `globalThis` too (happy-dom's window is not the global object; the engine calls `new IntersectionObserver` / `new ResizeObserver` as globals).
import { jest } from "@rivetjs/testing/jest";
for (const target of [window, globalThis])
  Object.defineProperty(target, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: matchingMediaQueries.includes(query),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });

let matchingMediaQueries: string[] = [];

export function setMatchingMediaQuery(queries: string | string[]): void {
  matchingMediaQueries = Array.isArray(queries) ? queries : [queries];
}

export function resetMatchingMediaQuery(): void {
  matchingMediaQueries = [];
}
