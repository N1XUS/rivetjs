// Jasmine globals for suites ported from Angular Components, on Vitest: spies (`jasmine.createSpy`,
// `spyOn` with `.and` strategies and `.calls` tracking) are `vi.fn` mocks underneath, so Vitest's
// `toHaveBeenCalled*` matchers work on them; spies stub (return undefined) until an `.and` strategy
// says otherwise, as in Jasmine; `jasmine.clock()` drives Vitest's fake timers; the Jasmine-only
// matchers (`toBeTrue`, `toHaveBeenCalledOnceWith`, `toHaveSize`, …) are added to `expect`
// (`toHaveBeenCalledBefore` is native in Vitest). `toHaveClass` is jest-dom's (a superset of
// Jasmine's), registered here too, so the result never depends on import order.
import { expect, vi, type Mock } from "vitest";
import { toHaveClass } from "@testing-library/jest-dom/matchers";

export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

type Fn = (...args: any[]) => any;

export interface CallInfo {
  object: unknown;
  args: any[];
  returnValue: unknown;
}

export interface Calls {
  any(): boolean;
  count(): number;
  argsFor(index: number): any[];
  allArgs(): any[][];
  all(): CallInfo[];
  mostRecent(): CallInfo;
  first(): CallInfo;
  reset(): void;
}

export interface SpyStrategy<T extends Fn = Fn> {
  callThrough(): Spy<T>;
  returnValue(value: ReturnType<T>): Spy<T>;
  returnValues(...values: ReturnType<T>[]): Spy<T>;
  callFake(fn: T): Spy<T>;
  throwError(error: unknown): Spy<T>;
  stub(): Spy<T>;
}

export type Spy<T extends Fn = Fn> = Mock<T> & { and: SpyStrategy<T>; calls: Calls; withArgs(...args: unknown[]): never };

function decorate<T extends Fn>(mock: Mock<T>, original?: T): Spy<T> {
  const spy = mock as Spy<T>;
  const self = (): Spy<T> => spy;
  spy.and = {
    callThrough: () => (original ? spy.mockImplementation(original as never) : spy.mockImplementation((() => undefined) as never), self()),
    returnValue: (value) => (spy.mockImplementation((() => value) as never), self()),
    returnValues: (...values) => {
      let i = 0;
      spy.mockImplementation((() => values[i++]) as never);
      return self();
    },
    callFake: (fn) => (spy.mockImplementation(fn as never), self()),
    throwError: (error) => (
      spy.mockImplementation((() => {
        throw typeof error === "string" ? new Error(error) : error;
      }) as never),
      self()
    ),
    stub: () => (spy.mockImplementation((() => undefined) as never), self()),
  };
  const info = (i: number): CallInfo => ({ object: spy.mock.contexts[i], args: spy.mock.calls[i] as any[], returnValue: spy.mock.results[i]?.value });
  spy.calls = {
    any: () => spy.mock.calls.length > 0,
    count: () => spy.mock.calls.length,
    argsFor: (i) => spy.mock.calls[i] as any[],
    allArgs: () => spy.mock.calls as any[][],
    all: () => spy.mock.calls.map((_, i) => info(i)),
    mostRecent: () => info(spy.mock.calls.length - 1),
    first: () => info(0),
    reset: () => void spy.mockClear(),
  };
  spy.withArgs = () => {
    throw new Error("jasmine withArgs is not supported; use and.callFake");
  };
  return spy;
}

/** Jasmine `spyOn(object, method)`: replaces the method with a stub spy (`.and.callThrough()` to call it). */
export function spyOn<T extends object, K extends keyof T>(object: T, method: K): Spy<T[K] extends Fn ? T[K] : Fn> {
  const original = object[method] as unknown as Fn;
  const mock = vi.spyOn(object as any, method as any).mockImplementation(() => undefined);
  return decorate(mock as any, original as any) as any;
}

