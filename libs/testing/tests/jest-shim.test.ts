// `@rivetjs/testing/jest`: `jest` is `vi`, except the hoisted module-mock calls, which would run after
// the imports on Vitest and silently mock nothing (round-2 review TK6).
import { expect, test, vi } from "vitest";
import { jest } from "@rivetjs/testing/jest";

test("jest.mock / jest.unmock throw and name the vi.* call to write", () => {
  expect(() => jest.mock("./module.ts")).toThrow(/jest\.mock\("\.\/module\.ts"\) is not hoisted on Vitest.*vi\.mock\("\.\/module\.ts", …\)/);
  expect(() => jest.unmock("./module.ts")).toThrow(/vi\.unmock/);
});

test("everything else is vi: fn, spyOn, fake timers, doMock", () => {
  const fn = jest.fn(() => 1);
  expect(fn()).toBe(1);
  expect(fn).toHaveBeenCalledOnce();
  expect(jest.isMockFunction(fn)).toBe(true);
  jest.useFakeTimers();
  try {
    let fired = false;
    setTimeout(() => (fired = true), 10);
    jest.advanceTimersByTime(10);
    expect(fired).toBe(true);
  } finally {
    jest.useRealTimers();
  }
  expect(jest.doMock).toBe(vi.doMock);
});
