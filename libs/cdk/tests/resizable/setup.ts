// Ported from react-resizable-panels (vitest.setup.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: imported by each test of this suite (the cdk-browser project has no per-folder setupFiles); React's
// `cleanup` + jest-dom dropped (no React trees here); `vitest-fail-on-console` (`shouldFailOnError`) as an
// `afterEach` check on a `console.error` spy.
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { resetMockGroupIdCounter } from "./global/test/mockGroup.ts";
import { mockBoundingClientRect, unmockBoundingClientRect } from "./utils/test/mockBoundingClientRect.ts";
import { mockGetComputedStyle, unmockGetComputedStyle } from "./utils/test/mockGetComputedStyle.ts";
import { mockResizeObserver, unmockResizeObserver } from "./utils/test/mockResizeObserver.ts";

declare module "vitest" {
  interface Matchers<R, T> {
    toLogError: (expectedError: string) => R;
  }
}

const PROTOTYPE_PROPS = ["clientHeight", "clientWidth", "offsetHeight", "offsetWidth"];

expect.addSnapshotSerializer({
  serialize(value) {
    const rect = value as DOMRect;
    return `${rect.x}, ${rect.y} (${rect.width} x ${rect.height})`;
  },
  test(value) {
    return value !== null && typeof value === "object" && "x" in value && "y" in value && "width" in value && "height" in value;
  },
});

expect.extend({
  toLogError: (callback: () => unknown, expectedError: string) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    callback();
    expect(console.error).toHaveBeenCalledWith(expectedError);
    spy.mockRestore();
    return { pass: true, message: () => "" };
  },
});

const saved = new Map<string, PropertyDescriptor | undefined>();
let errors: unknown[][] = [];
const originalError = console.error;

beforeAll(() => {
  PROTOTYPE_PROPS.forEach((propertyKey) => {
    saved.set(propertyKey, Object.getOwnPropertyDescriptor(HTMLElement.prototype, propertyKey));
    Object.defineProperty(HTMLElement.prototype, propertyKey, { configurable: true, value: 0 });
  });
  vi.spyOn(console, "warn").mockImplementation(() => {
    throw Error("Unexpected console warning");
  });
});

afterAll(() => {
  PROTOTYPE_PROPS.forEach((propertyKey) => {
    delete HTMLElement.prototype[propertyKey as keyof typeof HTMLElement.prototype];
    const descriptor = saved.get(propertyKey);
    if (descriptor) Object.defineProperty(HTMLElement.prototype, propertyKey, descriptor);
  });
  vi.restoreAllMocks();
});

beforeEach(() => {
  errors = [];
  console.error = (...args: unknown[]) => void errors.push(args);
  mockBoundingClientRect();
  mockGetComputedStyle();
  mockResizeObserver();
});

afterEach(() => {
  console.error = originalError;
  document.body.textContent = "";
  resetMockGroupIdCounter();
  unmockBoundingClientRect();
  unmockGetComputedStyle();
  unmockResizeObserver();
  expect(errors, "console.error calls").toEqual([]);
});