/** Jasmine `spyOnProperty(object, property, accessType)`: replaces the accessor with a stub spy (`.and.callThrough()` to call it). */
export function spyOnProperty<T extends object>(object: T, property: keyof T, accessType: "get" | "set" = "get"): Spy {
  const descriptor = Object.getOwnPropertyDescriptor(object, property) ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(object), property);
  const original = (accessType === "get" ? descriptor?.get : descriptor?.set) as Fn | undefined;
  const mock = (vi.spyOn(object as any, property as any, accessType as any) as unknown as Mock).mockImplementation(() => undefined);
  return decorate(mock as any, original);
}

let clockInstalled = false;
const clock = {
  install() {
    vi.useFakeTimers();
    clockInstalled = true;
    return clock;
  },
  uninstall() {
    if (clockInstalled) vi.useRealTimers();
    clockInstalled = false;
  },
  tick(ms = 0) {
    vi.advanceTimersByTime(ms);
  },
  mockDate(date: Date = new Date()) {
    vi.setSystemTime(date);
  },
  withMock(fn: () => void) {
    clock.install();
    try {
      fn();
    } finally {
      clock.uninstall();
    }
  },
};

export const jasmine = {
  /** A stub spy (returns undefined); `original` only backs `.and.callThrough()`, as in Jasmine. */
  createSpy<T extends Fn = Fn>(_name?: string, original?: T): Spy<T> {
    return decorate(vi.fn() as unknown as Mock<T>, original);
  },
  createSpyObj<T = any>(baseName: string | string[] | Record<string, unknown>, methods?: string[] | Record<string, unknown>): T {
    const spec = typeof baseName === "string" ? methods : baseName;
    const object: Record<string, Spy> = {};
    if (Array.isArray(spec)) for (const name of spec) object[name] = jasmine.createSpy(name);
    else for (const [name, value] of Object.entries(spec ?? {})) object[name] = jasmine.createSpy(name).and.returnValue(value);
    return object as T;
  },
  any: (type: unknown) => expect.any(type),
  anything: () => expect.anything(),
  objectContaining: <T>(shape: T) => expect.objectContaining(shape as object),
  arrayContaining: <T>(items: T[]) => expect.arrayContaining(items as unknown[]),
  stringMatching: (pattern: string | RegExp) => expect.stringMatching(pattern),
  stringContaining: (text: string) => expect.stringContaining(text),
  clock: () => clock,
};

const message = (pass: boolean, what: string) => () => (pass ? `expected value not ${what}` : `expected value ${what}`);
expect.extend({
  toBeTrue: (received: unknown) => ({ pass: received === true, message: message(received === true, "to be true") }),
  toBeFalse: (received: unknown) => ({ pass: received === false, message: message(received === false, "to be false") }),
  toHaveSize(received: { length?: number; size?: number }, size: number) {
    const actual = received?.size ?? received?.length ?? Object.keys(received ?? {}).length;
    return { pass: actual === size, message: message(actual === size, `to have size ${size} (got ${actual})`) };
  },
  toHaveClass: toHaveClass as never,
  toHaveBeenCalledOnceWith(this: { equals(a: unknown, b: unknown): boolean }, received: Mock, ...args: unknown[]) {
    const calls = received.mock.calls;
    const pass = calls.length === 1 && this.equals(calls[0], args);
    return { pass, message: message(pass, `to have been called once with ${JSON.stringify(args)} (calls: ${JSON.stringify(calls)})`) };
  },
  toBePositiveInfinity: (received: unknown) => ({ pass: received === Infinity, message: message(received === Infinity, "to be Infinity") }),
  toBeNegativeInfinity: (received: unknown) => ({ pass: received === -Infinity, message: message(received === -Infinity, "to be -Infinity") }),
});

declare module "vitest" {
  interface Matchers<R, T> {
    toBeTrue(): R;
    toBeFalse(): R;
    toHaveSize(size: number): R;
    toHaveClass(...classNames: (string | RegExp | { exact?: boolean } | undefined)[]): R;
    toHaveBeenCalledOnceWith(...args: unknown[]): R;
    toBePositiveInfinity(): R;
    toBeNegativeInfinity(): R;
  }
}
