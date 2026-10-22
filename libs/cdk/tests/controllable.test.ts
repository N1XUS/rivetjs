// Ported from react-stately `useControlledState.test.tsx` (packages/react-stately/test/utils/useControlledState.test.tsx),
// Apache-2.0, © Adobe. Rivet: `controllable(value, defaultValue, onChange)` returns plain state; `act(() =>
// setValue(x))` → `setControlledValue(state, x)`; "rerender with a new prop" → a new `controllable(...)` (a
// changed prop re-creates the component). Skipped: the four Suspense / `useTransition` cases (no React
// render aborts in Rivet) and the controlled ⇄ uncontrolled switch warnings (cannot happen: replaced by the
// DEV controlled-without-onChange warning, tested below).
import { describe, expect, test, vi, afterEach } from "vitest";
import { effect, signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue } from "../interactions/controllable.ts";

const flush = () => new Promise<void>((r) => queueMicrotask(r));

describe("useControlledState tests", () => {
  test("can handle default setValue behavior, wont invoke onChange for the same value twice in a row", async () => {
    const onChangeSpy = vi.fn();
    const state = controllable<string>(undefined, "defaultValue", onChangeSpy);
    expect(state.value()).toBe("defaultValue");
    expect(onChangeSpy).not.toHaveBeenCalled();
    setControlledValue(state, "newValue");
    await flush();
    expect(state.value()).toBe("newValue");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue");
    setControlledValue(state, "newValue2");
    await flush();
    expect(state.value()).toBe("newValue2");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue2");
    onChangeSpy.mockClear();
    setControlledValue(state, "newValue2");
    await flush();
    expect(state.value()).toBe("newValue2");
    expect(onChangeSpy).not.toHaveBeenCalled();
    setControlledValue(state, "newValue");
    expect(state.value()).toBe("newValue");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue");
  });

  test("using NaN will only trigger onChange once", () => {
    const onChangeSpy = vi.fn();
    const state = controllable<number | null>(undefined, null, onChangeSpy);
    expect(state.value()).toBe(null);
    setControlledValue(state, NaN);
    expect(state.value()).toBe(NaN);
    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).toHaveBeenLastCalledWith(NaN);
    setControlledValue(state, NaN);
    expect(state.value()).toBe(NaN);
    expect(onChangeSpy).toHaveBeenCalledTimes(1);
  });

  test("can handle callback setValue behavior", () => {
    const onChangeSpy = vi.fn();
    const state = controllable<string>(undefined, "defaultValue", onChangeSpy);
    setControlledValue(state, (prevValue) => {
      expect(prevValue).toBe("defaultValue");
      return "newValue";
    });
    expect(state.value()).toBe("newValue");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue");
  });

  test("does not trigger too many renders", () => {
    // Rivet: a binding reading the value re-runs once per change (React: one render per state change).
    const parent = signal(5);
    const state = controllable(parent, 0, (v: number) => parent.set(v));
    const renderSpy = vi.fn();
    const stop = effect(() => renderSpy(state.value()));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    setControlledValue(state, state.value() + 1);
    expect(parent()).toBe(6);
    expect(renderSpy).toHaveBeenCalledTimes(2);
    stop?.();
  });

  test("can handle controlled setValue behavior", async () => {
    const onChangeSpy = vi.fn();
    const state = controllable<string>("controlledValue", "defaultValue", onChangeSpy);
    expect(state.value()).toBe("controlledValue");
    expect(onChangeSpy).not.toHaveBeenCalled();
    setControlledValue(state, "newValue");
    await flush(); // upstream: the forced re-render resets valueRef
    expect(state.value()).toBe("controlledValue");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue");
    onChangeSpy.mockClear();
    setControlledValue(state, "controlledValue");
    expect(state.value()).toBe("controlledValue");
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  test("can handle controlled callback setValue behavior", async () => {
    const onChangeSpy = vi.fn();
    const state = controllable("controlledValue", "defaultValue", onChangeSpy);
    setControlledValue(state, (prevValue) => {
      expect(prevValue).toBe("controlledValue");
      return "newValue";
    });
    await flush();
    expect(state.value()).toBe("controlledValue");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue");
    onChangeSpy.mockClear();
    setControlledValue(state, (prevValue) => {
      expect(prevValue).toBe("controlledValue");
      return "controlledValue";
    });
    expect(state.value()).toBe("controlledValue");
    expect(onChangeSpy).not.toHaveBeenCalled();
  });

  test("can handle controlled callback setValue behavior called multiple times within a single act", () => {
    const onChangeSpy = vi.fn();
    const val = signal("controlledValue");
    // Rivet: the caller's state is the Signal; onChange observes.
    const state = controllable(val, "defaultValue", (newval: string) => onChangeSpy(newval));
    setControlledValue(state, (prevValue) => prevValue + "-newValue");
    setControlledValue(state, (prevValue) => prevValue + "-wombat");
    expect(controlledValue(state)).toBe("controlledValue-newValue-wombat");
    expect(val()).toBe("controlledValue-newValue-wombat");
    expect(onChangeSpy).toHaveBeenCalledTimes(2);
    expect(onChangeSpy).toHaveBeenNthCalledWith(1, "controlledValue-newValue");
    expect(onChangeSpy).toHaveBeenNthCalledWith(2, "controlledValue-newValue-wombat");
  });

  test("plain controlled value: several calls in one task chain on the pending value (upstream valueRef)", async () => {
    const onChangeSpy = vi.fn();
    const state = controllable("a", "d", onChangeSpy);
    setControlledValue(state, (p) => p + "b");
    setControlledValue(state, (p) => p + "c");
    expect(onChangeSpy).toHaveBeenNthCalledWith(1, "ab");
    expect(onChangeSpy).toHaveBeenNthCalledWith(2, "abc");
    expect(state.value()).toBe("a");
    await flush();
    expect(controlledValue(state)).toBe("a");
  });

  test("can handle controlled callback setValue behavior after prop change", async () => {
    const onChangeSpy = vi.fn();
    controllable("controlledValue", "defaultValue", onChangeSpy);
    // Prop change: Rivet re-creates the component with the new value.
    const state = controllable("updated", "defaultValue", onChangeSpy);
    setControlledValue(state, (prevValue) => {
      expect(prevValue).toBe("updated");
      return "newValue";
    });
    await flush();
    expect(state.value()).toBe("updated");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue");
    onChangeSpy.mockClear();
    setControlledValue(state, (prevValue) => {
      expect(prevValue).toBe("updated");
      return "newValue";
    });
    await flush();
    expect(state.value()).toBe("updated");
    expect(onChangeSpy).toHaveBeenLastCalledWith("newValue");
    onChangeSpy.mockClear();
    setControlledValue(state, (prevValue) => {
      expect(prevValue).toBe("updated");
      return "updated";
    });
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});

describe("controllable (Rivet)", () => {
  const env = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = env;
    vi.restoreAllMocks();
  });

  test("Signal value is two-way: setting writes the caller's signal and calls onChange", () => {
    const external = signal(1);
    const onChange = vi.fn();
    const state = controllable(external, 0, onChange);
    expect(state.isControlled && state.isSignal).toBe(true);
    setControlledValue(state, 2, "extra");
    expect(external()).toBe(2);
    expect(state.value()).toBe(2);
    expect(onChange).toHaveBeenCalledWith(2, "extra");
  });

  test("falsy controlled values stay controlled (only undefined is uncontrolled)", () => {
    const state = controllable<boolean>(false, true, () => {});
    expect(state.isControlled).toBe(true);
    expect(state.value()).toBe(false);
    setControlledValue(state, true);
    expect(state.value()).toBe(false);
  });

  test("DEV: warns once for a plain controlled value without onChange; not for a Signal or with onChange", () => {
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    controllable("x", "d", undefined);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/controlled value but no onChange/);
    controllable(signal("x"), "d", undefined);
    controllable("x", "d", () => {});
    controllable(undefined, "d", undefined);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("deprecated two-argument form returns the signal (caller's or a new one)", () => {
    const external = signal(3);
    expect(controllable(external, 0)).toBe(external);
    const own = controllable<number>(undefined, 7);
    expect(own()).toBe(7);
  });

  test("accessor value (plain function): controlled, read live, never written; setting only calls onChange", () => {
    const source = signal("a");
    const onChange = vi.fn();
    const state = controllable(() => source(), "d", onChange);
    expect(state.isControlled).toBe(true);
    expect(state.isAccessor).toBe(true);
    expect(state.isSignal).toBe(false);
    expect(state.value()).toBe("a");
    source.set("b");
    expect(state.value()).toBe("b");
    setControlledValue(state, "c", "extra");
    expect(onChange).toHaveBeenCalledWith("c", "extra");
    expect(source()).toBe("b");
    expect(state.value()).toBe("b");
  });

  test("accessor value is tracked by effects", () => {
    const source = signal(1);
    const state = controllable(
      () => source() * 10,
      0,
      () => {},
    );
    const seen: number[] = [];
    const dispose = effect(() => void seen.push(state.value()));
    source.set(2);
    dispose();
    expect(seen).toEqual([10, 20]);
  });

  test("function-typed T: wrap the value (`() => fn`)", () => {
    const fn = (x: number) => x + 1;
    const state = controllable<(x: number) => number>(
      () => fn,
      (x) => x,
      () => {},
    );
    expect(state.value()).toBe(fn);
  });
});
