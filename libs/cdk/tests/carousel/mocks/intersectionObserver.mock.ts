// Ported from embla-carousel (packages/embla-carousel/src/__tests__/mocks/intersectionObserver.mock.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Jest globals from `@rivetjs/testing/jest`; defined on `globalThis` too (happy-dom's window is not the global
// object; the engine calls `new IntersectionObserver` as a global); `function` mock implementation (Vitest mocks called with `new`
// need a constructible implementation).
import { jest } from "@rivetjs/testing/jest";

for (const target of [window, globalThis])
  Object.defineProperty(target, "IntersectionObserver", {
    writable: true,
    value: jest.fn().mockImplementation(function () {
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
    }),
  });
